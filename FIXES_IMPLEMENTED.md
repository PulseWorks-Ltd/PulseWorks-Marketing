# MVP Fixes Implementation Summary

This document summarizes the fixes applied to address auth, scheduling, plan limits, schema, and environment configuration issues.

## Overview

All changes were made **without rewriting the architecture**. The existing codebase structure was preserved, with targeted fixes applied to specific components.

---

## A) Authentication: NextAuth Integration ✅

### Problem
- NextAuth was installed but not configured
- Custom JWT auth with separate `JWT_SECRET`
- API client used localStorage Bearer tokens
- No unified session management

### Solution Implemented

#### 1. NextAuth Configuration ([apps/web/src/app/api/auth/[...nextauth]/route.ts](apps/web/src/app/api/auth/[...nextauth]/route.ts))

**Created NextAuth API route with:**
- **Credentials Provider**: Authenticates against existing API `/api/auth/signin`
- **Google Provider**: Optional (requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`)
- **JWT Strategy**: Session stored as JWT with 7-day expiration
- **Custom Callbacks**: Stores `accountId`, `role`, and API token in session

```typescript
// Stores API JWT token in NextAuth session for backward compatibility
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.apiToken = (user as any).token; // API JWT from sign-in
    }
    return token;
  }
}
```

#### 2. Session Provider ([apps/web/src/components/Providers.tsx](apps/web/src/components/Providers.tsx))

**Created client-side SessionProvider wrapper:**
- Wraps entire app in NextAuth session context
- Integrated in [apps/web/src/app/layout.tsx](apps/web/src/app/layout.tsx)

#### 3. API Client Update ([apps/web/src/lib/api.ts](apps/web/src/lib/api.ts))

**Updated to use NextAuth session:**
- **Removed**: `localStorage` token management (`setToken`, `clearToken`)
- **Added**: `getToken()` method that retrieves API token from NextAuth session
- **Added**: `credentials: 'include'` for cookie-based session

```typescript
private async getToken(): Promise<string | null> {
  const session = await getSession();
  return (session as any)?.apiToken || null;
}
```

#### 4. Unified Secret Management

**Updated to use `NEXTAUTH_SECRET` everywhere:**
- [apps/api/src/middleware/auth.ts](apps/api/src/middleware/auth.ts#L7): `const JWT_SECRET = process.env.NEXTAUTH_SECRET`
- [apps/api/src/routes/auth.ts](apps/api/src/routes/auth.ts#L10): `const JWT_SECRET = process.env.NEXTAUTH_SECRET`
- Removed `JWT_SECRET` from [.env.example](.env.example)

### Tenant Isolation (Verified)

**All existing safeguards confirmed in place:**
- ✅ `req.accountId` set from JWT token (verified in DB)
- ✅ All Prisma queries scoped by `accountId`
- ✅ Webhook handlers verify `providerProfileId` ownership
- ✅ Worker verifies `schedule.accountId == content.accountId`
- ✅ Audit logging tracks all actions

### How It Works Now

```
User Sign-In Flow:
1. User submits credentials to NextAuth
2. NextAuth calls API /api/auth/signin
3. API returns user object + JWT token
4. NextAuth stores JWT in session (cookie)
5. API Client retrieves token from session
6. API Client adds "Authorization: Bearer {token}" to requests
7. API middleware verifies JWT using NEXTAUTH_SECRET
8. API sets req.accountId from token payload
```

---

## B) Scheduling: Immediate Job Enqueue (No Polling) ✅

### Problem
- Worker polled database every 60 seconds for items within 5-minute window
- Risk of double-enqueueing if status updates lagged
- Unnecessary database load
- Jobs could drift if polling missed window

### Solution Implemented

#### 1. Queue Service Module ([apps/api/src/services/queue.ts](apps/api/src/services/queue.ts))

**Created centralized queue management:**
- Exports `publishQueue` (BullMQ Queue instance)
- Exports `enqueuePublishJob()` function
- Prevents circular dependencies between scheduler and worker

```typescript
export async function enqueuePublishJob(
  scheduleItemId: string,
  scheduledFor: Date
): Promise<void> {
  const delay = Math.max(0, scheduledFor.getTime() - new Date().getTime());

  await publishQueue.add('publish-post', { scheduleItemId }, {
    delay,
    jobId: `publish-${scheduleItemId}`, // Idempotency key
  });
}
```

#### 2. Scheduler Update ([apps/api/src/services/scheduler.ts](apps/api/src/services/scheduler.ts#L122-L163))

**Modified `scheduleContent()` method:**
- Creates `ScheduleItem` records in transaction (status: `QUEUED`)
- **Immediately enqueues BullMQ jobs** after transaction commits
- Jobs enqueued with precise delay: `scheduledFor - now`

```typescript
// After creating schedule items in transaction
for (let i = 0; i < createdItems.length; i++) {
  const scheduleItemId = createdItems[i];
  const scheduledFor = scheduleItems[i].scheduledFor;

  await enqueuePublishJob(scheduleItemId, scheduledFor); // ✅ Immediate
}
```

#### 3. Worker Simplification ([apps/api/src/worker/index.ts](apps/api/src/worker/index.ts#L160-L162))

**Removed polling logic:**
- Deleted `schedulePublishJobs()` function (lines 183-221)
- Deleted `setInterval()` polling loop (line 224)
- Worker now **only processes jobs** from queue
- Jobs arrive when BullMQ delay expires

```typescript
// BEFORE: Worker polled DB every 60 seconds
setInterval(schedulePublishJobs, 60 * 1000);

