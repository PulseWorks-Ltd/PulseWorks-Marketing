# PostLoop - AI Marketing Automation for Small Business

PostLoop is an AI-powered marketing automation platform that helps small businesses create and schedule social media content effortlessly.

## Quick Links

- 📋 **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - What's done, what's left
- 🚀 **[Railway Setup Guide](RAILWAY_SETUP_GUIDE.md)** - Step-by-step deployment
- 📘 **[Technical Implementation Guide](POSTLOOP_IMPLEMENTATION.md)** - Complete technical details
- 🔧 **[Previous Fixes](FIXES_IMPLEMENTED.md)** - NextAuth & scheduling improvements

---

## Features

### Plans & Pricing

**Starter - $39/month**
- 8 static posts per month
- Website scan + business profile
- Manual download only
- 14-day free trial

**Starter + Auto-posting Add-on - +$30/month**
- Auto-post to Facebook & Instagram
- Up to 8 scheduled posts per month
- Static posts only

**Growth - $99/month** (Popular)
- 12 static posts + 4 videos per month
- Auto-posting included
- Upload images to create content
- 14-day free trial

**Pro - $249/month**
- 30 static posts + 16 videos per month
- Auto-posting included
- Campaign-style creation
- Priority rendering
- 14-day free trial

**One-time Purchases:**
- Single static post: $5
- Single video: $19

### Core Capabilities

✅ **Website Scanning** - Generate business profile from your website
✅ **AI Content Generation** - Create posts tailored to your brand
✅ **Auto-posting** - Schedule to Facebook Pages & Instagram
✅ **Usage Tracking** - Quota-based system per billing period
✅ **Stripe Integration** - Subscriptions + one-time purchases

🚧 **Coming Soon:**
- Video generation
- Create content from uploaded images
- Usage dashboard
- Campaign tools (Pro)

---

## Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- NextAuth for authentication
- TypeScript
- Tailwind CSS

**Backend:**
- Express.js API
- PostgreSQL (Prisma ORM)
- Redis (BullMQ for job queue)
- TypeScript

**Services:**
- Stripe (Billing)
- OpenAI (Content generation)
- Ayrshare (Social media posting)
- Cloudflare R2 / AWS S3 (Media storage)

**Infrastructure:**
- Railway (Deployment)
- Monorepo (Turborepo)

---

## Project Structure

```
postloop/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/         # App router pages
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # API client, utilities
│   │   └── package.json
│   │
│   └── api/                 # Express backend
│       ├── src/
│       │   ├── routes/      # API endpoints
│       │   ├── services/    # Business logic
│       │   ├── middleware/  # Auth, error handling
│       │   ├── worker/      # BullMQ job processor
│       │   └── db/          # Prisma client
│       ├── prisma/          # Database schema
│       └── package.json
│
├── packages/
│   └── shared/              # Shared types & constants
│       ├── src/
│       │   ├── types.ts     # TypeScript types
│       │   └── constants.ts # Plan limits, etc.
│       └── package.json
│
├── package.json             # Root workspace config
└── turbo.json              # Turborepo configuration
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL database
- Redis server
- Stripe account (test mode)
- OpenAI API key
- Ayrshare API key (optional for testing)
- Cloudflare R2 or AWS S3 bucket

### Step 1: Clone & Install

```bash
git clone <your-repo>
cd postloop
npm install
```

### Step 2: Environment Variables

Copy `.env.example` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Random 32-char string
- `STRIPE_SECRET_KEY` - Stripe test key
- `STRIPE_PRICE_*` - Stripe price IDs (create products first)
- `OPENAI_API_KEY` - OpenAI API key
- `S3_*` - Storage credentials

See [RAILWAY_SETUP_GUIDE.md](RAILWAY_SETUP_GUIDE.md) for detailed setup.

### Step 3: Database Setup

```bash
# Run migrations
npm run db:migrate

# (Optional) Seed database
npm run db:seed
```

### Step 4: Start Development Servers

**Terminal 1 - API:**
```bash
cd apps/api
npm run dev
```

**Terminal 2 - Worker:**
```bash
cd apps/api
npm run worker
```

**Terminal 3 - Web:**
```bash
cd apps/web
npm run dev
```

Visit `http://localhost:3000`

---

## Deployment

### Railway (Recommended)

See **[RAILWAY_SETUP_GUIDE.md](RAILWAY_SETUP_GUIDE.md)** for complete step-by-step instructions.

**Quick Summary:**
1. Create Stripe products (6 products/prices)
2. Set up Cloudflare R2 bucket
3. Create Railway project
4. Deploy 3 services: Web, API, Worker
5. Add PostgreSQL + Redis databases
6. Configure environment variables
7. Run database migration
8. Set up Stripe webhook

**Time:** ~1-2 hours for first deployment

---

## Documentation

**Setup & Deployment:**
- [Railway Setup Guide](RAILWAY_SETUP_GUIDE.md) - Complete Railway deployment
- [Implementation Guide](POSTLOOP_IMPLEMENTATION.md) - Technical details

**Reference:**
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - What's done/pending
- [Previous Fixes](FIXES_IMPLEMENTED.md) - NextAuth & scheduling fixes
- [Environment Variables](.env.example) - All required vars

---

## Status

**Version:** 1.0.0
**Last Updated:** 2026-01-03
**Status:** Ready for staging deployment

**Completed:**
✅ Pricing model & constants
✅ Database schema & migrations
✅ Usage tracking service
✅ Stripe integration
✅ Webhooks
✅ Rebranding to PostLoop

**In Progress:**
🚧 Video generation
🚧 Image upload feature
🚧 Usage dashboard UI
🚧 Pay-per-use modal

---

## License

Private - © PulseWorks Limited
