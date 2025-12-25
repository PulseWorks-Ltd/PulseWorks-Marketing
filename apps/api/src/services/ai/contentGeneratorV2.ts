import { aiProvider } from './provider';
import { contentPlanSchema, generatedContentSchema } from '@shared/types';
import type { ContentPlanItem, GeneratedContent, Focus, Tone } from '@shared/types';
import { z } from 'zod';
import { PLAN_LIMITS } from '@shared/types';

/**
 * Content Generator V2
 *
 * Uses BrandProfile from database as SINGLE SOURCE OF TRUTH
 * Never directly accesses website data
 *
 * All prompts reference structured BrandProfile fields
 */

export interface GenerationRequestV2 {
  // BrandProfile fields (from database)
  toneKeywords: string[];
  brandVoiceRules: {
    do: string[];
    dont: string[];
  };
  contentPillars: string[];
  audienceSummary: string;
  visualStyle: {
    colors: string[];
    mood?: string;
  };

  // Monthly brief fields
  primaryFocus: Focus;
  secondaryFocus?: Focus;
  promoEnabled: boolean;
  promoText?: string;
  tone: Tone;
  plan: string;

  // Account context
  businessName: string;
}

export class ContentGeneratorV2 {
  async generateContentPack(request: GenerationRequestV2): Promise<GeneratedContent[]> {
    // Step 1: Generate content plan using BrandProfile
    const planItems = await this.generateContentPlan(request);

    // Step 2: Generate captions for each plan item
    const content: GeneratedContent[] = [];

    for (const item of planItems) {
      try {
        const generatedContent = await this.generatePostContent(request, item);
        content.push(generatedContent);
      } catch (error) {
        console.error(`Failed to generate content for: ${item.title}`, error);
        // Continue with other items
      }
    }

    return content;
  }

  private async generateContentPlan(request: GenerationRequestV2): Promise<ContentPlanItem[]> {
    const limits = PLAN_LIMITS[request.plan] || PLAN_LIMITS.ESSENTIAL;
    const totalPosts = limits.postsPerMonth;
    const promoCount = request.promoEnabled ? Math.min(limits.promosPerMonth, 1) : 0;
    const regularPosts = totalPosts - promoCount;

    // CRITICAL: Using BrandProfile as structured input
    const systemPrompt = `You are a social media content strategist creating a monthly content plan.

You MUST follow these brand guidelines strictly:

BRAND IDENTITY:
- Tone: ${request.toneKeywords.join(', ')}
- Audience: ${request.audienceSummary}
- Visual Mood: ${request.visualStyle.mood || 'Professional'}

VOICE RULES:
DO: ${request.brandVoiceRules.do.join('; ')}
DON'T: ${request.brandVoiceRules.dont.join('; ')}

CONTENT PILLARS:
${request.contentPillars.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Create content that resonates with the audience while following these guidelines.`;

    const prompt = `Create a ${regularPosts}-post content plan for ${request.businessName} for the upcoming month.

MONTHLY FOCUS:
- Primary: ${request.primaryFocus.replace('_', ' ')}
${request.secondaryFocus ? `- Secondary: ${request.secondaryFocus.replace('_', ' ')}` : ''}
${request.promoEnabled && request.promoText ? `- Promo: ${request.promoText}` : ''}

REQUIREMENTS:
- Each post must align with a content pillar
- Address the monthly focus authentically
- Be valuable and engaging (not salesy, except promos)
- Suitable for Facebook and Instagram
- ${promoCount > 0 ? `Include ${promoCount} promotional post` : ''}

Return as JSON:
{
  "posts": [
    {
      "title": "Clear, benefit-driven title",
      "type": "POST",
      "angle": "Specific approach/perspective for this post",
      "pillar": "[one of the content pillars]"
    }
  ]
}`;

    const result = await aiProvider.generateJSON(
      prompt,
      z.object({ posts: contentPlanSchema }),
      systemPrompt
    );

    return result.posts;
  }

  private async generatePostContent(
    request: GenerationRequestV2,
    planItem: ContentPlanItem
  ): Promise<GeneratedContent> {
    const isPromo = planItem.type === 'PROMO';

    // CRITICAL: Using BrandProfile fields in system prompt
    const systemPrompt = `You are writing social media content for ${request.businessName}.

BRAND VOICE (YOU MUST FOLLOW EXACTLY):
- Tone: ${request.tone}, ${request.toneKeywords.join(', ')}
- Target Audience: ${request.audienceSummary}

STRICT VOICE RULES:
DO: ${request.brandVoiceRules.do.join('; ')}
DON'T: ${request.brandVoiceRules.dont.join('; ')}

Your content must sound human, authentic, and aligned with this brand voice.`;

    const prompt = `Write a social media post with these details:

TITLE: ${planItem.title}
ANGLE: ${planItem.angle}
TYPE: ${isPromo ? 'Promotional' : 'Educational/Value'}
PILLAR: ${planItem.pillar}

REQUIREMENTS:
- Caption: 100-300 characters (short and punchy for social media)
- Include a soft call-to-action
- Sound conversational and genuine (not corporate or AI-generated)
- Be specific and valuable to the audience
${!isPromo ? '- Focus on value and insights, not selling' : '- Clear offer with genuine urgency'}

Also generate:
- 8-12 relevant hashtags (mix of popular and niche)
- Use New Zealand-appropriate hashtags where relevant
- Platform targets: Both Facebook and Instagram (unless content is platform-specific)

Return as JSON:
{
  "caption": "Your post caption here...",
  "hashtags": ["hashtag1", "hashtag2"],
  "platformTargets": ["FACEBOOK", "INSTAGRAM"]
}`;

    const result = await aiProvider.generateJSON(
      prompt,
      generatedContentSchema.omit({ title: true, type: true }),
      systemPrompt
    );

    return {
      title: planItem.title,
      type: planItem.type,
      caption: result.caption,
      hashtags: result.hashtags,
      platformTargets: result.platformTargets,
    };
  }
}

export const contentGeneratorV2 = new ContentGeneratorV2();
