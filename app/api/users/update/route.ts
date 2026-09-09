import { NextResponse } from 'next/server';
import { getPocketBaseAdmin } from '@/lib/pocketbaseAdmin';
import { requireAdmin, AuthError } from '@/lib/apiAuth';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, 'update-user'), 15, 60_000)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    // Apenas admin pode atualizar usuários
    await requireAdmin(req);

    const { id, name, email, role, password, photoURL } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    const pbAdmin = await getPocketBaseAdmin();

    const updatePayload: Record<string, any> = {};
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (role !== undefined) updatePayload.role = role;
    if (photoURL !== undefined) updatePayload.photoURL = photoURL;
    if (password && typeof password === 'string' && password.length >= 6) {
      updatePayload.password = password;
      updatePayload.passwordConfirm = password;
    }

    try {
      const record = await pbAdmin.collection('users').update(id, updatePayload);
      return NextResponse.json({ success: true, user: record });
    } catch (updateError: any) {
      console.error('PocketBase Update User Error:', updateError);
      return NextResponse.json({ error: updateError.message || 'Erro ao atualizar usuário' }, { status: 400 });
    }
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('API Error in /api/users/update:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
