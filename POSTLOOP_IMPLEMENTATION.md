# PostLoop Implementation Guide

## Overview

This document details the rebranding and pricing changes from "PulseWorks Marketing" to **PostLoop** — an AI marketing automation platform for small businesses.

---

## Changes Summary

### 1. Rebranding

**Product Name:** PulseWorks Marketing → **PostLoop**

**Terminology Changes:**
- "Pomelli scan" → "Website scan"
- "Brand intelligence" → "Business profile"
- "AI content" → "Generated content"
- "Posts/Promos" → "Static posts/Videos"

**Footer:** © PulseWorks Limited

### 2. New Pricing Model

#### Subscription Plans (14-day free trial)

**Starter — $39/month**
- Website scan + business profile
- 8 static posts per month
- Manual download only
- No auto-posting
- No image uploads
- No video creation

**Growth — $99/month** (Popular)
- Website scan + business profile
- 12 static posts per month
- 4 videos per month
- Auto-posting included
- Upload images + prompt to create content
- Facebook Pages + Instagram

**Pro — $249/month**
- Website scan + business profile
- 30 static posts per month
- 16 videos per month
- Auto-posting included
- Campaign-style creation
- Priority rendering

#### Add-ons

**Starter Auto-posting Add-on — +$30/month**
- Only for Starter plan
- Auto-post static posts only
- Max 8 scheduled posts per month
- Facebook Pages + Instagram

#### One-time Purchases

- **Static post:** $5
- **Video:** $19

### 3. Database Schema Changes

**New Enums:**
```prisma
enum Plan {
  STARTER  // was ESSENTIAL
  GROWTH   // unchanged
  PRO      // was AUTHORITY
}

enum ContentType {
  STATIC  // was POST
  VIDEO   // was PROMO
}
```

**Account Model Updates:**
```prisma
model Account {
  // ... existing fields
  plan          Plan     @default(STARTER)
  autopostAddon Boolean  @default(false) // Starter autopost add-on

  // Stripe subscription tracking
  stripeCustomerId String? @unique
  stripeSubscriptionId String? @unique
  subscriptionStatus String? // active, trialing, past_due, canceled
  trialEndsAt   DateTime?
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?

  // Relations
  usageCounter  UsageCounter?
}
```

**New UsageCounter Model:**
```prisma
model UsageCounter {
  id         String   @id @default(cuid())
  accountId  String   @unique
  staticUsed Int      @default(0)
  videoUsed  Int      @default(0)
  autopostUsed Int    @default(0)
  periodStart DateTime
  periodEnd  DateTime
}
```

### 4. Usage Tracking

**New Service:** `apps/api/src/services/usageTracking.ts`

**Key Features:**
- Tracks usage per billing period
- Enforces plan limits
- Supports one-time purchases
- Resets counters on period rollover

**Usage Deduction Rules:**
1. Website-generated content consumes quota
2. User-uploaded content (images + prompt) ALSO consumes quota
3. Auto-posting does NOT consume extra quota
4. Starter + add-on: Static posts only, 8/month autopost cap
5. Growth & Pro: Static OR video creation deducts from respective quota

### 5. New Features

#### Create from Images (Growth/Pro only)

**Flow:**
1. User uploads 1-6 images
2. Selects: Static post OR Video
3. Enters short prompt
4. System generates caption + hashtags
5. Creates image or short video
6. Optionally auto-posts if enabled

**Enforcement:**
- Blocked for Starter users
- Deducts from quota (static or video)
- Pay-per-use option if quota exceeded

### 6. Auto-posting Rules

| Plan | Auto-posting | Limits |
|------|--------------|--------|
| Starter | ❌ No | N/A |
| Starter + Add-on | ✅ Yes | Static only, 8/month cap |
| Growth | ✅ Yes | Static + video, unlimited within quota |
| Pro | ✅ Yes | Static + video, unlimited within quota |

---

## Environment Variables

### Required Stripe Variables

```bash
# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Subscription Price IDs
STRIPE_PRICE_STARTER="price_starter_..."
STRIPE_PRICE_GROWTH="price_growth_..."
STRIPE_PRICE_PRO="price_pro_..."

# Add-on Price ID
STRIPE_PRICE_STARTER_AUTOPOST="price_starter_autopost_..."

# One-time Purchase Price IDs
STRIPE_PRICE_STATIC_ONETIME="price_static_..."
STRIPE_PRICE_VIDEO_ONETIME="price_video_..."
```

### Existing Variables (Unchanged)

```bash
# Database & Redis
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-domain.com"

# S3 Storage
S3_ENDPOINT="..."
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_BUCKET="..."
S3_PUBLIC_BASE_URL="..."
S3_FORCE_PATH_STYLE="true"

# Third-party APIs
AYRSHARE_API_KEY="..."
OPENAI_API_KEY="..."

# Application
APP_URL="https://your-domain.com"
NODE_ENV="production"
```

---

## Stripe Setup

### 1. Create Products & Prices

In Stripe Dashboard:

