import { getSupabaseServerClient } from './supabase/server';

/**
 * Server-side invocation of the `user-action` Edge Function.
 *
 * Security model:
 *   - action is ALWAYS the server-chosen value (cannot be overridden by caller)
 *   - payload is never allowed to carry reserved keys (`action`)
 *   - Uses the authenticated user's JWT as Authorization
 *   - Edge Function verifies the JWT (verify_jwt=true) and uses service_role
 *     internally; browser never sees service_role
 */

const RESERVED_KEYS = new Set(['action', 'user_id', 'owner_id']);

export async function invokeUserAction<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; raw: unknown }> {
  const sb = await getSupabaseServerClient();
  const { data: { session } } = await sb.auth.getSession();
  const jwt = session?.access_token;
  if (!jwt) {
    return { ok: false, status: 401, error: 'unauthenticated', raw: null };
  }

  // Strip reserved keys so the caller cannot override action or inject user_id
  const safePayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!RESERVED_KEYS.has(k)) safePayload[k] = v;
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user-action`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    // Spread payload FIRST, then write action — defense in depth in case
    // RESERVED_KEYS filter is ever bypassed.
    body: JSON.stringify({ ...safePayload, action }),
    cache: 'no-store',
  });

  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: (raw as { error?: string })?.error ?? `http_${res.status}`,
      raw,
    };
  }
  return { ok: true, data: raw as T };
}
