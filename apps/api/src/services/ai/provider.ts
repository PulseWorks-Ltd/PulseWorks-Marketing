import OpenAI from 'openai';
import { z } from 'zod';

const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';

export class AIProvider {
  private openai?: OpenAI;

  constructor() {
    if (AI_PROVIDER === 'openai') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async generateJSON<T>(
    prompt: string,
    schema: z.ZodType<T>,
    systemPrompt?: string
  ): Promise<T> {
    if (!this.openai) {
      throw new Error('AI provider not configured');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const parsed = JSON.parse(content);
      return schema.parse(parsed);
    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error('Failed to generate content from AI');
    }
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.openai) {
      throw new Error('AI provider not configured');
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || '';
  }
}

export const aiProvider = new AIProvider();