**Product: PostLoop Starter**
- Price: $39/month recurring
- Lookup key: `postloop-starter`
- Metadata:
  - `plan`: `STARTER`
  - `static_posts`: `8`
  - `videos`: `0`
  - `autopost`: `false`

**Product: PostLoop Growth**
- Price: $99/month recurring
- Lookup key: `postloop-growth`
- Metadata:
  - `plan`: `GROWTH`
  - `static_posts`: `12`
  - `videos`: `4`
  - `autopost`: `true`

**Product: PostLoop Pro**
- Price: $249/month recurring
- Lookup key: `postloop-pro`
- Metadata:
  - `plan`: `PRO`
  - `static_posts`: `30`
  - `videos`: `16`
  - `autopost`: `true`

**Product: Starter Auto-posting Add-on**
- Price: $30/month recurring
- Lookup key: `postloop-starter-autopost`
- Metadata:
  - `addon`: `true`
  - `plan_required`: `STARTER`
  - `autopost_cap`: `8`

**Product: Single Static Post**
- Price: $5 one-time
- Lookup key: `postloop-static-onetime`

**Product: Single Video**
- Price: $19 one-time
- Lookup key: `postloop-video-onetime`

### 2. Configure Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-api-domain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Migration Guide

### 1. Database Migration

```bash
cd apps/api
npx prisma migrate deploy
```

**Migration includes:**
- Rename `ESSENTIAL` → `STARTER`, `AUTHORITY` → `PRO`
- Rename `POST` → `STATIC`, `PROMO` → `VIDEO`
- Add `autopostAddon` field
- Add Stripe subscription fields
- Add `UsageCounter` model

### 2. Data Backfill

**For existing accounts:**

```typescript
// Update existing accounts to Starter plan
UPDATE accounts SET plan = 'STARTER' WHERE plan = 'ESSENTIAL';
UPDATE accounts SET plan = 'PRO' WHERE plan = 'AUTHORITY';

// Rename postingAddon to autopostAddon
UPDATE accounts SET autopostAddon = postingAddon;

// Create usage counters for active subscriptions
// (Will be auto-created on first usage check)
```

### 3. Code Updates

**Files Changed:**
- `packages/shared/src/types.ts` - Updated Plan and ContentType enums
- `packages/shared/src/constants.ts` - New pricing constants
- `apps/api/prisma/schema.prisma` - Schema updates
- `apps/api/src/services/usageTracking.ts` - New service
- `apps/api/src/routes/billing_new.ts` - New billing routes
- `apps/api/src/routes/webhooks_stripe.ts` - Stripe webhooks
- `apps/web/src/app/layout.tsx` - Rebranded metadata
- `apps/web/src/app/page.tsx` - Rebranded home page

**Files to Update (TODO):**
- Content generation routes to support VIDEO type
- Image upload routes for "Create from images" feature
- Video generation service
- Auto-posting logic to enforce plan rules
- Dashboard to show usage indicators

---

## Railway Deployment Guide

### Prerequisites

1. Railway account: https://railway.app
2. GitHub repository with PostLoop codebase
3. Stripe account with products configured
4. Cloudflare R2 (or AWS S3) bucket
5. Ayrshare API account
6. OpenAI API key

### Step 1: Create Railway Project

1. Go to Railway dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your PostLoop repository
4. Railway will detect the monorepo

### Step 2: Create Services

You need **3 services**:

#### Service 1: Web Frontend (Next.js)

1. Create service
2. Root directory: `apps/web`
3. Start command: `npm run start --workspace=web`
4. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.railway.app
   NEXTAUTH_SECRET=<generate-random-32-char>
   NEXTAUTH_URL=https://your-web.railway.app
   ```

#### Service 2: API Backend (Express)

1. Create service
2. Root directory: `apps/api`
3. Build command: `npx prisma generate && npm run build`
4. Start command: `npm run start --workspace=api`
5. Environment variables:
   ```
   DATABASE_URL=<from-railway-postgres>
   REDIS_URL=<from-railway-redis>

   NEXTAUTH_SECRET=<same-as-web>

   S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
   S3_ACCESS_KEY=<r2-access-key>
   S3_SECRET_KEY=<r2-secret-key>
   S3_BUCKET=postloop-media
   S3_REGION=auto
   S3_PUBLIC_BASE_URL=https://your-cdn.com
   S3_FORCE_PATH_STYLE=true

   AYRSHARE_API_KEY=<ayrshare-key>
   OPENAI_API_KEY=<openai-key>

   STRIPE_SECRET_KEY=<stripe-secret-key>
   STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
   STRIPE_PRICE_STARTER=price_...
   STRIPE_PRICE_GROWTH=price_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_STARTER_AUTOPOST=price_...
   STRIPE_PRICE_STATIC_ONETIME=price_...
   STRIPE_PRICE_VIDEO_ONETIME=price_...

   APP_URL=https://your-web.railway.app
   NODE_ENV=production
   ```

#### Service 3: Worker (BullMQ)

1. Create service
2. Root directory: `apps/api`
3. Start command: `npm run worker --workspace=api`
4. Environment variables: (Same as API service)

### Step 3: Add Databases

#### PostgreSQL

1. Add PostgreSQL service
2. Railway auto-generates `DATABASE_URL`
3. Link to API and Worker services

#### Redis

1. Add Redis service
2. Railway auto-generates `REDIS_URL`
3. Link to API and Worker services

### Step 4: Run Migrations

After API service is deployed:

1. Go to API service → Settings → One-off command
2. Run: `npx prisma migrate deploy`
3. Wait for completion

### Step 5: Configure Stripe Webhook

1. Get API service public URL from Railway
2. In Stripe Dashboard → Webhooks
3. Add endpoint: `https://your-api.railway.app/api/webhooks/stripe`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET` in Railway

