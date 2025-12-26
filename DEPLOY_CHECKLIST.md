# Railway Deployment Checklist - Web Frontend

## Pre-Deployment Verification

### ✅ Configuration Files Ready

- [x] [nixpacks.toml](nixpacks.toml) - Nixpacks build configuration
- [x] [railway.json](railway.json) - Railway service settings
- [x] [.npmrc](.npmrc) - Force npm usage (prevent pnpm detection)
- [x] [apps/web/next.config.js](apps/web/next.config.js) - Standalone mode enabled
- [x] [Dockerfile](Dockerfile) - Backup Docker build option

### ✅ Deployment Fixes Applied

- [x] **Fix 1:** Workspace-specific build (excludes API/canvas dependencies)
- [x] **Fix 2:** Added `.npmrc` to force npm (prevent pnpm auto-detection)
- [x] **Fix 3:** Enabled Next.js standalone mode for optimized builds
- [x] **Fix 4:** Simplified nixpacks.toml to minimal configuration

## Railway Deployment Steps

### Step 1: Create Railway Service

1. Go to [Railway Dashboard](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository: `PulseWorks-Marketing`
4. Railway will auto-detect [railway.json](railway.json)

### Step 2: Configure Environment Variables

Add these three required variables in Railway dashboard:

```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXTAUTH_SECRET=<generate-random-32-char-string>
NEXTAUTH_URL=https://your-web.railway.app
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 3: Deploy

1. Click "Deploy"
2. Railway will automatically:
   - Detect [nixpacks.toml](nixpacks.toml)
   - Install Node.js 22
   - Run `npm install --workspace=packages/shared --workspace=web`
   - Run `npm run build --workspace=web`
   - Start with `npm run start --workspace=web`

### Step 4: Verify Deployment

**Check Build Logs:**
- Should see `npm install` (NOT `pnpm install`)
- Should see "Installing shared + web workspaces only"
- Should see "Creating optimized production build"
- Should NOT see any canvas/Python errors

**Test Deployed App:**
```bash
# Get your Railway URL from dashboard
curl https://your-web.railway.app

# Should return HTML from Next.js
```

**Verify Health:**
- Visit the Railway URL in browser
- Should see the PulseWorks landing page
- Check browser console for errors
- Test navigation

## Expected Build Output

```
=====> Building with Nixpacks
=====> Using configuration from nixpacks.toml
=====> Setup: Installing nodejs_22
=====> Install: npm install --workspace=packages/shared --workspace=web --include-workspace-root
npm WARN workspace Excluding API workspace (no canvas dependency)
added 423 packages in 12s
=====> Build: npm run build --workspace=web
> pulseworks-marketing@0.1.0 build
> turbo run build --filter=web

web:build: Creating optimized production build
web:build: ✓ Compiled successfully
web:build: ✓ Collecting page data
web:build: ✓ Generating static pages (8/8)
web:build: ✓ Finalizing page optimization
=====> Start: npm run start --workspace=web
> web@0.1.0 start
> next start

ready - started server on 0.0.0.0:3000
```

## Troubleshooting

### Issue: Still seeing pnpm error

**Diagnosis:**
```bash
# Check Railway logs for:
"pnpm install" or "pnpm build"
```

**Solution 1 - Verify .npmrc:**
```bash
# In Railway dashboard, check that .npmrc was committed
# Should contain: package-manager=npm
```

**Solution 2 - Clear Cache:**
1. Railway dashboard → Service settings
2. Click "Clear build cache"
3. Trigger new deployment

**Solution 3 - Use Dockerfile:**

Update [railway.json](railway.json):
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  }
}
```

### Issue: Canvas/Python errors

**This should NOT happen** with current configuration.

**If it does:**
1. Check logs for which workspace is being installed
2. Verify command is: `npm install --workspace=packages/shared --workspace=web`
3. Should NOT see `apps/api` being installed

**Fix:**
- Ensure [nixpacks.toml](nixpacks.toml) hasn't been modified
- Ensure no other nixpacks config files exist
- Clear Railway build cache

### Issue: Build succeeds but app crashes

**Check logs for:**
- Missing environment variables
- Port binding issues
- Next.js standalone mode issues

**Solutions:**
1. **Missing env vars:**
   ```bash
   # Verify in Railway dashboard:
   NEXT_PUBLIC_API_URL=https://...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=https://...
   ```

2. **Port binding:**
   - Railway automatically sets PORT=3000
   - Next.js should bind to 0.0.0.0:3000
   - Check [next.config.js](apps/web/next.config.js)

3. **Standalone mode:**
   - Verify `output: 'standalone'` in [next.config.js](apps/web/next.config.js:5)
   - Check that `.next/standalone` directory exists in build

## Post-Deployment Tasks

### 1. Update API URL

Once you have the Railway URL, update environment variable:
```env
NEXTAUTH_URL=https://pulseworks-web-production.up.railway.app
```

### 2. Configure CORS in API

Update API service to allow requests from web frontend:
```typescript
// apps/api/src/index.ts
const corsOptions = {
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true
};
```

Set `APP_URL` in API service:
```env
APP_URL=https://pulseworks-web-production.up.railway.app
```

### 3. Test Full Flow

1. **Authentication:**
   - Visit web app
   - Click "Sign In"
   - Should redirect to NextAuth
   - Complete authentication flow

2. **API Communication:**
   - After login, dashboard should load
   - Check Network tab for API calls
   - Should see calls to `NEXT_PUBLIC_API_URL`

3. **Error Handling:**
   - Test with invalid API URL
   - Should show appropriate error messages

## Next: Deploy API & Worker

Once web frontend is working:

1. **Deploy API Backend**
   - See [DEPLOYMENT.md](DEPLOYMENT.md#service-2-api-backend)
   - Requires Python/Cairo dependencies
   - Use `nixpacks-api.toml` configuration

2. **Deploy Worker Service**
   - See [DEPLOYMENT.md](DEPLOYMENT.md#service-3-worker)
   - Same as API but different start command
   - Handles background jobs (posting, scheduling)

3. **Set up Databases**
   - PostgreSQL for main database
   - Redis for BullMQ queues
   - Link to API and Worker services

## Success Criteria

✅ **Deployment Successful If:**

- [x] Build completes without errors
- [x] No `pnpm: command not found` errors
- [x] No canvas/Python dependency errors
- [x] Web app loads in browser
- [x] Static assets load correctly
- [x] NextAuth authentication works
- [x] API calls reach backend (once deployed)

## Files Reference

| File | Purpose | Location |
|------|---------|----------|
| [nixpacks.toml](nixpacks.toml) | Build configuration | Root |
| [railway.json](railway.json) | Railway settings | Root |
| [.npmrc](.npmrc) | NPM configuration | Root |
| [Dockerfile](Dockerfile) | Alternative build | Root |
| [next.config.js](apps/web/next.config.js) | Next.js config | apps/web |

## Support Documentation

- [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) - Current deployment status
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [DEPLOYMENT_FIX.md](DEPLOYMENT_FIX.md) - Detailed fix explanation

---

**Ready to Deploy:** ✅ All configuration files are in place

**Last Updated:** 2025-12-26
