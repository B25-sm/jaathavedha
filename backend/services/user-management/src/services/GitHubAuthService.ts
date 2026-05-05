import axios from 'axios';
import { Logger } from '@sai-mahendra/utils';

export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  bio?: string;
  company?: string;
  location?: string;
  blog?: string;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export interface GitHubTokens {
  accessToken: string;
  tokenType: string;
  scope: string;
}

export class GitHubAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID || '';
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
    this.redirectUri = process.env.GITHUB_REDIRECT_URI || '';
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const scopes = ['user:email', 'read:user'];
    const baseUrl = 'https://github.com/login/oauth/authorize';

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      state: state || '',
      allow_signup: 'true'
    });

    const authUrl = `${baseUrl}?${params.toString()}`;
    Logger.info('Generated GitHub OAuth URL');
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async getTokensFromCode(code: string): Promise<GitHubTokens> {
    try {
      const tokenUrl = 'https://github.com/login/oauth/access_token';

      const response = await axios.post(
        tokenUrl,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri
        },
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );

      const { access_token, token_type, scope } = response.data;

      if (!access_token) {
        throw new Error('No access token received from GitHub');
      }

      Logger.info('Successfully exchanged GitHub auth code for tokens');

      return {
        accessToken: access_token,
        tokenType: token_type || 'bearer',
        scope: scope || ''
      };
    } catch (error) {
      Logger.error('Error exchanging GitHub auth code', error as Error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile from GitHub
   */
  async getUserProfile(accessToken: string): Promise<GitHubUserProfile> {
    try {
      const profileResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      const profile = profileResponse.data;

      // If email is not public, fetch from emails endpoint
      if (!profile.email) {
        const emails = await this.getUserEmails(accessToken);
        const primaryEmail = emails.find(e => e.primary && e.verified);
        if (primaryEmail) {
          profile.email = primaryEmail.email;
        }
      }

      Logger.info('Retrieved GitHub user profile', { userId: profile.id });

      return {
        id: profile.id,
        login: profile.login,
        name: profile.name || profile.login,
        email: profile.email || '',
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        company: profile.company,
        location: profile.location,
        blog: profile.blog,
        public_repos: profile.public_repos,
        followers: profile.followers,
        following: profile.following
      };
    } catch (error) {
      Logger.error('Error fetching GitHub user profile', error as Error);
      throw new Error('Failed to fetch user profile from GitHub');
    }
  }

  /**
   * Get user emails from GitHub
   */
  async getUserEmails(accessToken: string): Promise<GitHubEmail[]> {
    try {
      const response = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      return response.data;
    } catch (error) {
      Logger.error('Error fetching GitHub user emails', error as Error);
      return [];
    }
  }

  /**
   * Get user repositories (optional, for developer programs)
   */
  async getUserRepositories(
    accessToken: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<any[]> {
    try {
      const response = await axios.get('https://api.github.com/user/repos', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        },
        params: {
          page,
          per_page: perPage,
          sort: 'updated',
          direction: 'desc'
        }
      });

      return response.data;
    } catch (error) {
      Logger.error('Error fetching GitHub repositories', error as Error);
      return [];
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccess(accessToken: string): Promise<void> {
    try {
      const revokeUrl = `https://api.github.com/applications/${this.clientId}/token`;

      await axios.delete(revokeUrl, {
        auth: {
          username: this.clientId,
          password: this.clientSecret
        },
        data: {
          access_token: accessToken
        },
        headers: {
          Accept: 'application/vnd.github.v3+json'
        }
      });

      Logger.info('GitHub access token revoked');
    } catch (error) {
      Logger.error('Error revoking GitHub access token', error as Error);
      throw new Error('Failed to revoke access token');
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      return true;
    } catch (error) {
      Logger.warn('GitHub token validation failed', { error });
      return false;
    }
  }
}