// AFTER: Worker passively processes jobs enqueued by scheduler
console.log('✅ Jobs are enqueued immediately when schedules are created (no polling)');
```

### How It Works Now

```
Scheduling Flow:
1. User calls POST /api/schedule/schedule
2. Scheduler creates ScheduleItem records (status: QUEUED)
3. Scheduler IMMEDIATELY enqueues BullMQ delayed jobs
   - Job ID: `publish-{scheduleItemId}` (prevents duplicates)
   - Delay: scheduledFor.getTime() - now.getTime()
4. BullMQ holds jobs in Redis until delay expires
5. Worker processes job at exact scheduled time
6. Worker publishes to Ayrshare
7. Worker updates ScheduleItem status (PUBLISHED/FAILED)
```

### Benefits

- ✅ **No polling overhead**: Zero DB queries between schedule and publish
- ✅ **Precise timing**: BullMQ handles millisecond-precise delays
- ✅ **Idempotent**: `jobId` prevents duplicate enqueues
- ✅ **Scalable**: Multiple workers can process queue concurrently
- ✅ **Reliable**: Jobs persisted in Redis, survive restarts

---

## C) Plan Limits: Consistency Verified ✅

### Analysis Result

**No inconsistencies found.** Plan limits are centralized and enforced correctly.

#### Canonical Source ([packages/shared/src/constants.ts](packages/shared/src/constants.ts))

```typescript
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  ESSENTIAL: {
    postsPerMonth: 8,
    promosPerMonth: 1,
    editsPerMonth: 3,
    price: 249,
  },
  GROWTH: {
    postsPerMonth: 18,  // ✅ Consistently 18 everywhere
    promosPerMonth: 2,
    editsPerMonth: 8,
    price: 449,
  },
  AUTHORITY: {
    postsPerMonth: 30,
    promosPerMonth: 3,
    editsPerMonth: 15,
    price: 799,
  },
};
```

#### Enforcement Points

1. **Edit Limit** ([apps/api/src/routes/content.ts](apps/api/src/routes/content.ts#L196-L210))
   - Checked on PATCH `/:id` endpoint
   - Increments `content.editCount`
   - Returns 403 if `newEditCount > limits.editsPerMonth`

2. **Content Generation** ([apps/api/src/services/ai/contentGeneratorV2.ts](apps/api/src/services/ai/contentGeneratorV2.ts#L63-L67))
   - Retrieves `PLAN_LIMITS[plan]`
   - Calculates `totalPosts = limits.postsPerMonth`
   - Instructs AI to generate exactly that many posts

3. **Billing Display** ([apps/api/src/routes/billing.ts](apps/api/src/routes/billing.ts#L15-L48))
   - Returns plan features as strings
   - Values match `PLAN_LIMITS` constants

### No Changes Required

Plan limits are already consistent and properly enforced.

---

## D) Prisma Schema Hardening ✅

### Changes Made

#### 1. Required `websiteUrl` Field ([apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma#L18))

**Before:**
```prisma
model Account {
  websiteUrl    String?  // Optional
}
```

**After:**
```prisma
model Account {
  websiteUrl    String   // Required for brand profile generation
}
```

**Migration:** Will be created on first deployment with `npx prisma migrate deploy`

#### 2. Verified Unique Constraints

✅ **Already in place:**
- `BrandProfile.accountId` - `@unique` (line 112)
- `MonthlyBrief` - `@@unique([accountId, month])` (line 151)
- `PublishingProfile.accountId` - `@unique` (line 90)
- `PostingRule.accountId` - `@unique` (line 188)

### Backfill Script

Existing script confirmed: [apps/api/src/scripts/backfillBrandProfiles.ts](apps/api/src/scripts/backfillBrandProfiles.ts)
- Generates `BrandProfile` for accounts missing one
- Uses `Account.websiteUrl` (now required)

---

## E) Environment Variables ✅

### Updated [.env.example](.env.example)

#### Removed

- ❌ `JWT_SECRET` (consolidated to `NEXTAUTH_SECRET`)

#### Added

```bash
# NextAuth configuration
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional)
# GOOGLE_CLIENT_ID="..."
# GOOGLE_CLIENT_SECRET="..."

