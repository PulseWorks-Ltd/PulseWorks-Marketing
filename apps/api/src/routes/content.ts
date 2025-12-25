import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { editContentSchema, bulkActionSchema } from '@shared/types';
import { logAuditEvent } from '../utils/audit';
import { brandProfileService } from '../services/brandProfileService';
import { contentGeneratorV2 } from '../services/ai/contentGeneratorV2';
import { imageGenerator } from '../services/imageGenerator';
import { storageService } from '../services/storage';
import { PLAN_LIMITS } from '@shared/types';

const router = Router();

// Get content items
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { month, status } = req.query;

    const where: any = { accountId: req.accountId };

    if (month) {
      where.month = new Date(month as string);
    }

    if (status) {
      where.status = status;
    }

    const content = await prisma.contentItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json(content);
  } catch (error) {
    next(error);
  }
});

// Generate content pack
router.post('/generate', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { monthlyBriefId } = req.body;

    // Load brief
    const brief = await prisma.monthlyBrief.findFirst({
      where: {
        id: monthlyBriefId,
        accountId: req.accountId,
      },
    });

    if (!brief) {
      res.status(404).json({ error: 'Monthly brief not found' });
      return;
    }

    // Load account
    const account = await prisma.account.findUnique({
      where: { id: req.accountId },
    });

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    // Get BrandProfile (auto-creates if missing)
    // CRITICAL: This is the SINGLE SOURCE OF TRUTH for brand identity
    const brandProfile = await brandProfileService.getBrandProfile(req.accountId!);

    // Parse visual style and voice rules from JSON
    const visualStyle = brandProfile.visualStyle as { colors: string[]; mood?: string };
    const brandVoiceRules = brandProfile.brandVoiceRules as { do: string[]; dont: string[] };

    // Generate content using BrandProfile
    const generatedContent = await contentGeneratorV2.generateContentPack({
      // BrandProfile fields
      toneKeywords: brandProfile.toneKeywords as string[],
      brandVoiceRules,
      contentPillars: brandProfile.contentPillars as string[],
      audienceSummary: brandProfile.audienceSummary,
      visualStyle,

      // Brief fields
      primaryFocus: brief.primaryFocus,
      secondaryFocus: brief.secondaryFocus || undefined,
      promoEnabled: brief.promoEnabled,
      promoText: brief.promoText || undefined,
      tone: brief.tone,
      plan: account.plan,

      // Account context
      businessName: account.name,
    });

    // Generate images and save content items
    const contentItems = [];

    for (const content of generatedContent) {
      // Generate image using BrandProfile colors
      const imageBuffer = await imageGenerator.generateImage({
        type: content.type,
        title: content.title,
        colorPalette: visualStyle.colors,
        brandName: account.name,
      });

      // Upload to S3
      const imagePath = `media/${account.id}/${brief.month.toISOString().slice(0, 7)}/${Date.now()}.png`;
      const imageUrl = await storageService.uploadImage(imageBuffer, imagePath);

      // Save content item
      const item = await prisma.contentItem.create({
        data: {
          accountId: req.accountId!,
          monthlyBriefId: brief.id,
          month: brief.month,
          type: content.type,
          title: content.title,
          caption: content.caption,
          hashtags: content.hashtags,
          mediaUrl: imageUrl,
          mediaType: 'IMAGE',
          platformTargets: content.platformTargets,
          status: 'DRAFT',
        },
      });

      contentItems.push(item);
    }

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'CONTENT_GENERATED',
      entityType: 'MonthlyBrief',
      entityId: brief.id,
      metadata: { count: contentItems.length },
    });

    res.json({
      success: true,
      count: contentItems.length,
      items: contentItems,
    });
  } catch (error) {
    next(error);
  }
});

// Approve content
router.post('/:id/approve', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const content = await prisma.contentItem.findFirst({
      where: {
        id: req.params.id,
        accountId: req.accountId,
      },
    });

    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    const updated = await prisma.contentItem.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approvedByUserId: req.userId,
        approvedAt: new Date(),
      },
    });

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'CONTENT_APPROVED',
      entityType: 'ContentItem',
      entityId: updated.id,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Edit content
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = editContentSchema.parse(req.body);

    const content = await prisma.contentItem.findFirst({
      where: {
        id: req.params.id,
        accountId: req.accountId,
      },
      include: { account: true },
    });

    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    // Check edit limits
    const limits = PLAN_LIMITS[content.account.plan];
    const newEditCount = content.editCount + 1;

    if (newEditCount > limits.editsPerMonth) {
      res.status(403).json({
        error: 'Edit limit reached',
        message: `Your ${content.account.plan} plan allows ${limits.editsPerMonth} edits per month`,
      });
      return;
    }

    const updated = await prisma.contentItem.update({
      where: { id: req.params.id },
      data: {
        caption: body.caption,
        hashtags: body.hashtags,
        platformTargets: body.platformTargets,
        editCount: newEditCount,
      },
    });

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'CONTENT_EDITED',
      entityType: 'ContentItem',
      entityId: updated.id,
      metadata: { editCount: newEditCount },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Skip content
router.post('/:id/skip', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const content = await prisma.contentItem.findFirst({
      where: {
        id: req.params.id,
        accountId: req.accountId,
      },
    });

    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    const updated = await prisma.contentItem.update({
      where: { id: req.params.id },
      data: { status: 'SKIPPED' },
    });

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'CONTENT_SKIPPED',
      entityType: 'ContentItem',
      entityId: updated.id,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Bulk actions
router.post('/bulk', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = bulkActionSchema.parse(req.body);

    const updates: any = {};
    let eventType: any;

    if (body.action === 'approve') {
      updates.status = 'APPROVED';
      updates.approvedByUserId = req.userId;
      updates.approvedAt = new Date();
      eventType = 'CONTENT_APPROVED';
    } else if (body.action === 'skip') {
      updates.status = 'SKIPPED';
      eventType = 'CONTENT_SKIPPED';
    } else if (body.action === 'delete') {
      // Delete schedule items first
      await prisma.scheduleItem.deleteMany({
        where: {
          contentItemId: { in: body.contentItemIds },
          accountId: req.accountId,
        },
      });

      // Delete content items
      await prisma.contentItem.deleteMany({
        where: {
          id: { in: body.contentItemIds },
          accountId: req.accountId,
        },
      });

      res.json({ success: true, deleted: body.contentItemIds.length });
      return;
    }

    // Update multiple items
    await prisma.contentItem.updateMany({
      where: {
        id: { in: body.contentItemIds },
        accountId: req.accountId,
      },
      data: updates,
    });

    // Log events
    for (const id of body.contentItemIds) {
      await logAuditEvent({
        accountId: req.accountId!,
        userId: req.userId,
        eventType,
        entityType: 'ContentItem',
        entityId: id,
      });
    }

    res.json({ success: true, updated: body.contentItemIds.length });
  } catch (error) {
    next(error);
  }
});

export default router;
