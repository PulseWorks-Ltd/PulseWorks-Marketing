// API client utility for making requests to the Express backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_URL;

    // Load token from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
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
