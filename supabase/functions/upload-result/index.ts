// deno-lint-ignore-file no-explicit-any
// @ts-nocheck -- Deno runtime
/**
 * upload-result
 *
 * Receives diff + logs + metrics from GitHub Actions workflow.
 * Authenticates via single-use `x-submission-token` header.
 * Marks submission as EVALUATING and enqueues judge job.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const token = req.headers.get('x-submission-token');
  if (!token) return json({ error: 'missing_token' }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const tokenHash = await sha256(token);

  // Validate + consume token atomically
  const { data: tokenRow, error: tokErr } = await sb
    .from('submission_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .select('submission_id')
    .single();

  if (tokErr || !tokenRow) {
    return json({ error: 'invalid_or_expired_token' }, 401);
  }

  const body = await req.json().catch(() => null) as {
    diff_b64?: string;
    log_b64?: string;
    tokens_used?: number;
    api_calls?: number;
    duration_ms?: number;
    exit_code?: number;
    error?: string;
  } | null;

  if (!body) return json({ error: 'invalid_body' }, 400);

  // Upload artifacts to Storage
  const submissionId = tokenRow.submission_id;
  let diffUrl: string | null = null;
  let logUrl: string | null = null;

  if (body.diff_b64) {
    const diffBytes = Uint8Array.from(atob(body.diff_b64), (c) => c.charCodeAt(0));
    const path = `submissions/${submissionId}/diff.patch`;
    const up = await sb.storage.from('artifacts').upload(path, diffBytes, {
      contentType: 'text/plain',
      upsert: true,
    });
    if (!up.error) {
      diffUrl = sb.storage.from('artifacts').getPublicUrl(path).data.publicUrl;
    }
  }

  if (body.log_b64) {
    const logBytes = Uint8Array.from(atob(body.log_b64), (c) => c.charCodeAt(0));
    const path = `submissions/${submissionId}/run.log`;
    const up = await sb.storage.from('artifacts').upload(path, logBytes, {
      contentType: 'text/plain',
      upsert: true,
    });
    if (!up.error) {
      logUrl = sb.storage.from('artifacts').getPublicUrl(path).data.publicUrl;
    }
  }

  // Update submission
  const diffHash = body.diff_b64 ? await sha256(body.diff_b64) : null;
  await sb
    .from('submissions')
    .update({
      status: body.exit_code === 0 ? 'EVALUATING' : 'FAILED',
      finished_at: new Date().toISOString(),
      tokens_used: body.tokens_used ?? 0,
      api_calls: body.api_calls ?? 0,
      diff_url: diffUrl,
      log_url: logUrl,
      diff_hash: diffHash,
      error: body.error ?? null,
    })
    .eq('id', submissionId);

  // TODO: enqueue judge job via pg_boss (or directly invoke judge-submission)
  //   for Phase 3 we just fire-and-forget the judge function
  if (body.exit_code === 0) {
    fetch(`${SUPABASE_URL}/functions/v1/judge-submission`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ submission_id: submissionId }),
    }).catch(() => {});
  }

  return json({ ok: true, submission_id: submissionId });
});

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
