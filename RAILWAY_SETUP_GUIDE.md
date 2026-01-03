# PostLoop Railway Deployment - Step-by-Step Guide

This guide will walk you through deploying PostLoop to Railway from scratch. Follow each step carefully.

---

## Prerequisites

Before you begin, gather these accounts and credentials:

### Required Accounts
- ✅ Railway account (https://railway.app)
- ✅ GitHub account with PostLoop repository
- ✅ Stripe account (https://stripe.com)
- ✅ Cloudflare account for R2 storage (or AWS for S3)
- ✅ Ayrshare account (https://ayrshare.com)
- ✅ OpenAI account (https://openai.com)

### Information You'll Need
- Domain name (optional, Railway provides one)
- Your website URL (for business profile generation)

---

## Part 1: Stripe Setup (Do This First!)

### Step 1.1: Create Stripe Products

Log into Stripe Dashboard → Products → Create Product

**Product 1: PostLoop Starter**
```
Name: PostLoop Starter
Description: Website scan + 8 static posts per month
Pricing: $39/month recurring
Billing period: Monthly
```

After creating:
1. Click "Add another price"
2. Select "Recurring"
3. Enter $39
4. Set billing period to "Monthly"
5. Click "+ Advanced pricing options"
6. Add lookup key: `postloop-starter`
7. Add metadata:
   - Key: `plan`, Value: `STARTER`
   - Key: `static_posts`, Value: `8`
   - Key: `videos`, Value: `0`
   - Key: `autopost`, Value: `false`
8. Save

**Copy the Price ID** (looks like `price_1Abc...`). Save it as `STRIPE_PRICE_STARTER`.

**Product 2: PostLoop Growth**
```
Name: PostLoop Growth
Description: 12 static posts + 4 videos + auto-posting
Pricing: $99/month recurring
Billing period: Monthly
```

Add metadata:
- `plan`: `GROWTH`
- `static_posts`: `12`
- `videos`: `4`
- `autopost`: `true`

Lookup key: `postloop-growth`

**Copy Price ID** → `STRIPE_PRICE_GROWTH`

**Product 3: PostLoop Pro**
```
Name: PostLoop Pro
Description: 30 static posts + 16 videos + auto-posting + priority
Pricing: $249/month recurring
Billing period: Monthly
```

Add metadata:
- `plan`: `PRO`
- `static_posts`: `30`
- `videos`: `16`
- `autopost`: `true`

Lookup key: `postloop-pro`

**Copy Price ID** → `STRIPE_PRICE_PRO`

**Product 4: Starter Auto-posting Add-on**
```
Name: Starter Auto-posting Add-on
Description: Add auto-posting to Starter plan (8 posts/month)
Pricing: $30/month recurring
Billing period: Monthly
```

Add metadata:
- `addon`: `true`
- `plan_required`: `STARTER`
- `autopost_cap`: `8`

Lookup key: `postloop-starter-autopost`

**Copy Price ID** → `STRIPE_PRICE_STARTER_AUTOPOST`

**Product 5: Single Static Post**
```
Name: Single Static Post
Description: One-time purchase - extra static post
Pricing: $5 one-time
```

Select "One-time" pricing

Lookup key: `postloop-static-onetime`

**Copy Price ID** → `STRIPE_PRICE_STATIC_ONETIME`

**Product 6: Single Video**
```
Name: Single Video
Description: One-time purchase - extra video
Pricing: $19 one-time
```

Select "One-time" pricing

Lookup key: `postloop-video-onetime`

**Copy Price ID** → `STRIPE_PRICE_VIDEO_ONETIME`

### Step 1.2: Get Stripe Secret Key

1. Go to Stripe Dashboard → Developers → API Keys
2. Find "Secret key" (starts with `sk_test_` for test mode)
3. Click "Reveal live key" if using live mode
4. **Copy it** → `STRIPE_SECRET_KEY`

### Step 1.3: Create Webhook (We'll Add URL Later)

We'll come back to this after deploying the API.

---

## Part 2: Cloudflare R2 Setup

### Step 2.1: Create R2 Bucket

1. Log into Cloudflare Dashboard
2. Go to R2 → Create bucket
3. Name: `postloop-media` (or your choice)
4. Location: Automatic
5. Create bucket

### Step 2.2: Create API Token

1. Go to R2 → Manage R2 API Tokens
2. Create API Token
3. Permissions: Object Read & Write
4. Click "Create API Token"
5. **Copy these values:**
   - Access Key ID → `S3_ACCESS_KEY`
   - Secret Access Key → `S3_SECRET_KEY`
   - S3 Endpoint (looks like `https://xxx.r2.cloudflarestorage.com`) → `S3_ENDPOINT`

### Step 2.3: Enable Public Access (Optional)

For public image URLs:

1. Go to your bucket → Settings
2. Scroll to "Public Access"
3. Click "Connect Domain"
4. Add custom domain or use R2.dev subdomain
5. **Copy public URL** → `S3_PUBLIC_BASE_URL`

---

## Part 3: Third-Party API Keys

### Step 3.1: Ayrshare

1. Log into Ayrshare dashboard
2. Go to Settings → API Key
3. **Copy API Key** → `AYRSHARE_API_KEY`

### Step 3.2: OpenAI

1. Log into OpenAI Platform
2. Go to API Keys
3. Create new secret key
4. **Copy it** → `OPENAI_API_KEY`

### Step 3.3: NextAuth Secret

Generate a random 32-character string:

```bash
openssl rand -base64 32
```

**Copy result** → `NEXTAUTH_SECRET`

---

## Part 4: Railway Project Setup

### Step 4.1: Create Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select your `postloop` repository
6. Railway will create the project

### Step 4.2: Create PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will provision a PostgreSQL database
4. **No configuration needed** - Railway auto-generates `DATABASE_URL`

### Step 4.3: Create Redis Database

1. Click "New" again
2. Select "Database" → "Add Redis"
3. Railway auto-generates `REDIS_URL`

---

## Part 5: Deploy API Service

### Step 5.1: Create API Service

1. In Railway project, click "New"
2. Select "GitHub Repo" → Choose your repository again
3. Name it: "API"

### Step 5.2: Configure Build Settings

1. Click on the API service
2. Go to "Settings"
3. Under "Build Command" (if not auto-detected):
   ```
   cd apps/api && npx prisma generate && npm run build
   ```
4. Under "Start Command":
   ```
   cd apps/api && npm start
   ```

### Step 5.3: Add Environment Variables

Click "Variables" tab. Add these one by one:

**Database (Auto-detected)**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

**Authentication**
```
NEXTAUTH_SECRET=<paste-your-32-char-secret>
```

**S3/R2 Storage**
```
S3_ENDPOINT=<from-cloudflare-r2>
S3_ACCESS_KEY=<from-cloudflare-r2>
S3_SECRET_KEY=<from-cloudflare-r2>
S3_BUCKET=postloop-media
S3_REGION=auto
S3_PUBLIC_BASE_URL=<your-public-r2-url>
S3_FORCE_PATH_STYLE=true
```

**Ayrshare**
```
AYRSHARE_API_KEY=<from-ayrshare>
```

**OpenAI**
```
OPENAI_API_KEY=<from-openai>
```

**Stripe**
```
STRIPE_SECRET_KEY=<from-stripe>
STRIPE_WEBHOOK_SECRET=<leave-blank-for-now>

STRIPE_PRICE_STARTER=<price-id-from-step-1>
STRIPE_PRICE_GROWTH=<price-id-from-step-1>
STRIPE_PRICE_PRO=<price-id-from-step-1>
STRIPE_PRICE_STARTER_AUTOPOST=<price-id-from-step-1>
STRIPE_PRICE_STATIC_ONETIME=<price-id-from-step-1>
STRIPE_PRICE_VIDEO_ONETIME=<price-id-from-step-1>
```

**Application**
```
NODE_ENV=production
```

(We'll add `APP_URL` later after web deploy)

### Step 5.4: Connect to Databases

1. In API service → Settings → Service Variables
2. Click "+ New Variable" → "Reference"
3. Select PostgreSQL database → DATABASE_URL
4. Repeat for Redis → REDIS_URL

### Step 5.5: Deploy

1. Railway will automatically deploy after adding variables
2. Wait for deployment to complete (check Deployments tab)
3. Once deployed, go to Settings → Networking
4. Click "Generate Domain"
5. **Copy the domain** (e.g., `postloop-api.up.railway.app`)

### Step 5.6: Run Database Migration

1. In API service → Settings
2. Scroll to "One-off Commands"
3. Run this command:
   ```
   cd apps/api && npx prisma migrate deploy
   ```
4. Wait for completion (check logs)

---

## Part 6: Deploy Worker Service

### Step 6.1: Create Worker Service

1. Click "New" in Railway project
2. Select "GitHub Repo" → Same repository
3. Name it: "Worker"

### Step 6.2: Configure Worker

1. Go to Settings
2. Under "Start Command":
   ```
   cd apps/api && npm run worker
   ```

### Step 6.3: Add Environment Variables

**Copy ALL environment variables from API service:**

1. Go to API service → Variables
2. Click "..." → "Copy all variables"
3. Go to Worker service → Variables
4. Click "..." → "Paste variables"

**Note:** Worker uses same environment as API

### Step 6.4: Connect to Databases

Same as API service:
- Add DATABASE_URL reference
- Add REDIS_URL reference

### Step 6.5: Deploy Worker

Railway will auto-deploy. Check logs for:
```
🚀 Posting worker started
✅ Jobs are enqueued immediately when schedules are created (no polling)
```

---

## Part 7: Deploy Web Frontend

### Step 7.1: Create Web Service

1. Click "New" in Railway project
2. Select "GitHub Repo" → Same repository
3. Name it: "Web"

### Step 7.2: Configure Build Settings

1. Go to Settings
2. Under "Build Command":
   ```
   cd apps/web && npm run build
   ```
3. Under "Start Command":
   ```
   cd apps/web && npm start
   ```

### Step 7.3: Add Environment Variables

```
NEXT_PUBLIC_API_URL=https://<your-api-domain-from-step-5-5>
NEXTAUTH_SECRET=<same-as-api-service>
NEXTAUTH_URL=<leave-blank-for-now>
```

### Step 7.4: Deploy

1. Railway will deploy
2. Once complete, go to Settings → Networking
3. Click "Generate Domain"
4. **Copy the domain** (e.g., `postloop.up.railway.app`)

### Step 7.5: Update Environment Variables

Now go back and update:

**In Web service:**
```
NEXTAUTH_URL=https://<your-web-domain-from-step-7-4>
```

**In API service:**
```
APP_URL=https://<your-web-domain-from-step-7-4>
```

Redeploy both services after updating.

---

## Part 8: Configure Stripe Webhook

### Step 8.1: Create Webhook Endpoint

1. Go back to Stripe Dashboard
2. Developers → Webhooks
3. Click "+ Add endpoint"
4. Endpoint URL:
   ```
   https://<your-api-domain>/api/webhooks/stripe
   ```
5. Description: "PostLoop Subscriptions"
6. Events to send: Select these:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
7. Click "Add endpoint"

### Step 8.2: Get Webhook Secret

1. After creating endpoint, click on it
2. Click "Reveal" under "Signing secret"
3. **Copy the secret** (starts with `whsec_`)

### Step 8.3: Update Railway

1. Go to Railway → API service → Variables
2. Find `STRIPE_WEBHOOK_SECRET`
3. Update with the secret from Step 8.2
4. Redeploy API service

---

## Part 9: Verification & Testing

### Step 9.1: Test Web App

1. Visit your web URL: `https://<your-web-domain>`
2. You should see: "PostLoop - Marketing automation for small business"
3. Click "Get Started"

### Step 9.2: Create Test Account

1. Sign up with email/password
2. Account should be created
3. You'll be signed in automatically

### Step 9.3: Test Subscription Flow

1. Go to `/billing` or pricing page
2. Click "Subscribe to Starter"
3. Complete Stripe checkout (use test card: `4242 4242 4242 4242`)
4. After payment, you should be redirected back
5. Check Railway API logs for webhook events

### Step 9.4: Verify Database

1. Go to Railway → PostgreSQL
2. Click "Data" tab
3. You should see:
   - Accounts table with your account
   - UsageCounter table with a counter for your account
   - Plan should be `STARTER`
   - Trial period should be set

### Step 9.5: Test Content Generation

1. In the app, add your website URL
2. Generate content
3. Check that usage counter increments
4. Verify quota limits are enforced

### Step 9.6: Test Worker

1. Schedule a post (if you have auto-posting)
2. Check Worker logs in Railway
3. Should see job processing at scheduled time
4. No polling messages

---

## Part 10: Custom Domain (Optional)

### Step 10.1: Configure Railway Custom Domain

1. Go to Web service → Settings → Networking
2. Click "Custom Domain"
3. Enter your domain (e.g., `postloop.com`)
4. Railway will provide DNS records

### Step 10.2: Update DNS

1. Go to your domain registrar
2. Add the CNAME or A record provided by Railway
3. Wait for DNS propagation (5-60 minutes)

### Step 10.3: Update Environment Variables

Once domain is active:

**Web service:**
```
NEXTAUTH_URL=https://postloop.com
```

**API service:**
```
APP_URL=https://postloop.com
```

**Stripe Webhook:**
Update endpoint URL if you have custom API domain

Redeploy services.

---

## Part 11: Production Checklist

Before going live:

### Security
- [ ] Change `NODE_ENV` to `production`
- [ ] Use Stripe live mode (not test mode)
- [ ] Rotate all API keys from test to production
- [ ] Set strong `NEXTAUTH_SECRET` (32+ chars)
- [ ] Enable HTTPS only (Railway does this automatically)

### Stripe
- [ ] Switch to live mode in Stripe Dashboard
- [ ] Create live products/prices (repeat Part 1)
- [ ] Update price IDs in Railway variables
- [ ] Update webhook to live endpoint
- [ ] Test live checkout flow with real card

### Monitoring
- [ ] Set up Railway monitoring/alerts
- [ ] Check logs for errors
- [ ] Monitor database usage
- [ ] Set up Stripe email notifications

### Content
- [ ] Test website scan with real business sites
- [ ] Verify content generation quality
- [ ] Test all three plan tiers
- [ ] Test add-on purchase
- [ ] Test one-time purchases

---

## Troubleshooting

### "Billing period not set" Error

**Cause:** Account doesn't have subscription

**Fix:**
1. Check Stripe Dashboard → Customers
2. Find customer by email
3. Verify subscription is active
4. Check webhook logs in Stripe
5. Check API logs for webhook processing

### Worker Not Processing Jobs

**Cause:** Redis connection issue or worker not running

**Fix:**
1. Check Worker service logs in Railway
2. Verify REDIS_URL is set correctly
3. Restart Worker service
4. Check for error messages in logs

### Webhook Signature Verification Failed

**Cause:** Wrong webhook secret

**Fix:**
1. Go to Stripe → Webhooks
2. Copy signing secret
3. Update `STRIPE_WEBHOOK_SECRET` in Railway
4. Redeploy API service

### Can't Create Content

**Cause:** Usage counter not initialized

**Fix:**
1. Check that webhook `customer.subscription.created` fired
2. Manually create usage counter in database:
   ```sql
   INSERT INTO usage_counter (account_id, static_used, video_used, autopost_used, period_start, period_end)
   VALUES ('account-id', 0, 0, 0, NOW(), NOW() + INTERVAL '1 month');
   ```

---

## Environment Variables Summary

### Web Service
```
NEXT_PUBLIC_API_URL=https://api-domain.railway.app
NEXTAUTH_SECRET=<32-char-random>
NEXTAUTH_URL=https://web-domain.railway.app
```

### API Service
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
NEXTAUTH_SECRET=<same-as-web>
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_KEY=<r2-key>
S3_SECRET_KEY=<r2-secret>
S3_BUCKET=postloop-media
S3_REGION=auto
S3_PUBLIC_BASE_URL=https://cdn.yoursite.com
S3_FORCE_PATH_STYLE=true
AYRSHARE_API_KEY=<ayrshare-key>
OPENAI_API_KEY=<openai-key>
STRIPE_SECRET_KEY=<stripe-secret>
STRIPE_WEBHOOK_SECRET=<webhook-secret>
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_GROWTH=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_STARTER_AUTOPOST=price_xxx
STRIPE_PRICE_STATIC_ONETIME=price_xxx
STRIPE_PRICE_VIDEO_ONETIME=price_xxx
APP_URL=https://web-domain.railway.app
NODE_ENV=production
```

### Worker Service
```
(Same as API Service)
```

---

## Next Steps

After successful deployment:

1. **Test All Features**
   - Sign up flow
   - Website scanning
   - Content generation
   - Auto-posting
   - Billing/subscriptions

2. **Monitor Usage**
   - Check quota tracking works
   - Verify usage resets monthly
   - Test limit enforcement

3. **Implement Remaining Features**
   - Video generation
   - Create from images UI
   - Usage dashboard
   - Pay-per-use modal

4. **Go Live**
   - Switch to Stripe live mode
   - Update marketing site
   - Launch!

---

**Congratulations!** PostLoop is now deployed and running on Railway.

For questions or issues, refer to:
- [POSTLOOP_IMPLEMENTATION.md](POSTLOOP_IMPLEMENTATION.md) - Complete implementation guide
- [FIXES_IMPLEMENTED.md](FIXES_IMPLEMENTED.md) - NextAuth & scheduling fixes
- Railway Logs - Real-time debugging

**Support:** Create an issue in your repository or consult Railway documentation.

---

**Last Updated:** 2026-01-03
**Version:** 1.0.0
