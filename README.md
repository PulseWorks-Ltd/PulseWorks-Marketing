# PulseWorks Marketing - Content Engine SaaS

A production-ready multi-tenant SaaS platform for automated social media content generation and posting, built specifically for New Zealand businesses.

## Features

- **Brand Intelligence Layer**: Structured brand profiles as single source of truth for content generation
- **AI-Powered Content Generation**: Generate monthly content packs using brand profiles
- **Multi-Platform Publishing**: Auto-post to Facebook Pages and Instagram Business accounts
- **Smart Scheduling**: Intelligent content distribution across the month
- **Multi-Tenant Architecture**: Strict account isolation with comprehensive audit logging
- **Subscription Billing**: Stripe integration with 3 plans + posting add-on
- **Content Approval Workflow**: Clients approve, edit, or skip content before publishing
- **Manual Refinement**: Update brand profiles without code changes (supports external analysis tools)

## Tech Stack

### Backend
- **Node.js + Express + TypeScript**: REST API server
- **Prisma + PostgreSQL**: Database ORM with type-safe queries
- **BullMQ + Redis**: Background job processing for publishing
- **OpenAI GPT-4**: AI content generation
- **Ayrshare**: Social media posting provider
- **Stripe**: Payment processing
- **AWS S3/Cloudflare R2**: Media storage

### Frontend
- **Next.js 14 (App Router)**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **shadcn/ui**: UI components
- **NextAuth**: Authentication

### Infrastructure
- **Turborepo**: Monorepo management
- **Docker**: Containerization (optional)
- **Vercel/Railway**: Deployment ready

## Project Structure

```
pulseworks-marketing/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   ├── components/
│   │   │   └── lib/      # Utilities
│   │   └── package.json
│   └── api/              # Express backend
│       ├── src/
│       │   ├── routes/   # API routes
│       │   ├── services/ # Business logic
│       │   ├── middleware/
│       │   ├── worker/   # BullMQ worker
│       │   └── db/       # Prisma client & seed
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
└── packages/
    └── shared/           # Shared types & schemas
        ├── src/
        │   ├── types.ts
        │   ├── schemas.ts  # Zod schemas
        │   └── constants.ts
        └── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6
- npm >= 9.0.0

### Environment Setup

1. **Clone and install dependencies:**

```bash
git clone <repo-url>
cd pulseworks-marketing
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/pulseworks_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
NEXTAUTH_SECRET="your-secret-key"
JWT_SECRET="your-jwt-secret"

# Storage (Cloudflare R2 or AWS S3)
S3_ENDPOINT="https://your-account.r2.cloudflarestorage.com"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_BUCKET="pulseworks-media"
S3_REGION="auto"

# Ayrshare
AYRSHARE_API_KEY="your-ayrshare-api-key"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ESSENTIAL="price_..."
STRIPE_PRICE_GROWTH="price_..."
STRIPE_PRICE_AUTHORITY="price_..."
STRIPE_PRICE_POSTING_ADDON="price_..."

# App
APP_URL="http://localhost:3000"
```

3. **Set up database:**

```bash
# Run migrations
npm run db:migrate

# Seed database with test data
npm run db:seed
```

4. **Start development servers:**

```bash
# Start all services (API + Web + Worker)
npm run dev

