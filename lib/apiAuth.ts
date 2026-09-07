import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '@/lib/pocketbase';

export interface AuthedUser {
  id: string;
  email: string | null;
  role: string | null;
}

/**
 * Extrai e valida o JWT da sessão a partir do header Authorization: Bearer <token>.
 * Usa o authRefresh do PocketBase para VALIDAR o token. Retorna o usuário + role.
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

  const pb = new PocketBase(POCKETBASE_URL);
  pb.authStore.save(token, null);

  try {
    const authData = await pb.collection('users').authRefresh();
    if (!authData.record) {
      throw new Error('User not found');
    }

    return {
      id: authData.record.id,
      email: authData.record.email,
      role: authData.record.role || null,
    };
  } catch (error) {
    throw new AuthError('Não autenticado: token inválido ou expirado.', 401);
  }
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
