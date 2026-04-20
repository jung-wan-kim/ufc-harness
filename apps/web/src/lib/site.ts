/**
 * Centralized site origin resolution. Strictly normalize NEXT_PUBLIC_APP_URL
 * to a clean origin (no path/query/trailing slash). Anywhere that needs an
 * absolute URL should use this helper, NOT the raw env var.
 */

const FALLBACK = 'https://ufc-harness.vercel.app';

function normalizeOrigin(raw: string | undefined): string {
  if (!raw) return FALLBACK;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return FALLBACK;
    return u.origin; // strips path/query/hash, no trailing slash
  } catch {
    return FALLBACK;
  }
}

export const SITE_ORIGIN = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'UFC-Harness';

export function siteUrl(path: string): string {
  return new URL(path.startsWith('/') ? path : `/${path}`, SITE_ORIGIN).toString();
}
