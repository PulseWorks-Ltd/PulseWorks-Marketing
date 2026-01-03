import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAuditEvent } from '../utils/audit';
import { PLAN_LIMITS, STARTER_AUTOPOST_ADDON_PRICE, ONE_TIME_STATIC_PRICE, ONE_TIME_VIDEO_PRICE } from '@shared/types';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Get pricing plans (PostLoop pricing)
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        price: 39,
        priceId: process.env.STRIPE_PRICE_STARTER,
        trial: true,
        features: [
          'Website scan + business profile',
          '8 static posts per month',
          'Manual download only',
          'No auto-posting',
          'No image uploads',
          'No video creation',
        ],
      },
      {
        id: 'growth',
        name: 'Growth',
        price: 99,
        priceId: process.env.STRIPE_PRICE_GROWTH,
        popular: true,
        trial: true,
        features: [
          'Website scan + business profile',
          '12 static posts per month',
          '4 videos per month',
          'Auto-posting included',
          'Upload images to create content',
          'Facebook Pages + Instagram',
        ],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 249,
        priceId: process.env.STRIPE_PRICE_PRO,
        trial: true,
        features: [
          'Website scan + business profile',
          '30 static posts per month',
          '16 videos per month',
          'Auto-posting included',
          'Campaign-style creation',
          'Priority rendering',
        ],
      },
    ],
    addon: {
      id: 'starter-autopost',
      name: 'Auto-posting Add-on',
      price: 30,
      priceId: process.env.STRIPE_PRICE_STARTER_AUTOPOST,
      planRequired: 'STARTER',
      features: [
        'Auto-post static posts only',
        'Max 8 scheduled posts per month',
        'Facebook Pages + Instagram',
      ],
    },
    oneTime: [
      {
        id: 'static-post',
        name: 'Single Static Post',
        price: 5,
        priceId: process.env.STRIPE_PRICE_STATIC_ONETIME,
      },
      {
        id: 'video',
        name: 'Single Video',
        price: 19,
        priceId: process.env.STRIPE_PRICE_VIDEO_ONETIME,
      },
    ],
  });
});

// Create checkout session (subscriptions or one-time)
router.post('/checkout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { priceId, mode = 'subscription', isAddon = false } = req.body;

    if (!priceId) {
      res.status(400).json({ error: 'Price ID required' });
      return;
    }

    const account = await prisma.account.findUnique({
      where: { id: req.accountId },
      include: { users: { where: { id: req.userId } } },
    });

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const user = account.users[0];

    // Create or retrieve Stripe customer
    let customerId = account.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          accountId: account.id,
          userId: user.id,
        },
      });

      customerId = customer.id;

      await prisma.account.update({
        where: { id: account.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: mode as 'subscription' | 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/billing?success=true`,
      cancel_url: `${APP_URL}/billing?cancelled=true`,
      metadata: {
        accountId: account.id,
        isAddon: isAddon ? 'true' : 'false',
      },
    };

    // Add 14-day trial for subscriptions (not add-ons)
    if (mode === 'subscription' && !isAddon) {
      sessionConfig.subscription_data = {
        trial_period_days: 14,
        metadata: {
          accountId: account.id,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Customer portal
router.post('/portal', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.accountId },
      select: { stripeCustomerId: true },
    });

    if (!account?.stripeCustomerId) {
      res.status(400).json({ error: 'No active subscription' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${APP_URL}/billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Get subscription status
router.get('/subscription', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.accountId },
      select: {
        plan: true,
        autopostAddon: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    });

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const limits = PLAN_LIMITS[account.plan];

    res.json({
      plan: account.plan,
      autopostAddon: account.autopostAddon,
      status: account.subscriptionStatus,
      trialEndsAt: account.trialEndsAt,
      currentPeriod: {
        start: account.currentPeriodStart,
        end: account.currentPeriodEnd,
      },
      limits,
      stripeCustomerId: account.stripeCustomerId,
      hasActiveSubscription: !!account.stripeSubscriptionId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
