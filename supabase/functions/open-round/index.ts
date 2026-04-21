// open-round v2 — 12h 주기, deterministic spec, GitHub repo 생성 + README + self-eval workflow
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });

async function getSecret(key: string): Promise<string> {
  const { data } = await sb.rpc('get_secret', { p_key: key });
  return (data as string) ?? '';
}

function b64utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

async function gh(ghToken: string, path: string, method: string, body?: any) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ufc-harness-open-round',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

async function putFile(ghToken: string, owner: string, repo: string, path: string, content: string, message: string): Promise<{ ok: boolean; detail?: string }> {
  const url = `/repos/${owner}/${repo}/contents/${path}`;
  // Check if exists
  const existing = await gh(ghToken, url, 'GET');
  const body: any = { message, content: b64utf8(content) };
  if (existing.ok && (existing.body as any).sha) body.sha = (existing.body as any).sha;
  const r = await gh(ghToken, url, 'PUT', body);
  return r.ok ? { ok: true } : { ok: false, detail: `${r.status}: ${JSON.stringify(r.body).slice(0, 200)}` };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const internal = await getSecret('UFC_INTERNAL_SECRET');
  if (req.headers.get('x-internal-secret') !== internal) return json({ error: 'unauthorized' }, 401);

  const ghToken = await getSecret('UFC_GITHUB_APP_TOKEN');
  if (!ghToken) return json({ error: 'no_github_token' }, 500);

  // Idempotency: if a PREVIEW round exists with preview_at within last hour, return it
  const { data: existing } = await sb
    .from('rounds')
    .select('id, number, slug, spec_repo_url, status')
    .eq('status', 'PREVIEW')
    .gte('preview_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return json({ ok: true, round: existing, idempotent: true });

  const { data: lastRound } = await sb
    .from('rounds').select('number').order('number', { ascending: false }).limit(1).maybeSingle();
  const nextNumber = (lastRound?.number ?? 0) + 1;

  const { data: pool } = await sb.from('spec_pool').select('*').eq('active', true);
  if (!pool || pool.length === 0) return json({ error: 'no_spec_pool' }, 500);
  const seed = nextNumber * 7919;
  const spec = pool[seed % pool.length];

  const previewAt = new Date();
  const opensAt = new Date(previewAt.getTime() + 12 * 60 * 60 * 1000);
  const closesAt = new Date(opensAt.getTime() + 12 * 60 * 60 * 1000);

  const slug = `round-${nextNumber}-${spec.slug}`;
  const repoName = slug;
  const repoOwner = 'jung-wan-kim';

  const title = `Round ${nextNumber}: ${spec.slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}`;
  const readme = (spec.template_md as string).replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, k: string) => {
    const vars: Record<string, string> = {
      round_title: title,
      round_number: String(nextNumber),
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      weights_json: JSON.stringify(spec.weights, null, 2),
    };
    return vars[k] ?? `{{${k}}}`;
  });

  // 1. Create repo
  const createR = await gh(ghToken, '/user/repos', 'POST', {
    name: repoName,
    description: `UFC-Harness ${title}`,
    private: false,
    auto_init: true,
    has_issues: false, has_projects: false, has_wiki: false,
  });
  if (!createR.ok && createR.status !== 422) {
    return json({ error: 'github_create_failed', detail: `${createR.status}: ${JSON.stringify(createR.body).slice(0, 300)}` }, 500);
  }

  // 2. Push README.md
  const readmeR = await putFile(ghToken, repoOwner, repoName, 'README.md', readme, `init: spec for ${title}`);

  // 3. Push self-eval workflow
  const workflow = `name: ufc-self-eval
on:
  push:
  workflow_dispatch:
jobs:
  evaluate:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run evaluation
        env:
          UPLOAD_TOKEN: \${{ secrets.UFC_UPLOAD_TOKEN }}
        run: |
          set +e
          if [ -f package.json ]; then npm install --no-audit --no-fund > /dev/null 2>&1; npm test 2>&1 | tee /tmp/test.log; fi
          if [ -f pyproject.toml ] || [ -f requirements.txt ]; then pip install -e . > /dev/null 2>&1 || true; pytest 2>&1 | tee /tmp/test.log; fi
          if [ -f tsconfig.json ]; then npx --yes tsc --noEmit 2>&1 | head -50 > /tmp/types.log; fi
          npx --yes eslint . 2>&1 | head -50 > /tmp/lint.log
          if [ -n "\$UPLOAD_TOKEN" ]; then
            T=\$(base64 -w0 /tmp/test.log 2>/dev/null || base64 /tmp/test.log | tr -d '\\n')
            Y=\$(base64 -w0 /tmp/types.log 2>/dev/null || base64 /tmp/types.log | tr -d '\\n')
            L=\$(base64 -w0 /tmp/lint.log 2>/dev/null || base64 /tmp/lint.log | tr -d '\\n')
            jq -nc --arg t "\$T" --arg y "\$Y" --arg l "\$L" --arg s "\${GITHUB_SHA}" '{test_log:\$t,types_log:\$y,lint_log:\$l,commit_sha:\$s}' > /tmp/payload.json
            curl -fsSL -X POST https://bypbtvpqjzqescijdqrb.supabase.co/functions/v1/upload-eval \\
              -H "x-upload-token: \$UPLOAD_TOKEN" -H "Content-Type: application/json" \\
              --data-binary @/tmp/payload.json
          fi
`;
  const workflowR = await putFile(ghToken, repoOwner, repoName, '.github/workflows/ufc-self-eval.yml', workflow, 'init: ufc self-eval workflow');

  // 4. Insert round
  const { data: round, error } = await sb.from('rounds').insert({
    number: nextNumber, slug, spec_pool_id: spec.id, seed,
    spec_repo_url: `https://github.com/${repoOwner}/${repoName}`,
    spec_repo_owner: repoOwner, spec_repo_name: repoName, spec_md: readme,
    preview_at: previewAt.toISOString(), opens_at: opensAt.toISOString(), closes_at: closesAt.toISOString(),
    status: 'PREVIEW', weights: spec.weights,
  }).select('id, number, slug, spec_repo_url').single();

  if (error) return json({ error: error.message }, 500);

  return json({
    ok: true,
    round,
    repo: round.spec_repo_url,
    pushed: { readme: readmeR.ok, workflow: workflowR.ok },
    detail: { readme: readmeR.detail, workflow: workflowR.detail },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
