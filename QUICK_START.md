# Quick Start Guide

Get PulseWorks Marketing running in under 10 minutes.

## Prerequisites Check

```bash
node --version   # Should be >= 18
psql --version   # PostgreSQL >= 14
redis-cli ping   # Should return PONG
```

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` with your keys. **Minimum required for local dev:**

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/pulseworks_dev"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="dev-secret-change-me"
OPENAI_API_KEY="sk-..."
AYRSHARE_API_KEY="..."
STRIPE_SECRET_KEY="sk_test_..."
S3_ENDPOINT="https://..."
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_BUCKET="pulseworks-media"
```

## 3. Set Up Database

```bash
# Create database and run migrations
npm run db:migrate

# Seed with test data
npm run db:seed
```

Test credentials will be:
- Email: `test@example.com`
- Password: `password123`

## 4. Start Services

**Option A: All at once** (3 terminals)
```bash
# Terminal 1: API
cd apps/api && npm run dev

# Terminal 2: Worker
cd apps/api && npm run worker

# Terminal 3: Frontend
cd apps/web && npm run dev
```

**Option B: Using turbo** (single terminal)
```bash
npm run dev
```

## 5. Test the API

```bash
# Sign in
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Copy the token from response, then:
export TOKEN="<your-token>"

# Get account
curl http://localhost:3001/api/account \
  -H "Authorization: Bearer $TOKEN"

# Create monthly brief
curl -X POST http://localhost:3001/api/briefs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "month": "2025-01-01",
    "primaryFocus": "NEW_CLIENTS",
    "tone": "EDUCATIONAL",
    "promoEnabled": false
  }'
```

## 6. Test Content Generation

```bash
# Get brief ID from previous response, then:
curl -X POST http://localhost:3001/api/content/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthlyBriefId":"<brief-id>"}'
```

This will:
1. Fetch the test website
2. Extract brand profile
3. Generate content plan
4. Write captions
5. Generate images
6. Upload to S3
7. Save content items

## 7. Access Frontend

Open [http://localhost:3000](http://localhost:3000)

- Landing page is ready
- Auth pages need UI (backend works)
- Dashboard needs UI (backend works)

## Common Issues

### "Database connection failed"
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# If not running (Mac):
brew services start postgresql

# If not running (Ubuntu):
sudo systemctl start postgresql
```

### "Redis connection failed"
```bash
# Check Redis is running
redis-cli ping

# If not running (Mac):
brew services start redis

# If not running (Ubuntu):
sudo systemctl start redis
```

### "Prisma migration failed"
```bash
# Reset database (⚠️ deletes all data)
cd apps/api
npx prisma migrate reset

# Then re-seed
npx tsx src/db/seed.ts
```

### "Worker not processing jobs"
```bash
# Check Redis has the queue
redis-cli
> KEYS bull:publish-posts:*
> EXIT

# Check worker logs
cd apps/api && npm run worker
```

## API Endpoints Quick Reference

Base URL: `http://localhost:3001`

### Auth (no token required)
- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Get token

### Content Flow (requires token)
1. `POST /api/briefs` - Create monthly brief
2. `POST /api/content/generate` - Generate content pack
3. `GET /api/content` - View generated content
4. `POST /api/content/:id/approve` - Approve a post
5. `POST /api/schedule/rules` - Set posting schedule
6. `POST /api/schedule/schedule` - Schedule approved posts
7. `GET /api/schedule/upcoming` - View schedule

### Social & Billing
- `POST /api/social/connect` - Connect FB/IG
- `POST /api/social/verify-destinations` - Verify accounts
- `POST /api/billing/checkout` - Start subscription

## Database Tools

```bash
# Open Prisma Studio (visual database browser)
npm run db:studio

# View tables directly
psql postgresql://postgres:password@localhost:5432/pulseworks_dev
```

## View Logs

```bash
# API logs
cd apps/api && npm run dev

# Worker logs
cd apps/api && npm run worker

# Check BullMQ queue
redis-cli
> KEYS bull:publish-posts:*
> LRANGE bull:publish-posts:waiting 0 -1
```

## Test the Full Flow

1. Sign in via API
2. Create monthly brief
3. Generate content pack (AI + images)
4. Approve a few posts
5. Set posting rules
6. Schedule posts
7. Watch worker pick up and process

## Next Steps

- Implement frontend UI pages (see [IMPLEMENTATION.md](IMPLEMENTATION.md))
- Configure production services (Stripe, Ayrshare, S3)
- Deploy to Railway or Vercel

## Need Help?

- Check [README.md](README.md) for detailed docs
- Check [IMPLEMENTATION.md](IMPLEMENTATION.md) for architecture
- Check `.env.example` for all config options
- Check `apps/api/src/__tests__` for usage examples

---

**Happy building! 🚀**
