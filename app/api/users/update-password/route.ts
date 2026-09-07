import { NextResponse } from 'next/server';
import { getPocketBaseAdmin } from '@/lib/pocketbaseAdmin';
import { requireAdmin, AuthError } from '@/lib/apiAuth';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!rateLimit(clientKey(req, 'update-password'), 5, 60_000)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    await requireAdmin(req);

    const { userId, password } = await req.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'ID do usuário e senha são obrigatórios.' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });
    }

    const pbAdmin = await getPocketBaseAdmin();
    
    try {
      const record = await pbAdmin.collection('users').update(userId, {
        password: password,
        passwordConfirm: password
      });

      return NextResponse.json({ success: true, user: record });
    } catch (error: any) {
      console.error('PocketBase Admin Error (update-password):', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
