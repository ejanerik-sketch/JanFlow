
import { supabase } from './supabase';

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

const apiCall = async (action: string, payload: any) => {
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

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || `Error in DB action: ${action}`);
  }

  return res.json();
};

// Supabase Database Utility via API Proxy
export const localDB = {
  // Retorna os dados do cache de forma instantânea (síncrona se rodar no cliente)
  getCached: (
    collection: string,
    uid: string,
    context?: string,
    options?: { from?: string; to?: string; dateColumn?: string }
  ) => {
    if (typeof window === 'undefined') return [];
    
    // Constrói a chave de cache única
    const cacheKey = `janflow_cache_v3_${collection}_${context || 'all'}_${options?.from || 'any'}_${options?.to || 'any'}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
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
    options?: { from?: string; to?: string; dateColumn?: string }
  ) => {
    try {
      const result = await apiCall('get', { collection, uid, context, options });
      const parsedData = (result.data || []).map(convertKeysToCamelCase);
      
      // Salva no cache local para a próxima vez ser instantâneo
      if (typeof window !== 'undefined') {
        const cacheKey = `janflow_cache_v3_${collection}_${context || 'all'}_${options?.from || 'any'}_${options?.to || 'any'}`;
        localStorage.setItem(cacheKey, JSON.stringify(parsedData));
      }
      
      return parsedData;
    } catch (error) {
      console.error(`Error fetching ${collection}:`, error);
      // Fallback para cache em caso de erro na rede
      return localDB.getCached(collection, uid, context, options);
    }
  },

  getBatch: async (
    requests: Array<{
      collection: string;
      context?: string;
      options?: { from?: string; to?: string; dateColumn?: string };
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
        
        // Salva no cache local para a próxima vez ser instantâneo
        if (typeof window !== 'undefined') {
          const cacheKey = `janflow_cache_${res.collection}_${res.context || 'all'}_${res.options?.from || 'any'}_${res.options?.to || 'any'}`;
          localStorage.setItem(cacheKey, JSON.stringify(parsedData));
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
      const { id, ...rest } = dbItem;
      return rest;
    });

    try {
      const result = await apiCall('saveMany', { collection, payload });
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
      return convertKeysToCamelCase(result.data);
    } catch (error) {
      console.error(`Error saving ${collection}:`, error);
      throw error;
    }
  },
  
  delete: async (collection: string, id: string) => {
    try {
      await apiCall('delete', { collection, id });
    } catch (error) {
      console.error(`Error deleting ${collection}:`, error);
      throw error;
    }
  }
};
