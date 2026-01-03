// Usage tracking service for PostLoop quota management
import { prisma } from '../db/client';
import { PLAN_LIMITS, STARTER_AUTOPOST_CAP } from '@shared/types';

export class UsageTrackingService {
  /**
   * Get or create usage counter for current billing period
   */
  async getUsageCounter(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        currentPeriodStart: true,
        currentPeriodEnd: true,
        usageCounter: true,
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    if (!account.currentPeriodStart || !account.currentPeriodEnd) {
      throw new Error('Billing period not set - subscription may not be active');
    }

    const now = new Date();
    const periodStart = new Date(account.currentPeriodStart);
    const periodEnd = new Date(account.currentPeriodEnd);

    // Check if current counter is for current period
    if (
      account.usageCounter &&
      account.usageCounter.periodStart.getTime() === periodStart.getTime() &&
      account.usageCounter.periodEnd.getTime() === periodEnd.getTime()
    ) {
      return account.usageCounter;
    }

    // Create new counter for current period (or period has rolled over)
    return await prisma.usageCounter.upsert({
      where: { accountId },
      create: {
        accountId,
        staticUsed: 0,
        videoUsed: 0,
        autopostUsed: 0,
        periodStart,
        periodEnd,
      },
      update: {
        staticUsed: 0,
        videoUsed: 0,
        autopostUsed: 0,
        periodStart,
        periodEnd,
      },
    });
  }

  /**
   * Check if account can create content of given type
   */
  async canCreateContent(
    accountId: string,
    contentType: 'STATIC' | 'VIDEO'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { plan: true },
    });

    if (!account) {
      return { allowed: false, reason: 'Account not found' };
    }

    const limits = PLAN_LIMITS[account.plan];

    if (contentType === 'VIDEO' && limits.videosPerMonth === 0) {
      return {
        allowed: false,
        reason: `Video creation is not available on the ${account.plan} plan. Upgrade to Growth or Pro.`,
      };
    }

    const usage = await this.getUsageCounter(accountId);

    if (contentType === 'STATIC') {
      if (usage.staticUsed >= limits.staticPostsPerMonth) {
        return {
          allowed: false,
          reason: `Monthly quota reached (${limits.staticPostsPerMonth} static posts). Purchase additional posts or upgrade your plan.`,
        };
      }
    } else if (contentType === 'VIDEO') {
      if (usage.videoUsed >= limits.videosPerMonth) {
        return {
          allowed: false,
          reason: `Monthly quota reached (${limits.videosPerMonth} videos). Purchase additional videos or upgrade your plan.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if account can schedule auto-post
   */
  async canAutopost(accountId: string): Promise<{ allowed: boolean; reason?: string }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { plan: true, autopostAddon: true },
    });

    if (!account) {
      return { allowed: false, reason: 'Account not found' };
    }

    const limits = PLAN_LIMITS[account.plan];

    // Check plan allows autoposting
    if (!limits.autoposting && !account.autopostAddon) {
      return {
        allowed: false,
        reason: 'Auto-posting is not available on your plan. Add the auto-posting add-on or upgrade.',
      };
    }

    // Check Starter + addon cap
    if (account.plan === 'STARTER' && account.autopostAddon) {
      const usage = await this.getUsageCounter(accountId);
      if (usage.autopostUsed >= STARTER_AUTOPOST_CAP) {
        return {
          allowed: false,
          reason: `Auto-post quota reached (${STARTER_AUTOPOST_CAP} posts per month on Starter + add-on).`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if account can upload images
   */
  async canUploadImages(accountId: string): Promise<{ allowed: boolean; reason?: string }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { plan: true },
    });

    if (!account) {
      return { allowed: false, reason: 'Account not found' };
    }

    const limits = PLAN_LIMITS[account.plan];

    if (!limits.imageUploads) {
      return {
        allowed: false,
        reason: 'Image uploads are not available on the Starter plan. Upgrade to Growth or Pro.',
      };
    }

    return { allowed: true };
  }

  /**
   * Increment static post usage
   */
  async incrementStaticUsage(accountId: string): Promise<void> {
    const usage = await this.getUsageCounter(accountId);

    await prisma.usageCounter.update({
      where: { id: usage.id },
      data: { staticUsed: { increment: 1 } },
    });
  }

  /**
   * Increment video usage
   */
  async incrementVideoUsage(accountId: string): Promise<void> {
    const usage = await this.getUsageCounter(accountId);

    await prisma.usageCounter.update({
      where: { id: usage.id },
      data: { videoUsed: { increment: 1 } },
    });
  }

  /**
   * Increment autopost usage (for Starter + addon tracking)
   */
  async incrementAutopostUsage(accountId: string): Promise<void> {
    const usage = await this.getUsageCounter(accountId);

    await prisma.usageCounter.update({
      where: { id: usage.id },
      data: { autopostUsed: { increment: 1 } },
    });
  }

  /**
   * Get usage summary for account
   */
  async getUsageSummary(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        plan: true,
        autopostAddon: true,
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const limits = PLAN_LIMITS[account.plan];
    const usage = await this.getUsageCounter(accountId);

    return {
      plan: account.plan,
      autopostAddon: account.autopostAddon,
      period: {
        start: usage.periodStart,
        end: usage.periodEnd,
      },
      static: {
        used: usage.staticUsed,
        limit: limits.staticPostsPerMonth,
        remaining: Math.max(0, limits.staticPostsPerMonth - usage.staticUsed),
      },
      video: {
        used: usage.videoUsed,
        limit: limits.videosPerMonth,
        remaining: Math.max(0, limits.videosPerMonth - usage.videoUsed),
      },
      autopost: {
        used: usage.autopostUsed,
        limit:
          account.plan === 'STARTER' && account.autopostAddon
            ? STARTER_AUTOPOST_CAP
            : null,
        enabled: limits.autoposting || account.autopostAddon,
      },
      features: {
        autoposting: limits.autoposting || account.autopostAddon,
        imageUploads: limits.imageUploads,
        videoCreation: limits.videosPerMonth > 0,
      },
    };
  }
}

export const usageTracking = new UsageTrackingService();
