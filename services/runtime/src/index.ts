/**
 * Runtime worker — consumes BullMQ `submission:execute` jobs.
 *
 * Flow per job:
 *   1. clone harness repo @ commit_sha → isolated workspace
 *   2. clone challenge starter repo
 *   3. inject BYOK keys (ephemeral env)
 *   4. spawn Docker container w/ cgroup limits + network allowlist
 *   5. run entrypoint (e.g. `claude code "solve this challenge"`)
 *   6. capture diff + logs + metrics → upload artifacts
 *   7. enqueue `submission:evaluate` job
 *
 * See: docs/SECURITY.md for isolation details.
 */
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { runSubmission } from './run-submission';

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'submission:execute',
  async (job) => {
    const { submissionId } = job.data as { submissionId: string };
    return runSubmission(submissionId);
  },
  {
    connection: redis,
    concurrency: Number(process.env.RUNTIME_MAX_CONCURRENT ?? '8'),
  },
);

worker.on('completed', (job) => {
  console.log(`[runtime] submission=${job.data.submissionId} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[runtime] submission=${job?.data?.submissionId} failed:`, err);
});

console.log('[runtime] worker started');
