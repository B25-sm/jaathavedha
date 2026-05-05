import { OAuth2Client } from 'google-auth-library';
import { Logger } from '@sai-mahendra/utils';

export interface GoogleUserProfile {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || '',
      prompt: 'consent' // Force consent to get refresh token
    });

    Logger.info('Generated Google OAuth URL');
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<GoogleTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      const expiresAt = tokens.expiry_date 
        ? new Date(tokens.expiry_date)
        : undefined;

      Logger.info('Successfully exchanged Google auth code for tokens');

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt
      };
    } catch (error) {
      Logger.error('Error exchanging Google auth code', error as Error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile from Google
   */
  async getUserProfile(accessToken: string): Promise<GoogleUserProfile> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const response = await this.oauth2Client.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo'
      });

      const profile = response.data as GoogleUserProfile;

      Logger.info('Retrieved Google user profile', { userId: profile.id });
      return profile;
    } catch (error) {
      Logger.error('Error fetching Google user profile', error as Error);
      throw new Error('Failed to fetch user profile from Google');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('No access token received from refresh');
      }

      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : undefined;

      Logger.info('Successfully refreshed Google access token');

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresAt
      };
    } catch (error) {
      Logger.error('Error refreshing Google access token', error as Error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccess(accessToken: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(accessToken);
      Logger.info('Google access token revoked');
    } catch (error) {
      Logger.error('Error revoking Google access token', error as Error);
      throw new Error('Failed to revoke access token');
    }
  }

  /**
   * Verify ID token
   */
  async verifyIdToken(idToken: string): Promise<GoogleUserProfile> {
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      
      if (!payload) {
        throw new Error('Invalid ID token payload');
      }

      return {
        id: payload.sub,
        email: payload.email || '',
        verified_email: payload.email_verified || false,
        name: payload.name || '',
        given_name: payload.given_name || '',
        family_name: payload.family_name || '',
        picture: payload.picture || '',
        locale: payload.locale || 'en'
      };
    } catch (error) {
      Logger.error('Error verifying Google ID token', error as Error);
      throw new Error('Failed to verify ID token');
    }
  }
}
