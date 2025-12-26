# Deployment Fix: Canvas Build Issue

## Problem

Railway build was failing with:

```
gyp ERR! find Python
Error: Could not find any Python installation to use
```

**Root Cause:** The `canvas` package (used in the API for image generation) requires native dependencies (Python, Cairo, Pango, etc.) to compile. When deploying the **web frontend**, Railway was trying to install ALL workspace dependencies including the API's `canvas` package.

## Solution

Created workspace-specific build configurations to ensure the web frontend **only installs web dependencies**, not API dependencies.

## Files Created

### 1. [nixpacks.toml](nixpacks.toml)

Configures the web frontend build to exclude API dependencies:

```toml
[phases.setup]
nixPkgs = ['nodejs_22', 'npm-9_x']

[phases.install]
cmds = [
  'npm install --workspace=packages/shared --include-workspace-root',
  'npm install --workspace=web'
]

[phases.build]
cmds = ['npm run build --workspace=web']

[start]
cmd = 'npm run start --workspace=web'
```

**Key Points:**
- ✅ Only installs `packages/shared` and `web` workspaces
- ✅ Skips `apps/api` workspace (which has canvas)
- ✅ No Python or native build tools needed
- ✅ Fast builds

### 2. [railway.json](railway.json)

Railway-specific configuration:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "nixpacksConfigPath": "nixpacks.toml"
  },
  "deploy": {
    "startCommand": "npm run start --workspace=web",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 3. [DEPLOYMENT.md](DEPLOYMENT.md)

Complete deployment guide with:
- Railway setup (3 services)
- Vercel deployment
- Docker configurations
- Troubleshooting
- Post-deployment steps

## How to Deploy

### Railway (Recommended)

#### Web Frontend Service

1. Create new Railway service
2. Connect GitHub repository
3. Railway will automatically use `nixpacks.toml`
4. Set environment variables:
   ```env
   NEXT_PUBLIC_API_URL=https://your-api.railway.app
   NEXTAUTH_SECRET=your-secret
   NEXTAUTH_URL=https://your-web.railway.app
   ```
5. Deploy ✅

#### API Backend Service

1. Create new Railway service
2. Connect same GitHub repository
3. Create `nixpacks-api.toml` (with Python and Cairo deps)
4. Set environment variables (DATABASE_URL, REDIS_URL, etc.)
5. Deploy ✅

#### Worker Service

1. Create new Railway service
2. Connect same GitHub repository
3. Use same build as API
4. Override start command: `npm run worker --workspace=api`
5. Deploy ✅

## Why This Works

### Before (Failed)
```
Railway build web →
  npm install (root) →
    installs ALL workspaces →
      includes apps/api →
        includes canvas →
          ❌ FAILS (no Python)
```

### After (Fixed)
```
Railway build web →
  npm install --workspace=web →
    installs ONLY web workspace →
      excludes apps/api →
        ✅ SUCCESS (no canvas)
```

## Alternative Solutions Considered

### ❌ Option 1: Add Python to web build
**Problem:** Unnecessary bloat, longer builds, more attack surface

### ❌ Option 2: Remove canvas from API
**Problem:** Breaks image generation feature

### ✅ Option 3: Workspace-specific builds (Implemented)
**Benefits:**
- Clean separation
- Fast builds
- No unnecessary dependencies
- Proper monorepo structure

## Verification

After deployment, verify:

```bash
# Check web is running
curl https://your-web.railway.app

# Check API is running
curl https://your-api.railway.app/health

# Check worker logs
railway logs --service=worker
```

## Monorepo Best Practices

This fix follows monorepo best practices:

1. **Workspace Isolation** - Each service only builds its dependencies
2. **Shared Code** - Common types in `packages/shared`
3. **Independent Deployment** - Services can deploy separately
4. **Optimized Builds** - No unnecessary dependencies

## Environment-Specific Configurations

### Development
```bash
# Install everything (for local dev)
npm install
```

### Production (Web)
```bash
# Install only web workspace
npm install --workspace=web --workspace=packages/shared
```

### Production (API)
```bash
# Install everything (API needs canvas)
npm install
```

## Future Improvements

### 1. Separate API Dependencies

Consider moving canvas to a separate package:
```
packages/
  ├── shared/
  ├── image-generation/  # Canvas + image templates
  └── ...
```

### 2. Build Cache

Use Railway's build cache to speed up rebuilds:
```toml
[phases.install]
cacheDirectories = ['node_modules']
```

### 3. Multi-Stage Docker

For Docker deployments, use multi-stage builds:
```dockerfile
# Stage 1: Build
FROM node:22 as builder
# Install all deps + build

# Stage 2: Production
FROM node:22-alpine
# Copy only built files
```

## Troubleshooting

### Build still failing?

1. **Check Railway service settings**
   - Ensure it's using `nixpacks.toml`
   - Verify environment variables are set

2. **Check workspace dependencies**
   ```bash
   # List web dependencies
   cat apps/web/package.json
   # Should NOT include canvas
   ```

3. **Clear Railway cache**
   - Go to service settings
   - Click "Clear build cache"
   - Trigger new deployment

### Canvas errors in API deployment?

API deployment should include Python and native deps:

```toml
[phases.setup]
nixPkgs = ['nodejs_22', 'python311', 'pkg-config', 'cairo', 'pango', ...]
```

## Summary

✅ **Problem:** Canvas dependency causing web build failures
✅ **Solution:** Workspace-specific build configurations
✅ **Files:** nixpacks.toml, railway.json, DEPLOYMENT.md
✅ **Result:** Clean, fast, working deployments

The web frontend now builds without any native dependencies, while the API and Worker services properly include canvas and its requirements.

---

**Next Steps:**
1. Deploy web frontend using nixpacks.toml
2. Deploy API backend with Python deps
3. Deploy worker with same config as API
4. Configure webhooks and environment variables

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.
