/**
 * Robustness axis — adversarial test suite (edge cases, hidden tests, fuzzing).
 * Runs a *second* test set the harness did NOT see during solving.
 */

export interface RobustnessInput {
  workspacePath: string;
  adversarialTestUrl: string;
  timeoutSec: number;
}

export interface RobustnessResult {
  hiddenTestsTotal: number;
  hiddenTestsPassed: number;
  fuzzCasesRun: number;
  fuzzCasesFailed: number;
  regressionDetected: boolean;
}

export async function scoreRobustness(_input: RobustnessInput): Promise<{
  score: number;
  result: RobustnessResult;
}> {
  // TODO(runtime): run hidden tests + lightweight fuzz in sandbox
  const result: RobustnessResult = {
    hiddenTestsTotal: 0,
    hiddenTestsPassed: 0,
    fuzzCasesRun: 0,
    fuzzCasesFailed: 0,
    regressionDetected: false,
  };
  const base = result.hiddenTestsTotal === 0
    ? 0
    : (result.hiddenTestsPassed / result.hiddenTestsTotal) * 100;
  const penalty = result.regressionDetected ? 20 : 0;
  return { score: Math.max(0, base - penalty), result };
}
