/**
 * Correctness axis — runs the challenge's test suite against the harness output.
 * Returns score 0-100 based on pass rate.
 */

export interface TestResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export interface CorrectnessInput {
  workspacePath: string;
  testCommand: string; // e.g. "pnpm test"
  timeoutSec: number;
}

export async function scoreCorrectness(_input: CorrectnessInput): Promise<{
  score: number;
  result: TestResult;
}> {
  // TODO(runtime): spawn test command inside sandbox, parse junit/tap output
  // Placeholder until runtime integration is wired up.
  const result: TestResult = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
  };
  const score = result.total === 0 ? 0 : (result.passed / result.total) * 100;
  return { score, result };
}
