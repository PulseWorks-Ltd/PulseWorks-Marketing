import * as cheerio from 'cheerio';
import { brandProfileSchema } from '@shared/types';
import { aiProvider } from './provider';
import type { BrandProfile } from '@shared/types';

export class BrandExtractor {
  async extractBrandProfile(websiteUrl: string, businessName: string): Promise<BrandProfile> {
    // Fetch website HTML
    const html = await this.fetchWebsite(websiteUrl);

    // Parse HTML
    const $ = cheerio.load(html);

    // Extract basic info
    const siteTitle = $('title').text().trim() || businessName;
    const metaDescription = $('meta[name="description"]').attr('content')?.trim();

    // Extract headings
    const headings: string[] = [];
    $('h1, h2').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 100) {
        headings.push(text);
      }
    });

    // Extract colors from CSS (basic approach)
    const colors = await this.extractColors($);

    // Use AI to generate brand profile
    const prompt = `Analyze this business information and create a brand profile.

Business Name: ${businessName}
Website: ${websiteUrl}
Site Title: ${siteTitle}
Meta Description: ${metaDescription || 'Not provided'}
Key Headings: ${headings.slice(0, 10).join(', ')}

Create a brand profile with:
1. Tone keywords (3-5 words that describe the brand voice)
2. Color palette (suggest 3-5 hex colors based on the industry and brand, use ${colors.join(', ')} if available)
3. Content pillars (3-4 main topics this brand should post about)
4. Voice rules: 3 things to DO and 3 things to DON'T in content

Return as JSON matching this structure:
{
  "toneKeywords": ["professional", "approachable"],
  "colorPalette": ["#1a2b3c", "#4a5b6c"],
  "contentPillars": ["Education", "Client success", "Industry insights"],
  "voiceRules": {
    "do": ["Use clear, simple language", "Focus on benefits"],
    "dont": ["Use jargon", "Make bold claims"]
  }
}`;

    const aiResult = await aiProvider.generateJSON(
      prompt,
      brandProfileSchema.pick({
        toneKeywords: true,
        colorPalette: true,
        contentPillars: true,
        voiceRules: true,
      })
    );

    return {
      name: businessName,
      websiteUrl,
      siteTitle,
      metaDescription,
      headings: headings.slice(0, 10),
      colorPalette: aiResult.colorPalette,
      toneKeywords: aiResult.toneKeywords,
      contentPillars: aiResult.contentPillars,
      voiceRules: aiResult.voiceRules,
    };
  }

  private async fetchWebsite(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PulseWorks/1.0; +https://pulseworks.co.nz)',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Website fetch error:', error);
      throw new Error('Could not access website. Please check the URL.');
    }
  }

  private async extractColors($: cheerio.CheerioAPI): Promise<string[]> {
    const colors: string[] = [];

    // Look for inline styles with color
    $('[style*="color"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const colorMatch = style.match(/#[0-9A-Fa-f]{6}/);
      if (colorMatch) colors.push(colorMatch[0]);
    });

    return [...new Set(colors)].slice(0, 3);
  }
}

export const brandExtractor = new BrandExtractor();
