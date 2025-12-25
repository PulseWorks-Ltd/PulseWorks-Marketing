# Brand Intelligence Layer

## Overview

The Brand Intelligence layer is a **structured representation** of a brand's identity, voice, and audience. It acts as the **single source of truth** for all content generation.

### Core Principle

> **BrandProfile is the authoritative source for brand identity.**
>
> Content generation MUST use BrandProfile fields, never raw website data.
> Manual refinement updates BrandProfile, not generation code.

## Why This Architecture?

### Before (Direct Generation)
```
Website → Extract → AI Generate → Content
```
**Problems:**
- Inconsistent outputs (parsing varies)
- No memory of refinements
- Can't improve without code changes
- Hard to A/B test voice changes

### After (Brand Intelligence)
```
Website → BrandProfile (DB) → AI Generate → Content
                ↑
         Manual Refinement
         (e.g., Pomelli-informed)
```
**Benefits:**
- ✅ Consistent outputs (stable input)
- ✅ Refinements persist
- ✅ Improve quality without code changes
- ✅ A/B test voice changes easily
- ✅ No external tool coupling

## Database Schema

```prisma
model BrandProfile {
  id                String   @id @default(cuid())
  accountId         String   @unique
  websiteUrl        String

  // Brand identity
  toneKeywords      Json     // ["professional", "approachable", "expert"]
  brandVoiceRules   Json     // { do: [...], dont: [...] }
  visualStyle       Json     // { colors: [...], mood: "..." }
  audienceSummary   String
  contentPillars    Json     // ["Education", "Client success", "Industry insights"]

  // Quality tracking
  confidenceScore   Int      @default(3) // 1-5, higher = more refined
  source            BrandProfileSource @default(AUTO)
  notes             String?  // Internal notes

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum BrandProfileSource {
  AUTO              // Generated from website
  MANUAL_OVERRIDE   // Manually refined (e.g., Pomelli-informed)
}
```

## API Endpoints

### GET /api/brand-profile
Get BrandProfile (auto-creates if missing).

```bash
curl http://localhost:3001/api/brand-profile \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "id": "...",
  "accountId": "...",
  "websiteUrl": "https://example.com",
  "toneKeywords": ["professional", "approachable", "caring"],
  "brandVoiceRules": {
    "do": ["Use clear language", "Focus on benefits", "Be specific"],
    "dont": ["Use jargon", "Make bold claims", "Be overly salesy"]
  },
  "visualStyle": {
    "colors": ["#1a365d", "#3182ce", "#63b3ed"],
    "mood": "Confident & Trustworthy"
  },
  "audienceSummary": "Health-conscious professionals aged 30-50 seeking preventive care...",
  "contentPillars": ["Education", "Client success", "Industry insights", "Team culture"],
  "confidenceScore": 3,
  "source": "AUTO"
}
```

### PATCH /api/brand-profile
Update BrandProfile (manual refinement).

**Use this for Pomelli-informed refinements.**

```bash
curl -X PATCH http://localhost:3001/api/brand-profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toneKeywords": ["professional", "approachable", "expert"],
    "brandVoiceRules": {
      "do": ["Use patient-first language", "Focus on outcomes", "Be reassuring"],
      "dont": ["Use medical jargon", "Create fear", "Oversell procedures"]
    },
    "confidenceScore": 4
  }'
```

**Response:**
```json
{
  "success": true,
  "brandProfile": { ... },
  "message": "Brand profile updated successfully"
}
```

### POST /api/brand-profile/regenerate
Regenerate from website (useful when website changes).

```bash
curl -X POST http://localhost:3001/api/brand-profile/regenerate \
  -H "Authorization: Bearer $TOKEN"
```

### PATCH /api/brand-profile/notes
Add internal notes (document refinement rationale).

```bash
curl -X PATCH http://localhost:3001/api/brand-profile/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Pomelli analysis suggests more authoritative tone. Updated voice rules to emphasize expertise while maintaining approachability. Increased confidence to 4."
  }'
```

## Content Generation Flow

### OLD Flow (Deprecated)
```typescript
// ❌ DO NOT USE
const brandData = await brandExtractor.extractBrandProfile(url, name);
const content = await contentGenerator.generateContentPack({ brandData, ... });
```

### NEW Flow (Current)
```typescript
// ✅ CORRECT
const brandProfile = await brandProfileService.getBrandProfile(accountId);
const content = await contentGeneratorV2.generateContentPack({
  toneKeywords: brandProfile.toneKeywords,
  brandVoiceRules: brandProfile.brandVoiceRules,
  contentPillars: brandProfile.contentPillars,
  audienceSummary: brandProfile.audienceSummary,
  visualStyle: brandProfile.visualStyle,
  // ... monthly brief fields
});
```

## How Pomelli Fits In (Manual Refinement Workflow)

### Important
- **Pomelli is NOT in the code**
- **Pomelli is NOT called at runtime**
- **Pomelli is NOT visible to clients**

### Manual Refinement Process

1. **Generate initial BrandProfile** (automatic on first content generation)
   ```
   Website → Auto-generate BrandProfile (confidence: 3)
   ```

2. **Manually analyze with Pomelli** (internal, operator-only)
   ```
   Operator: Paste website into Pomelli
   Pomelli: Returns brand analysis
   Operator: Reviews Pomelli output
   ```

