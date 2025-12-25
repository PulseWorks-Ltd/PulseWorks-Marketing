import { prisma } from '../db/client';
import { Platform } from '@prisma/client';
import { startOfMonth, endOfMonth, addDays, setHours, setMinutes, isBefore, isAfter } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { TIME_WINDOWS } from '@shared/types';

export interface ScheduleRequest {
  accountId: string;
  contentItemIds: string[];
  startDate?: Date;
}

export interface ScheduleResult {
  scheduled: number;
  items: Array<{
    contentItemId: string;
    platform: Platform;
    scheduledFor: Date;
  }>;
}

export class Scheduler {
  async scheduleContent(request: ScheduleRequest): Promise<ScheduleResult> {
    // 1. Verify publishing profile
    const publishingProfile = await prisma.publishingProfile.findUnique({
      where: { accountId: request.accountId },
    });

    if (!publishingProfile || publishingProfile.status !== 'VERIFIED') {
      throw new Error('Publishing destinations must be verified before scheduling');
    }

    if (!publishingProfile.verifiedAt) {
      throw new Error('Publishing profile not verified');
    }

    // 2. Load posting rules
    const postingRule = await prisma.postingRule.findUnique({
      where: { accountId: request.accountId },
    });

    if (!postingRule) {
      throw new Error('Posting rules not configured');
    }

    // 3. Load account timezone
    const account = await prisma.account.findUnique({
      where: { id: request.accountId },
      select: { timezone: true },
    });

    const timezone = account?.timezone || 'Pacific/Auckland';

    // 4. Load content items
    const contentItems = await prisma.contentItem.findMany({
      where: {
        id: { in: request.contentItemIds },
        accountId: request.accountId,
        status: 'APPROVED',
      },
    });

    if (contentItems.length === 0) {
      throw new Error('No approved content items found');
    }

    // 5. Generate schedule slots
    const startDate = request.startDate || new Date();
    const monthEnd = endOfMonth(startDate);

    const slots = this.generateTimeSlots(
      startDate,
      monthEnd,
      postingRule.daysOfWeek as number[],
      postingRule.timeWindow,
      postingRule.fixedTime,
      timezone
    );

    // 6. Distribute content across slots
    const scheduleItems: Array<{
      contentItemId: string;
      platform: Platform;
      scheduledFor: Date;
      providerProfileId: string;
    }> = [];

    let slotIndex = 0;

    for (const content of contentItems) {
      const platforms = content.platformTargets as Platform[];

      for (const platform of platforms) {
        if (slotIndex >= slots.length) {
          console.warn('Not enough slots for all content items');
          break;
        }

        // Get provider profile ID for this platform
        const providerProfileId =
          platform === 'FACEBOOK'
            ? publishingProfile.facebookProfileId
            : publishingProfile.instagramProfileId;

        if (!providerProfileId) {
          console.warn(`No provider profile for ${platform}`);
          continue;
        }

        scheduleItems.push({
          contentItemId: content.id,
          platform,
          scheduledFor: slots[slotIndex],
          providerProfileId,
        });

        slotIndex++;
      }
    }

    // 7. Create schedule items in database
    await prisma.$transaction(async (tx) => {
      // Delete existing schedules for these content items
      await tx.scheduleItem.deleteMany({
        where: {
          contentItemId: { in: request.contentItemIds },
          accountId: request.accountId,
        },
      });

      // Create new schedule items
      for (const item of scheduleItems) {
        await tx.scheduleItem.create({
          data: {
            accountId: request.accountId,
            contentItemId: item.contentItemId,
            platform: item.platform,
            scheduledFor: item.scheduledFor,
            providerProfileId: item.providerProfileId,
            status: 'QUEUED',
          },
        });

        // Update content item status
        await tx.contentItem.update({
          where: { id: item.contentItemId },
          data: { status: 'SCHEDULED' },
        });
      }
    });

    return {
      scheduled: scheduleItems.length,
      items: scheduleItems,
    };
  }

  private generateTimeSlots(
    startDate: Date,
    endDate: Date,
    daysOfWeek: number[],
    timeWindow: string,
    fixedTime: string | null,
    timezone: string
  ): Date[] {
    const slots: Date[] = [];

    // Get time from window or fixed time
    const timeStr = fixedTime || TIME_WINDOWS[timeWindow as keyof typeof TIME_WINDOWS] || TIME_WINDOWS.MORNING;
    const [hours, minutes] = timeStr.split(':').map(Number);

    let currentDate = startOfMonth(startDate);
    const end = endDate;

    while (isBefore(currentDate, end) || currentDate.getTime() === end.getTime()) {
      const dayOfWeek = currentDate.getDay() || 7; // Convert Sunday (0) to 7

      if (daysOfWeek.includes(dayOfWeek)) {
        // Create time in account's timezone
        let slotTime = setMinutes(setHours(currentDate, hours), minutes);

        // Convert to UTC for storage
        slotTime = zonedTimeToUtc(slotTime, timezone);

        // Only add if in future
        if (isAfter(slotTime, new Date())) {
          slots.push(slotTime);
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    return slots.sort((a, b) => a.getTime() - b.getTime());
  }

  async getUpcomingSchedule(accountId: string, limit = 50): Promise<any[]> {
    const items = await prisma.scheduleItem.findMany({
      where: {
        accountId,
        scheduledFor: { gte: new Date() },
        status: { in: ['QUEUED', 'SCHEDULED'] },
      },
      include: {
        contentItem: {
          select: {
            id: true,
            title: true,
            caption: true,
            mediaUrl: true,
            type: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
    });

    return items;
  }
}

export const scheduler = new Scheduler();
