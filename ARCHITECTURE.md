# PulseWorks Marketing - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 14 Frontend (apps/web)                                 │
│  - React Server Components                                       │
│  - API Client (JWT auth)                                         │
│  - Tailwind + shadcn/ui                                         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS/JSON
                               │
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  Express API (apps/api/src)                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Auth Middleware → JWT verification                        │ │
│  │ Account Context → Tenant isolation                        │ │
│  │ Error Handler → Centralized error handling               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Routes:                                                         │
│  ├─ /api/auth/*        - Authentication                         │
│  ├─ /api/briefs/*      - Monthly brief CRUD                     │
│  ├─ /api/content/*     - Content generation & management        │
│  ├─ /api/schedule/*    - Scheduling & posting rules             │
│  ├─ /api/social/*      - Social connections                     │
│  ├─ /api/billing/*     - Stripe integration                     │
│  └─ /api/webhooks/*    - External webhooks                      │
└─────────────────────────────────────────────────────────────────┘
                    │              │              │
        ┌───────────┴──────┐      │      ┌───────┴────────┐
        │                  │      │      │                │
        ▼                  ▼      ▼      ▼                ▼
┌─────────────┐    ┌────────────────────────┐    ┌──────────────┐
│             │    │   SERVICE LAYER        │    │              │
│  PostgreSQL │◄───┤   (Business Logic)     │───►│  Redis       │
│             │    │                        │    │  (BullMQ)    │
│  - Prisma   │    │  ┌──────────────────┐ │    │              │
│  - Multi-   │    │  │ AI Services      │ │    └──────────────┘
│    tenant   │    │  │ - Brand Extract  │ │            │
│  - Indexed  │    │  │ - Content Gen    │ │            │
│             │    │  │ - Image Gen      │ │            ▼
└─────────────┘    │  └──────────────────┘ │    ┌──────────────┐
                   │  ┌──────────────────┐ │    │   WORKER     │
                   │  │ Scheduler        │ │    │   PROCESS    │
                   │  │ - Time slots     │ │    │              │
                   │  │ - Distribution   │ │    │  Publishing  │
                   │  └──────────────────┘ │    │  Jobs        │
                   │  ┌──────────────────┐ │    │              │
                   │  │ Ayrshare Client  │◄┼────┤  - Verify    │
                   │  │ - Multi-account  │ │    │  - Post      │
                   │  │ - Post/Status    │ │    │  - Retry     │
                   │  └──────────────────┘ │    │  - Log       │
                   │  ┌──────────────────┐ │    └──────────────┘
                   │  │ Storage Service  │ │
                   │  │ - S3/R2 upload   │ │
                   │  └──────────────────┘ │
                   └────────────────────────┘
                            │      │
                    ┌───────┘      └───────┐
                    │                      │
                    ▼                      ▼
            ┌──────────────┐      ┌──────────────┐
            │  OpenAI API  │      │  S3/R2       │
            │              │      │  Storage     │
            │  - GPT-4o    │      │              │
            │  - JSON mode │      │  /media/     │
            └──────────────┘      │  {accountId}/│
                                  └──────────────┘
                    │
                    ▼
            ┌──────────────┐      ┌──────────────┐
            │  Ayrshare    │      │  Stripe      │
            │  API         │      │  API         │
            │              │      │              │
            │  - FB Pages  │      │  - Checkout  │
            │  - Instagram │      │  - Portal    │
            └──────────────┘      │  - Webhooks  │
                    │              └──────────────┘
                    │
                    ▼
            ┌──────────────┐
            │  Social      │
            │  Media       │
            │              │
            │  - Facebook  │
            │  - Instagram │
            └──────────────┘
```

## Data Flow

### 1. Content Generation Flow

```
User → Create Brief → API validates
                    → Saves to DB
                    ↓
Generate Button → API triggers generation
                    ↓
                Brand Extractor
                    ├─ Fetch website HTML
                    ├─ Parse metadata/headings
                    ├─ Extract colors
                    └─ AI: Generate brand profile
                    ↓
                Content Generator
                    ├─ AI: Generate content plan
                    ├─ For each post:
                    │   ├─ AI: Generate caption
                    │   ├─ AI: Generate hashtags
                    │   └─ Image Generator
                    │       ├─ Create canvas
                    │       ├─ Render template
                    │       └─ Export PNG buffer
                    └─ Upload to S3
                    ↓
                Save ContentItems to DB
                    ↓
                Return to User
```

### 2. Publishing Flow

```
User → Approve Content → Update status = APPROVED
                       ↓
     Set Posting Rules → Save to DB
                       ↓
     Schedule Posts → Scheduler
                       ├─ Verify destinations verified
                       ├─ Generate time slots
                       ├─ Distribute content
                       ├─ Freeze providerProfileId
                       └─ Create ScheduleItems
                       ↓
     Worker (every minute)
         ├─ Query: scheduledFor in next 5 min
         ├─ Queue BullMQ job with delay
         └─ Mark as SCHEDULED
                       ↓
     Job Execution (at exact time)
         ├─ Load ScheduleItem + Content
         ├─ Verify account match
         ├─ Verify provider profile match
         ├─ Post via Ayrshare
         ├─ Update status
         └─ Log audit event
                       ↓
     Webhook (async)
         ├─ Receive posting status
         ├─ Update ScheduleItem
         └─ Log audit event
```

### 3. Authentication Flow

```
Sign Up → Validate input
        → Hash password
        → Transaction:
            ├─ Create Account
            └─ Create User (role=OWNER)
        → Log audit events
        → Generate JWT token
        → Return to client
                ↓
Client stores token in localStorage
                ↓
API requests → Include Bearer token
             → Middleware verifies JWT
             → Load user + account
             → Set req.accountId, req.userId
             → Continue to route handler
```

## Database Schema Overview

### Core Tables

```
Account (Tenant)
├── id (PK)
├── name
├── websiteUrl
├── plan (ESSENTIAL|GROWTH|AUTHORITY)
├── postingAddon (boolean)
├── timezone (default: Pacific/Auckland)
└── stripeCustomerId

User
├── id (PK)
├── accountId (FK → Account)
├── email (unique)
├── passwordHash
└── role (OWNER|ADMIN|MEMBER)

MonthlyBrief
├── id (PK)
├── accountId (FK → Account)
├── month (date, unique with accountId)
├── primaryFocus (NEW_CLIENTS|EDUCATION|...)
├── promoEnabled
└── tone (NEUTRAL|EDUCATIONAL|PROMOTIONAL)

ContentItem
├── id (PK)
├── accountId (FK → Account)
├── monthlyBriefId (FK → MonthlyBrief)
├── month
├── type (POST|PROMO)
├── title, caption, hashtags
├── mediaUrl
├── platformTargets (json: ["FACEBOOK", "INSTAGRAM"])
├── status (DRAFT|APPROVED|SCHEDULED|PUBLISHED)
└── editCount

SocialConnection
├── id (PK)
├── accountId (FK → Account)
├── platform (FACEBOOK|INSTAGRAM)
├── providerProfileId (Ayrshare profile key)
├── platformAccountId
└── status

PublishingProfile (one per account)
├── id (PK)
├── accountId (FK → Account, unique)
├── facebookProfileId (frozen)
├── instagramProfileId (frozen)
├── status (VERIFIED|NEEDS_RECONNECT)
└── verifiedAt

PostingRule (one per account)
├── id (PK)
├── accountId (FK → Account, unique)
├── frequency (TWICE_WEEKLY|THREE_WEEKLY)
├── daysOfWeek (json: [1,3,5])
└── timeWindow (MORNING|AFTERNOON|EVENING)

ScheduleItem
├── id (PK)
├── accountId (FK → Account)
├── contentItemId (FK → ContentItem)
├── platform (FACEBOOK|INSTAGRAM)
├── scheduledFor (datetime, indexed)
├── providerProfileId (FROZEN at schedule time)
├── providerJobId (from Ayrshare)
├── status (QUEUED|SCHEDULED|PUBLISHED|FAILED)
└── errorMessage

AuditEvent
├── id (PK)
├── accountId (FK → Account)
├── userId (FK → User, nullable)
├── eventType (CONTENT_GENERATED|POST_PUBLISHED|...)
├── entityType, entityId
├── metadata (json)
└── createdAt (indexed)
```

## Security Architecture

### Multi-Tenant Isolation

```
Request → JWT Middleware
            ↓
        Extract userId
            ↓
        Load User + Account
            ↓
        Set req.accountId ← CRITICAL
            ↓
        Route Handler
            ↓
        All queries MUST include:
        where: { accountId: req.accountId }
            ↓
        Response (only tenant data)
```

### Publishing Safety Layers

```
Layer 1: Verification Required
    └─ User must confirm FB Page + IG account
       before scheduling is allowed

Layer 2: Freeze Profile IDs
    └─ Copy providerProfileId to ScheduleItem
       at schedule creation time

Layer 3: Worker Verification
    └─ Verify:
       ├─ scheduleItem.accountId === content.accountId
       ├─ scheduleItem.providerProfileId === current profile
       └─ Account still owns social connection

Layer 4: Audit Logging
    └─ Log all publish attempts with:
       ├─ accountId
       ├─ userId
       ├─ timestamp
       ├─ success/failure
       └─ error details
```

## External Integrations

### OpenAI (Content Generation)
- **Model**: GPT-4o-mini
- **Mode**: JSON with schema validation
- **Rate Limiting**: Handled by OpenAI SDK
- **Error Handling**: Retry once, then fail gracefully

### Ayrshare (Social Posting)
- **Multi-Account**: Profile keys per tenant
- **Platforms**: Facebook Pages, Instagram Business
- **Webhooks**: Status updates
- **Rate Limiting**: Managed by Ayrshare

### Stripe (Billing)
- **Products**: 3 plans + 1 addon
- **Webhooks**: subscription.created/updated/deleted
- **Customer Portal**: Managed by Stripe
- **Security**: Webhook signature verification

### S3/R2 (Media Storage)
- **Path Structure**: `/media/{accountId}/{month}/{contentId}.png`
- **Access**: Public-read or signed URLs
- **Size**: 1080x1080px PNGs
- **Cleanup**: Manual (future: lifecycle rules)

## Scaling Considerations

### Current Limitations (MVP)

1. **Single API instance**: No load balancing
2. **Single Worker instance**: Process 5 jobs concurrently
3. **No caching**: Every request hits DB
4. **No CDN**: Images served directly from S3/R2

### Scaling Strategy (Future)

```
Horizontal Scaling:
├─ API: Add instances behind load balancer
├─ Worker: Add more worker processes
└─ Database: Read replicas for queries

Caching:
├─ Redis: Brand profiles, content plans
├─ CDN: Static assets, generated images
└─ Query caching: Frequent lookups

Rate Limiting:
├─ API Gateway: Per-account quotas
├─ Content Gen: Max N/hour per account
└─ AI Provider: Circuit breaker

Monitoring:
├─ APM: New Relic / DataDog
├─ Logs: ELK stack / Logtail
├─ Alerts: PagerDuty / Opsgenie
└─ Metrics: Queue depth, job success rate
```

## Deployment Architecture

### Recommended: Railway

```
Railway Project
├─ PostgreSQL Service
│   └─ Automatic backups
├─ Redis Service
│   └─ Persistence enabled
├─ API Service
│   ├─ apps/api
│   ├─ Environment variables
│   └─ Auto-deploy from GitHub
├─ Worker Service
│   ├─ Same code as API
│   ├─ Start command: npm run worker
│   └─ Auto-restart on failure
└─ Web Service
    ├─ apps/web
    ├─ Environment variables
    └─ Auto-deploy from GitHub
```

### Alternative: Vercel + Railway

```
Vercel (Frontend only)
└─ apps/web

Railway (Backend)
├─ PostgreSQL
├─ Redis
├─ API Service
└─ Worker Service
```

## Performance Benchmarks (Expected)

### API Response Times
- Auth endpoints: < 200ms
- Content list: < 100ms
- Generate content: 10-30s (AI + images)
- Schedule posts: < 500ms

### Worker Performance
- Job pickup latency: 5-60s (checks every minute)
- Post processing: < 3s per post
- Concurrent jobs: 5 (configurable)

### Database Queries
- Tenant-scoped queries: < 50ms
- Schedule generation: < 200ms
- Audit logging: Async, non-blocking

---

**Last Updated**: 2025-01-25
