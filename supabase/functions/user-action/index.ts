// deno-lint-ignore-file no-explicit-any
// user-action — verify_jwt=false at platform level (ES256 project keys incompatible
// with platform HS256 gate); we verify user JWT internally via getUser().

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthenticated' }, 401);
  }

  // Verify user JWT by asking gotrue (handles ES256 + HS256 transparently).
  const userSb = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userSb.auth.getUser();
  if (userErr || !user) return json({ error: 'unauthenticated', detail: userErr?.message }, 401);

  const body = await req.json().catch(() => ({})) as any;
  const action = String(body.action ?? '');

  try {
    switch (action) {
      case 'save_github_token':
        return await saveGithubToken(user.id, body);
      case 'get_github_token_status':
        return await getTokenStatus(user.id);
      case 'github_repos':
        return await githubRepos(user.id, body);
      case 'create_harness':
        return await createHarness(user.id, body);
      default:
        return json({ error: 'unknown_action', action }, 400);
    }
  } catch (e) {
    return json({ error: 'internal', detail: (e as Error).message }, 500);
  }
});

async function saveGithubToken(userId: string, body: any) {
  const token = String(body.access_token ?? '');
  if (!token) return json({ error: 'missing_token' }, 400);
  await adminSb.rpc('save_github_token', {
    p_user_id: userId,
    p_access_token: token,
    p_scopes: String(body.scopes ?? 'read:user user:email repo'),
    p_expires_at: body.expires_at ?? null,
  });
  return json({ ok: true });
}

async function getTokenStatus(userId: string) {
  const { data } = await adminSb.rpc('get_github_token', { p_user_id: userId });
  return json({ has_token: !!data });
}

async function githubRepos(userId: string, body: any) {
  const { data: ghToken } = await adminSb.rpc('get_github_token', { p_user_id: userId });
  if (!ghToken) return json({ error: 'no_github_token' }, 401);

  const search = String(body.search ?? '');
  const ghRes = await fetch(
    'https://api.github.com/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator',
    { headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' } },
  );
  if (!ghRes.ok) return json({ error: 'github_api_failed', status: ghRes.status }, 502);
  const repos = await ghRes.json() as any[];
  const safe = repos.map((r) => ({
    id: r.id, name: r.name, full_name: r.full_name, html_url: r.html_url,
    description: r.description, private: r.private, default_branch: r.default_branch,
    pushed_at: r.pushed_at, language: r.language,
  }));
  const filtered = search
    ? safe.filter((r) =>
        r.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase()))
    : safe;
  return json({ repos: filtered });
}

async function createHarness(userId: string, body: any) {
  const input = {
    github_repo_id: Number(body.github_repo_id),
    name: String(body.name ?? '').trim(),
    runtime: String(body.runtime ?? ''),
    entrypoint: String(body.entrypoint ?? '').trim(),
    description: String(body.description ?? '').trim(),
  };
  if (!Number.isInteger(input.github_repo_id) || input.github_repo_id <= 0)
    return json({ error: 'invalid_repo_id' }, 400);
  if (input.name.length < 2 || input.name.length > 60) return json({ error: 'invalid_name' }, 400);
  if (!['CLAUDE_CODE','CODEX','AGENT_SDK','CUSTOM'].includes(input.runtime))
    return json({ error: 'invalid_runtime' }, 400);
  if (input.entrypoint.length < 1 || input.entrypoint.length > 500)
    return json({ error: 'invalid_entrypoint' }, 400);

  const { data: ghToken } = await adminSb.rpc('get_github_token', { p_user_id: userId });
  if (!ghToken) return json({ error: 'no_github_token' }, 401);

  const repoRes = await fetch(`https://api.github.com/repositories/${input.github_repo_id}`, {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
  });
  if (!repoRes.ok) return json({ error: 'repo_not_accessible', status: repoRes.status }, 403);
  const repo = await repoRes.json() as any;
  const canModify = repo.permissions?.push || repo.permissions?.maintain || repo.permissions?.admin;
  if (!canModify) return json({ error: 'insufficient_repo_permission' }, 403);

  const branchRes = await fetch(
    `https://api.github.com/repos/${repo.full_name}/branches/${repo.default_branch}`,
    { headers: { Authorization: `Bearer ${ghToken}` } },
  );
  let commitSha = 'HEAD';
  if (branchRes.ok) {
    const branch = await branchRes.json();
    commitSha = branch?.commit?.sha ?? 'HEAD';
  }

  const slug = input.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 60);

  const { data, error } = await adminSb
    .from('harnesses')
    .insert({
      owner_id: userId,
      name: input.name,
      slug,
      repo_url: repo.html_url,
      commit_sha: commitSha,
      runtime: input.runtime,
      entrypoint: input.entrypoint,
      meta: {
        description: input.description || null,
        github_repo_id: repo.id,
        github_full_name: repo.full_name,
        language: repo.language,
        private: repo.private,
      },
      status: 'ACTIVE',
      auto_submit: true,
    })
    .select('id, slug')
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ id: data.id, slug: data.slug });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
