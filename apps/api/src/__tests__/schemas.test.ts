import { describe, it, expect } from '@jest/globals';
import {
  monthlyBriefSchema,
  editContentSchema,
  postingRuleSchema,
  generatedContentSchema,
} from '@shared/types';

describe('Schema Validation', () => {
  describe('monthlyBriefSchema', () => {
    it('should validate correct brief data', () => {
      const validData = {
        month: '2025-01-01',
        primaryFocus: 'NEW_CLIENTS',
        secondaryFocus: 'EDUCATION',
        promoEnabled: true,
        promoText: 'Special offer for new clients',
        tone: 'EDUCATIONAL',
      };

      const result = monthlyBriefSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid month format', () => {
      const invalidData = {
        month: '2025-01-15', // Not first of month
        primaryFocus: 'NEW_CLIENTS',
        tone: 'EDUCATIONAL',
      };

      const result = monthlyBriefSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid focus', () => {
      const invalidData = {
        month: '2025-01-01',
        primaryFocus: 'INVALID_FOCUS',
        tone: 'EDUCATIONAL',
      };

      const result = monthlyBriefSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('editContentSchema', () => {
    it('should validate correct content edit', () => {
      const validData = {
        caption: 'This is a valid caption with enough length',
        hashtags: ['dental', 'health', 'wellness'],
        platformTargets: ['FACEBOOK', 'INSTAGRAM'],
      };

      const result = editContentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject caption that is too short', () => {
      const invalidData = {
        caption: 'Too short',
        hashtags: ['test'],
        platformTargets: ['FACEBOOK'],
      };

      const result = editContentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty platform targets', () => {
      const invalidData = {
        caption: 'Valid caption with enough length here',
        hashtags: ['test'],
        platformTargets: [],
      };

      const result = editContentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('generatedContentSchema', () => {
    it('should validate AI-generated content', () => {
      const validData = {
        title: 'Why Dental Health Matters',
        caption: 'Regular checkups are essential for maintaining good oral health. Book your appointment today!',
        hashtags: ['dental', 'health', 'nz', 'dentist', 'oralhealth'],
        platformTargets: ['FACEBOOK', 'INSTAGRAM'],
        type: 'POST',
      };

      const result = generatedContentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject caption that is too short', () => {
      const invalidData = {
        title: 'Test Post',
        caption: 'Too short',
        hashtags: ['test'],
        platformTargets: ['FACEBOOK'],
        type: 'POST',
      };

      const result = generatedContentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject insufficient hashtags', () => {
      const invalidData = {
        title: 'Test Post',
        caption: 'This is a valid caption with enough length for the schema validation rules',
        hashtags: ['one', 'two'], // Need at least 3
        platformTargets: ['FACEBOOK'],
        type: 'POST',
      };

      const result = generatedContentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('postingRuleSchema', () => {
    it('should validate correct posting rule', () => {
      const validData = {
        frequency: 'TWICE_WEEKLY',
        daysOfWeek: [2, 4],
        timeWindow: 'MORNING',
      };

      const result = postingRuleSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty daysOfWeek', () => {
      const invalidData = {
        frequency: 'TWICE_WEEKLY',
        daysOfWeek: [],
        timeWindow: 'MORNING',
      };

      const result = postingRuleSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate fixed time format', () => {
      const validData = {
        frequency: 'CUSTOM',
        daysOfWeek: [1, 3, 5],
        timeWindow: 'CUSTOM',
        fixedTime: '14:30',
      };

      const result = postingRuleSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid time format', () => {
      const invalidData = {
        frequency: 'CUSTOM',
        daysOfWeek: [1],
        timeWindow: 'CUSTOM',
        fixedTime: '2:30 PM', // Invalid format
      };

      const result = postingRuleSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
