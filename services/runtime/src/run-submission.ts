/**
 * Orchestrate a single submission end-to-end.
 * This is a skeleton — Phase 2 will flesh out sandbox container spawning.
 */
import { sandboxRun } from './sandbox';

export interface RunResult {
  submissionId: string;
  success: boolean;
  durationMs: number;
  tokensUsed: number;
  apiCalls: number;
  diffPath: string;
  logPath: string;
}

export async function runSubmission(submissionId: string): Promise<RunResult> {
  const started = Date.now();

  // TODO: fetch submission + harness + challenge metadata from DB (Phase 2)
  const harness = { repoUrl: '', commitSha: '', entrypoint: '', byokEnv: {} };
  const challenge = { starterRepoUrl: '', timeLimitSec: 1800 };

  const result = await sandboxRun({
    harness,
    challenge,
    workspaceId: submissionId,
  });

  return {
    submissionId,
    success: result.exitCode === 0,
    durationMs: Date.now() - started,
    tokensUsed: result.tokensUsed,
    apiCalls: result.apiCalls,
    diffPath: result.diffPath,
    logPath: result.logPath,
  };
}
