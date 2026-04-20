/**
 * Elegance axis — minimality of change, diff quality.
 * Rewards small, focused diffs over sprawling rewrites.
 */

export interface EleganceInput {
  diffLinesAdded: number;
  diffLinesRemoved: number;
  filesChanged: number;
  baselineLinesAdded: number; // reference solution size
}

export function scoreElegance(i: EleganceInput): number {
  const totalChanges = i.diffLinesAdded + i.diffLinesRemoved;
  if (i.baselineLinesAdded === 0) return 50; // unknown baseline
  const ratio = totalChanges / (i.baselineLinesAdded * 2);
  // Score peaks when ratio ≈ 1 (close to baseline), penalizes bloat.
  const base = ratio <= 1 ? 100 * (1 - Math.abs(1 - ratio) * 0.5) : Math.max(0, 100 - (ratio - 1) * 40);
  const filePenalty = Math.min(20, Math.max(0, i.filesChanged - 5) * 2);
  return Math.max(0, Math.min(100, base - filePenalty));
}
