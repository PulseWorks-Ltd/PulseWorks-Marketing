import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { brandProfileService } from '../services/brandProfileService';
import { z } from 'zod';

const router = Router();

/**
 * BrandProfile Admin Routes
 *
 * These endpoints manage the Brand Intelligence layer.
 * Admin-only for MVP (can add role check later).
 *
 * USAGE NOTES:
 * - BrandProfile is auto-generated on first content generation
 * - Manual updates (e.g., Pomelli-informed) use PATCH endpoint
 * - Regenerate from website using POST /regenerate
 * - Never mention "Pomelli" in code or responses
 */

// Validation schemas
const updateBrandProfileSchema = z.object({
  toneKeywords: z.array(z.string()).min(2).max(10).optional(),
  brandVoiceRules: z
    .object({
      do: z.array(z.string()).min(2).max(5),
      dont: z.array(z.string()).min(2).max(5),
    })
    .optional(),
  visualStyle: z
    .object({
      colors: z.array(z.string()).min(1).max(5),
      mood: z.string().optional(),
    })
    .optional(),
  audienceSummary: z.string().min(20).max(500).optional(),
  contentPillars: z.array(z.string()).min(2).max(5).optional(),
  confidenceScore: z.number().min(1).max(5).optional(),
});

const addNotesSchema = z.object({
  notes: z.string().max(2000),
});

// Get BrandProfile (auto-creates if missing)
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const brandProfile = await brandProfileService.getBrandProfile(
      req.accountId!
    );

    res.json(brandProfile);
  } catch (error) {
    next(error);
  }
});

// Update BrandProfile (manual refinement)
// Use this to apply Pomelli-informed insights
router.patch('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const updates = updateBrandProfileSchema.parse(req.body);

    const brandProfile = await brandProfileService.updateBrandProfile(
      req.accountId!,
      updates,
      req.userId
    );

    res.json({
      success: true,
      brandProfile,
      message: 'Brand profile updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Regenerate BrandProfile from website
router.post('/regenerate', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const brandProfile = await brandProfileService.regenerateBrandProfile(
      req.accountId!,
      req.userId
    );

    res.json({
      success: true,
      brandProfile,
      message: 'Brand profile regenerated from website',
    });
  } catch (error) {
    next(error);
  }
});

// Set confidence score
router.patch('/confidence', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { score } = z.object({ score: z.number().min(1).max(5) }).parse(req.body);

    const brandProfile = await brandProfileService.setConfidenceScore(
      req.accountId!,
      score,
      req.userId
    );

    res.json({
      success: true,
      brandProfile,
      message: `Confidence score updated to ${score}`,
    });
  } catch (error) {
    next(error);
  }
});

// Add internal notes
// Use this to document manual refinement rationale
router.patch('/notes', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { notes } = addNotesSchema.parse(req.body);

    const brandProfile = await brandProfileService.addNotes(
      req.accountId!,
      notes,
      req.userId
    );

    res.json({
      success: true,
      brandProfile,
      message: 'Notes added successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
