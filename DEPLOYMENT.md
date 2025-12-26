# Deployment Guide

## Architecture

This is a monorepo with three deployable services:

1. **Web Frontend** (Next.js) - Port 3000
2. **API Backend** (Express) - Port 3001
3. **Worker** (BullMQ) - Background jobs

## Railway Deployment (Recommended)

### Option 1: Three Separate Services

Create three Railway services from the same repository:

#### Service 1: Frontend (Web)

```bash
# Root directory: /
# Build command: (uses nixpacks.toml)
# Start command: npm run start --workspace=web
```

**Environment Variables:**
```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://your-web.railway.app
```

**Configuration Files:**
- Uses [nixpacks.toml](nixpacks.toml) - builds only web workspace
- Uses [railway.json](railway.json) - Railway-specific config

#### Service 2: API Backend

```bash
# Root directory: /
# Build command: npm install && npm run build --workspace=api
# Start command: npm run start --workspace=api
```

**Nixpacks configuration:**
Create `nixpacks-api.toml`:
```toml
[phases.setup]
nixPkgs = ['nodejs_22', 'npm-9_x', 'python311', 'pkg-config', 'cairo', 'pango', 'libpng', 'libjpeg', 'giflib', 'librsvg', 'pixman']

[phases.install]
cmds = ['npm install']

[phases.build]
cmds = ['npm run build --workspace=api']

[start]
cmd = 'npm run start --workspace=api'
```

