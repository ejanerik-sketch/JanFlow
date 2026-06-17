/**
 * Rate limiter simples em memória (janela fixa). Suficiente para deploy
 * single-instance (Coolify/VPS). Para múltiplas instâncias, trocar por Redis.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

/** Deriva uma chave de cliente a partir do IP da requisição. */
export function clientKey(req: Request, suffix = ''): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || req.headers.get('x-real-ip') || 'unknown';
  return `${ip}:${suffix}`;
}
