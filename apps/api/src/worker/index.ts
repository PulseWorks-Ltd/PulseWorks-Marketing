import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../db/client';
import { ayrshareClient } from '../services/ayrshare';
import { logAuditEvent } from '../utils/audit';
import { PublishPostJob } from '../services/queue';

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create worker
const worker = new Worker<PublishPostJob>(
  'publish-posts',
  async (job: Job<PublishPostJob>) => {
    const { scheduleItemId } = job.data;

    console.log(`Processing publish job for schedule item: ${scheduleItemId}`);

    // Load schedule item with content
    const scheduleItem = await prisma.scheduleItem.findUnique({
      where: { id: scheduleItemId },
      include: {
        contentItem: true,
        account: true,
      },
    });

    if (!scheduleItem) {
      throw new Error(`Schedule item not found: ${scheduleItemId}`);
    }

    // Verify account ownership
    if (scheduleItem.contentItem.accountId !== scheduleItem.accountId) {
      throw new Error('Account mismatch - security violation');
    }

    // Verify provider profile still matches
    const publishingProfile = await prisma.publishingProfile.findUnique({
      where: { accountId: scheduleItem.accountId },
    });

    if (!publishingProfile) {
      throw new Error('Publishing profile not found');
    }

    const expectedProfileId =
      scheduleItem.platform === 'FACEBOOK'
        ? publishingProfile.facebookProfileId
        : publishingProfile.instagramProfileId;

    if (scheduleItem.providerProfileId !== expectedProfileId) {
      throw new Error('Provider profile mismatch - destinations may have changed');
    }

    // Prepare post data
    const platformKey = scheduleItem.platform.toLowerCase();
    const caption = scheduleItem.contentItem.caption;
    const hashtags = (scheduleItem.contentItem.hashtags as string[]) || [];
    const hashtagsText = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    const fullText = `${caption}\n\n${hashtagsText}`;

    const mediaUrls = scheduleItem.contentItem.mediaUrl
      ? [scheduleItem.contentItem.mediaUrl]
      : [];

    // Post via Ayrshare
    try {
      const response = await ayrshareClient.createPost({
        post: fullText,
        platforms: [platformKey],
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        profileKey: scheduleItem.providerProfileId, // Use frozen provider profile
      });

      // Update schedule item with results
      const postResult = response.postIds?.find((p) => p.platform === platformKey);

      await prisma.scheduleItem.update({
        where: { id: scheduleItemId },
        data: {
          providerJobId: response.id,
          providerPostId: postResult?.postId,
          postUrl: postResult?.postUrl,
          status: postResult?.status === 'success' ? 'PUBLISHED' : 'FAILED',
          errorMessage: response.errors?.[0]?.message,
        },
      });

      // Check if all schedule items for this content are published
      const allSchedules = await prisma.scheduleItem.findMany({
        where: { contentItemId: scheduleItem.contentItemId },
      });

      const allPublished = allSchedules.every((s) => s.status === 'PUBLISHED');

      if (allPublished) {
        await prisma.contentItem.update({
          where: { id: scheduleItem.contentItemId },
          data: { status: 'PUBLISHED' },
        });
      }

      // Log audit event
      await logAuditEvent({
        accountId: scheduleItem.accountId,
        eventType: postResult?.status === 'success' ? 'POST_PUBLISHED' : 'POST_FAILED',
        entityType: 'ScheduleItem',
        entityId: scheduleItemId,
        metadata: {
          platform: scheduleItem.platform,
          contentId: scheduleItem.contentItemId,
          postUrl: postResult?.postUrl,
        },
      });

      console.log(`Successfully published: ${scheduleItemId}`);
    } catch (error) {
      console.error(`Failed to publish: ${scheduleItemId}`, error);

      // Update schedule item with error
      await prisma.scheduleItem.update({
        where: { id: scheduleItemId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      await logAuditEvent({
        accountId: scheduleItem.accountId,
        eventType: 'POST_FAILED',
        entityType: 'ScheduleItem',
        entityId: scheduleItemId,
        metadata: {
          platform: scheduleItem.platform,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('🚀 Posting worker started');
console.log('📊 Connected to Redis:', process.env.REDIS_URL || 'redis://localhost:6379');
console.log('✅ Jobs are enqueued immediately when schedules are created (no polling)');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...');
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
});
