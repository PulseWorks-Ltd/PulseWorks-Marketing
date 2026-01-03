import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { usageTracking } from '../services/usageTracking';

const router = Router();

// Get usage summary for current billing period
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const summary = await usageTracking.getUsageSummary(req.accountId!);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// Check if can create content of specific type
router.post('/check', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { contentType } = req.body;

    if (!contentType || !['STATIC', 'VIDEO'].includes(contentType)) {
      res.status(400).json({ error: 'Valid contentType required (STATIC or VIDEO)' });
      return;
    }

    const check = await usageTracking.canCreateContent(req.accountId!, contentType);

    res.json(check);
  } catch (error) {
    next(error);
  }
});

// Check if can autopost
router.post('/check-autopost', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const check = await usageTracking.canAutopost(req.accountId!);
    res.json(check);
  } catch (error) {
    next(error);
  }
});

// Check if can upload images
router.post('/check-uploads', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const check = await usageTracking.canUploadImages(req.accountId!);
    res.json(check);
  } catch (error) {
    next(error);
  }
});

export default router;
