import { NextResponse } from 'next/server';
import { getPocketBaseAdmin } from '@/lib/pocketbaseAdmin';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { getAuthedUser } from '@/lib/apiAuth';
import { recordActivityLog } from '@/lib/activityLogger';

const collectionToEntity: Record<string, 'Lançamentos' | 'Categorias' | 'Cartões' | 'Clientes' | 'Orçamentos' | 'Usuários'> = {
  transactions: 'Lançamentos',
  categories: 'Categorias',
  cards: 'Cartões',
  clients: 'Clientes',
  budgets: 'Orçamentos',
  users: 'Usuários'
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
  if (collection === 'users') {
    return `${actionType === 'Edição' ? 'Perfil/cargo atualizado' : 'Usuário modificado'}`;
  }
  return `${actionType} em ${collection}`;
}

export async function POST(request: Request) {
  try {
    let user;
    try {
      user = await getAuthedUser(request);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }

    const pbAdmin = await getPocketBaseAdmin();
    const body = await request.json();
    const { action, collection, uid, context, options, payload, id } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    if (action !== 'batch' && !collection) {
      return NextResponse.json({ error: 'Missing collection' }, { status: 400 });
    }

    // Helper para montar query filter do PocketBase
    const buildFilter = (coll: string, ctx?: string, opts?: any) => {
      const filters = [];
      // Isolamento: se for contexto pessoal, restringe ao usuário.
      // (ignora tabelas de sistema como users e logs onde a regra é diferente)
      if (ctx === 'pessoal' && uid && coll !== 'users' && coll !== 'activity_logs') {
        filters.push(`user_id="${uid}"`);
      }

      if (ctx) filters.push(`context="${ctx}"`);
      if (opts?.from && opts?.to) {
        const col = opts.dateColumn || 'date';
        filters.push(`${col}>="${opts.from}"`);
        filters.push(`${col}<="${opts.to}"`);
      }
      if (opts?.groupId) {
        filters.push(`group_id="${opts.groupId}"`);
      }
      return filters.join(' && ');
    };

    if (action === 'get') {
      const filterStr = buildFilter(collection, context, options);
      const queryOptions: any = {};
      if (filterStr) queryOptions.filter = filterStr;

      try {
        const data = await pbAdmin.collection(collection).getFullList(queryOptions);
        return NextResponse.json({ data });
      } catch (e: any) {
        console.error(`[API/DB] GET ${collection} Error:`, e);
        if (e.response) console.error(`[API/DB] PocketBase Response:`, e.response);
        throw e;
      }
    }

    if (action === 'saveMany') {
      // PocketBase doesn't have native bulk upsert, so we loop
      const results = [];
      for (const item of payload) {
        if (item.id && !String(item.id).startsWith('temp_')) {
          const { id: itemId, ...rest } = item;
          results.push(await pbAdmin.collection(collection).update(itemId, rest));
        } else {
          const { id: _, ...rest } = item;
          results.push(await pbAdmin.collection(collection).create(rest));
        }
      }

      if (collectionToEntity[collection]) {
        recordActivityLog({
          userId: user.id,
          userEmail: user.email || '',
          action: 'Criação',
          entity: collectionToEntity[collection],
          details: `${payload.length} itens adicionados em lote em ${collectionToEntity[collection]}`,
          context: payload[0]?.context || 'empresa'
        }).catch(err => console.error(err));
      }

      return NextResponse.json({ data: results });
    }

    if (action === 'save') {
      const isInsert = !payload.id || String(payload.id).startsWith('temp_');
      let resultData: any;

      if (!isInsert) {
        const { id: payloadId, ...updatePayload } = payload;
        resultData = await pbAdmin.collection(collection).update(payloadId, updatePayload);
      } else {
        const { id: _, ...insertPayload } = payload;
        resultData = await pbAdmin.collection(collection).create(insertPayload);
      }

      if (collectionToEntity[collection]) {
        const actionType = isInsert ? 'Criação' : 'Edição';
        recordActivityLog({
          userId: user.id,
          userEmail: user.email || '',
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
      
      let deletedItem: any = null;
      if (collectionToEntity[collection]) {
        try {
          deletedItem = await pbAdmin.collection(collection).getOne(id);
        } catch (e) {}
      }

      await pbAdmin.collection(collection).delete(id);

      if (collectionToEntity[collection]) {
        recordActivityLog({
          userId: user.id,
          userEmail: user.email || '',
          action: 'Exclusão',
          entity: collectionToEntity[collection],
          details: formatDetails(collection, deletedItem || { id }, 'Exclusão'),
          context: deletedItem?.context || 'empresa'
        }).catch(err => console.error(err));
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'deleteMany') {
      const ids = payload;
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ success: true });
      }

      const validIds = ids.filter(id => !String(id).startsWith('temp_'));
      
      if (validIds.length > 0) {
        await Promise.all(validIds.map(vid => pbAdmin.collection(collection).delete(vid)));
        
        if (collectionToEntity[collection]) {
          recordActivityLog({
            userId: user.id,
            userEmail: user.email || '',
            action: 'Exclusão',
            entity: collectionToEntity[collection],
            details: `${validIds.length} itens excluídos em lote em ${collectionToEntity[collection]}`,
            context: context || 'empresa'
          }).catch(err => console.error(err));
        }
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
            const filterStr = buildFilter(req.collection, req.context, req.options);
            const queryOpts: any = {};
            if (filterStr) queryOpts.filter = filterStr;
            const data = await pbAdmin.collection(req.collection).getFullList(queryOpts);
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