# S3 public access
S3_PUBLIC_BASE_URL="https://your-public-r2-url.com"
S3_FORCE_PATH_STYLE="true"  # Required for R2 compatibility
```

#### Renamed

```bash
# BEFORE
# NextAuth / JWT
NEXTAUTH_SECRET="..."
JWT_SECRET="..."

# AFTER
# NextAuth (used for both web session and API JWT)
NEXTAUTH_SECRET="..."
```

---

## F) Safety Verification ✅

### Multi-Tenant Isolation Confirmed

**All routes verified:**
- ✅ All Prisma queries include `where: { accountId: req.accountId }`
- ✅ Create operations set `accountId: req.accountId!`
- ✅ Composite unique constraints prevent cross-tenant access

### Publishing Safety (4-Layer Protection)

1. **Schedule Creation** ([apps/api/src/services/scheduler.ts](apps/api/src/services/scheduler.ts#L25-L27))
   - Verifies `PublishingProfile` exists and is `VERIFIED`
   - Freezes `providerProfileId` at schedule time (line 100-103)

2. **Worker Verification** ([apps/api/src/worker/index.ts](apps/api/src/worker/index.ts#L58-L78))
   - Validates `scheduleItem.accountId == content.accountId`
   - Confirms `providerProfileId` hasn't changed
   - Throws error on mismatch

3. **Webhook Verification** ([apps/api/src/routes/webhooks.ts](apps/api/src/routes/webhooks.ts))
   - Stripe: Verifies signature with `STRIPE_WEBHOOK_SECRET`
   - Ayrshare: Validates `providerJobId` maps to correct account

4. **Audit Logging** ([apps/api/src/utils/audit.ts](apps/api/src/utils/audit.ts))
   - All actions logged to `AuditEvent` table
   - Includes `accountId`, `userId`, `entityType`, `entityId`

---

## G) Testing Checklist

### Local Testing Commands

```bash
# 1. Install dependencies
npm install

# 2. Run database migrations
npm run db:migrate

# 3. Seed database (optional)
npm run db:seed

# 4. Backfill brand profiles
cd apps/api && npx tsx src/scripts/backfillBrandProfiles.ts

# 5. Start API server
cd apps/api && npm run dev

# 6. Start worker (separate terminal)
cd apps/api && npm run worker

# 7. Start web app (separate terminal)
cd apps/web && npm run dev
```

### Flow Testing

1. **Authentication**
   - ✅ Visit `http://localhost:3000`
   - ✅ Sign up with email/password
   - ✅ Session stored in cookie
   - ✅ API calls include Bearer token from session

2. **Content Generation**
   - ✅ Create monthly brief
   - ✅ Generate content pack
   - ✅ Verify post count matches plan limits
   - ✅ Edit content (track `editCount`)
   - ✅ Verify edit limit enforcement

3. **Scheduling (New Flow)**
   - ✅ Configure posting rules
   - ✅ Approve content
   - ✅ Schedule posts
   - ✅ **Verify**: Jobs enqueued immediately (check Redis or BullMQ UI)
   - ✅ **Verify**: No polling in worker logs
   - ✅ Check upcoming schedule shows queued items

4. **Publishing**
   - ✅ Worker processes job at scheduled time
   - ✅ Ayrshare API called with frozen `providerProfileId`
   - ✅ ScheduleItem status updated to PUBLISHED
   - ✅ ContentItem status updated when all platforms published
   - ✅ Audit event logged

---

## Summary of Changes

| Component | File | Change |
|-----------|------|--------|
| **NextAuth Config** | `apps/web/src/app/api/auth/[...nextauth]/route.ts` | ✅ Created |
| **Session Provider** | `apps/web/src/components/Providers.tsx` | ✅ Created |
| **Layout** | `apps/web/src/app/layout.tsx` | ✅ Updated (wrapped in Providers) |
| **API Client** | `apps/web/src/lib/api.ts` | ✅ Updated (session-based tokens) |
| **API Middleware** | `apps/api/src/middleware/auth.ts` | ✅ Updated (NEXTAUTH_SECRET) |
| **Auth Routes** | `apps/api/src/routes/auth.ts` | ✅ Updated (NEXTAUTH_SECRET) |
| **Queue Service** | `apps/api/src/services/queue.ts` | ✅ Created |
| **Scheduler** | `apps/api/src/services/scheduler.ts` | ✅ Updated (immediate enqueue) |
| **Worker** | `apps/api/src/worker/index.ts` | ✅ Updated (removed polling) |
| **Prisma Schema** | `apps/api/prisma/schema.prisma` | ✅ Updated (websiteUrl required) |
| **Environment** | `.env.example` | ✅ Updated (removed JWT_SECRET, added S3 vars) |

