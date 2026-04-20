/**
 * Simple ELO rating.
 *  K-factor: 32 (new), 16 (rated >30 games), 8 (rated >100 games)
 *  Draw = 0.5, Win = 1, Loss = 0
 *  Also supports non-binary outcomes: score [0..1] derived from total score delta.
 */

export interface EloState {
  rating: number;
  gamesPlayed: number;
}

export function kFactor(gamesPlayed: number): number {
  if (gamesPlayed > 100) return 8;
  if (gamesPlayed > 30) return 16;
  return 32;
}

export function expectedScore(a: EloState, b: EloState): number {
  return 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
}

/** outcome: 1 = A wins, 0 = B wins, 0.5 = draw, or any value in [0, 1]. */
export function updateElo(
  a: EloState,
  b: EloState,
  outcome: number,
): { a: EloState; b: EloState } {
  const expectedA = expectedScore(a, b);
  const expectedB = 1 - expectedA;
  const kA = kFactor(a.gamesPlayed);
  const kB = kFactor(b.gamesPlayed);

  return {
    a: {
      rating: Math.round(a.rating + kA * (outcome - expectedA)),
      gamesPlayed: a.gamesPlayed + 1,
    },
    b: {
      rating: Math.round(b.rating + kB * (1 - outcome - expectedB)),
      gamesPlayed: b.gamesPlayed + 1,
    },
  };
}

/** Convert 5-axis scores (0-100) to [0,1] outcome using normalized delta. */
export function outcomeFromScores(totalA: number, totalB: number): number {
  const delta = totalA - totalB;
  // Sigmoid centered at 0, width 30 (i.e. 30 point diff ≈ 0.88 outcome)
  return 1 / (1 + Math.exp(-delta / 30));
}
