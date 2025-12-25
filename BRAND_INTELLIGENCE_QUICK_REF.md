# Brand Intelligence - Quick Reference

## TL;DR

BrandProfile is the **single source of truth** for brand identity. Content generation uses it, not raw website data.

## Core Commands

```bash
# Get BrandProfile (auto-creates if missing)
GET /api/brand-profile

# Update BrandProfile (manual refinement)
PATCH /api/brand-profile
{
  "toneKeywords": ["professional", "caring"],
  "brandVoiceRules": { "do": [...], "dont": [...] },
  "confidenceScore": 4
}

# Regenerate from website
POST /api/brand-profile/regenerate

# Add notes (document refinements)
PATCH /api/brand-profile/notes
{ "notes": "Refined based on external analysis..." }
```

## Manual Refinement Workflow

### Option 1: Via API

```bash
# 1. Get current BrandProfile
curl http://localhost:3001/api/brand-profile \
  -H "Authorization: Bearer $TOKEN" > profile.json

# 2. Edit profile.json (adjust based on Pomelli or other analysis)

# 3. Update BrandProfile
curl -X PATCH http://localhost:3001/api/brand-profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @profile.json
```

### Option 2: Via Code (Admin Script)

```typescript
import { brandProfileService } from './services/brandProfileService';

await brandProfileService.updateBrandProfile('account-id', {
  toneKeywords: ['professional', 'caring', 'expert'],
  brandVoiceRules: {
    do: ['Use patient-first language', 'Focus on outcomes', 'Be reassuring'],
    dont: ['Use medical jargon', 'Create fear', 'Oversell'],
  },
  confidenceScore: 4,
});
```

## BrandProfile Fields

```typescript
{
  // Website source
  websiteUrl: string

  // Brand voice
  toneKeywords: string[]           // ["professional", "approachable"]
  brandVoiceRules: {
    do: string[]                   // ["Use clear language"]
    dont: string[]                 // ["Use jargon"]
  }

  // Visual identity
  visualStyle: {
    colors: string[]               // ["#1a365d", "#3182ce"]
    mood?: string                  // "Confident & Trustworthy"
  }

  // Audience
  audienceSummary: string          // "Health-conscious professionals..."

  // Content strategy
  contentPillars: string[]         // ["Education", "Client success"]

  // Quality tracking
  confidenceScore: number          // 1-5 (3 = default, 4-5 = refined)
  source: 'AUTO' | 'MANUAL_OVERRIDE'
  notes?: string                   // Internal documentation
}
```

## Confidence Score Guide

| Score | Use When | Quality |
|-------|----------|---------|
| 1 | Very limited data | Poor |
| 2 | Generic website | Below average |
| 3 | **Auto-generated (default)** | Acceptable |
| 4 | **Manually refined** | Good |
| 5 | **Proven, optimized** | Excellent |

## Common Tasks

### Refine After External Analysis

```bash
# After using Pomelli or other analysis tool
PATCH /api/brand-profile
{
  "toneKeywords": ["expert", "caring", "modern"],
  "brandVoiceRules": {
    "do": ["Use patient-first language", "Be specific"],
    "dont": ["Use medical jargon", "Be generic"]
  },
  "confidenceScore": 4,
  "notes": "Refined based on brand analysis. Emphasizing expertise while maintaining approachability."
}
```

### Update Visual Style

```bash
PATCH /api/brand-profile
{
  "visualStyle": {
    "colors": ["#0A2540", "#635BFF", "#00D4FF"],
    "mood": "Modern & Trustworthy"
  }
}
```

### Adjust Content Pillars

```bash
PATCH /api/brand-profile
{
  "contentPillars": [
    "Patient education",
    "Preventive care tips",
    "Team expertise",
    "Community involvement"
  ]
}
```

### Document Refinement Rationale

```bash
PATCH /api/brand-profile/notes
{
  "notes": "Updated tone based on client feedback. Reduced promotional language, increased educational focus. Confidence increased to 4 after testing."
}
```

## Migration

### Backfill Existing Accounts

```bash
cd apps/api
npx tsx src/scripts/backfillBrandProfiles.ts
```

### Check BrandProfile Status

```sql
SELECT
  a."name",
  bp."confidenceScore",
  bp."source",
  bp."updatedAt"
FROM "Account" a
LEFT JOIN "BrandProfile" bp ON a."id" = bp."accountId"
WHERE bp."id" IS NULL
   OR bp."confidenceScore" < 3
ORDER BY bp."confidenceScore" ASC;
```

## Content Generation Flow

```
1. BrandProfile exists?
   ├─ Yes → Use it
   └─ No → Auto-generate from website

2. Generate content pack
   └─ Uses BrandProfile fields in AI prompts

3. Review outputs
   ├─ Good quality → Done
   └─ Needs improvement → Refine BrandProfile → Regenerate
```

## Audit Trail

```sql
-- View BrandProfile changes
SELECT
  "eventType",
  "userId",
  "metadata",
  "createdAt"
FROM "AuditEvent"
WHERE "entityType" = 'BrandProfile'
  AND "accountId" = 'abc123'
ORDER BY "createdAt" DESC;
```

## Troubleshooting

### Content quality issues?
1. Check `confidenceScore` (should be ≥ 4 for good quality)
2. Review `brandVoiceRules` - Are they specific enough?
3. Check `audienceSummary` - Is it accurate?
4. Refine and increase `confidenceScore`

### BrandProfile not found?
Auto-created on first content generation. Or manually trigger:
```bash
POST /api/brand-profile/regenerate
```

### Want to reset BrandProfile?
```bash
POST /api/brand-profile/regenerate
```
(Fetches website again and regenerates)

## Best Practices

✅ **DO:**
- Increase `confidenceScore` after manual refinement
- Add `notes` to document refinement rationale
- Review and refine iteratively
- Use `MANUAL_OVERRIDE` source for refined profiles

❌ **DON'T:**
- Don't mention external tools in code/UI
- Don't hard-code brand rules in prompts
- Don't skip audit logging
- Don't modify without testing

## Integration Example

```typescript
// In your content generation route
const brandProfile = await brandProfileService.getBrandProfile(accountId);

const content = await contentGeneratorV2.generateContentPack({
  toneKeywords: brandProfile.toneKeywords as string[],
  brandVoiceRules: brandProfile.brandVoiceRules as VoiceRules,
  contentPillars: brandProfile.contentPillars as string[],
  audienceSummary: brandProfile.audienceSummary,
  visualStyle: brandProfile.visualStyle as VisualStyle,
  // ... monthly brief fields
});
```

## Key Files

- **Service:** `apps/api/src/services/brandProfileService.ts`
- **Routes:** `apps/api/src/routes/brandProfile.ts`
- **Generator:** `apps/api/src/services/ai/contentGeneratorV2.ts`
- **Schema:** `apps/api/prisma/schema.prisma` (line 110-129)
- **Docs:** `BRAND_INTELLIGENCE.md`

## Support

For detailed documentation, see: **[BRAND_INTELLIGENCE.md](BRAND_INTELLIGENCE.md)**

---

**Quick tip:** Set `confidenceScore = 4` after manual refinement based on external analysis.