**Environment Variables:**
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-jwt-secret
NEXTAUTH_SECRET=same-as-web
S3_ENDPOINT=https://...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=pulseworks-media
AYRSHARE_API_KEY=...
OPENAI_API_KEY=...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ESSENTIAL=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_AUTHORITY=price_...
STRIPE_PRICE_POSTING_ADDON=price_...
APP_URL=https://your-web.railway.app
PORT=3001
```

#### Service 3: Worker

```bash
# Root directory: /
# Build command: npm install && npm run build --workspace=api
# Start command: npm run worker --workspace=api
```

**Same environment variables as API** (shares codebase)

**Nixpacks configuration:** Same as API

### Option 2: Deploy API + Worker Together

You can run worker and API in the same service using a process manager.

Create `Procfile`:
```
web: npm run start --workspace=api
worker: npm run worker --workspace=api
```

### Railway Services Setup

#### Step 1: Add PostgreSQL
1. Click "New" → "Database" → "PostgreSQL"
2. Copy `DATABASE_URL` to API and Worker services

#### Step 2: Add Redis
1. Click "New" → "Database" → "Redis"
2. Copy `REDIS_URL` to API and Worker services

#### Step 3: Deploy Services
1. **Frontend:** Connect GitHub → Select "main" branch → Configure using nixpacks.toml
2. **API:** Connect GitHub → Select "main" branch → Use custom nixpacks-api.toml
3. **Worker:** Connect GitHub → Select "main" branch → Same as API but different start command

## Vercel Deployment (Frontend Only)

The frontend can be deployed to Vercel separately:

```bash
cd apps/web
vercel
```

**Environment Variables:**
```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://your-app.vercel.app
```

**vercel.json:**
```json
{
  "buildCommand": "cd ../.. && npm run build --workspace=web",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

## Docker Deployment

### Frontend (Web)

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json turbo.json ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Install dependencies
RUN npm install --workspace=web --workspace=packages/shared --include-workspace-root

# Build
RUN npm run build --workspace=web

# Start
WORKDIR /app/apps/web
CMD ["npm", "start"]
```

### API Backend

```dockerfile
FROM node:22

WORKDIR /app

# Install native dependencies for canvas
RUN apt-get update && apt-get install -y \
    python3 \
    pkg-config \
    cairo-dev \
    pango-dev \
    libjpeg-dev \
    giflib-dev \
    librsvg2-dev \
    pixman-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY package.json package-lock.json turbo.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Install dependencies
RUN npm install

# Build
RUN npm run build --workspace=api

# Start
CMD ["npm", "run", "start", "--workspace=api"]
```

### Worker

Same Dockerfile as API, different CMD:
```dockerfile
CMD ["npm", "run", "worker", "--workspace=api"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: pulseworks
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/pulseworks
      REDIS_URL: redis://redis:6379
      # ... other env vars
    depends_on:
      - postgres
      - redis

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/pulseworks
      REDIS_URL: redis://redis:6379
      # ... other env vars
    depends_on:
      - postgres
      - redis

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
      NEXTAUTH_SECRET: dev-secret
      NEXTAUTH_URL: http://localhost:3000

volumes:
  postgres_data:
```

## Troubleshooting

### Canvas Build Failure (node-gyp)

**Error:** `gyp ERR! find Python`

**Solution:** Use the nixpacks configuration with Python and native dependencies:

```toml
[phases.setup]
nixPkgs = ['nodejs_22', 'npm-9_x', 'python311', 'pkg-config', 'cairo', 'pango', 'libpng', 'libjpeg', 'giflib', 'librsvg', 'pixman']
```

Or for Docker:
```dockerfile
RUN apt-get update && apt-get install -y \
    python3 pkg-config cairo-dev pango-dev \
    libjpeg-dev giflib-dev librsvg2-dev
```

### Workspace Dependencies

**Error:** Cannot find module '@shared/types'

**Solution:** Ensure shared workspace is built before others:

```bash
npm install --workspace=packages/shared --include-workspace-root
npm install --workspace=web
```

### Database Migrations

Run migrations before starting services:

```bash
cd apps/api
npx prisma migrate deploy
```

For development:
```bash
npm run db:migrate
```

### Environment Variables

Ensure all required variables are set:

**Required for API:**
- DATABASE_URL
- REDIS_URL
- JWT_SECRET or NEXTAUTH_SECRET
- OPENAI_API_KEY
- AYRSHARE_API_KEY
- STRIPE_SECRET_KEY
- S3_* (all S3 variables)

**Required for Web:**
- NEXT_PUBLIC_API_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL

## Post-Deployment

### 1. Run Migrations

```bash
railway run --service=api npx prisma migrate deploy
```

### 2. Seed Database (Optional)

```bash
railway run --service=api npm run db:seed
```

### 3. Backfill BrandProfiles

```bash
railway run --service=api npx tsx src/scripts/backfillBrandProfiles.ts
```

### 4. Configure Webhooks

**Stripe:**
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-api.railway.app/api/webhooks/stripe`
3. Select events: `checkout.session.completed`, `customer.subscription.*`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

**Ayrshare:**
1. Go to Ayrshare Dashboard → Webhooks
2. Add endpoint: `https://your-api.railway.app/api/webhooks/ayrshare`
3. Enable status notifications

### 5. Test the Flow

1. Sign up at `https://your-web.railway.app`
2. Create monthly brief
3. Generate content pack
4. Approve posts
5. Schedule posts
6. Check worker logs for publishing

## Monitoring

### Logs

```bash
# Railway
railway logs --service=api
railway logs --service=worker

# Docker
docker logs api-container
docker logs worker-container
```

### Health Checks

```bash
# API
curl https://your-api.railway.app/health

# Worker (check Redis queue)
redis-cli
> KEYS bull:publish-posts:*
```

### Database

```bash
# Railway
railway run --service=api npx prisma studio

# Docker
docker exec -it postgres psql -U postgres -d pulseworks
```

## Scaling

### Horizontal Scaling

**API:** Add more instances behind load balancer
**Worker:** Add more worker processes (BullMQ handles concurrency)
**Web:** Next.js scales horizontally

### Vertical Scaling

Increase memory/CPU for:
- API (content generation is CPU-intensive)
- Worker (image generation uses memory)

## Security Checklist

Before going to production:

- [ ] Change all secrets (NEXTAUTH_SECRET, JWT_SECRET)
- [ ] Use production Stripe keys
- [ ] Enable HTTPS everywhere
- [ ] Set up proper CORS origins
- [ ] Configure S3 bucket permissions
- [ ] Enable database connection pooling
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure backups for PostgreSQL
- [ ] Review and test all webhooks
- [ ] Set NODE_ENV=production

---

**Need help?** See [README.md](README.md) for more details.
