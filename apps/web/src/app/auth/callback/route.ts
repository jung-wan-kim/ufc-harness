import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// Allowlist of permitted post-login redirect paths.
// Prevents open-redirect / redirect-gadget attacks via `?next=`.
const ALLOWED_NEXT = new Set<string>([
  '/',
  '/submit',
  '/leaderboard',
]);

function safeNext(raw: string | null): string {
  if (!raw) return '/submit';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/submit';
  const path = raw.split('?')[0]?.split('#')[0] ?? '/submit';
  return ALLOWED_NEXT.has(path) ? raw : '/submit';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) return NextResponse.redirect(`${origin}/auth/error`);

  const sb = await getSupabaseServerClient();
  const { data: exchanged, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !exchanged?.session) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  // Capture provider_token during this one-shot exchange and save it to
  // private.user_github_tokens via the `user-action` Edge Function.
  // The token never reaches the browser: we call the Edge Function
  // server-side using the freshly-issued user JWT.
  const providerToken = exchanged.session.provider_token;
  const userJwt = exchanged.session.access_token;
  if (providerToken && userJwt) {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user-action`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userJwt}`,
            'Content-Type': 'application/json',
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            action: 'save_github_token',
            access_token: providerToken,
            scopes: 'read:user user:email repo',
          }),
        },
      );
    } catch (e) {
      console.error('save_github_token failed:', e);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
