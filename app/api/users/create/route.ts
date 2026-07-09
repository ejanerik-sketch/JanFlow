import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin, AuthError } from '@/lib/apiAuth';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Rate limit por IP antes de qualquer processamento pesado
    if (!rateLimit(clientKey(req, 'create-user'), 10, 60_000)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    // CRÍTICO: só admin autenticado pode cadastrar usuários.
    await requireAdmin(req);

    const { email, password, name, role, photoURL } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();

    // Cria via Admin API com email_confirm: true → o usuário já entra confirmado
    // e consegue logar imediatamente. (signUp client-side deixava o usuário preso
    // como não-confirmado em produção, onde a confirmação de e-mail está ativa e
    // não há SMTP — por isso "login não funcionava dos cadastros".)
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, photoURL },
    });

    if (error) {
      console.error('Supabase Admin Error (create):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // O trigger handle_new_user força role mínima ('analista') por segurança.
    // Aqui o admin define o role/photoURL corretos escolhidos na tela.
    if (data.user) {
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({ role, photoURL })
        .eq('id', data.user.id);
      if (profileError) {
        console.error('Erro ao definir role do novo usuário:', profileError);
      }
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
