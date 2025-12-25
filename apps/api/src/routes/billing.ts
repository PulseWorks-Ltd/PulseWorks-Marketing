import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAuditEvent } from '../utils/audit';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Get pricing plans
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'essential',
        name: 'Essential',
        price: 249,
        priceId: process.env.STRIPE_PRICE_ESSENTIAL,
        features: ['8 posts per month', '1 promo per month', '3 edits per month'],
      },
      {
        id: 'growth',
        name: 'Growth',
        price: 449,
        priceId: process.env.STRIPE_PRICE_GROWTH,
        features: ['18 posts per month', '2 promos per month', '8 edits per month'],
      },
      {
        id: 'authority',
        name: 'Authority',
        price: 799,
        priceId: process.env.STRIPE_PRICE_AUTHORITY,
        features: ['30 posts per month', '3 promos per month', '15 edits per month'],
      },
    ],
    addon: {
      id: 'posting',
      name: 'Posting & Scheduling',
      price: 249,
      priceId: process.env.STRIPE_PRICE_POSTING_ADDON,
      features: ['Auto-posting to Facebook & Instagram', 'Up to plan post limit', '1 Page + 1 Account'],
    },
  });
});

// Create checkout session
router.post('/checkout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { priceId, isAddon } = req.body;

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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/billing?success=true`,
      cancel_url: `${APP_URL}/billing?cancelled=true`,
      metadata: {
        accountId: account.id,
        isAddon: isAddon ? 'true' : 'false',
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Create customer portal session
router.post('/portal', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.accountId },
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

// Get current subscription
router.get('/subscription', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.accountId },
      select: {
        id: true,
        plan: true,
        postingAddon: true,
        stripeCustomerId: true,
      },
    });

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    let subscription = null;

    if (account.stripeCustomerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: account.stripeCustomerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        subscription = subscriptions.data[0];
      }
    }

    res.json({
      account,
      subscription,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