3. **Refine BrandProfile** (via API or admin tool)
   ```bash
   PATCH /api/brand-profile
   {
     "toneKeywords": [...],  # Informed by Pomelli
     "brandVoiceRules": {    # Informed by Pomelli
       "do": [...],
       "dont": [...]
     },
     "confidenceScore": 4,   # Higher = more refined
     "notes": "Pomelli analysis suggests..."
   }
   ```

4. **Generate content** (uses refined BrandProfile)
   ```
   BrandProfile (confidence: 4) → Better content
   ```

5. **Iterate as needed**
   ```
   Review outputs → Adjust BrandProfile → Regenerate
   ```

## Confidence Score Guide

| Score | Meaning | When to Use |
|-------|---------|-------------|
| 1 | Low confidence | Minimal website content, unclear brand |
| 2 | Below average | Generic website, limited voice clarity |
| 3 | **Default** | Standard auto-generation, needs review |
| 4 | **Good** | Manually refined, Pomelli-informed |
| 5 | **Excellent** | Heavily refined, proven outputs |

**Recommendation:** Set to 4-5 after manual refinement.

## Best Practices

### ✅ DO
- Use BrandProfile as single source of truth
- Update BrandProfile when brand evolves
- Document refinements in `notes` field
- Increase `confidenceScore` after refinement
- Regenerate content when BrandProfile changes
- Review outputs and refine BrandProfile iteratively

### ❌ DON'T
- Don't parse website directly in content generation
- Don't hard-code brand rules in prompts
- Don't mention "Pomelli" in code or UI
- Don't automate Pomelli analysis
- Don't skip BrandProfile validation
- Don't modify BrandProfile without audit logging

## Admin Tools

### Backfill Script
Generate BrandProfiles for existing accounts:

```bash
cd apps/api
npx tsx src/scripts/backfillBrandProfiles.ts
```

### Manual Update (via code)
```typescript
import { brandProfileService } from './services/brandProfileService';

await brandProfileService.updateBrandProfile(accountId, {
  toneKeywords: ['professional', 'caring', 'expert'],
  confidenceScore: 4,
});
```

## Monitoring

### Low Confidence Warning
When `confidenceScore < 3`, a warning is logged:
```
[BrandProfile] Low confidence score (2) for account abc123
```

**Action:** Review and refine BrandProfile.

### Audit Events
All BrandProfile changes are logged:
- `BRAND_PROFILE_CREATED`
- `BRAND_PROFILE_UPDATED`

Query audit log:
```sql
SELECT * FROM "AuditEvent"
WHERE "entityType" = 'BrandProfile'
AND "accountId" = 'abc123'
ORDER BY "createdAt" DESC;
```

## Testing

### Unit Tests
Test BrandProfile generation:
```typescript
describe('BrandProfileService', () => {
  it('should generate BrandProfile from website', async () => {
    const profile = await brandProfileService.generateBrandProfile(
      accountId,
      'https://example.com',
      'Example Business'
    );

    expect(profile.toneKeywords).toHaveLength.greaterThan(2);
    expect(profile.confidenceScore).toBe(3);
    expect(profile.source).toBe('AUTO');
  });
});
```

### Integration Tests
Test content generation with BrandProfile:
```typescript
it('should generate content using BrandProfile', async () => {
  const brandProfile = await brandProfileService.getBrandProfile(accountId);

  const content = await contentGeneratorV2.generateContentPack({
    ...brandProfile,
    primaryFocus: 'NEW_CLIENTS',
    // ...
  });

  expect(content).toHaveLength.greaterThan(0);
});
```

## Future Enhancements

### Phase 2: UI for Manual Refinement
Add admin UI for BrandProfile editing:
- Visual editor for voice rules
- Color picker for visual style
- Confidence score slider
- Revision history

### Phase 3: A/B Testing
Test different BrandProfile versions:
```typescript
// Generate content with version A
const contentA = await generateWithProfile(brandProfileV1);

// Generate content with version B
const contentB = await generateWithProfile(brandProfileV2);

// Compare engagement metrics
```

### Phase 4: Auto-Refinement
Learn from approved vs skipped content:
```typescript
// Analyze which content gets approved
const approvedContent = await getApprovedContent(accountId);

// Suggest BrandProfile improvements
const suggestions = await analyzeBrandAlignment(approvedContent);
```

## Troubleshooting

### BrandProfile not generating
```
Error: Website URL required to generate brand profile
```
**Solution:** Ensure account has `websiteUrl` set.

### Low confidence score
```
Warning: Low confidence score (2) for account abc123
```
**Solution:** Manually review and refine BrandProfile.

### Content quality issues
1. Check BrandProfile fields
2. Review `audienceSummary` accuracy
3. Refine `brandVoiceRules`
4. Adjust `toneKeywords`
5. Increase `confidenceScore` after refinement

## Summary

The Brand Intelligence layer:
- ✅ Separates brand analysis from content generation
- ✅ Enables manual refinement without code changes
- ✅ Supports Pomelli-informed improvements (no coupling)
- ✅ Provides consistent, repeatable outputs
- ✅ Tracks quality with confidence scores
- ✅ Logs all changes for compliance

**Key Principle:** BrandProfile is the single source of truth. All content generation MUST use it.

---

**Last Updated:** 2025-01-25
