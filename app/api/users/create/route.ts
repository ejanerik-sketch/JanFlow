import { NextResponse } from 'next/server';
import { getPocketBaseAdmin } from '@/lib/pocketbaseAdmin';
import { requireAdmin, AuthError } from '@/lib/apiAuth';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, 'create-user'), 10, 60_000)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    // Apenas admin pode criar usuários
    await requireAdmin(req);

    const { email, password, name, role, photoURL } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });
    }

    const pbAdmin = await getPocketBaseAdmin();

    try {
      const record = await pbAdmin.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        name: name || '',
        role: role || 'analista',
        photoURL: photoURL || '',
        verified: true // Usuário criado pelo admin já nasce verificado
      });

      return NextResponse.json({ success: true, user: record });
    } catch (createError: any) {
      console.error('PocketBase Create User Error:', createError);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
