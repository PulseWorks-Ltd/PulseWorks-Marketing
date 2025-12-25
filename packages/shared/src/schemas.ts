import { z } from 'zod';

// ===== AUTH SCHEMAS =====

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  businessName: z.string().min(1, 'Business name is required'),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

// ===== MONTHLY BRIEF SCHEMAS =====

export const monthlyBriefSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/, 'Must be first day of month'),
  primaryFocus: z.enum(['NEW_CLIENTS', 'PROMOTE_SERVICE', 'EDUCATION', 'SEASONAL']),
  secondaryFocus: z.enum(['NEW_CLIENTS', 'PROMOTE_SERVICE', 'EDUCATION', 'SEASONAL']).optional(),
  promoEnabled: z.boolean().default(false),
  promoText: z.string().max(200).optional(),
  tone: z.enum(['NEUTRAL', 'EDUCATIONAL', 'PROMOTIONAL']).default('NEUTRAL'),
  notes: z.string().max(500).optional(),
});

// ===== CONTENT SCHEMAS =====

export const editContentSchema = z.object({
  caption: z.string().min(10, 'Caption too short').max(2200, 'Caption too long'),
  hashtags: z.array(z.string()).min(0).max(30),
  platformTargets: z.array(z.enum(['FACEBOOK', 'INSTAGRAM'])).min(1, 'Select at least one platform'),
});

export const bulkActionSchema = z.object({
  contentItemIds: z.array(z.string()).min(1),
  action: z.enum(['approve', 'skip', 'delete']),
});

// ===== POSTING RULE SCHEMAS =====

export const postingRuleSchema = z.object({
  frequency: z.enum(['TWICE_WEEKLY', 'THREE_WEEKLY', 'CUSTOM']),
  daysOfWeek: z.array(z.number().min(1).max(7)).min(1, 'Select at least one day'),
  timeWindow: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM']),
  fixedTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// ===== AI GENERATION SCHEMAS =====

export const brandProfileSchema = z.object({
  name: z.string(),
  websiteUrl: z.string().url(),
  siteTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  headings: z.array(z.string()),
  colorPalette: z.array(z.string()).min(1).max(5),
  toneKeywords: z.array(z.string()).min(1).max(10),
  contentPillars: z.array(z.string()).min(2).max(5),
  voiceRules: z.object({
    do: z.array(z.string()).min(2).max(5),
    dont: z.array(z.string()).min(2).max(5),
  }),
});

export const contentPlanItemSchema = z.object({
  title: z.string().min(5).max(100),
  type: z.enum(['POST', 'PROMO']),
  angle: z.string().min(10).max(200),
  pillar: z.string(),
});

export const contentPlanSchema = z.array(contentPlanItemSchema).min(1).max(50);

export const generatedContentSchema = z.object({
  title: z.string().min(5).max(100),
  caption: z.string().min(50).max(2200),
  hashtags: z.array(z.string()).min(3).max(30),
  platformTargets: z.array(z.enum(['FACEBOOK', 'INSTAGRAM'])),
  type: z.enum(['POST', 'PROMO']),
});

// ===== SOCIAL CONNECTION SCHEMAS =====

export const connectSocialSchema = z.object({
  platform: z.enum(['FACEBOOK', 'INSTAGRAM']),
  authCode: z.string().optional(),
  accessToken: z.string().optional(),
});

export const verifyDestinationsSchema = z.object({
  facebookPageId: z.string().optional(),
  instagramAccountId: z.string().optional(),
  confirmed: z.boolean(),
});

// ===== SCHEDULING SCHEMAS =====

export const schedulePostsSchema = z.object({
  contentItemIds: z.array(z.string()).min(1),
  startDate: z.string().optional(),
});

// ===== WEBHOOK SCHEMAS (Ayrshare) =====

export const ayrshareWebhookSchema = z.object({
  action: z.string(),
  status: z.string(),
  id: z.string().optional(), // Job ID
  postId: z.string().optional(),
  postUrl: z.string().optional(),
  errors: z.array(z.string()).optional(),
  platform: z.string().optional(),
});
