/**
 * Quality axis — combines static analysis + LLM judge rubric.
 * - static: lint errors, type errors, complexity, duplication
 * - llm: rubric-based review (readability, idiomatic, separation of concerns)
 */

export interface StaticAnalysisInput {
  workspacePath: string;
  lintCommand?: string;
  typeCheckCommand?: string;
}

export interface StaticAnalysisResult {
  lintErrors: number;
  lintWarnings: number;
  typeErrors: number;
  cyclomaticComplexityAvg: number;
  duplicationPct: number;
}

export async function runStaticAnalysis(
  _input: StaticAnalysisInput,
): Promise<StaticAnalysisResult> {
  // TODO(runtime): ESLint + tsc + jscpd in sandbox
  return {
    lintErrors: 0,
    lintWarnings: 0,
    typeErrors: 0,
    cyclomaticComplexityAvg: 0,
    duplicationPct: 0,
  };
}

export function staticScore(r: StaticAnalysisResult): number {
  // 100 - penalties
  let score = 100;
  score -= r.lintErrors * 3;
  score -= r.lintWarnings * 0.5;
  score -= r.typeErrors * 5;
  score -= Math.max(0, r.cyclomaticComplexityAvg - 10) * 2;
  score -= r.duplicationPct;
  return Math.max(0, Math.min(100, score));
}
