import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { userId, password } = await req.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'ID do usuário e senha são obrigatórios.' }, { status: 400 });
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
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
