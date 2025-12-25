import { prisma } from '../db/client';
import { brandExtractor } from './ai/brandExtractor';
import { aiProvider } from './ai/provider';
import { logAuditEvent } from '../utils/audit';
import { z } from 'zod';

/**
 * BrandProfile Service
 *
 * This service manages the Brand Intelligence layer - our app's structured
 * understanding of a brand's identity, voice, and audience.
 *
 * KEY PRINCIPLE:
 * - BrandProfile is the SINGLE SOURCE OF TRUTH for brand identity
 * - Content generation MUST use BrandProfile, never raw website data
 * - Manual refinement (e.g., Pomelli-informed) updates BrandProfile
 * - All AI prompts reference BrandProfile fields
 */

export interface BrandProfileData {
  websiteUrl: string;
  toneKeywords: string[];
  brandVoiceRules: {
    do: string[];
    dont: string[];
  };
  visualStyle: {
    colors: string[];
    mood?: string;
  };
  audienceSummary: string;
  contentPillars: string[];
  confidenceScore?: number;
}

// Zod schema for BrandProfile creation/update
const brandProfileDataSchema = z.object({
  websiteUrl: z.string().url(),
  toneKeywords: z.array(z.string()).min(2).max(10),
  brandVoiceRules: z.object({
    do: z.array(z.string()).min(2).max(5),
    dont: z.array(z.string()).min(2).max(5),
  }),
  visualStyle: z.object({
    colors: z.array(z.string()).min(1).max(5),
    mood: z.string().optional(),
  }),
  audienceSummary: z.string().min(20).max(500),
  contentPillars: z.array(z.string()).min(2).max(5),
  confidenceScore: z.number().min(1).max(5).optional(),
});

export class BrandProfileService {
  /**
   * Get BrandProfile for an account
   * Creates one automatically if missing
   */
  async getBrandProfile(accountId: string): Promise<any> {
    let brandProfile = await prisma.brandProfile.findUnique({
      where: { accountId },
    });

    if (!brandProfile) {
      // Auto-generate if missing
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { websiteUrl: true, name: true },
      });

      if (!account?.websiteUrl) {
        throw new Error('Website URL required to generate brand profile');
      }

