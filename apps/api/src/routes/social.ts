import { Router } from 'express';
import { prisma } from '../db/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { verifyDestinationsSchema } from '@shared/types';
import { ayrshareClient } from '../services/ayrshare';
import { logAuditEvent } from '../utils/audit';

const router = Router();

// Get social connections
router.get('/connections', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const connections = await prisma.socialConnection.findMany({
      where: { accountId: req.accountId },
    });

    res.json(connections);
  } catch (error) {
    next(error);
  }
});

// Get publishing profile
router.get('/publishing-profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const profile = await prisma.publishingProfile.findUnique({
      where: { accountId: req.accountId },
      include: {
        verifiedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// Connect social account (simplified - real implementation would use OAuth)
router.post('/connect', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { platform } = req.body;

    // In production, this would:
    // 1. Generate Ayrshare profile key for this account
    // 2. Redirect to Ayrshare OAuth flow
    // 3. Store returned credentials
    //
    // For MVP, we'll simulate with manual API key setup

    // Generate profile key
    const profileKeyResponse = await ayrshareClient.generateProfileKey(
      `${req.accountId}-${platform}`
    );

    // Get connected profiles
    const profiles = await ayrshareClient.getProfiles();

    // Create or update connection
    const connection = await prisma.socialConnection.upsert({
      where: {
        accountId_platform: {
          accountId: req.accountId!,
          platform,
        },
      },
      create: {
        accountId: req.accountId!,
        provider: 'ayrshare',
        platform,
        providerProfileId: profileKeyResponse.profileKey,
        status: 'ACTIVE',
      },
      update: {
        providerProfileId: profileKeyResponse.profileKey,
        status: 'ACTIVE',
        lastCheckedAt: new Date(),
      },
    });

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'SOCIAL_CONNECTED',
      entityType: 'SocialConnection',
      entityId: connection.id,
      metadata: { platform },
    });

    res.json({
      success: true,
      connection,
      profileKey: profileKeyResponse.profileKey,
      message: 'Use this profile key in Ayrshare dashboard to connect your social accounts',
    });
  } catch (error) {
    next(error);
  }
});

// Verify publishing destinations
router.post('/verify-destinations', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = verifyDestinationsSchema.parse(req.body);

    if (!body.confirmed) {
      res.status(400).json({ error: 'Destinations must be confirmed' });
      return;
    }

    // Get connections
    const connections = await prisma.socialConnection.findMany({
      where: { accountId: req.accountId },
    });

    const fbConnection = connections.find((c) => c.platform === 'FACEBOOK');
    const igConnection = connections.find((c) => c.platform === 'INSTAGRAM');

    // Create or update publishing profile
    const profile = await prisma.publishingProfile.upsert({
      where: { accountId: req.accountId! },
      create: {
        accountId: req.accountId!,
        facebookProfileId: fbConnection?.providerProfileId,
        facebookPageName: fbConnection?.platformAccountName,
        facebookPageId: fbConnection?.platformAccountId,
        instagramProfileId: igConnection?.providerProfileId,
        instagramHandle: igConnection?.platformHandle,
        instagramAccountId: igConnection?.platformAccountId,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedByUserId: req.userId,
      },
      update: {
        facebookProfileId: fbConnection?.providerProfileId,
        facebookPageName: fbConnection?.platformAccountName,
        facebookPageId: fbConnection?.platformAccountId,
        instagramProfileId: igConnection?.providerProfileId,
        instagramHandle: igConnection?.platformHandle,
        instagramAccountId: igConnection?.platformAccountId,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedByUserId: req.userId,
      },
    });

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'PUBLISHING_VERIFIED',
      entityType: 'PublishingProfile',
      entityId: profile.id,
    });

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// Disconnect social account
router.delete('/disconnect/:platform', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { platform } = req.params;

    await prisma.socialConnection.updateMany({
      where: {
        accountId: req.accountId,
        platform: platform as any,
      },
      data: {
        status: 'DISCONNECTED',
      },
    });

    // Update publishing profile
    const updateData: any = {};
    if (platform === 'FACEBOOK') {
      updateData.facebookProfileId = null;
      updateData.facebookPageName = null;
      updateData.facebookPageId = null;
    } else if (platform === 'INSTAGRAM') {
      updateData.instagramProfileId = null;
      updateData.instagramHandle = null;
      updateData.instagramAccountId = null;
    }

    await prisma.publishingProfile.updateMany({
      where: { accountId: req.accountId },
      data: {
        ...updateData,
        status: 'NEEDS_RECONNECT',
      },
    });

    await logAuditEvent({
      accountId: req.accountId!,
      userId: req.userId,
      eventType: 'SOCIAL_DISCONNECTED',
      entityType: 'SocialConnection',
      metadata: { platform },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
