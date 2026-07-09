
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

// Supabase Database Utility
export const localDB = {
  get: async (
    collection: string,
    uid: string,
    context?: string,
    options?: { from?: string; to?: string; dateColumn?: string }
  ) => {
    let query = supabase.from(collection).select('*').eq('user_id', uid);

    if (context) {
      query = query.eq('context', context);
    }

    // Filtro de intervalo de datas direto no banco (evita puxar tudo e filtrar
    // no navegador). Usado, por ex., para carregar só o mês selecionado.
    if (options?.from && options?.to) {
      const col = options.dateColumn || 'date';
      query = query.gte(col, options.from).lte(col, options.to);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${collection}:`, error);
      return [];
    }

    return (data || []).map(convertKeysToCamelCase);
  },

  // Insere vários registros de uma vez (1 round-trip). Usado no seed de
  // categorias padrão, que antes fazia ~40 inserts sequenciais e travava o
  // primeiro carregamento.
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

    const { data, error } = await supabase.from(collection).insert(payload).select();

    if (error) {
      console.error(`Error bulk inserting ${collection}:`, error);
      throw error;
    }

    return (data || []).map(convertKeysToCamelCase);
  },

  save: async (collection: string, item: any) => {
    // Ensure user_id is set (mapping from uid)
    const payload = { ...item };
    if (payload.uid) {
      payload.user_id = payload.uid;
      delete payload.uid;
    }

    // Convert keys to snake_case for Supabase
    const dbPayload = convertKeysToSnakeCase(payload);

    if (dbPayload.id) {
      const { id, ...updatePayload } = dbPayload;
      const { data, error } = await supabase
        .from(collection)
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error(`Error updating ${collection}:`, error);
        throw error;
      }
      return convertKeysToCamelCase(data);
    } else {
      // Remove id if it's undefined to avoid Supabase errors
      const { id, ...insertPayload } = dbPayload;
      const { data, error } = await supabase
        .from(collection)
        .insert([insertPayload])
        .select()
        .single();
        
      if (error) {
        console.error(`Error inserting ${collection}:`, error);
        throw error;
      }
      return convertKeysToCamelCase(data);
    }
  },
  
  delete: async (collection: string, id: string) => {
    const { error } = await supabase
      .from(collection)
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error(`Error deleting ${collection}:`, error);
      throw error;
    }
  }
};
