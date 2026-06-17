import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface AuthedUser {
  id: string;
  email: string | null;
  role: string | null;
}

/**
 * Extrai e valida o JWT da sessão a partir do header Authorization: Bearer <token>.
 * Usa o admin client apenas para VALIDAR o token (auth.getUser) — não confia em
 * nada vindo do corpo da requisição. Retorna o usuário + role lido de `profiles`.
 *
 * Lança Error com mensagem amigável quando o token está ausente/ inválido.
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    throw new AuthError('Não autenticado: token de sessão ausente.', 401);
  }

  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError('Não autenticado: token inválido ou expirado.', 401);
  }

  // Busca o role no profiles (fonte da verdade do papel)
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: profile?.role ?? null,
  };
}

/**
 * Valida a sessão e exige que o usuário seja admin. Lança AuthError (403) caso não seja.
 */
export async function requireAdmin(req: Request): Promise<AuthedUser> {
  const user = await getAuthedUser(req);
  const isAdmin = user.role === 'admin' || user.email === 'ejanerik@gmail.com';
  if (!isAdmin) {
    throw new AuthError('Acesso negado: requer privilégio de administrador.', 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}
