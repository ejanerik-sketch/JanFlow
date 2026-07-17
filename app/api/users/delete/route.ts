import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/apiAuth';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, 'delete-user'), 10, 60_000)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    // Apenas admin
    await requireAdmin(req);

    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID é obrigatório.' }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();

    // Deleta o usuário da tabela auth.users.
    // Isso deve acionar o cascade delete na tabela public.profiles se configurado.
    const { data, error } = await adminClient.auth.admin.deleteUser(uid);

    if (error) {
      console.error('Supabase Admin Error (delete):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in /api/users/delete:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao deletar usuário.' },
      { status: error.message?.includes('expirada') || error.message?.includes('permissão') ? 401 : 500 }
    );
  }
}
