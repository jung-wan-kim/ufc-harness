import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED_NEXT = new Set<string>(['/', '/submit', '/leaderboard']);

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

  if (!code) return NextResponse.redirect(`${origin}/auth/error?reason=no_code`);

  const sb = await getSupabaseServerClient();
  const { data: exchanged, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !exchanged?.session) {
    return NextResponse.redirect(`${origin}/auth/error?reason=exchange_failed`);
  }

  // Capture provider_token during this one-shot exchange and persist it via
  // the user-action Edge Function. If persistence fails, we must NOT silently
  // continue — downstream UX (repo picker, harness creation) needs the token.
  // Instead, redirect to /auth/error with a diagnosable reason.
  const providerToken = exchanged.session.provider_token;
  const userJwt = exchanged.session.access_token;

  if (!providerToken || !userJwt) {
    // No provider_token (e.g. wrong OAuth scopes or provider misconfigured)
    return NextResponse.redirect(`${origin}/auth/error?reason=no_provider_token`);
  }

  let saveOk = false;
  try {
    const saveRes = await fetch(
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
        cache: 'no-store',
      },
    );
    if (saveRes.ok) {
      saveOk = true;
    } else {
      const body = await saveRes.text().catch(() => '');
      console.error(`save_github_token failed: status=${saveRes.status} body=${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.error('save_github_token network error:', e);
  }

  if (!saveOk) {
    // Sign out so the next login attempt is clean, then surface the error.
    await sb.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/error?reason=token_save_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
