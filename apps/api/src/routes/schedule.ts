import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate, AuthRequest, requirePostingAddon } from '../middleware/auth';
import { postingRuleSchema, schedulePostsSchema } from '@shared/types';
import { scheduler } from '../services/scheduler';
import { logAuditEvent } from '../utils/audit';

const router = Router();

// Get posting rules
router.get('/rules', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const rules = await prisma.postingRule.findUnique({
      where: { accountId: req.accountId },
    });

    res.json(rules);
  } catch (error) {
    next(error);
  }
});

// Create/update posting rules
router.post('/rules', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = postingRuleSchema.parse(req.body);

    const rules = await prisma.postingRule.upsert({
      where: { accountId: req.accountId! },
      create: {
        accountId: req.accountId!,
        frequency: body.frequency,
        daysOfWeek: body.daysOfWeek,
        timeWindow: body.timeWindow,
        fixedTime: body.fixedTime,
      },
      update: {
        frequency: body.frequency,
        daysOfWeek: body.daysOfWeek,
        timeWindow: body.timeWindow,
        fixedTime: body.fixedTime,
      },
    });

    res.json(rules);
  } catch (error) {
    next(error);
  }
});

// Get upcoming schedule
router.get('/upcoming', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const items = await scheduler.getUpcomingSchedule(req.accountId!, limit);

    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Schedule posts
router.post('/schedule', authenticate, requirePostingAddon, async (req: AuthRequest, res, next) => {
  try {
    const body = schedulePostsSchema.parse(req.body);

    const result = await scheduler.scheduleContent({
      accountId: req.accountId!,
      contentItemIds: body.contentItemIds,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
    });

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'POSTS_SCHEDULED',
      entityType: 'ScheduleItem',
      metadata: { count: result.scheduled },
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Cancel scheduled post
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const scheduleItem = await prisma.scheduleItem.findFirst({
      where: {
        id: req.params.id,
        accountId: req.accountId,
      },
    });

    if (!scheduleItem) {
      res.status(404).json({ error: 'Schedule item not found' });
      return;
    }

    if (scheduleItem.status === 'PUBLISHED') {
      res.status(400).json({ error: 'Cannot cancel published post' });
      return;
    }

    await prisma.scheduleItem.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    // Update content item status if needed
    const remainingSchedules = await prisma.scheduleItem.count({
      where: {
        contentItemId: scheduleItem.contentItemId,
        status: { in: ['QUEUED', 'SCHEDULED'] },
      },
    });

    if (remainingSchedules === 0) {
      await prisma.contentItem.update({
        where: { id: scheduleItem.contentItemId },
        data: { status: 'APPROVED' },
      });
    }

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'SCHEDULE_CANCELLED',
      entityType: 'ScheduleItem',
      entityId: req.params.id,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
