import type { PlanLimits } from './types';

// PostLoop Pricing Tiers
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  STARTER: {
    staticPostsPerMonth: 8,
    videosPerMonth: 0,
    autoposting: false,
    imageUploads: false,
    price: 39,
  },
  GROWTH: {
    staticPostsPerMonth: 12,
    videosPerMonth: 4,
    autoposting: true,
    imageUploads: true,
    price: 99,
  },
  PRO: {
    staticPostsPerMonth: 30,
    videosPerMonth: 16,
    autoposting: true,
    imageUploads: true,
    price: 249,
  },
};

// Add-ons
export const STARTER_AUTOPOST_ADDON_PRICE = 30;
export const STARTER_AUTOPOST_CAP = 8; // Max auto-posts per month for Starter + addon

// One-time purchases
export const ONE_TIME_STATIC_PRICE = 5;
export const ONE_TIME_VIDEO_PRICE = 19;

export const DEFAULT_TIMEZONE = 'Pacific/Auckland';

export const TIME_WINDOWS = {
  MORNING: '09:30',
  AFTERNOON: '13:00',
  EVENING: '18:30',
};

export const FOCUS_OPTIONS = [
  { value: 'NEW_CLIENTS', label: 'New clients' },
  { value: 'PROMOTE_SERVICE', label: 'Promote a service' },
  { value: 'EDUCATION', label: 'Education / authority' },
  { value: 'SEASONAL', label: 'Seasonal campaign' },
] as const;

export const TONE_OPTIONS = [
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'EDUCATIONAL', label: 'Educational' },
  { value: 'PROMOTIONAL', label: 'Promotional' },
] as const;

export const FREQUENCY_OPTIONS = [
  { value: 'TWICE_WEEKLY', label: '2x per week' },
  { value: 'THREE_WEEKLY', label: '3x per week' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
] as const;
