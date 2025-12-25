import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { monthlyBriefSchema } from '@shared/types';
import { logAuditEvent } from '../utils/audit';

const router = Router();

// Get monthly briefs
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const briefs = await prisma.monthlyBrief.findMany({
      where: { accountId: req.accountId },
      orderBy: { month: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        content: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    res.json(briefs);
  } catch (error) {
    next(error);
  }
});

// Get brief by month
router.get('/:month', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const month = new Date(req.params.month);

    const brief = await prisma.monthlyBrief.findUnique({
      where: {
        accountId_month: {
          accountId: req.accountId!,
          month,
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        content: true,
      },
    });

    if (!brief) {
      res.status(404).json({ error: 'Brief not found' });
      return;
    }

    res.json(brief);
  } catch (error) {
    next(error);
  }
});

// Create or update brief
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = monthlyBriefSchema.parse(req.body);
    const month = new Date(body.month);

    const brief = await prisma.monthlyBrief.upsert({
      where: {
        accountId_month: {
          accountId: req.accountId!,
          month,
        },
      },
      create: {
        accountId: req.accountId!,
        month,
        primaryFocus: body.primaryFocus,
        secondaryFocus: body.secondaryFocus,
        promoEnabled: body.promoEnabled,
        promoText: body.promoText,
        tone: body.tone,
        notes: body.notes,
        createdByUserId: req.userId!,
      },
      update: {
        primaryFocus: body.primaryFocus,
        secondaryFocus: body.secondaryFocus,
        promoEnabled: body.promoEnabled,
        promoText: body.promoText,
        tone: body.tone,
        notes: body.notes,
      },
    });

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: brief ? 'BRIEF_UPDATED' : 'BRIEF_CREATED',
      entityType: 'MonthlyBrief',
      entityId: brief.id,
    });

    res.json(brief);
  } catch (error) {
    next(error);
  }
});

export default router;
