import { NextResponse } from 'next/server';
import { z } from 'zod';
import { invokeUserAction } from '@/lib/user-action';
import { enforceSameOrigin, rateLimit } from '@/lib/csrf';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const Body = z.object({
  github_repo_id: z.number().int().positive(),
  name: z.string().min(2).max(60),
  runtime: z.enum(['CLAUDE_CODE', 'CODEX', 'AGENT_SDK', 'CUSTOM']),
  entrypoint: z.string().min(1).max(500),
  description: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  // CSRF: require same-origin POST
  const csrfBlock = enforceSameOrigin(request);
  if (csrfBlock) return csrfBlock;

  // Per-user rate limit (defense-in-depth — not a replacement for WAF)
  const sb = await getSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const rl = rateLimit(`harness-create:${user.id}`, { capacity: 10, refillPerSec: 0.1 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_ms: rl.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)) } },
    );
  }

  // Parse + VALIDATE the shape explicitly (no raw pass-through)
  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  // Forward ONLY the validated fields. `action` is always set by
  // invokeUserAction and cannot be overridden (see lib/user-action.ts).
  const result = await invokeUserAction<{ id: string; slug: string }>('create_harness', parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