      brandProfile = await this.generateBrandProfile(
        accountId,
        account.websiteUrl,
        account.name
      );
    }

    // Warn if confidence is low
    if (brandProfile.confidenceScore < 3) {
      console.warn(
        `[BrandProfile] Low confidence score (${brandProfile.confidenceScore}) for account ${accountId}`
      );
    }

    return brandProfile;
  }

  /**
   * Generate a new BrandProfile from website analysis
   * Source: AUTO
   */
  async generateBrandProfile(
    accountId: string,
    websiteUrl: string,
    businessName: string,
    userId?: string
  ): Promise<any> {
    // Extract raw brand data from website using existing extractor
    const extractedData = await brandExtractor.extractBrandProfile(
      websiteUrl,
      businessName
    );

    // Enhance with AI to create structured audience summary
    const audienceSummary = await this.generateAudienceSummary(
      businessName,
      extractedData.siteTitle || '',
      extractedData.metaDescription || '',
      extractedData.contentPillars
    );

    // Determine mood from tone keywords
    const mood = this.inferMood(extractedData.toneKeywords);

    // Create BrandProfile in database
    const brandProfile = await prisma.brandProfile.create({
      data: {
        accountId,
        websiteUrl,
        toneKeywords: extractedData.toneKeywords,
        brandVoiceRules: extractedData.voiceRules,
        visualStyle: {
          colors: extractedData.colorPalette,
          mood,
        },
        audienceSummary,
        contentPillars: extractedData.contentPillars,
        confidenceScore: 3, // Default for auto-generated
        source: 'AUTO',
      },
    });

    // Log audit event
    await logAuditEvent({
      accountId,
      userId,
      eventType: 'BRAND_PROFILE_CREATED',
      entityType: 'BrandProfile',
      entityId: brandProfile.id,
      metadata: {
        source: 'AUTO',
        websiteUrl,
        confidenceScore: 3,
      },
    });

    return brandProfile;
  }

  /**
   * Update BrandProfile (manual refinement)
   * Source: MANUAL_OVERRIDE
   *
   * Use this for Pomelli-informed refinements without coupling
   */
  async updateBrandProfile(
    accountId: string,
    updates: Partial<BrandProfileData>,
    userId?: string
  ): Promise<any> {
    // Get existing profile
    const existing = await this.getBrandProfile(accountId);

    // Validate updates
    const validatedUpdates = brandProfileDataSchema.partial().parse(updates);

    // Update in database
    const brandProfile = await prisma.brandProfile.update({
      where: { accountId },
      data: {
        ...validatedUpdates,
        source: 'MANUAL_OVERRIDE',
        updatedAt: new Date(),
      },
    });

    // Log audit event
    await logAuditEvent({
      accountId,
      userId,
      eventType: 'BRAND_PROFILE_UPDATED',
      entityType: 'BrandProfile',
      entityId: brandProfile.id,
      metadata: {
        source: 'MANUAL_OVERRIDE',
        updatedFields: Object.keys(validatedUpdates),
        previousSource: existing.source,
      },
    });

    return brandProfile;
  }

  /**
   * Regenerate BrandProfile from scratch
   * Useful when website changes significantly
   */
  async regenerateBrandProfile(
    accountId: string,
    userId?: string
  ): Promise<any> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { websiteUrl: true, name: true },
    });

    if (!account?.websiteUrl) {
      throw new Error('Website URL required');
    }

    // Delete existing
    await prisma.brandProfile.deleteMany({
      where: { accountId },
    });

    // Generate new
    return this.generateBrandProfile(
      accountId,
      account.websiteUrl,
      account.name,
      userId
    );
  }

  /**
   * Set confidence score manually
   * Higher score = more refined/accurate
   */
  async setConfidenceScore(
    accountId: string,
    score: number,
    userId?: string
  ): Promise<any> {
    if (score < 1 || score > 5) {
      throw new Error('Confidence score must be 1-5');
    }

    const brandProfile = await prisma.brandProfile.update({
      where: { accountId },
      data: { confidenceScore: score },
    });

    await logAuditEvent({
      accountId,
      userId,
      eventType: 'BRAND_PROFILE_UPDATED',
      entityType: 'BrandProfile',
      entityId: brandProfile.id,
      metadata: {
        action: 'confidence_score_updated',
        newScore: score,
      },
    });

    return brandProfile;
  }

  /**
   * Add internal notes (admin only)
   * Use this to document Pomelli findings or refinement rationale
   */
  async addNotes(
    accountId: string,
    notes: string,
    userId?: string
  ): Promise<any> {
    const brandProfile = await prisma.brandProfile.update({
      where: { accountId },
      data: { notes },
    });

    await logAuditEvent({
      accountId,
      userId,
      eventType: 'BRAND_PROFILE_UPDATED',
      entityType: 'BrandProfile',
      entityId: brandProfile.id,
      metadata: {
        action: 'notes_added',
      },
    });

    return brandProfile;
  }

  // ===== PRIVATE HELPERS =====

  private async generateAudienceSummary(
    businessName: string,
    siteTitle: string,
    metaDescription: string,
    contentPillars: string[]
  ): Promise<string> {
    const prompt = `Based on this business information, write a 1-2 sentence summary of their target audience.

Business Name: ${businessName}
Site Title: ${siteTitle}
Description: ${metaDescription}
Content Focus: ${contentPillars.join(', ')}

Example output: "Health-conscious professionals aged 30-50 seeking preventive care and family dental services in Auckland. Values convenience, quality, and modern treatment options."

Write the audience summary:`;

    const summary = await aiProvider.generateText(prompt);
    return summary.trim();
  }

  private inferMood(toneKeywords: string[]): string {
    const moodMap: Record<string, string> = {
      professional: 'Confident & Trustworthy',
      approachable: 'Warm & Friendly',
      expert: 'Authoritative & Knowledgeable',
      innovative: 'Modern & Forward-Thinking',
      caring: 'Compassionate & Supportive',
      energetic: 'Dynamic & Vibrant',
      calm: 'Peaceful & Reassuring',
    };

    // Find first matching keyword
    for (const keyword of toneKeywords) {
      const lowerKeyword = keyword.toLowerCase();
      for (const [key, value] of Object.entries(moodMap)) {
        if (lowerKeyword.includes(key)) {
          return value;
        }
      }
    }

    return 'Professional & Balanced';
  }
}

export const brandProfileService = new BrandProfileService();