### Step 6: Test Deployment

1. Visit web app URL
2. Create test account
3. Start 14-day trial (no credit card)
4. Generate content
5. Check usage tracking
6. Test auto-posting (if on Growth/Pro)

---

## API Endpoints Reference

### Billing

```
GET  /api/billing/plans - Get pricing plans
POST /api/billing/checkout - Create checkout session
POST /api/billing/portal - Customer portal
GET  /api/billing/subscription - Get subscription status
```

### Usage Tracking

```
GET  /api/usage - Get usage summary
POST /api/usage/check - Check if can create content
```

### Content (Updated)

```
POST /api/content/generate - Generate from website
POST /api/content/from-images - Create from uploaded images (Growth/Pro)
GET  /api/content/:id - Get content item
PATCH /api/content/:id - Edit content
```

### Webhooks

```
POST /api/webhooks/stripe - Stripe webhook handler
POST /api/webhooks/ayrshare - Ayrshare webhook handler
```

---

## Testing Checklist

### Subscription Flow

- [ ] Sign up creates account
- [ ] 14-day trial starts automatically
- [ ] Trial period tracked in database
- [ ] Subscription webhook updates account
- [ ] Usage counter created on subscription

### Usage Tracking

- [ ] Static post creation deducts from quota
- [ ] Video creation deducts from quota
- [ ] Quota enforced (blocks when exceeded)
- [ ] Usage resets on billing period change
- [ ] Starter blocks image uploads
- [ ] Starter blocks video creation

### Auto-posting

- [ ] Starter users blocked from auto-posting
- [ ] Starter + add-on allows static auto-posts only
- [ ] Starter + add-on enforces 8/month cap
- [ ] Growth/Pro unlimited auto-posting within quota
- [ ] Worker increments autopost counter

### One-time Purchases

- [ ] Purchase modal shows when quota exceeded
- [ ] Static post purchase ($5) works
- [ ] Video purchase ($19) works
- [ ] One-time purchase bypasses quota check

### Stripe Integration

- [ ] Checkout session creates successfully
- [ ] Trial period configured correctly
- [ ] Webhooks update database
- [ ] Customer portal works
- [ ] Plan changes reflected in database

---

## Troubleshooting

### Issue: "Billing period not set"

**Cause:** Account doesn't have `currentPeriodStart` and `currentPeriodEnd`

**Fix:** Ensure Stripe webhook `customer.subscription.created` fired and updated account

### Issue: Usage not resetting

**Cause:** UsageCounter period doesn't match subscription period

**Fix:** UsageCounter auto-updates on first check after period change

### Issue: Starter user can't upload images

**Expected:** This is correct. Image uploads are Growth/Pro only.

**Solution:** Upgrade to Growth or use website-generated content only

### Issue: Video option not showing

**Cause:** Plan doesn't include videos

**Fix:** Only Growth (4/month) and Pro (16/month) can create videos

---

## Roadmap Items (Not Implemented)

The following features are referenced but not fully implemented:

1. **Video Generation Service**
   - Route: `POST /api/content/from-images` with `type: 'VIDEO'`
   - Needs video rendering service integration
   - Placeholder exists in usage tracking

2. **Image Upload Route**
   - Route: `POST /api/content/upload-images`
   - Needs multipart form handling
   - S3 upload logic exists but not connected

3. **Campaign-style Creation** (Pro feature)
   - Multi-post campaign planning
   - Coordinated messaging across posts

4. **Priority Rendering** (Pro feature)
   - Queue prioritization for Pro users
   - Faster content generation

5. **Usage Dashboard UI**
   - Visual quota indicators
   - Period progress bar
   - Upgrade prompts

6. **Pay-per-use Modal**
   - When quota exceeded, show purchase options
   - Stripe one-time checkout flow

---

## Summary

PostLoop is now configured with:

✅ New pricing tiers (Starter $39, Growth $99, Pro $249)
✅ 14-day free trials
✅ Usage tracking per billing period
✅ Plan-specific feature enforcement
✅ Stripe subscription + one-time payment support
✅ Auto-posting add-on for Starter
✅ Webhook-driven subscription management
✅ Rebranded UI (PostLoop)

**Next Steps:**
1. Complete video generation service
2. Implement "Create from images" UI
3. Add usage indicators to dashboard
4. Build pay-per-use modal
5. Test end-to-end user flows

---

**Last Updated:** 2026-01-03
**Version:** 1.0.0 (PostLoop)
