// BullMQ queue for publishing posts
// Centralized queue instance to avoid circular dependencies

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Define job types
export interface PublishPostJob {
  scheduleItemId: string;
}

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create publish queue
export const publishQueue = new Queue<PublishPostJob>('publish-posts', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000, // 1 minute
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
    },
  },
});

/**
 * Enqueue a publish job for a schedule item
 * @param scheduleItemId - ID of the schedule item to publish
 * @param scheduledFor - When the post should be published
 */
export async function enqueuePublishJob(
  scheduleItemId: string,
  scheduledFor: Date
): Promise<void> {
  const now = new Date();
  const delay = Math.max(0, scheduledFor.getTime() - now.getTime());

  await publishQueue.add(
    'publish-post',
    { scheduleItemId },
    {
      delay,
      jobId: `publish-${scheduleItemId}`, // Prevents duplicate jobs
    }
  );

  console.log(`Enqueued publish job for ${scheduleItemId} with delay ${delay}ms (${Math.round(delay / 1000 / 60)} minutes)`);
}
