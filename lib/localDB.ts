import { supabase } from './supabase';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de validade mínima de cache
const STATIC_COLLECTIONS = new Set(['categories', 'cards', 'budgets', 'profiles']);

const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const convertKeysToSnakeCase = (obj: any) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  const newObj: any = {};
  for (const key in obj) {
    newObj[toSnakeCase(key)] = obj[key];
  }
  return newObj;
};

const convertKeysToCamelCase = (obj: any) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  const newObj: any = {};
  for (const key in obj) {
    newObj[toCamelCase(key)] = obj[key];
  }
  return newObj;
};

/**
 * Invalida o cache local de uma coleção ao sofrer escrita (save/delete)
 */
const invalidateCache = (collection: string) => {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes(`_${collection}_`) || key.startsWith(`janflow_cache_${collection}_`) || key.startsWith(`janflow_cache_v3_${collection}_`))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Falha ao invalidar cache local:', e);
  }
};

const apiCall = async (action: string, payload: any) => {
  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, ...payload })
      });

      // Se servidor responder 502 / 503, interrompe sem retries contínuos
      if (res.status === 502 || res.status === 503) {
        throw new Error(`Servidor temporariamente indisponível (${res.status})`);
      }

      if (!res.ok) {
        let errorMsg = `Error in DB action: ${action}`;
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          // Response não era json
        }
        throw new Error(errorMsg);
      }

      return await res.json();
    } catch (err: any) {
      attempt++;
      // Erro 502/503 ou não-transitório não retenta
      if (err?.message?.includes('502') || err?.message?.includes('503') || attempt >= maxRetries) {
        throw err;
      }
      // Backoff exponencial para falhas transitórias de conexão
      const backoffMs = Math.min(800 * Math.pow(2, attempt), 3000);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
};

// Supabase Database Utility via API Proxy com Cache Resiliente
export const localDB = {
  // Retorna os dados do cache se ainda válidos
  getCached: (
    collection: string,
    uid: string,
    context?: string,
    options?: { from?: string; to?: string; dateColumn?: string },
    maxAgeMs: number = CACHE_TTL_MS
  ) => {
    if (typeof window === 'undefined') return [];
    
    const cacheKey = `janflow_cache_v3_${collection}_${context || 'all'}_${options?.from || 'any'}_${options?.to || 'any'}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        // Suporte a novo formato com timestamp de expiração
        if (parsed && typeof parsed === 'object' && 'timestamp' in parsed && 'data' in parsed) {
          const age = Date.now() - parsed.timestamp;
          if (age <= maxAgeMs) {
            return parsed.data;
          }
          return parsed.data; // Retorna dados mesmo expirados como fallback instantâneo
        }
        // Retrocompatibilidade se for array puro salvo anteriormente
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        return [];
      }
    }
    return [];
  },

  get: async (
    collection: string,
    uid: string,
    context?: string,
    options?: { from?: string; to?: string; dateColumn?: string; groupId?: string },
    forceRefresh: boolean = false
  ) => {
    const isStatic = STATIC_COLLECTIONS.has(collection);

    // Se for dado estático e temos cache dentro da validade de 5 minutos, utiliza o cache direto
    if (isStatic && !forceRefresh && typeof window !== 'undefined') {
      const cacheKey = `janflow_cache_v3_${collection}_${context || 'all'}_${options?.from || 'any'}_${options?.to || 'any'}`;
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.timestamp && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
            return parsed.data;
          }
        } catch {}
      }
    }

    try {
      const result = await apiCall('get', { collection, uid, context, options });
      const parsedData = (result.data || []).map(convertKeysToCamelCase);
      
      // Salva no cache com carimbo de data/hora para respeitar os 5 minutos de validade
      if (typeof window !== 'undefined') {
        const cacheKey = `janflow_cache_v3_${collection}_${context || 'all'}_${options?.from || 'any'}_${options?.to || 'any'}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: parsedData
        }));
      }
      
      return parsedData;
    } catch (error) {
      console.error(`Error fetching ${collection}:`, error);
      // Fallback para cache em caso de indisponibilidade de rede/servidor
      return localDB.getCached(collection, uid, context, options);
    }
  },

  getBatch: async (
    requests: Array<{
      collection: string;
      context?: string;
      options?: { from?: string; to?: string; dateColumn?: string; groupId?: string };
    }>,
    uid: string
  ) => {
    try {
      const result = await apiCall('batch', { requests });
      const results = result.results || [];
      
      return results.map((res: any) => {
        if (!res.success) {
          throw new Error(res.error || `Error in batch request for ${res.collection}`);
        }
        const parsedData = (res.data || []).map(convertKeysToCamelCase);
        
        // Salva no cache local com timestamp
        if (typeof window !== 'undefined') {
          const cacheKey = `janflow_cache_v3_${res.collection}_${res.context || 'all'}_${res.options?.from || 'any'}_${res.options?.to || 'any'}`;
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: parsedData
          }));
        }
        
        return parsedData;
      });
    } catch (error) {
      console.error('Error fetching batch database actions:', error);
      // Fallback para cache individual
      return requests.map((req) => 
        localDB.getCached(req.collection, uid, req.context, req.options)
      );
    }
  },

  saveMany: async (collection: string, items: any[]) => {
    if (!items || items.length === 0) return [];

    const payload = items.map((item) => {
      const p = { ...item };
      if (p.uid) {
        p.user_id = p.uid;
        delete p.uid;
      }
      const dbItem = convertKeysToSnakeCase(p);
      if (dbItem.id && String(dbItem.id).startsWith('temp_')) {
        delete dbItem.id;
      }
      return dbItem;
    });

    try {
      const result = await apiCall('saveMany', { collection, payload });
      invalidateCache(collection);
      return (result.data || []).map(convertKeysToCamelCase);
    } catch (error) {
      console.error(`Error bulk inserting ${collection}:`, error);
      throw error;
    }
  },

  save: async (collection: string, item: any) => {
    const payload = { ...item };
    if (payload.uid) {
      payload.user_id = payload.uid;
      delete payload.uid;
    }

    const dbPayload = convertKeysToSnakeCase(payload);

    try {
      const result = await apiCall('save', { collection, payload: dbPayload });
      invalidateCache(collection);
      return convertKeysToCamelCase(result.data);
    } catch (error) {
      console.error(`Error saving ${collection}:`, error);
      throw error;
    }
  },
  
  delete: async (collection: string, id: string) => {
    try {
      await apiCall('delete', { collection, id });
      invalidateCache(collection);
    } catch (error) {
      console.error(`Error deleting ${collection}:`, error);
      throw error;
    }
  },

  deleteMany: async (collection: string, ids: string[]) => {
    try {
      await apiCall('deleteMany', { collection, payload: ids });
      invalidateCache(collection);
    } catch (error) {
      console.error(`Error bulk deleting ${collection}:`, error);
      throw error;
    }
  }
};
