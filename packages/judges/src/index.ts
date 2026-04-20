/**
 * UFC-Harness Judging Engine
 *
 * 5-axis autonomous scoring:
 *   correctness — unit/integration test pass rate
 *   quality     — LLM judge consensus + static analysis
 *   efficiency  — time / tokens / API calls
 *   robustness  — adversarial test pass rate
 *   elegance    — diff size, change minimality
 *
 * Dual-judge (Claude + Codex). Tie-breaker when they disagree > threshold.
 */

export * from './axes/correctness';
export * from './axes/quality';
export * from './axes/efficiency';
export * from './axes/robustness';
export * from './axes/elegance';
export * from './dual-judge';
export * from './elo';
