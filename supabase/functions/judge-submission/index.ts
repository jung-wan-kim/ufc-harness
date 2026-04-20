// deno-lint-ignore-file no-explicit-any
// @ts-nocheck -- Deno runtime
/**
 * judge-submission
 *
 * 5-axis scoring + dual-judge (Claude + Codex) consensus.
 * Updates `scores` and `elo_ratings`.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

interface ScoreAxes {
  correctness: number;
  quality: number;
  efficiency: number;
  robustness: number;
  elegance: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { submission_id } = await req.json() as { submission_id: string };
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Fetch submission + challenge
  const { data: sub } = await sb
    .from('submissions')
    .select('*, challenge:challenges!inner(*)')
    .eq('id', submission_id)
    .single();
  if (!sub) return json({ error: 'not_found' }, 404);

  const challenge = (sub as any).challenge;
  const weights = challenge.weights as Record<keyof ScoreAxes, number>;

  // Fetch diff content
  const diffText = sub.diff_url ? await fetch(sub.diff_url).then((r) => r.text()) : '';

  // TODO Phase 3: actually run tests + static analysis inside Edge function worker
  // Placeholder deterministic score based on presence of diff + metrics
  const deterministic = {
    correctness: diffText.length > 0 ? 50 : 0,
    efficiency: computeEfficiency(sub, challenge),
    elegance: computeElegance(diffText),
  };

  // Dual LLM judge for quality + robustness (and as second opinion on everything)
  const [claudeV, codexV] = await Promise.all([
    judgeWithClaude({ diff: diffText, challenge }),
    judgeWithCodex({ diff: diffText, challenge }),
  ]);

  const avg = (a: number, b: number) => (a + b) / 2;
  const final: ScoreAxes = {
    correctness: avg(claudeV.scores.correctness, codexV.scores.correctness),
    quality: avg(claudeV.scores.quality, codexV.scores.quality),
    efficiency: deterministic.efficiency,
    robustness: avg(claudeV.scores.robustness, codexV.scores.robustness),
    elegance: avg(claudeV.scores.elegance, codexV.scores.elegance),
  };

  const total =
    final.correctness * weights.correctness +
    final.quality * weights.quality +
    final.efficiency * weights.efficiency +
    final.robustness * weights.robustness +
    final.elegance * weights.elegance;

  await sb.from('scores').upsert({
    submission_id,
    ...final,
    total,
    judge_trace: { claude: claudeV, codex: codexV, deterministic },
  }, { onConflict: 'submission_id' });

  await sb.from('submissions').update({ status: 'COMPLETED' }).eq('id', submission_id);

  // TODO: ELO update across all completed submissions of this challenge

  return json({ ok: true, submission_id, total });
});

function computeEfficiency(sub: any, challenge: any): number {
  const timeBudget = challenge.time_limit_sec * 1000;
  const tokenBudget = 200_000;
  const callBudget = 100;
  const ts = (sub.finished_at && sub.started_at)
    ? new Date(sub.finished_at).getTime() - new Date(sub.started_at).getTime()
    : timeBudget;
  const t = Math.max(0, 1 - ts / timeBudget) * 40;
  const tk = Math.max(0, 1 - (sub.tokens_used ?? tokenBudget) / tokenBudget) * 40;
  const c = Math.max(0, 1 - (sub.api_calls ?? callBudget) / callBudget) * 20;
  return Math.min(100, t + tk + c);
}

function computeElegance(diff: string): number {
  const lines = diff.split('\n').filter((l) => l.startsWith('+') || l.startsWith('-'));
  if (lines.length === 0) return 0;
  if (lines.length < 50) return 90;
  if (lines.length < 200) return 70;
  if (lines.length < 500) return 50;
  return 30;
}

async function judgeWithClaude(ctx: { diff: string; challenge: any }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: buildJudgePrompt(ctx) },
      ],
    }),
  });
  const body = await res.json();
  const text = body?.content?.[0]?.text ?? '{}';
  return parseJudge(text, 'claude', 'claude-sonnet-4-6');
}

async function judgeWithCodex(ctx: { diff: string; challenge: any }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-codex',
      messages: [{ role: 'user', content: buildJudgePrompt(ctx) }],
      response_format: { type: 'json_object' },
    }),
  });
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content ?? '{}';
  return parseJudge(text, 'codex', 'gpt-5-codex');
}

function buildJudgePrompt(ctx: { diff: string; challenge: any }): string {
  return `You are an expert software engineering judge.
Challenge: ${ctx.challenge.title}
Spec:
${ctx.challenge.spec_md}

Submitted diff:
\`\`\`diff
${ctx.diff.slice(0, 8000)}
\`\`\`

Rate on 5 axes (0-100 each). Respond JSON only:
{"correctness": n, "quality": n, "efficiency": n, "robustness": n, "elegance": n, "reasoning": "..."}`;
}

function parseJudge(text: string, judge: string, model: string) {
  try {
    const clean = text.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      judge,
      model,
      scores: {
        correctness: Number(parsed.correctness ?? 0),
        quality: Number(parsed.quality ?? 0),
        efficiency: Number(parsed.efficiency ?? 0),
        robustness: Number(parsed.robustness ?? 0),
        elegance: Number(parsed.elegance ?? 0),
      },
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch {
    return {
      judge,
      model,
      scores: { correctness: 0, quality: 0, efficiency: 0, robustness: 0, elegance: 0 },
      reasoning: 'parse_error',
    };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
