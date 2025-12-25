// Shared types across web and API

export type Plan = 'ESSENTIAL' | 'GROWTH' | 'AUTHORITY';
export type Platform = 'FACEBOOK' | 'INSTAGRAM';
export type Focus = 'NEW_CLIENTS' | 'PROMOTE_SERVICE' | 'EDUCATION' | 'SEASONAL';
export type Tone = 'NEUTRAL' | 'EDUCATIONAL' | 'PROMOTIONAL';
export type ContentType = 'POST' | 'PROMO';
export type ContentStatus = 'DRAFT' | 'APPROVED' | 'SKIPPED' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
export type Frequency = 'TWICE_WEEKLY' | 'THREE_WEEKLY' | 'CUSTOM';
export type TimeWindow = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CUSTOM';
export type ScheduleStatus = 'QUEUED' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';

export interface PlanLimits {
  postsPerMonth: number;
  promosPerMonth: number;
  editsPerMonth: number;
  price: number;
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
