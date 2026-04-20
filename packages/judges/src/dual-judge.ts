/**
 * Dual-judge consensus: Claude + Codex score independently.
 * If axis-level disagreement > THRESHOLD, tiebreaker model decides.
 */

import type { ScoreAxes, JudgeVerdict, ScoreWeights } from '@ufc/schemas';

export const DISAGREEMENT_THRESHOLD = 20; // points per axis (0-100 scale)

export interface ConsensusResult {
  final: ScoreAxes;
  total: number;
  verdicts: JudgeVerdict[];
  tiebreakerUsed: boolean;
  disagreements: Array<{ axis: keyof ScoreAxes; spread: number }>;
}

export function computeConsensus(
  claudeVerdict: JudgeVerdict,
  codexVerdict: JudgeVerdict,
  weights: ScoreWeights,
  tiebreaker?: JudgeVerdict,
): ConsensusResult {
  const axes: Array<keyof ScoreAxes> = [
    'correctness',
    'quality',
    'efficiency',
    'robustness',
    'elegance',
  ];

  const disagreements: Array<{ axis: keyof ScoreAxes; spread: number }> = [];
  const final: Partial<ScoreAxes> = {};

  for (const axis of axes) {
    const a = claudeVerdict.scores[axis];
    const b = codexVerdict.scores[axis];
    const spread = Math.abs(a - b);

    if (spread > DISAGREEMENT_THRESHOLD && tiebreaker) {
      disagreements.push({ axis, spread });
      // tiebreaker replaces average
      final[axis] = tiebreaker.scores[axis];
    } else {
      final[axis] = (a + b) / 2;
    }
  }

  const finalScores = final as ScoreAxes;
  const total =
    finalScores.correctness * weights.correctness +
    finalScores.quality * weights.quality +
    finalScores.efficiency * weights.efficiency +
    finalScores.robustness * weights.robustness +
    finalScores.elegance * weights.elegance;

  const verdicts = tiebreaker
    ? [claudeVerdict, codexVerdict, tiebreaker]
    : [claudeVerdict, codexVerdict];

  return {
    final: finalScores,
    total,
    verdicts,
    tiebreakerUsed: !!tiebreaker && disagreements.length > 0,
    disagreements,
  };
}

export function needsTiebreaker(
  a: JudgeVerdict,
  b: JudgeVerdict,
): boolean {
  const axes: Array<keyof ScoreAxes> = [
    'correctness',
    'quality',
    'efficiency',
    'robustness',
    'elegance',
  ];
  return axes.some(
    (axis) => Math.abs(a.scores[axis] - b.scores[axis]) > DISAGREEMENT_THRESHOLD,
  );
}