# Or start individually:
cd apps/api && npm run dev        # API server on :3001
cd apps/api && npm run worker     # BullMQ worker
cd apps/web && npm run dev        # Next.js on :3000
```

### Test Credentials

After seeding:
- **Email**: `test@example.com`
- **Password**: `password123`

## API Documentation

### Authentication

All API requests (except `/api/auth/*`) require a Bearer token:

```
Authorization: Bearer <token>
```

Get a token by signing in:

```bash
POST /api/auth/signin
{
  "email": "test@example.com",
  "password": "password123"
}
```

### Key Endpoints

#### Monthly Briefs
- `POST /api/briefs` - Create/update monthly brief
- `GET /api/briefs/:month` - Get brief by month

#### Content Generation
- `POST /api/content/generate` - Generate content pack from brief
- `GET /api/content?month=2025-01-01` - List content
- `POST /api/content/:id/approve` - Approve content
- `PATCH /api/content/:id` - Edit content (limited by plan)
- `POST /api/content/:id/skip` - Skip content

#### Scheduling
- `POST /api/schedule/rules` - Set posting rules
- `POST /api/schedule/schedule` - Schedule approved posts
- `GET /api/schedule/upcoming` - View upcoming posts
- `DELETE /api/schedule/:id` - Cancel scheduled post

#### Social Connections
- `POST /api/social/connect` - Connect social account
- `POST /api/social/verify-destinations` - Verify and freeze destinations
- `GET /api/social/publishing-profile` - Get verified profile

#### Billing
- `POST /api/billing/checkout` - Create Stripe checkout
- `POST /api/billing/portal` - Access customer portal
- `GET /api/billing/subscription` - Get current subscription

## Plans & Limits

| Plan | Price | Posts | Promos | Edits |
|------|-------|-------|--------|-------|
| Essential | $249/mo | 8 | 1 | 3 |
| Growth | $449/mo | 18 | 2 | 8 |
| Authority | $799/mo | 30 | 3 | 15 |

**Add-on: Posting & Scheduling** - $249/mo
- Auto-posting to FB + IG
- 1 Facebook Page + 1 Instagram account
- Includes all scheduled posts up to plan limit

## Security & Multi-Tenancy

### Tenant Isolation
- Every database query is scoped to `accountId`
- Middleware enforces account context from JWT
- No cross-tenant data leakage possible

### Publishing Safety
1. **Destination Verification**: Users must confirm social accounts before scheduling
2. **Frozen Profile IDs**: Provider profile IDs are copied to schedule items at creation time
3. **Account Matching**: Worker verifies account ownership before posting
4. **Audit Logging**: All critical actions logged with account + user context

### Audit Events
All these actions are logged:
- User login, account created
- Social connections, publishing verification
- Content generated, approved, edited, skipped
- Posts scheduled, published, failed
- Subscriptions created, updated, cancelled

## Content Generation Pipeline

### 1. Brand Extraction
```typescript
// Fetches website, extracts:
- Site title & meta description
- H1/H2 headings
- Color palette (basic)
- Generates brand profile via AI:
  - Tone keywords
  - Content pillars
  - Voice rules (do/don't)
```

### 2. Content Planning
```typescript
// AI generates post topics based on:
- Brand profile
- Monthly focus (new clients, education, promo, seasonal)
- Plan limits (8-30 posts)
```

### 3. Caption Generation
```typescript
// AI writes captions following:
- Brand voice rules
- 100-300 characters (social-optimized)
- Clear, non-spammy
- NZ-appropriate hashtags (8-12)
```

### 4. Image Generation
```typescript
// Server-side canvas rendering:
- Education cards (title + bullets)
- Promo cards (offer + CTA)
- Trust cards (team/about)
- Brand colors + business name
```

### 5. Storage
```typescript
// Upload to S3/R2:
/media/{accountId}/{month}/{contentItemId}.png
```

## Scheduling Algorithm

```typescript
// Input: approved content items + posting rules
// Output: schedule items with exact UTC timestamps

1. Load PostingRule (frequency, days, time window)
2. Generate time slots for remaining month
   - Filter by selected weekdays
   - Apply time window (morning/afternoon/evening)
   - Convert to UTC from account timezone
3. Distribute content across slots (round-robin)
4. Create ScheduleItem per platform per content
5. Freeze providerProfileId at schedule time
```

## BullMQ Worker

The posting worker runs continuously:

```typescript
// Every minute:
1. Query schedule items with scheduledFor in next 5 minutes
2. Queue BullMQ job with delay until exact time
3. Mark as SCHEDULED

// On job execution:
1. Load schedule item + content + account
2. Verify account match + provider profile match
3. Post via Ayrshare API
4. Update status (PUBLISHED/FAILED)
5. Log audit event
```

## Webhooks

### Stripe Webhook
- `POST /api/webhooks/stripe`
- Handles: subscription created/updated/cancelled
- Updates account plan and posting addon

### Ayrshare Webhook
- `POST /api/webhooks/ayrshare`
- Handles: post success/failure notifications
- Updates schedule item status and post URLs

## Testing

```bash
# Run all tests
npm test

# Run API tests only
cd apps/api && npm test

# Run specific test file
cd apps/api && npm test -- scheduler.test
```

### Test Coverage
- ✅ Zod schema validation (all schemas)
- ✅ Scheduling algorithm (time slots, day filtering)
- ✅ Tenant isolation (conceptual verification)

## Deployment

### Railway (Recommended)

1. **Create Railway project** with:
   - PostgreSQL database
   - Redis service
   - API service
   - Worker service
   - Web service

2. **Set environment variables** in each service

3. **Deploy:**

```bash
# API service
railway up apps/api

# Worker service (same code, different start command)
railway up apps/api --start "npm run worker"

# Web service
railway up apps/web
```

### Vercel (Frontend) + Railway (Backend)

- **Frontend**: Deploy `apps/web` to Vercel
- **Backend**: Deploy `apps/api` + worker to Railway

### Docker (Self-hosted)

```bash
docker-compose up -d
```

(Docker config not included in MVP - add as needed)

## Production Checklist

Before going live:

- [ ] Change all secrets (`NEXTAUTH_SECRET`, `JWT_SECRET`)
- [ ] Set up production Stripe products/prices
- [ ] Configure production Ayrshare account
- [ ] Set up S3/R2 bucket with proper CORS
- [ ] Enable Stripe webhook endpoint in dashboard
- [ ] Set up Ayrshare webhook endpoint
- [ ] Configure domain and SSL
- [ ] Set `NODE_ENV=production`
- [ ] Enable database connection pooling
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Configure backups for PostgreSQL
- [ ] Test full flow: signup → generate → approve → schedule → publish
- [ ] Verify tenant isolation in production
- [ ] Set up admin dashboard for monitoring

## Architecture Decisions

### Why Express instead of Next.js API routes?
- Clean separation of concerns
- Easier to scale API independently
- Better suited for background jobs (BullMQ worker)
- Can deploy to different infrastructure if needed

### Why Ayrshare instead of direct social APIs?
- Unified API for FB + IG (and future platforms)
- Handles OAuth flows and token refresh
- Manages rate limits and retries
- Reduces compliance/security burden

### Why node-canvas for images instead of external service?
- Cost: no per-image fees
- Privacy: no data sent to third parties
- Control: customize templates fully
- Speed: server-side rendering is fast enough for MVP

### Why BullMQ instead of cron?
- Precise scheduling (down to the second)
- Automatic retries with exponential backoff
- Job persistence (survives server restarts)
- Scalable (can add more workers)

## Troubleshooting

### Database connection errors
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Reset database
npm run db:push
```

### Redis connection errors
```bash
# Check Redis is running
redis-cli ping

# Should return: PONG
```

### Posting worker not processing jobs
```bash
# Check worker is running
cd apps/api && npm run worker

# Check Redis queue
redis-cli
> KEYS bull:publish-posts:*
```

### AI generation failures
- Verify `OPENAI_API_KEY` is set and valid
- Check API quota/billing
- Review AI service logs in console

### Images not uploading
- Verify S3 credentials (`S3_ACCESS_KEY`, `S3_SECRET_KEY`)
- Check bucket permissions (public-read or signed URLs)
- Test with AWS CLI: `aws s3 ls s3://your-bucket --endpoint-url=...`

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test thoroughly
3. Ensure tests pass: `npm test`
4. Update documentation if needed
5. Submit pull request

## License

MIT License - see LICENSE file

## Support

For issues or questions:
- GitHub Issues: [repo-url]/issues
- Email: support@pulseworks.co.nz

---

**Built with ❤️ in New Zealand**
