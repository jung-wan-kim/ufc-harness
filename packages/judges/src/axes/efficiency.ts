/**
 * Efficiency axis — wall time, tokens, API calls.
 * Normalizes against per-challenge baseline/budget.
 */

export interface EfficiencyInput {
  wallTimeSec: number;
  timeBudgetSec: number;
  tokensUsed: number;
  tokenBudget: number;
  apiCalls: number;
  apiCallBudget: number;
}

export function scoreEfficiency(i: EfficiencyInput): number {
  const timeScore = Math.max(0, 1 - i.wallTimeSec / i.timeBudgetSec) * 40;
  const tokenScore = Math.max(0, 1 - i.tokensUsed / i.tokenBudget) * 40;
  const callScore = Math.max(0, 1 - i.apiCalls / i.apiCallBudget) * 20;
  return Math.min(100, timeScore + tokenScore + callScore);
}
