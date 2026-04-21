// close-round — 라운드 종료 시 commit cutoff + history 검증 + 점수 산출
// 1. status=OPEN이고 closes_at 지난 라운드 조회
// 2. 각 round_participants의 fork_repo에서 GET /commits?until=closes_at&per_page=1
// 3. cutoff_commit_sha + commit history quality 산출
// 4. evaluations row 생성 (LLM 없음, history 품질만 결정론적)
// 참가자 self-eval.yml이 따로 upload-eval로 코드 품질 점수 올려줬다면 evaluations에 merge

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
  return data as string ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const internal = await getSecret('UFC_INTERNAL_SECRET');
  if (req.headers.get('x-internal-secret') !== internal) {
    return json({ error: 'unauthorized' }, 401);
  }
  const ghToken = await getSecret('UFC_GITHUB_APP_TOKEN');

  // Find rounds whose closes_at <= now and status not yet FINISHED
  const { data: rounds } = await sb
    .from('rounds').select('*')
    .in('status', ['OPEN', 'PREVIEW'])
    .lte('closes_at', new Date().toISOString());

  const results: any[] = [];
  for (const round of (rounds ?? [])) {
    await sb.from('rounds').update({ status: 'CLOSING' }).eq('id', round.id);

    const { data: participants } = await sb
      .from('round_participants').select('*').eq('round_id', round.id);

    for (const p of (participants ?? [])) {
      const evalRow = await harvestAndScore({ ghToken, round, participant: p });
      await sb.from('evaluations').upsert(evalRow, { onConflict: 'round_id,harness_id' });
      results.push({ harness_id: p.harness_id, score: evalRow.total_score });
    }

    await sb.from('rounds').update({
      status: 'FINISHED',
      results_at: new Date().toISOString(),
    }).eq('id', round.id);
  }

  return json({ ok: true, processed: rounds?.length ?? 0, evaluations: results });
});

interface ParsedRepo { owner: string; name: string }

function parseRepoUrl(url: string): ParsedRepo | null {
  if (!url) return null;
  const m = url.match(/github\.com[/:](.+?)\/(.+?)(?:\.git|\/|$)/);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

async function harvestAndScore(opts: { ghToken: string; round: any; participant: any }) {
  const { ghToken, round, participant } = opts;
  const repo = parseRepoUrl(participant.fork_repo_url);
  if (!repo) {
    return baseEval(round.id, participant.harness_id, 'no_fork_url');
  }

  const branch = participant.fork_default_branch ?? 'main';
  const until = round.closes_at;
  const since = round.opens_at;

  // Cutoff commit
  const cutoffRes = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?sha=${branch}&until=${encodeURIComponent(until)}&per_page=1`,
    { headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' } },
  );
  if (!cutoffRes.ok) return baseEval(round.id, participant.harness_id, `cutoff ${cutoffRes.status}`);
  const cutoffArr = await cutoffRes.json();
  if (!Array.isArray(cutoffArr) || cutoffArr.length === 0) {
    return baseEval(round.id, participant.harness_id, 'no_commits_in_window');
  }
  const cutoffCommit = cutoffArr[0];

  // Full history within window for quality scoring
  const histRes = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?sha=${branch}&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&per_page=100`,
    { headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' } },
  );
  const commits = histRes.ok ? await histRes.json() : [];
  const historyQuality = scoreCommitHistory(commits);

  // Save cutoff to participant
  await sb.from('round_participants').update({
    cutoff_commit_sha: cutoffCommit.sha,
    cutoff_commit_at: cutoffCommit.commit?.author?.date ?? null,
  }).eq('round_id', round.id).eq('harness_id', participant.harness_id);

  // Static eval (deterministic) — self-eval.yml may have already uploaded test_pass / lint / types
  // For now, history is the primary score; UPLOAD-EVAL Edge Function merges in the rest.
  const weights = round.weights as Record<string, number>;
  const total = (historyQuality * (weights.history ?? 0.1)) * 100; // until upload-eval merges others

  return {
    round_id: round.id,
    harness_id: participant.harness_id,
    cutoff_commit_sha: cutoffCommit.sha,
    test_pass_rate: 0,
    type_check_pass: false,
    lint_score: 0,
    coverage_pct: 0,
    complexity_avg: 0,
    duplication_pct: 0,
    commit_history_quality: historyQuality,
    total_score: total,
    raw_metrics: {
      commit_count: Array.isArray(commits) ? commits.length : 0,
      cutoff_commit_message: cutoffCommit.commit?.message?.slice(0, 200),
      authors: Array.isArray(commits) ? Array.from(new Set(commits.map((c: any) => c.commit?.author?.email))).slice(0, 5) : [],
    },
  };
}

function scoreCommitHistory(commits: any[]): number {
  if (!Array.isArray(commits) || commits.length === 0) return 0;

  // 1. AI marker presence (Co-Authored-By: Claude/Codex/etc OR bot author)
  const aiMarked = commits.filter((c: any) => {
    const msg = c.commit?.message ?? '';
    const email = (c.commit?.author?.email ?? '').toLowerCase();
    const name = (c.commit?.author?.name ?? '').toLowerCase();
    return /co-authored-by:\s*(claude|codex|gpt|gemini|copilot)/i.test(msg)
      || /generated\s+(with|by)\s+(claude|codex|gpt)/i.test(msg)
      || email.endsWith('@users.noreply.github.com')
      || name.endsWith('[bot]')
      || name.includes('claude')
      || name.includes('codex');
  }).length;
  const markerRatio = aiMarked / commits.length;

  // 2. Single big squash penalty
  const sizePenalty = commits.length < 3 ? 0.5 : 1.0;

  return Math.max(0, Math.min(1, markerRatio * sizePenalty));
}

function baseEval(roundId: string, harnessId: string, reason: string) {
  return {
    round_id: roundId, harness_id: harnessId,
    cutoff_commit_sha: null,
    test_pass_rate: 0, type_check_pass: false, lint_score: 0,
    coverage_pct: 0, complexity_avg: 0, duplication_pct: 0,
    commit_history_quality: 0,
    total_score: 0,
    raw_metrics: { error: reason },
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
