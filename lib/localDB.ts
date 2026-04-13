
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
  get: async (collection: string, uid: string, context?: string) => {
    let query = supabase.from(collection).select('*').eq('user_id', uid);
    
    if (context) {
      query = query.eq('context', context);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching ${collection}:`, error);
      return [];
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
      const { data, error } = await supabase
        .from(collection)
        .update(dbPayload)
        .eq('id', dbPayload.id)
        .select()
        .single();
        
      if (error) {
        console.error(`Error updating ${collection}:`, error);
        throw error;
      }
      return convertKeysToCamelCase(data);
    } else {
      const { data, error } = await supabase
        .from(collection)
        .insert([dbPayload])
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
