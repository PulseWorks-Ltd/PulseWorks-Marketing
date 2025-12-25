import { aiProvider } from './provider';
import { contentPlanSchema, generatedContentSchema } from '@shared/types';
import type { BrandProfile, ContentPlanItem, GeneratedContent, Focus, Tone } from '@shared/types';
import { z } from 'zod';
import { PLAN_LIMITS } from '@shared/types';

export interface GenerationRequest {
  brandProfile: BrandProfile;
  primaryFocus: Focus;
  secondaryFocus?: Focus;
  promoEnabled: boolean;
  promoText?: string;
  tone: Tone;
  plan: string;
}

export class ContentGenerator {
  async generateContentPack(request: GenerationRequest): Promise<GeneratedContent[]> {
    // Step 1: Generate content plan
    const planItems = await this.generateContentPlan(request);

    // Step 2: Generate captions for each plan item
    const content: GeneratedContent[] = [];

    for (const item of planItems) {
      try {
        const generatedContent = await this.generatePostContent(
          request.brandProfile,
          item,
          request.tone
        );
        content.push(generatedContent);
      } catch (error) {
        console.error(`Failed to generate content for: ${item.title}`, error);
        // Continue with other items
      }
    }

    return content;
  }

  private async generateContentPlan(request: GenerationRequest): Promise<ContentPlanItem[]> {
    const limits = PLAN_LIMITS[request.plan] || PLAN_LIMITS.ESSENTIAL;
    const totalPosts = limits.postsPerMonth;
    const promoCount = request.promoEnabled ? Math.min(limits.promosPerMonth, 1) : 0;
    const regularPosts = totalPosts - promoCount;

    const prompt = `Create a content plan for a ${request.brandProfile.name} for the month.

Brand Profile:
- Content Pillars: ${request.brandProfile.contentPillars.join(', ')}
- Tone: ${request.brandProfile.toneKeywords.join(', ')}
- Voice Rules DO: ${request.brandProfile.voiceRules.do.join(', ')}
- Voice Rules DON'T: ${request.brandProfile.voiceRules.dont.join(', ')}

Monthly Focus:
- Primary: ${request.primaryFocus.replace('_', ' ')}
${request.secondaryFocus ? `- Secondary: ${request.secondaryFocus.replace('_', ' ')}` : ''}
${request.promoEnabled && request.promoText ? `- Promo: ${request.promoText}` : ''}

Generate ${regularPosts} regular posts${promoCount > 0 ? ` and ${promoCount} promo post` : ''}.

Each post should:
- Align with a content pillar
- Address the monthly focus
- Be valuable, not salesy (except promos)
- Be suitable for small business social media (Facebook/Instagram)

Return as JSON:
{
  "posts": [
    {
      "title": "5 Signs You Need Professional Help",
      "type": "POST",
      "angle": "Educational post about when to seek services",
      "pillar": "Education"
    }
  ]
}`;

    const result = await aiProvider.generateJSON(
      prompt,
      z.object({ posts: contentPlanSchema })
    );

    return result.posts;
  }

  private async generatePostContent(
    brandProfile: BrandProfile,
    planItem: ContentPlanItem,
    tone: Tone
  ): Promise<GeneratedContent> {
    const isPromo = planItem.type === 'PROMO';

    const prompt = `Write a social media post for ${brandProfile.name}.

Post Details:
- Title: ${planItem.title}
- Angle: ${planItem.angle}
- Type: ${isPromo ? 'Promotional' : 'Regular educational/value post'}
- Pillar: ${planItem.pillar}

Brand Voice:
- Tone: ${tone}, ${brandProfile.toneKeywords.join(', ')}
- DO: ${brandProfile.voiceRules.do.join('; ')}
- DON'T: ${brandProfile.voiceRules.dont.join('; ')}

Requirements:
- Caption: 100-300 characters (short and punchy for social)
- Include a soft call-to-action
- Sound human, not AI-generated
- Be specific and valuable
${!isPromo ? '- Focus on value, not selling' : '- Clear offer and urgency'}

Also generate:
- 8-12 relevant hashtags (mix of popular and niche, NZ-appropriate)
- Platform targets: Both Facebook and Instagram unless content is platform-specific

Return as JSON:
{
  "caption": "Your post caption here...",
  "hashtags": ["hashtag1", "hashtag2"],
  "platformTargets": ["FACEBOOK", "INSTAGRAM"]
}`;

    const result = await aiProvider.generateJSON(
      prompt,
      generatedContentSchema.omit({ title: true, type: true })
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

export const contentGenerator = new ContentGenerator();
