// deno-lint-ignore-file no-explicit-any
// @ts-nocheck -- Deno runtime (Supabase Edge Function)
/**
 * dispatch-challenge
 *
 * Trigger: pg_cron every 4 hours (or manual).
 * Action:
 *   1. Open next challenge (from curated pool or LLM-generated)
 *   2. For each ACTIVE + auto_submit harness, create a submission row
 *   3. Issue single-use submission_token
 *   4. Fire GitHub repository_dispatch to harness.repo_url with payload
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GH_APP_TOKEN = Deno.env.get('UFC_GITHUB_APP_TOKEN')!; // fine-grained PAT or App token
const INTERNAL_SECRET = Deno.env.get('UFC_INTERNAL_SECRET')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('x-internal-secret');
  if (authHeader !== INTERNAL_SECRET) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Pick next challenge (stub: get one that opens <= now and hasn't been dispatched)
  const { data: challenge, error: chErr } = await sb
    .from('challenges')
    .select('*')
    .lte('opens_at', new Date().toISOString())
    .gte('closes_at', new Date().toISOString())
    .order('opens_at', { ascending: false })
    .limit(1)
    .single();

  if (chErr || !challenge) {
    return json({ error: 'no_active_challenge', detail: chErr?.message }, 404);
  }

  // 2. Fetch all active harnesses with auto-submit
  const { data: harnesses } = await sb
    .from('harnesses')
    .select('id, owner_id, repo_url, entrypoint, webhook_secret')
    .eq('status', 'ACTIVE')
    .eq('auto_submit', true);

  let dispatched = 0;
  const errors: string[] = [];

  for (const h of harnesses ?? []) {
    try {
      // Create submission
      const { data: sub, error: subErr } = await sb
        .from('submissions')
        .insert({
          harness_id: h.id,
          challenge_id: challenge.id,
          status: 'DISPATCHED',
        })
        .select()
        .single();
      if (subErr || !sub) throw new Error(subErr?.message);

      // Issue token (hash stored, plaintext sent to GHA)
      const tokenPlain = crypto.randomUUID() + '-' + crypto.randomUUID();
      const tokenHash = await sha256(tokenPlain);
      await sb.from('submission_tokens').insert({
        submission_id: sub.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });

      // Fire repository_dispatch
      const [owner, repo] = parseGithubRepo(h.repo_url);
      const dispatchRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GH_APP_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            event_type: 'ufc-harness-challenge',
            client_payload: {
              submission_id: sub.id,
              submission_token: tokenPlain,
              challenge_slug: challenge.slug,
              challenge_spec_url: `${SUPABASE_URL}/storage/v1/object/public/challenges/${challenge.slug}/spec.md`,
              challenge_starter_url: `${SUPABASE_URL}/storage/v1/object/public/challenges/${challenge.slug}/starter.tar.gz`,
              time_limit_sec: challenge.time_limit_sec,
              upload_url: `${SUPABASE_URL}/functions/v1/upload-result`,
              entrypoint: h.entrypoint,
            },
          }),
        },
      );

      if (!dispatchRes.ok) {
        const body = await dispatchRes.text();
        throw new Error(`dispatch failed ${dispatchRes.status}: ${body}`);
      }
      dispatched++;
    } catch (e) {
      errors.push(`harness=${h.id}: ${(e as Error).message}`);
    }
  }

  return json({ challenge_id: challenge.id, dispatched, errors });
});

function parseGithubRepo(url: string): [string, string] {
  const m = url.match(/github\.com[/:](.+?)\/(.+?)(?:\.git|$|\/)/);
  if (!m) throw new Error(`invalid github url: ${url}`);
  return [m[1], m[2]];
}

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
