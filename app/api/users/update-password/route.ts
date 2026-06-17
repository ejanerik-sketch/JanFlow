import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin, AuthError } from '@/lib/apiAuth';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Rate limit por IP antes de qualquer processamento pesado
    if (!rateLimit(clientKey(req, 'update-password'), 5, 60_000)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    // CRÍTICO: só admin autenticado pode trocar a senha de outro usuário.
    await requireAdmin(req);

    const { userId, password } = await req.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'ID do usuário e senha são obrigatórios.' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();
    const { data, error } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (error) {
      console.error('Supabase Admin Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
