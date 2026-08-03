import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { recordActivityLog } from '@/lib/activityLogger';

const collectionToEntity: Record<string, 'Lançamentos' | 'Categorias' | 'Cartões' | 'Clientes' | 'Orçamentos' | 'Usuários'> = {
  transactions: 'Lançamentos',
  categories: 'Categorias',
  cards: 'Cartões',
  clients: 'Clientes',
  budgets: 'Orçamentos',
  profiles: 'Usuários'
};

function formatPaymentMethodName(method?: string): string {
  if (!method) return 'Outro';
  switch (method) {
    case 'pix': return 'PIX';
    case 'cartao_credito': return 'Cartão de Crédito';
    case 'cartao_debito': return 'Cartão de Débito';
    case 'boleto': return 'Boleto';
    case 'dinheiro': return 'Dinheiro';
    case 'transferencia': return 'Transferência';
    case 'financiamento': return 'Financiamento';
    default: return method.replace('_', ' ');
  }
}

function formatDetails(collection: string, payload: any, actionType: 'Criação' | 'Edição' | 'Exclusão'): string {
  if (collection === 'transactions') {
    const title = payload?.entity_name || payload?.description || payload?.category || 'Lançamento';
    const cat = payload?.category ? ` | Categoria: ${payload.category}` : '';
    const payMethod = payload?.payment_method || payload?.paymentMethod;
    const payStr = payMethod ? ` | ${payload?.type === 'receita' ? 'Recebimento' : 'Pagamento'}: ${formatPaymentMethodName(payMethod)}` : '';
    const val = payload?.value ? ` | R$ ${Number(payload.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
    return `${actionType === 'Criação' ? 'Novo lançamento' : actionType === 'Edição' ? 'Lançamento alterado' : 'Lançamento excluído'}: "${title}"${cat}${payStr}${val}`;
  }
  if (collection === 'categories') {
    return `${actionType === 'Criação' ? 'Nova categoria' : actionType === 'Edição' ? 'Categoria alterada' : 'Categoria excluída'}: "${payload?.name || ''}"`;
  }
  if (collection === 'cards') {
    const limit = payload?.limit_amount || payload?.limitAmount ? ` (Limite: R$ ${Number(payload.limit_amount || payload.limitAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : '';
    return `${actionType === 'Criação' ? 'Novo cartão' : actionType === 'Edição' ? 'Cartão alterado' : 'Cartão excluído'}: "${payload?.name || ''}"${limit}`;
  }
  if (collection === 'clients') {
    return `${actionType === 'Criação' ? 'Novo cliente' : actionType === 'Edição' ? 'Cliente alterado' : 'Cliente excluído'}: "${payload?.company_name || payload?.companyName || payload?.name || ''}"`;
  }
  if (collection === 'budgets') {
    const amt = payload?.amount ? ` (R$ ${Number(payload.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : '';
    return `${actionType === 'Criação' ? 'Novo orçamento' : actionType === 'Edição' ? 'Orçamento alterado' : 'Orçamento excluído'} na categoria "${payload?.category || ''}"${amt}`;
  }
  if (collection === 'profiles') {
    return `${actionType === 'Edição' ? 'Perfil/cargo atualizado' : 'Usuário modificado'}`;
  }
  return `${actionType} em ${collection}`;
}

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
      const { data, error } = await supabaseAdmin.from(collection).upsert(payload).select();
      if (error) throw error;

      if (collectionToEntity[collection]) {
        recordActivityLog({
          userId: user.id,
          userEmail: user.email,
          action: 'Criação',
          entity: collectionToEntity[collection],
          details: `${payload.length} itens adicionados em lote em ${collectionToEntity[collection]}`,
          context: payload[0]?.context || 'empresa'
        }).catch(err => console.error(err));
      }

      return NextResponse.json({ data });
    }

    if (action === 'save') {
      const isInsert = !payload.id || String(payload.id).startsWith('temp_');
      let resultData: any;

      if (!isInsert) {
        const { id: payloadId, ...updatePayload } = payload;
        const { data, error } = await supabaseAdmin
          .from(collection)
          .update(updatePayload)
          .eq('id', payloadId)
          .select()
          .single();
        if (error) throw error;
        resultData = data;
      } else {
        const { id: payloadId, ...insertPayload } = payload;
        const { data, error } = await supabaseAdmin
          .from(collection)
          .insert([insertPayload])
          .select()
          .single();
        if (error) throw error;
        resultData = data;
      }

      if (collectionToEntity[collection]) {
        const actionType = isInsert ? 'Criação' : 'Edição';
        recordActivityLog({
          userId: user.id,
          userEmail: user.email,
          action: actionType,
          entity: collectionToEntity[collection],
          details: formatDetails(collection, resultData || payload, actionType),
          context: resultData?.context || payload?.context || 'empresa'
        }).catch(err => console.error(err));
      }

      return NextResponse.json({ data: resultData });
    }

    if (action === 'delete') {
      if (String(id).startsWith('temp_')) {
        return NextResponse.json({ success: true });
      }
      
      // Buscar item antes de deletar para detalhe no log se possível
      let deletedItem: any = null;
      if (collectionToEntity[collection]) {
        const { data } = await supabaseAdmin.from(collection).select('*').eq('id', id).maybeSingle();
        deletedItem = data;
      }

      const { error } = await supabaseAdmin.from(collection).delete().eq('id', id);
      if (error) throw error;

      if (collectionToEntity[collection]) {
        recordActivityLog({
          userId: user.id,
          userEmail: user.email,
          action: 'Exclusão',
          entity: collectionToEntity[collection],
          details: formatDetails(collection, deletedItem || { id }, 'Exclusão'),
          context: deletedItem?.context || 'empresa'
        }).catch(err => console.error(err));
      }

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
