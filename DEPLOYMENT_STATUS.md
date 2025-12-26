# Deployment Status - Railway Web Frontend

## Current Configuration

### Files Modified for Deployment

1. **[nixpacks.toml](nixpacks.toml)** - Nixpacks build configuration
2. **[railway.json](railway.json)** - Railway service configuration
3. **[.npmrc](.npmrc)** - NPM configuration (forces npm usage)
4. **[apps/web/next.config.js](apps/web/next.config.js)** - Added standalone output mode
5. **[Dockerfile](Dockerfile)** - Alternative Docker build (backup option)

## Deployment Configuration

### Current Setup: Nixpacks (Recommended)

Railway will use the Nixpacks builder with this configuration:

**[nixpacks.toml](nixpacks.toml:4-14)**
```toml
[phases.setup]
nixPkgs = ['nodejs_22']

[phases.install]
cmds = ['npm install --workspace=packages/shared --workspace=web --include-workspace-root']

[phases.build]
cmds = ['npm run build --workspace=web']

[start]
cmd = 'npm run start --workspace=web'
```

**Key Points:**
- ✅ Only installs `packages/shared` and `apps/web` workspaces
- ✅ Excludes `apps/api` workspace (no canvas dependency)
- ✅ No Python or native build tools required
- ✅ Fast, lightweight builds

### Alternative Setup: Dockerfile (If Nixpacks Fails)

If Nixpacks continues to have issues, switch to Docker by updating [railway.json](railway.json:3-6):

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  }
}
```

The [Dockerfile](Dockerfile) uses a multi-stage build optimized for Next.js standalone mode.

## Recent Fixes

### Fix 1: Canvas Build Failure
**Problem:** Railway was installing ALL workspace dependencies, including `canvas` from API workspace

**Solution:**
- Created workspace-specific build configuration in [nixpacks.toml](nixpacks.toml)
- Only install `packages/shared` and `apps/web` workspaces
- Skip `apps/api` entirely for web frontend builds

### Fix 2: pnpm Auto-Detection
**Problem:** Nixpacks was detecting and trying to use pnpm instead of npm

**Solution:**
- Added [.npmrc](.npmrc) with `package-manager=npm` to force npm usage
- Simplified [nixpacks.toml](nixpacks.toml) to minimal configuration
- Removed any triggers for auto-detection

### Fix 3: Standalone Mode
**Enhancement:** Added standalone output mode for optimized production builds

**Change in [apps/web/next.config.js](apps/web/next.config.js:5):**
```javascript
output: 'standalone', // Enable standalone mode for Docker
```

## Railway Service Setup

### Environment Variables Required

```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://your-web.railway.app
```

### Deployment Steps

1. **Create Railway Service**
   - Connect GitHub repository
   - Railway auto-detects [railway.json](railway.json) and [nixpacks.toml](nixpacks.toml)

2. **Set Environment Variables**
   - Add the three required environment variables above
   - `NEXTAUTH_SECRET` should be a random 32+ character string

3. **Deploy**
   - Railway will automatically build using Nixpacks configuration
   - Build process:
     1. Setup: Install Node.js 22
     2. Install: Install shared + web workspace dependencies
     3. Build: Build web workspace with Next.js
     4. Start: Run `npm run start --workspace=web`

4. **Verify Deployment**
   - Check Railway logs for successful build
   - Visit deployed URL to confirm web app is running
   - Test authentication flow

## Build Process Flow

```
Railway Deploy →
  nixpacks.toml detected →
    Setup Phase: Install nodejs_22 →
      Install Phase: npm install --workspace=packages/shared --workspace=web →
        Build Phase: npm run build --workspace=web →
          Next.js standalone build →
            ✅ Production ready server
```

## Workspace Isolation

This deployment configuration ensures clean separation:

```
Web Frontend (This Deployment)
├── packages/shared ✅ (TypeScript types)
└── apps/web ✅ (Next.js frontend)

API Backend (Separate Deployment)
├── packages/shared ✅ (TypeScript types)
└── apps/api ✅ (Express + canvas)
```

**Why This Matters:**
- Web frontend doesn't need Python, Cairo, Pango, or other native dependencies
- Faster builds (no native compilation)
- Smaller container size
- Better security (fewer dependencies)
- Proper microservices architecture

## Troubleshooting

### If Build Still Fails with pnpm Error

1. **Check Railway Logs**
   - Look for `pnpm install` or `pnpm build` commands
   - Should see `npm install` commands instead

2. **Verify Configuration Files**
   - Ensure [.npmrc](.npmrc) exists with `package-manager=npm`
   - Ensure [nixpacks.toml](nixpacks.toml) has explicit npm commands
   - Ensure [railway.json](railway.json) points to `nixpacks.toml`

3. **Try Dockerfile Alternative**
   - Update [railway.json](railway.json) to use `"builder": "DOCKERFILE"`
   - Railway will use [Dockerfile](Dockerfile) instead
   - This bypasses all auto-detection

4. **Clear Railway Cache**
   - Go to Railway service settings
   - Click "Clear build cache"
   - Trigger new deployment

### If Build Fails with Canvas Error

This should NOT happen with current configuration, but if it does:

1. **Verify Workspace Installation**
   - Check logs for `npm install` command
   - Should show `--workspace=packages/shared --workspace=web`
   - Should NOT install `apps/api`

2. **Check for Incorrect Dependencies**
   - Verify `apps/web/package.json` doesn't include `canvas`
   - Verify `packages/shared/package.json` doesn't include `canvas`

## Next Steps

### For Production Deployment

1. **Deploy Web Frontend** (This Service)
   - Use current Nixpacks configuration
   - Set environment variables
   - Deploy and verify

2. **Deploy API Backend** (Separate Service)
   - Create new Railway service
   - Use `nixpacks-api.toml` with Python/Cairo dependencies
   - Set DATABASE_URL, REDIS_URL, etc.
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for full API deployment guide

3. **Deploy Worker** (Separate Service)
   - Create new Railway service
   - Same config as API but different start command
   - Start command: `npm run worker --workspace=api`

4. **Configure Databases**
   - Add PostgreSQL service in Railway
   - Add Redis service in Railway
   - Link to API and Worker services

## Status Summary

| Configuration | Status | Notes |
|--------------|--------|-------|
| [nixpacks.toml](nixpacks.toml) | ✅ Ready | Workspace-specific build |
| [railway.json](railway.json) | ✅ Ready | Nixpacks configuration |
| [.npmrc](.npmrc) | ✅ Added | Forces npm usage |
| [next.config.js](apps/web/next.config.js) | ✅ Updated | Standalone mode enabled |
| [Dockerfile](Dockerfile) | ✅ Ready | Alternative build method |
| Environment Variables | ⏳ Required | Set in Railway dashboard |

## Expected Build Output

When deployed successfully, you should see:

```
=====> Building web frontend
=====> Using nixpacks.toml configuration
=====> Installing Node.js 22
=====> Running: npm install --workspace=packages/shared --workspace=web --include-workspace-root
=====> Installing dependencies...
=====> Running: npm run build --workspace=web
=====> Building Next.js application...
=====> Creating standalone build...
=====> Build completed successfully
=====> Starting: npm run start --workspace=web
=====> Web server listening on port 3000
```

## Support

If you continue to experience deployment issues:

1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive deployment guide
2. Check [DEPLOYMENT_FIX.md](DEPLOYMENT_FIX.md) for detailed fix explanation
3. Share full Railway build logs for further troubleshooting

---

**Last Updated:** 2025-12-26
**Configuration Version:** v3 (Nixpacks + .npmrc)
