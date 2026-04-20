/**
 * CSRF / same-origin guard for state-changing POST requests.
 * Rejects requests whose Origin doesn't match the request host.
 */
export function enforceSameOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  if (!host) {
    return new Response(JSON.stringify({ error: 'missing_host' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const expectedHost = host.toLowerCase();

  const check = (val: string | null): boolean => {
    if (!val) return false;
    try {
      return new URL(val).host.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  };

  if (!check(origin) && !check(referer)) {
    return new Response(JSON.stringify({ error: 'cross_origin_not_allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

/**
 * Simple per-user in-memory token bucket. Best-effort — behind a single
 * runtime instance. For production use a distributed store (Redis/Upstash),
 * but this is still defense-in-depth against naive hammering.
 */
type Bucket = { tokens: number; refilledAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  { capacity, refillPerSec }: { capacity: number; refillPerSec: number },
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, refilledAt: now };
  const elapsed = (now - b.refilledAt) / 1000;
  const refilled = Math.min(capacity, b.tokens + elapsed * refillPerSec);
  if (refilled >= 1) {
    buckets.set(key, { tokens: refilled - 1, refilledAt: now });
    return { allowed: true };
  }
  const need = 1 - refilled;
  const retryMs = Math.ceil((need / refillPerSec) * 1000);
  buckets.set(key, { tokens: refilled, refilledAt: now });
  return { allowed: false, retryAfterMs: retryMs };
}
