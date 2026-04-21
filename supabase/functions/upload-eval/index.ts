// upload-eval — 참가자 fork의 GHA 자체 실행결과(test/lint/types/coverage)를
// upload_token_hash 인증으로 evaluations 테이블에 merge.
// LLM 호출 0건 — 참가자 환경에서 이미 실행된 결과 파싱만.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-upload-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('x-upload-token');
  if (!token) return json({ error: 'missing_token' }, 401);
  const tokenHash = await sha256(token);

  // Find round_participants entry by upload_token_hash (single-use semantics)
  const { data: p } = await sb
    .from('round_participants')
    .select('round_id, harness_id, upload_token_expires_at')
    .eq('upload_token_hash', tokenHash)
    .gte('upload_token_expires_at', new Date().toISOString())
    .maybeSingle();
  if (!p) return json({ error: 'invalid_or_expired_token' }, 401);

  const body = await req.json().catch(() => null) as any;
  if (!body) return json({ error: 'invalid_body' }, 400);

  // Parse logs (base64 의 텍스트 로그)
  const decode = (b64: string) => {
    try { return atob(String(b64 ?? '')); } catch { return ''; }
  };
  const testLog = decode(body.test_log);
  const typesLog = decode(body.types_log);
  const lintLog = decode(body.lint_log);

  // Extract metrics deterministically
  const testPassRate = parseTestPass(testLog);
  const typeCheckPass = !/\berror\s+TS\d+/.test(typesLog) && typesLog.length > 0;
  const lintScore = parseLintScore(lintLog);

  // Merge into evaluations (close-round set the row already with history quality)
  const { data: existing } = await sb
    .from('evaluations')
    .select('*')
    .eq('round_id', p.round_id).eq('harness_id', p.harness_id)
    .maybeSingle();

  // Get round.weights
  const { data: round } = await sb.from('rounds').select('weights').eq('id', p.round_id).single();
  const w = (round?.weights ?? {}) as Record<string, number>;
  const historyQ = existing?.commit_history_quality ?? 0;

  const total = (
    testPassRate * (w.test_pass ?? 0.5) +
    (typeCheckPass ? 1 : 0) * (w.type_check ?? 0.1) +
    lintScore * (w.lint ?? 0.1) +
    0 * (w.coverage ?? 0.1) +     // TODO: parse coverage
    1 * (w.complexity ?? 0.1) +    // TODO: parse complexity
    historyQ * (w.history ?? 0.1)
  ) * 100;

  await sb.from('evaluations').upsert({
    round_id: p.round_id,
    harness_id: p.harness_id,
    cutoff_commit_sha: body.commit_sha ?? existing?.cutoff_commit_sha,
    test_pass_rate: testPassRate,
    type_check_pass: typeCheckPass,
    lint_score: lintScore,
    coverage_pct: 0,
    complexity_avg: 0,
    duplication_pct: 0,
    commit_history_quality: historyQ,
    total_score: total,
    raw_metrics: { test_log: testLog.slice(-500), types_log: typesLog.slice(-300), lint_log: lintLog.slice(-300) },
  }, { onConflict: 'round_id,harness_id' });

  // Burn token (single-use)
  await sb.from('round_participants').update({
    upload_token_hash: null,
    upload_token_expires_at: null,
  }).eq('round_id', p.round_id).eq('harness_id', p.harness_id);

  return json({ ok: true, total_score: total, test_pass_rate: testPassRate, type_check_pass: typeCheckPass, lint_score: lintScore });
});

function parseTestPass(log: string): number {
  // Vitest: 'Tests  X passed | Y failed'
  const v = log.match(/Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?/i);
  if (v) {
    const passed = +v[1]; const failed = +(v[2] ?? 0);
    const total = passed + failed;
    return total > 0 ? passed / total : 0;
  }
  // Jest: 'Tests:       X passed, Y total'
  const j = log.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/i);
  if (j) return +j[1] / Math.max(1, +j[2]);
  // pytest: 'X passed, Y failed'
  const py = log.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?/i);
  if (py) {
    const passed = +py[1]; const failed = +(py[2] ?? 0);
    const total = passed + failed;
    return total > 0 ? passed / total : 0;
  }
  // No tests detected
  return 0;
}

function parseLintScore(log: string): number {
  if (!log) return 0;
  const errors = (log.match(/\berror\b/gi) ?? []).length;
  const warns = (log.match(/\bwarning\b/gi) ?? []).length;
  const penalty = errors * 0.1 + warns * 0.02;
  return Math.max(0, Math.min(1, 1 - penalty));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
