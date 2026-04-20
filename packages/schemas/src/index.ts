import { z } from 'zod';

// ───── Harness ─────
export const HarnessRuntime = z.enum(['CLAUDE_CODE', 'CODEX', 'AGENT_SDK', 'CUSTOM']);
export type HarnessRuntime = z.infer<typeof HarnessRuntime>;

export const HarnessSubmitInput = z.object({
  name: z.string().min(2).max(60),
  repoUrl: z
    .string()
    .url()
    .refine((v) => v.includes('github.com'), 'Only GitHub repos are supported for now'),
  commitSha: z
    .string()
    .regex(/^[a-f0-9]{7,40}$/i)
    .optional(),
  runtime: HarnessRuntime,
  entrypoint: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional(),
  autoSubmit: z.boolean().default(true),
});
export type HarnessSubmitInput = z.infer<typeof HarnessSubmitInput>;

// ───── Challenge ─────
export const ChallengeType = z.enum([
  'CODING',
  'BUG_FIX',
  'REFACTOR',
  'FULLSTACK',
  'ADVERSARIAL',
]);
export type ChallengeType = z.infer<typeof ChallengeType>;

export const Difficulty = z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']);
export type Difficulty = z.infer<typeof Difficulty>;

export const ScoreWeights = z.object({
  correctness: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  efficiency: z.number().min(0).max(1),
  robustness: z.number().min(0).max(1),
  elegance: z.number().min(0).max(1),
});
export type ScoreWeights = z.infer<typeof ScoreWeights>;

// ───── Score ─────
export const ScoreAxes = z.object({
  correctness: z.number().min(0).max(100),
  quality: z.number().min(0).max(100),
  efficiency: z.number().min(0).max(100),
  robustness: z.number().min(0).max(100),
  elegance: z.number().min(0).max(100),
});
export type ScoreAxes = z.infer<typeof ScoreAxes>;

export const JudgeVerdict = z.object({
  judge: z.enum(['claude', 'codex', 'tiebreaker']),
  scores: ScoreAxes,
  reasoning: z.string(),
  tokensUsed: z.number().int().nonnegative(),
  model: z.string(),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdict>;

// ───── Submission Events (realtime) ─────
export const SubmissionEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('queued'),
    submissionId: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal('started'),
    submissionId: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal('tool_call'),
    submissionId: z.string(),
    tool: z.string(),
    input: z.unknown(),
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal('diff'),
    submissionId: z.string(),
    diffPreview: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal('finished'),
    submissionId: z.string(),
    success: z.boolean(),
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal('scored'),
    submissionId: z.string(),
    scores: ScoreAxes,
    total: z.number(),
    at: z.string().datetime(),
  }),
]);
export type SubmissionEvent = z.infer<typeof SubmissionEvent>;
