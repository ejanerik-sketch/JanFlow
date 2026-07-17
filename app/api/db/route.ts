import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = getSupabaseAdmin();
    
    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const { action, collection, uid, context, options, payload, id } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    if (action !== 'batch' && !collection) {
      return NextResponse.json({ error: 'Missing collection' }, { status: 400 });
    }

    if (action === 'get') {
      let query = supabaseAdmin.from(collection).select('*');
      
      // Se houver um contexto especificado, filtramos por ele. 
      // Sem filtro de user_id, todos veem tudo em ambas as sessões.
      if (context) {
        query = query.eq('context', context);
      }

      if (options?.from && options?.to) {
        const col = options.dateColumn || 'date';
        query = query.gte(col, options.from).lte(col, options.to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === 'saveMany') {
      const { data, error } = await supabaseAdmin.from(collection).insert(payload).select();
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === 'save') {
      if (payload.id) {
        const { id: payloadId, ...updatePayload } = payload;
        const { data, error } = await supabaseAdmin
          .from(collection)
          .update(updatePayload)
          .eq('id', payloadId)
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ data });
      } else {
        const { id: payloadId, ...insertPayload } = payload;
        const { data, error } = await supabaseAdmin
          .from(collection)
          .insert([insertPayload])
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ data });
      }
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin.from(collection).delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'batch') {
      const { requests } = body;
      if (!Array.isArray(requests)) {
        return NextResponse.json({ error: 'Requests must be an array' }, { status: 400 });
      }

      const results = await Promise.all(
        requests.map(async (req: any) => {
          try {
            let query = supabaseAdmin.from(req.collection).select('*');
            if (req.context) {
              query = query.eq('context', req.context);
            }
            if (req.options?.from && req.options?.to) {
              const col = req.options.dateColumn || 'date';
              query = query.gte(col, req.options.from).lte(col, req.options.to);
            }
            const { data, error } = await query;
            if (error) throw error;
            return {
              collection: req.collection,
              context: req.context,
              options: req.options,
              data,
              success: true
            };
          } catch (err: any) {
            console.error(`Batch query error for ${req.collection}:`, err);
            return {
              collection: req.collection,
              context: req.context,
              options: req.options,
              error: err.message || 'Error querying database',
              success: false
            };
          }
        })
      );

      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('API /api/db error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
