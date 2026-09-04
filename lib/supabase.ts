import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Estado do Circuit Breaker para evitar loops e DDoS contra o Kong/Supabase
let authCircuitOpen = false;
let authCircuitResetTimer: NodeJS.Timeout | null = null;
const MAX_AUTH_RETRIES = 3;

/**
 * Utilitário para limpar o estado de autenticação localmente
 * sem disparar novas chamadas ao servidor se ele estiver fora do ar.
 */
export function clearLocalAuthSession() {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.clear();
      // Remove chaves específicas do supabase se houver no localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase.auth')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Falha ao limpar armazenamento local:', e);
    }
  }
}

/**
 * Função para disparar a saída limpa e notificar os componentes
 */
export function triggerAuthFailure(status: number, message: string) {
  authCircuitOpen = true;
  clearLocalAuthSession();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('janflow:auth_service_unavailable', {
        detail: { status, message }
      })
    );
  }

  // Reseta o circuit breaker após 30 segundos de cooldown
  if (authCircuitResetTimer) clearTimeout(authCircuitResetTimer);
  authCircuitResetTimer = setTimeout(() => {
    authCircuitOpen = false;
  }, 30000);
}

/**
 * Wrapper resiliente para fetch do Supabase Client
 * - Limita tentativas a no máximo 3 com backoff exponencial
 * - Trava imediata em erros 502 e 503 para evitar bombardeamento do gateway
 * - Redirecionamento limpo e proteção do servidor
 */
const resilientFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any).url || '';
  const isAuthRequest = urlString.includes('/auth/v1/');
  const isTokenRefresh = urlString.includes('/auth/v1/token');

  // Se o circuito estiver aberto para rotas de auth, bloqueia chamadas redundantes imediatas
  if (isAuthRequest && authCircuitOpen) {
    throw new Error('Supabase Auth temporariamente indisponível. Circuito aberto para proteção do servidor.');
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt < MAX_AUTH_RETRIES) {
    try {
      const response = await fetch(input, init);

      // Tratamento para Erro 502 / 503 (Serviço Fora do Ar)
      if (response.status === 502 || response.status === 503) {
        if (isAuthRequest) {
          console.error(`[Supabase Auth] Servidor respondeu com status ${response.status}. Interrompendo chamadas.`);
          triggerAuthFailure(response.status, 'Serviço de autenticação temporariamente indisponível (503/502).');
          return response;
        }
      }

      // Se a resposta for bem sucedida ou erro da aplicação (4xx), retorna direto sem retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        // Se for 400 em refresh token (refresh token inválido/revogado), limpa sessão e não retenta
        if (isTokenRefresh && response.status === 400) {
          clearLocalAuthSession();
        }
        return response;
      }

      // Se for outro erro de servidor (5xx que não 502/503), conta tentativa com backoff
      attempt++;
      if (attempt < MAX_AUTH_RETRIES) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000) + Math.random() * 300;
        await new Promise(res => setTimeout(res, backoffMs));
      } else {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      attempt++;

      if (isAuthRequest) {
        console.warn(`[Supabase Auth] Tentativa ${attempt} de ${MAX_AUTH_RETRIES} falhou:`, err?.message);
      }

      if (attempt < MAX_AUTH_RETRIES) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000) + Math.random() * 300;
        await new Promise(res => setTimeout(res, backoffMs));
      } else {
        if (isAuthRequest) {
          triggerAuthFailure(503, 'Falha de conexão com o serviço de autenticação após 3 tentativas.');
        }
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Falha ao conectar com o serviço.');
};

// Exporta o cliente Supabase com proteções de resiliência e autoRefreshToken seguro
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      global: {
        fetch: resilientFetch
      }
    })
  : new Proxy({} as any, {
      get: (target, prop) => {
        if (prop === 'auth') {
          return new Proxy({} as any, {
            get: () => () => {
              throw new Error('Supabase URL and Anon Key are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment.');
            }
          });
        }
        return () => {
          throw new Error('Supabase URL and Anon Key are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment.');
        };
      }
    });
