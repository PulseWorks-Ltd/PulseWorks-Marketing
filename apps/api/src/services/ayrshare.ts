// Ayrshare API client for posting to social media

export interface AyrsharePost {
  post: string;
  platforms: string[]; // ['facebook', 'instagram']
  mediaUrls?: string[];
  profileKey?: string; // For multi-profile accounts
  scheduleDate?: string; // ISO format for scheduled posts
  instagramOptions?: {
    postType?: 'story' | 'reels';
  };
}

export interface AyrshareResponse {
  status: string;
  id?: string; // Job ID
  postIds?: Array<{
    platform: string;
    postId: string;
    postUrl?: string;
    status: string;
  }>;
  errors?: Array<{
    action: string;
    platform: string;
    message: string;
  }>;
}

export class AyrshareClient {
  private apiKey: string;
  private baseUrl = 'https://app.ayrshare.com/api';

  constructor() {
    this.apiKey = process.env.AYRSHARE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('AYRSHARE_API_KEY not configured');
    }
  }

  async createPost(data: AyrsharePost): Promise<AyrshareResponse> {
    if (!this.apiKey) {
      throw new Error('Ayrshare API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ayrshare API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  async getPostStatus(id: string): Promise<AyrshareResponse> {
    const response = await fetch(`${this.baseUrl}/post/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get post status: ${response.status}`);
    }

    return await response.json();
  }

  async deletePost(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/delete/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete post: ${response.status}`);
    }
  }

  // Get user's social profiles
  async getProfiles(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/user`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get profiles: ${response.status}`);
    }

    return await response.json();
  }

  // Generate a profile key for multi-account setups
  async generateProfileKey(title: string): Promise<{ profileKey: string }> {
    const response = await fetch(`${this.baseUrl}/profiles/generateProfileKey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate profile key: ${response.status}`);
    }

    return await response.json();
  }
}

export const ayrshareClient = new AyrshareClient();
