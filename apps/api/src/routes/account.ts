import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get account details
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.accountId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        publishingProfile: true,
        postingRule: true,
      },
    });

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    res.json(account);
  } catch (error) {
    next(error);
  }
});

// Update account
router.patch('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, websiteUrl, timezone } = req.body;

    const account = await prisma.account.update({
      where: { id: req.accountId },
      data: {
        ...(name && { name }),
        ...(websiteUrl && { websiteUrl }),
        ...(timezone && { timezone }),
      },
    });

    res.json(account);
  } catch (error) {
    next(error);
  }
});

export default router;
