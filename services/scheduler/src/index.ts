/**
 * Scheduler — triggers new challenges every 4 hours and enqueues submissions.
 *
 * Cron jobs:
 *   "0 *\/4 * * *"  — open next challenge, fan-out submissions to all auto-submit harnesses
 *   "*\/5 * * * *"  — tick: close expired challenges, finalize ELO for completed rounds
 *   "0 0 * * 0"     — weekly: publish weekly leaderboard snapshot
 */
import { Cron } from 'croner';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { openNextChallenge } from './open-challenge';
import { tickSubmissions } from './tick';

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const executeQueue = new Queue('submission:execute', { connection: redis });

new Cron('0 */4 * * *', { timezone: 'UTC' }, async () => {
  const challenge = await openNextChallenge();
  console.log(`[scheduler] opened challenge=${challenge.id}`);
  await fanOutSubmissions(challenge.id);
});

new Cron('*/5 * * * *', { timezone: 'UTC' }, async () => {
  await tickSubmissions();
});

async function fanOutSubmissions(challengeId: string) {
  // TODO: fetch all ACTIVE harnesses w/ auto_submit=true, enqueue one job each
  const submissionIds: string[] = [];
  for (const id of submissionIds) {
    await executeQueue.add(
      'execute',
      { submissionId: id },
      { attempts: 2, backoff: { type: 'exponential', delay: 30_000 } },
    );
  }
  console.log(`[scheduler] fanned out ${submissionIds.length} submissions for ${challengeId}`);
}

console.log('[scheduler] started');
