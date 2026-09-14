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
    
    if (password !== undefined && password !== '') {
      if (typeof password !== 'string' || password.length < 6) {
        return NextResponse.json({ error: 'A senha deve conter ao menos 6 caracteres.' }, { status: 400 });
      }
      updatePayload.password = password;
      updatePayload.passwordConfirm = password;
    }

    try {
      const record = await pbAdmin.collection('users').update(id, updatePayload);
      return NextResponse.json({ success: true, user: record });
    } catch (updateError: any) {
      console.error('PocketBase Update User Error:', updateError);
      let errorMsg = updateError.message || 'Erro ao atualizar usuário';
      if (updateError.data?.data) {
        const details = Object.entries(updateError.data.data)
          .map(([k, v]: [string, any]) => {
            if (k === 'photoURL') return 'Foto de perfil: Arquivo ou imagem muito grande.';
            if (k === 'email') return 'E-mail: Este endereço de e-mail já está em uso ou é inválido.';
            if (k === 'password') return 'Senha: Deve conter ao menos 6 caracteres.';
            return `${k}: ${v.message || v.code}`;
          })
          .join(', ');
        if (details) errorMsg = details;
      }
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('API Error in /api/users/update:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
