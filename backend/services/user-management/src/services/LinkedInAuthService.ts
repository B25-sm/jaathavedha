import axios from 'axios';
import { Logger } from '@sai-mahendra/utils';

export interface LinkedInUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  localizedFirstName?: string;
  localizedLastName?: string;
}

export interface LinkedInTokens {
  accessToken: string;
  expiresAt: Date;
}

export class LinkedInAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID || '';
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || '';
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const scopes = ['openid', 'profile', 'email'];
    const baseUrl = 'https://www.linkedin.com/oauth/v2/authorization';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      state: state || ''
    });

    const authUrl = `${baseUrl}?${params.toString()}`;
    Logger.info('Generated LinkedIn OAuth URL');
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async getTokensFromCode(code: string): Promise<LinkedInTokens> {
    try {
      const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      });

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('No access token received from LinkedIn');
      }

      const expiresAt = new Date(Date.now() + expires_in * 1000);

      Logger.info('Successfully exchanged LinkedIn auth code for tokens');

      return {
        accessToken: access_token,
        expiresAt
      };
    } catch (error) {
      Logger.error('Error exchanging LinkedIn auth code', error as Error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile from LinkedIn
   */
  async getUserProfile(accessToken: string): Promise<LinkedInUserProfile> {
    try {
      // Get basic profile information
      const profileResponse = await axios.get(
        'https://api.linkedin.com/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const profile = profileResponse.data;

      Logger.info('Retrieved LinkedIn user profile', { userId: profile.sub });

      return {
        id: profile.sub,
        firstName: profile.given_name || '',
        lastName: profile.family_name || '',
        email: profile.email || '',
        profilePicture: profile.picture || undefined,
        localizedFirstName: profile.given_name,
        localizedLastName: profile.family_name
      };
    } catch (error) {
      Logger.error('Error fetching LinkedIn user profile', error as Error);
      throw new Error('Failed to fetch user profile from LinkedIn');
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccess(accessToken: string): Promise<void> {
    try {
      const revokeUrl = 'https://www.linkedin.com/oauth/v2/revoke';

      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        token: accessToken
      });

      await axios.post(revokeUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      Logger.info('LinkedIn access token revoked');
    } catch (error) {
      Logger.error('Error revoking LinkedIn access token', error as Error);
      throw new Error('Failed to revoke access token');
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return true;
    } catch (error) {
      Logger.warn('LinkedIn token validation failed', { error });
      return false;
    }
  }
}
