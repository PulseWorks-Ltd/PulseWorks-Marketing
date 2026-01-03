// Shared types across web and API

export type Plan = 'STARTER' | 'GROWTH' | 'PRO';
export type Platform = 'FACEBOOK' | 'INSTAGRAM';
export type Focus = 'NEW_CLIENTS' | 'PROMOTE_SERVICE' | 'EDUCATION' | 'SEASONAL';
export type Tone = 'NEUTRAL' | 'EDUCATIONAL' | 'PROMOTIONAL';
export type ContentType = 'STATIC' | 'VIDEO'; // Changed from POST/PROMO to STATIC/VIDEO
export type ContentStatus = 'DRAFT' | 'APPROVED' | 'SKIPPED' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
export type Frequency = 'TWICE_WEEKLY' | 'THREE_WEEKLY' | 'CUSTOM';
export type TimeWindow = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CUSTOM';
export type ScheduleStatus = 'QUEUED' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';

export interface PlanLimits {
  staticPostsPerMonth: number;
  videosPerMonth: number;
  autoposting: boolean;
  imageUploads: boolean;
  price: number;
}

// Usage tracking for billing periods
export interface UsageCounter {
  staticUsed: number;
  videoUsed: number;
  autopostUsed: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface BrandProfile {
  name: string;
  websiteUrl: string;
  siteTitle?: string;
  metaDescription?: string;
  headings: string[];
  colorPalette: string[];
  toneKeywords: string[];
  contentPillars: string[];
  voiceRules: {
    do: string[];
    dont: string[];
  };
}

export interface ContentPlanItem {
  title: string;
  type: ContentType;
  angle: string;
  pillar: string;
}

export interface GeneratedContent {
  title: string;
  caption: string;
  hashtags: string[];
  platformTargets: Platform[];
  mediaUrl?: string;
  type: ContentType;
}

export interface PostingDestinations {
  facebook?: {
    pageId: string;
    pageName: string;
    profilePicUrl?: string;
  };
  instagram?: {
    accountId: string;
    handle: string;
    profilePicUrl?: string;
  };
}
