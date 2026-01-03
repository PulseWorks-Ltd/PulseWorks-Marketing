import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db/client';
import { logAuditEvent } from '../utils/audit';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Stripe webhook handler
router.post(
  '/stripe',
  // Important: Use raw body for signature verification
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      res.status(400).send('No signature');
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Handle checkout session completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const accountId = session.metadata?.accountId;

  if (!accountId) {
    console.error('No accountId in checkout session metadata');
    return;
  }

  // Update account with customer ID
  await prisma.account.update({
    where: { id: accountId },
    data: {
      stripeCustomerId: session.customer as string,
    },
  });

  await logAuditEvent({
    accountId,
    eventType: 'SUBSCRIPTION_CREATED',
    entityType: 'Account',
    entityId: accountId,
    metadata: {
      customerId: session.customer,
      mode: session.mode,
    },
  });
}

// Handle subscription created
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find account by customer ID
  const account = await prisma.account.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!account) {
    console.error('Account not found for customer:', customerId);
    return;
  }

  // Get plan from subscription metadata or line items
  const plan = determinePlanFromSubscription(subscription);
  const isAddon = subscription.metadata?.isAddon === 'true';

  const updateData: any = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };

  if (subscription.trial_end) {
    updateData.trialEndsAt = new Date(subscription.trial_end * 1000);
  }

  if (plan && !isAddon) {
    updateData.plan = plan;
  }

  if (isAddon) {
    updateData.autopostAddon = true;
  }

  await prisma.account.update({
    where: { id: account.id },
    data: updateData,
  });

  // Create or reset usage counter for new billing period
  await prisma.usageCounter.upsert({
    where: { accountId: account.id },
    create: {
      accountId: account.id,
      staticUsed: 0,
      videoUsed: 0,
      autopostUsed: 0,
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      staticUsed: 0,
      videoUsed: 0,
      autopostUsed: 0,
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  await logAuditEvent({
    accountId: account.id,
    eventType: 'SUBSCRIPTION_CREATED',
    entityType: 'Account',
    entityId: account.id,
    metadata: {
      subscriptionId: subscription.id,
      plan: plan || 'addon',
      status: subscription.status,
    },
  });
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const account = await prisma.account.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!account) {
    console.error('Account not found for customer:', customerId);
    return;
  }

  const plan = determinePlanFromSubscription(subscription);

  const updateData: any = {
    subscriptionStatus: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };

  if (plan) {
    updateData.plan = plan;
  }

  if (subscription.trial_end) {
    updateData.trialEndsAt = new Date(subscription.trial_end * 1000);
  }

  await prisma.account.update({
    where: { id: account.id },
    data: updateData,
  });

  // Reset usage counter if period changed
  const currentCounter = await prisma.usageCounter.findUnique({
    where: { accountId: account.id },
  });

  const newPeriodStart = new Date(subscription.current_period_start * 1000);
  const newPeriodEnd = new Date(subscription.current_period_end * 1000);

  if (
    !currentCounter ||
    currentCounter.periodStart.getTime() !== newPeriodStart.getTime()
  ) {
    await prisma.usageCounter.upsert({
      where: { accountId: account.id },
      create: {
        accountId: account.id,
        staticUsed: 0,
        videoUsed: 0,
        autopostUsed: 0,
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
      },
      update: {
        staticUsed: 0,
        videoUsed: 0,
        autopostUsed: 0,
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
      },
    });
  }

  await logAuditEvent({
    accountId: account.id,
    eventType: 'SUBSCRIPTION_UPDATED',
    entityType: 'Account',
    entityId: account.id,
    metadata: {
      subscriptionId: subscription.id,
      status: subscription.status,
    },
  });
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const account = await prisma.account.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!account) {
    console.error('Account not found for customer:', customerId);
    return;
  }

  const isAddon = subscription.metadata?.isAddon === 'true';

  const updateData: any = {
    subscriptionStatus: 'canceled',
  };

  if (!isAddon) {
    updateData.stripeSubscriptionId = null;
  } else {
    updateData.autopostAddon = false;
  }

  await prisma.account.update({
    where: { id: account.id },
    data: updateData,
  });

  await logAuditEvent({
    accountId: account.id,
    eventType: 'SUBSCRIPTION_CANCELLED',
    entityType: 'Account',
    entityId: account.id,
    metadata: {
      subscriptionId: subscription.id,
    },
  });
}

// Handle invoice paid
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const account = await prisma.account.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!account) {
    console.error('Account not found for customer:', customerId);
    return;
  }

  // Update subscription status to active
  await prisma.account.update({
    where: { id: account.id },
    data: {
      subscriptionStatus: 'active',
    },
  });
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const account = await prisma.account.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!account) {
    console.error('Account not found for customer:', customerId);
    return;
  }

  // Update subscription status to past_due
  await prisma.account.update({
    where: { id: account.id },
    data: {
      subscriptionStatus: 'past_due',
    },
  });
}

// Helper: Determine plan from subscription
function determinePlanFromSubscription(subscription: Stripe.Subscription): string | null {
  // Get the first line item (should only be one for our use case)
  const lineItem = subscription.items.data[0];
  if (!lineItem) return null;

  const priceId = lineItem.price.id;

  // Map price IDs to plans
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'STARTER';
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return 'GROWTH';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO';

  // Check price metadata for plan
  const metadata = lineItem.price.metadata;
  if (metadata?.plan) {
    return metadata.plan.toUpperCase();
  }

  return null;
}

export default router;
