import { Router, raw } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db/client';
import { ayrshareWebhookSchema } from '@shared/types';
import { logAuditEvent } from '../utils/audit';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Stripe webhook (requires raw body)
router.post(
  '/stripe',
  raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      res.status(400).send('No signature');
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    console.log('Stripe webhook event:', event.type);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const accountId = session.metadata?.accountId;
          const isAddon = session.metadata?.isAddon === 'true';

          if (!accountId) break;

          // Get subscription details
          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );

            const priceId = subscription.items.data[0]?.price.id;

            // Determine plan or addon
            if (isAddon) {
              await prisma.account.update({
                where: { id: accountId },
                data: { postingAddon: true },
              });

              await logAuditEvent({
                accountId,
                eventType: 'SUBSCRIPTION_CREATED',
                entityType: 'Account',
                entityId: accountId,
                metadata: { type: 'addon', priceId },
              });
            } else {
              let plan: 'ESSENTIAL' | 'GROWTH' | 'AUTHORITY' = 'ESSENTIAL';

              if (priceId === process.env.STRIPE_PRICE_GROWTH) {
                plan = 'GROWTH';
              } else if (priceId === process.env.STRIPE_PRICE_AUTHORITY) {
                plan = 'AUTHORITY';
              }

              await prisma.account.update({
                where: { id: accountId },
                data: { plan },
              });

              await logAuditEvent({
                accountId,
                eventType: 'SUBSCRIPTION_CREATED',
                entityType: 'Account',
                entityId: accountId,
                metadata: { plan, priceId },
              });
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customer = await stripe.customers.retrieve(subscription.customer as string);

          if ('metadata' in customer) {
            const accountId = customer.metadata?.accountId;
            if (!accountId) break;

            const priceId = subscription.items.data[0]?.price.id;

            // Update plan based on price
            let plan: 'ESSENTIAL' | 'GROWTH' | 'AUTHORITY' = 'ESSENTIAL';

            if (priceId === process.env.STRIPE_PRICE_GROWTH) {
              plan = 'GROWTH';
            } else if (priceId === process.env.STRIPE_PRICE_AUTHORITY) {
              plan = 'AUTHORITY';
            }

            await prisma.account.update({
              where: { id: accountId },
              data: { plan },
            });

            await logAuditEvent({
              accountId,
              eventType: 'SUBSCRIPTION_UPDATED',
              entityType: 'Account',
              entityId: accountId,
              metadata: { plan, priceId },
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customer = await stripe.customers.retrieve(subscription.customer as string);

          if ('metadata' in customer) {
            const accountId = customer.metadata?.accountId;
            if (!accountId) break;

            const priceId = subscription.items.data[0]?.price.id;

            // Check if this was an addon
            if (priceId === process.env.STRIPE_PRICE_POSTING_ADDON) {
              await prisma.account.update({
                where: { id: accountId },
                data: { postingAddon: false },
              });
            }

            await logAuditEvent({
              accountId,
              eventType: 'SUBSCRIPTION_CANCELLED',
              entityType: 'Account',
              entityId: accountId,
              metadata: { priceId },
            });
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Ayrshare webhook
router.post('/ayrshare', async (req, res) => {
  try {
    const body = ayrshareWebhookSchema.parse(req.body);

    console.log('Ayrshare webhook:', body);

    // Find schedule item by provider job ID
    if (!body.id) {
      res.json({ received: true });
      return;
    }

    const scheduleItem = await prisma.scheduleItem.findFirst({
      where: { providerJobId: body.id },
    });

    if (!scheduleItem) {
      console.warn('Schedule item not found for job:', body.id);
      res.json({ received: true });
      return;
    }

    // Update schedule item
    const updates: any = {};

    if (body.status === 'success') {
      updates.status = 'PUBLISHED';
      updates.providerPostId = body.postId;
      updates.postUrl = body.postUrl;
    } else if (body.status === 'error') {
      updates.status = 'FAILED';
      updates.errorMessage = body.errors?.join(', ') || 'Unknown error';
    }

    await prisma.scheduleItem.update({
      where: { id: scheduleItem.id },
      data: updates,
    });

    // Log audit event
    await logAuditEvent({
      accountId: scheduleItem.accountId,
      eventType: updates.status === 'PUBLISHED' ? 'POST_PUBLISHED' : 'POST_FAILED',
      entityType: 'ScheduleItem',
      entityId: scheduleItem.id,
      metadata: {
        platform: scheduleItem.platform,
        postUrl: body.postUrl,
        error: body.errors?.join(', '),
      },
    });

    res.json({ received: true });
  } catch (error) {
    console.error('Ayrshare webhook error:', error);
    res.status(400).json({ error: 'Invalid webhook data' });
  }
});

export default router;
