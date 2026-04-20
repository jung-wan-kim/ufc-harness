import { NextResponse } from 'next/server';
import { invokeUserAction } from '@/lib/user-action';
import { rateLimit } from '@/lib/csrf';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const rl = rateLimit(`repos:${user.id}`, { capacity: 30, refillPerSec: 0.5 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_ms: rl.retryAfterMs },
      { status: 429 },
    );
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get('q') ?? '').slice(0, 200);

  const result = await invokeUserAction<{ repos: unknown[] }>('github_repos', { search });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