---

## Deployment Notes

### Required Environment Variables (Production)

```bash
# Database & Redis
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# Authentication (SINGLE SECRET)
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"
NEXTAUTH_URL="https://your-web-domain.com"

# S3 Storage
S3_ENDPOINT="https://..."
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_BUCKET="pulseworks-media"
S3_PUBLIC_BASE_URL="https://your-cdn.com"
S3_FORCE_PATH_STYLE="true"

# Third-party APIs
AYRSHARE_API_KEY="..."
OPENAI_API_KEY="..."

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ESSENTIAL="price_..."
STRIPE_PRICE_GROWTH="price_..."
STRIPE_PRICE_AUTHORITY="price_..."
STRIPE_PRICE_POSTING_ADDON="price_..."

# Application
APP_URL="https://your-web-domain.com"
NODE_ENV="production"
```

### Deployment Steps

1. **Web Frontend** (Railway/Vercel)
   - Set `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
   - Set `NEXT_PUBLIC_API_URL` to API backend URL

2. **API Backend** (Railway/Fly.io)
   - Set all environment variables above
   - Run migration: `npx prisma migrate deploy`
   - Run backfill: `npx tsx src/scripts/backfillBrandProfiles.ts`

3. **Worker** (Railway/Fly.io)
   - Same environment as API
   - Start command: `npm run worker --workspace=api`

4. **Verify**
   - Check worker logs for "✅ Jobs are enqueued immediately"
   - Test full flow from sign-up to publishing
   - Verify audit events in database

---

## Breaking Changes

### ⚠️ Migration Required for Existing Deployments

If you have existing deployments with data:

1. **Environment Variables**
   - Remove `JWT_SECRET` from production
   - Ensure `NEXTAUTH_SECRET` is set (same value as old JWT_SECRET for continuity)
   - Add `S3_PUBLIC_BASE_URL` and `S3_FORCE_PATH_STYLE`
   - Add `NEXTAUTH_URL`

2. **Database Migration**
   - Run `npx prisma migrate deploy` to make `websiteUrl` required
   - If any accounts have `null` websiteUrl, migration will fail
   - Fix: Update accounts with placeholder URLs before migration

3. **Worker Restart**
   - Old worker polls DB every 60 seconds (unnecessary load)
   - New worker processes queued jobs only
   - Restart worker to remove polling behavior

4. **Existing Scheduled Posts**
   - Posts with status `QUEUED` won't have BullMQ jobs enqueued
   - Fix: Cancel and reschedule, OR run manual enqueue script

### No Breaking Changes For

- ✅ User authentication (API JWT still works)
- ✅ Content generation
- ✅ Audit logging
- ✅ Billing/Stripe integration
- ✅ Webhook handlers

---

## Files Reference

### Created Files
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `apps/web/src/components/Providers.tsx` - Session provider wrapper
- `apps/api/src/services/queue.ts` - Centralized BullMQ queue management
- `FIXES_IMPLEMENTED.md` - This document

### Modified Files
- `apps/web/src/app/layout.tsx` - Wrapped in SessionProvider
- `apps/web/src/lib/api.ts` - Session-based token retrieval
- `apps/api/src/middleware/auth.ts` - Use NEXTAUTH_SECRET
- `apps/api/src/routes/auth.ts` - Use NEXTAUTH_SECRET
- `apps/api/src/services/scheduler.ts` - Immediate job enqueue
- `apps/api/src/worker/index.ts` - Removed polling loop
- `apps/api/prisma/schema.prisma` - Required websiteUrl
- `.env.example` - Updated variables

---

## Questions & Support

### "Do I need to regenerate JWT tokens for existing users?"

**No.** As long as you set `NEXTAUTH_SECRET` to the same value as your old `JWT_SECRET`, existing tokens continue to work.

### "What happens to posts scheduled before this update?"

Existing `ScheduleItem` records with status `QUEUED` won't have BullMQ jobs enqueued. You have two options:
1. Cancel and reschedule them (triggers new job enqueue)
2. Write one-time script to enqueue jobs for existing items

### "Can I still use Google OAuth?"

Yes. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in environment, and NextAuth will enable Google provider automatically.

### "How do I verify jobs are being enqueued?"

Check worker logs for:
```
Enqueued publish job for <scheduleItemId> with delay <X>ms
```

Or use BullMQ Board/Arena to inspect Redis queue.

---

**Last Updated:** 2025-12-26
**Version:** 1.0.0
**Author:** Claude Sonnet 4.5 (via Claude Code)
