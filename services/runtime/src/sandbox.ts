/**
 * Docker-based sandbox (Phase 2 initial impl).
 * Phase 3+: migrate to Firecracker microVM for stronger isolation.
 *
 * Guarantees:
 *  - CPU / RAM / disk hard limits (cgroup)
 *  - Network allowlist (api.anthropic.com, api.openai.com, github.com)
 *  - FS isolation: host FS not mounted; only /workspace mounted read-write
 *  - BYOK keys injected as env, never persisted to disk
 *  - Entry process runs as non-root
 */

export interface HarnessCtx {
  repoUrl: string;
  commitSha: string;
  entrypoint: string;
  byokEnv: Record<string, string>;
}

export interface ChallengeCtx {
  starterRepoUrl: string;
  timeLimitSec: number;
}

export interface SandboxInput {
  harness: HarnessCtx;
  challenge: ChallengeCtx;
  workspaceId: string;
}

export interface SandboxResult {
  exitCode: number;
  tokensUsed: number;
  apiCalls: number;
  diffPath: string;
  logPath: string;
}

export async function sandboxRun(_input: SandboxInput): Promise<SandboxResult> {
  // TODO(Phase 2): dockerode-based implementation
  //   - create container w/ image `ufc-harness/sandbox:latest`
  //   - attach volume: /workspace (tmpfs-backed)
  //   - apply allowlist via iptables in entrypoint script
  //   - stream logs to R2/S3
  //   - parse final diff via `git diff`
  return {
    exitCode: 0,
    tokensUsed: 0,
    apiCalls: 0,
    diffPath: '',
    logPath: '',
  };
}
