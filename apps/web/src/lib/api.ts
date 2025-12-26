// API client utility for making requests to the Express backend
// Now uses NextAuth session tokens instead of manual JWT management

import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  // Get API token from NextAuth session
  private async getToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null; // Server-side - no session available
    }

    const session = await getSession();
    return (session as any)?.apiToken || null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Get token from NextAuth session
    const token = await this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for session
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async signUp(data: {
    email: string;
    password: string;
    name: string;
    businessName: string;
  }) {
    return this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async signIn(data: { email: string; password: string }) {
    return this.request('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Account
  async getAccount() {
    return this.request('/api/account');
  }

  // Briefs
  async getBriefs() {
    return this.request('/api/briefs');
  }

  async createBrief(data: any) {
    return this.request('/api/briefs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Content
  async getContent(month?: string) {
    const query = month ? `?month=${month}` : '';
    return this.request(`/api/content${query}`);
  }

  async generateContent(monthlyBriefId: string) {
    return this.request('/api/content/generate', {
      method: 'POST',
      body: JSON.stringify({ monthlyBriefId }),
    });
  }

  async approveContent(id: string) {
    return this.request(`/api/content/${id}/approve`, {
      method: 'POST',
    });
  }

  async editContent(id: string, data: any) {
    return this.request(`/api/content/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async skipContent(id: string) {
    return this.request(`/api/content/${id}/skip`, {
      method: 'POST',
    });
  }

  // Schedule
  async getPostingRules() {
    return this.request('/api/schedule/rules');
  }

  async savePostingRules(data: any) {
    return this.request('/api/schedule/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async scheduleContent(data: any) {
    return this.request('/api/schedule/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUpcomingSchedule(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request(`/api/schedule/upcoming${query}`);
  }

  // Social
  async getSocialConnections() {
    return this.request('/api/social/connections');
  }

  async connectSocial(data: any) {
    return this.request('/api/social/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyDestinations(data: any) {
    return this.request('/api/social/verify-destinations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Billing
  async createCheckout(data: any) {
    return this.request('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPortalUrl() {
    return this.request('/api/billing/portal', {
      method: 'POST',
    });
  }

  async getSubscription() {
    return this.request('/api/billing/subscription');
  }
}

export const apiClient = new ApiClient();
