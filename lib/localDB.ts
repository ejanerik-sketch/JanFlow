
import { supabase } from './supabase';

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
    
    return data || [];
  },
  
  save: async (collection: string, item: any) => {
    // Ensure user_id is set (mapping from uid)
    const payload = { ...item };
    if (payload.uid) {
      payload.user_id = payload.uid;
      delete payload.uid;
    }

    if (payload.id) {
      const { data, error } = await supabase
        .from(collection)
        .update(payload)
        .eq('id', payload.id)
        .select()
        .single();
        
      if (error) {
        console.error(`Error updating ${collection}:`, error);
        throw error;
      }
      return data;
    } else {
      const { data, error } = await supabase
        .from(collection)
        .insert([payload])
        .select()
        .single();
        
      if (error) {
        console.error(`Error inserting ${collection}:`, error);
        throw error;
      }
      return data;
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
