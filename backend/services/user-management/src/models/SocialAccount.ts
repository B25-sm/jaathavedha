import { DatabaseUtils, Logger, CryptoUtils } from '@sai-mahendra/utils';

export type SocialProvider = 'google' | 'linkedin' | 'github';

export interface SocialAccount {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  email?: string;
  displayName?: string;
  profilePictureUrl?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  profileData?: any;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialAccountCreate {
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  email?: string;
  displayName?: string;
  profilePictureUrl?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  profileData?: any;
  isPrimary?: boolean;
}

export interface AccountLinkingRequest {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  email: string;
  verificationToken: string;
  expiresAt: Date;
  status: string;
  createdAt: Date;
}

export class SocialAccountModel {
  /**
   * Create a new social account
   */
  static async create(data: SocialAccountCreate): Promise<SocialAccount> {
    try {
      const query = `
        INSERT INTO social_accounts (
          user_id, provider, provider_user_id, email, display_name,
          profile_picture_url, access_token, refresh_token, token_expires_at,
          profile_data, is_primary
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        data.userId,
        data.provider,
        data.providerUserId,
        data.email || null,
        data.displayName || null,
        data.profilePictureUrl || null,
        data.accessToken,
        data.refreshToken || null,
        data.tokenExpiresAt || null,
        data.profileData ? JSON.stringify(data.profileData) : null,
        data.isPrimary || false
      ];

      const result = await DatabaseUtils.query(query, values);
      Logger.info('Social account created', { 
        userId: data.userId, 
        provider: data.provider 
      });

      return this.mapRowToSocialAccount(result.rows[0]);
    } catch (error) {
      Logger.error('Error creating social account', error as Error);
      throw error;
    }
  }

  /**
   * Find social account by provider and provider user ID
   */
  static async findByProviderAndUserId(
    provider: SocialProvider,
    providerUserId: string
  ): Promise<SocialAccount | null> {
    try {
      const query = `
        SELECT * FROM social_accounts
        WHERE provider = $1 AND provider_user_id = $2
      `;

      const result = await DatabaseUtils.query(query, [provider, providerUserId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSocialAccount(result.rows[0]);
    } catch (error) {
      Logger.error('Error finding social account', error as Error);
      throw error;
    }
  }

  /**
   * Find all social accounts for a user
   */
  static async findByUserId(userId: string): Promise<SocialAccount[]> {
    try {
      const query = `
        SELECT * FROM social_accounts
        WHERE user_id = $1
        ORDER BY is_primary DESC, created_at ASC
      `;

      const result = await DatabaseUtils.query(query, [userId]);
      return result.rows.map(row => this.mapRowToSocialAccount(row));
    } catch (error) {
      Logger.error('Error finding social accounts by user ID', error as Error);
      throw error;
    }
  }

  /**
   * Update social account tokens
   */
  static async updateTokens(
    id: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      const query = `
        UPDATE social_accounts
        SET access_token = $1,
            refresh_token = COALESCE($2, refresh_token),
            token_expires_at = $3,
            updated_at = NOW()
        WHERE id = $4
      `;

      await DatabaseUtils.query(query, [accessToken, refreshToken, expiresAt, id]);
      Logger.info('Social account tokens updated', { id });
    } catch (error) {
      Logger.error('Error updating social account tokens', error as Error);
      throw error;
    }
  }

  /**
   * Delete social account (unlink)
   */
  static async delete(id: string, userId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM social_accounts
        WHERE id = $1 AND user_id = $2
      `;

      const result = await DatabaseUtils.query(query, [id, userId]);
      const deleted = result.rowCount > 0;

      if (deleted) {
        Logger.info('Social account deleted', { id, userId });
      }

      return deleted;
    } catch (error) {
      Logger.error('Error deleting social account', error as Error);
      throw error;
    }
  }

  /**
   * Set primary social account
   */
  static async setPrimary(id: string, userId: string): Promise<void> {
    try {
      // First, unset all primary flags for this user
      await DatabaseUtils.query(
        'UPDATE social_accounts SET is_primary = false WHERE user_id = $1',
        [userId]
      );

      // Then set the specified account as primary
      await DatabaseUtils.query(
        'UPDATE social_accounts SET is_primary = true WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      Logger.info('Primary social account set', { id, userId });
    } catch (error) {
      Logger.error('Error setting primary social account', error as Error);
      throw error;
    }
  }

  /**
   * Create account linking request
   */
  static async createLinkingRequest(
    userId: string,
    provider: SocialProvider,
    providerUserId: string,
    email: string
  ): Promise<AccountLinkingRequest> {
    try {
      const verificationToken = CryptoUtils.generateSecureToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const query = `
        INSERT INTO account_linking_requests (
          user_id, provider, provider_user_id, email,
          verification_token, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await DatabaseUtils.query(query, [
        userId,
        provider,
        providerUserId,
        email,
        verificationToken,
        expiresAt
      ]);

      Logger.info('Account linking request created', { userId, provider });
      return this.mapRowToLinkingRequest(result.rows[0]);
    } catch (error) {
      Logger.error('Error creating account linking request', error as Error);
      throw error;
    }
  }

  /**
   * Find account linking request by token
   */
  static async findLinkingRequestByToken(
    token: string
  ): Promise<AccountLinkingRequest | null> {
    try {
      const query = `
        SELECT * FROM account_linking_requests
        WHERE verification_token = $1
          AND expires_at > NOW()
          AND status = 'pending'
      `;

      const result = await DatabaseUtils.query(query, [token]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToLinkingRequest(result.rows[0]);
    } catch (error) {
      Logger.error('Error finding linking request', error as Error);
      throw error;
    }
  }

  /**
   * Complete account linking request
   */
  static async completeLinkingRequest(token: string): Promise<void> {
    try {
      const query = `
        UPDATE account_linking_requests
        SET status = 'completed'
        WHERE verification_token = $1
      `;

      await DatabaseUtils.query(query, [token]);
      Logger.info('Account linking request completed', { token });
    } catch (error) {
      Logger.error('Error completing linking request', error as Error);
      throw error;
    }
  }

  /**
   * Check if email is already linked to a social account
   */
  static async isEmailLinked(
    email: string,
    provider: SocialProvider
  ): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM social_accounts
        WHERE email = $1 AND provider = $2
      `;

      const result = await DatabaseUtils.query(query, [email, provider]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      Logger.error('Error checking if email is linked', error as Error);
      throw error;
    }
  }

  /**
   * Map database row to SocialAccount object
   */
  private static mapRowToSocialAccount(row: any): SocialAccount {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerUserId: row.provider_user_id,
      email: row.email,
      displayName: row.display_name,
      profilePictureUrl: row.profile_picture_url,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: row.token_expires_at,
      profileData: row.profile_data,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to AccountLinkingRequest object
   */
  private static mapRowToLinkingRequest(row: any): AccountLinkingRequest {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerUserId: row.provider_user_id,
      email: row.email,
      verificationToken: row.verification_token,
      expiresAt: row.expires_at,
      status: row.status,
      createdAt: row.created_at
    };
  }
}
