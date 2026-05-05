import { query } from '../database';
import { encrypt, decrypt } from '../utils/encryption';
import logger from '../utils/logger';
import {
  CalendarConnection,
  CalendarProvider,
  OAuthTokens,
  SyncPreferences,
} from '../types';

export class CalendarConnectionService {
  /**
   * Create a new calendar connection
   */
  async createConnection(
    userId: string,
    provider: CalendarProvider,
    tokens: OAuthTokens,
    calendarId?: string
  ): Promise<CalendarConnection> {
    try {
      // Encrypt tokens before storing
      const encryptedAccessToken = encrypt(tokens.accessToken);
      const encryptedRefreshToken = encrypt(tokens.refreshToken);

      const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

      const result = await query(
        `INSERT INTO calendar_connections 
        (user_id, provider, access_token, refresh_token, token_expiry, calendar_id, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, provider) 
        DO UPDATE SET 
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expiry = EXCLUDED.token_expiry,
          calendar_id = EXCLUDED.calendar_id,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING *`,
        [
          userId,
          provider,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiry,
          calendarId,
          true,
        ]
      );

      logger.info('Calendar connection created:', { userId, provider });

      return this.mapToConnection(result.rows[0]);
    } catch (error) {
      logger.error('Error creating calendar connection:', error);
      throw new Error('Failed to create calendar connection');
    }
  }

  /**
   * Get calendar connection by user and provider
   */
  async getConnection(
    userId: string,
    provider: CalendarProvider
  ): Promise<CalendarConnection | null> {
    try {
      const result = await query(
        `SELECT * FROM calendar_connections 
        WHERE user_id = $1 AND provider = $2 AND is_active = true`,
        [userId, provider]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapToConnection(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching calendar connection:', error);
      throw new Error('Failed to fetch calendar connection');
    }
  }

  /**
   * Get all active connections for a user
   */
  async getUserConnections(userId: string): Promise<CalendarConnection[]> {
    try {
      const result = await query(
        `SELECT * FROM calendar_connections 
        WHERE user_id = $1 AND is_active = true
        ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map((row) => this.mapToConnection(row));
    } catch (error) {
      logger.error('Error fetching user connections:', error);
      throw new Error('Failed to fetch user connections');
    }
  }

  /**
   * Update connection tokens
   */
  async updateTokens(
    userId: string,
    provider: CalendarProvider,
    tokens: OAuthTokens
  ): Promise<void> {
    try {
      const encryptedAccessToken = encrypt(tokens.accessToken);
      const encryptedRefreshToken = encrypt(tokens.refreshToken);
      const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

      await query(
        `UPDATE calendar_connections 
        SET access_token = $1, refresh_token = $2, token_expiry = $3, updated_at = NOW()
        WHERE user_id = $4 AND provider = $5`,
        [encryptedAccessToken, encryptedRefreshToken, tokenExpiry, userId, provider]
      );

      logger.info('Calendar connection tokens updated:', { userId, provider });
    } catch (error) {
      logger.error('Error updating connection tokens:', error);
      throw new Error('Failed to update connection tokens');
    }
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(userId: string, provider: CalendarProvider): Promise<void> {
    try {
      await query(
        `UPDATE calendar_connections 
        SET last_sync_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
      );
    } catch (error) {
      logger.error('Error updating last sync:', error);
      throw new Error('Failed to update last sync');
    }
  }

  /**
   * Deactivate a calendar connection
   */
  async deactivateConnection(userId: string, provider: CalendarProvider): Promise<void> {
    try {
      await query(
        `UPDATE calendar_connections 
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
      );

      logger.info('Calendar connection deactivated:', { userId, provider });
    } catch (error) {
      logger.error('Error deactivating connection:', error);
      throw new Error('Failed to deactivate connection');
    }
  }

  /**
   * Delete a calendar connection
   */
  async deleteConnection(userId: string, provider: CalendarProvider): Promise<void> {
    try {
      await query(
        `DELETE FROM calendar_connections 
        WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
      );

      logger.info('Calendar connection deleted:', { userId, provider });
    } catch (error) {
      logger.error('Error deleting connection:', error);
      throw new Error('Failed to delete connection');
    }
  }

  /**
   * Get or create sync preferences
   */
  async getSyncPreferences(userId: string): Promise<SyncPreferences> {
    try {
      let result = await query(
        `SELECT * FROM calendar_sync_preferences WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default preferences
        result = await query(
          `INSERT INTO calendar_sync_preferences 
          (user_id, auto_sync_enabled, sync_interval, providers, sync_past_events, sync_future_events, days_in_past, days_in_future)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *`,
          [userId, true, 15, ['google'], false, true, 0, 90]
        );
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        autoSyncEnabled: row.auto_sync_enabled,
        syncInterval: row.sync_interval,
        providers: row.providers,
        syncPastEvents: row.sync_past_events,
        syncFutureEvents: row.sync_future_events,
        daysInPast: row.days_in_past,
        daysInFuture: row.days_in_future,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Error fetching sync preferences:', error);
      throw new Error('Failed to fetch sync preferences');
    }
  }

  /**
   * Update sync preferences
   */
  async updateSyncPreferences(
    userId: string,
    preferences: Partial<SyncPreferences>
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (preferences.autoSyncEnabled !== undefined) {
        updates.push(`auto_sync_enabled = $${paramIndex++}`);
        values.push(preferences.autoSyncEnabled);
      }
      if (preferences.syncInterval !== undefined) {
        updates.push(`sync_interval = $${paramIndex++}`);
        values.push(preferences.syncInterval);
      }
      if (preferences.providers !== undefined) {
        updates.push(`providers = $${paramIndex++}`);
        values.push(preferences.providers);
      }
      if (preferences.syncPastEvents !== undefined) {
        updates.push(`sync_past_events = $${paramIndex++}`);
        values.push(preferences.syncPastEvents);
      }
      if (preferences.syncFutureEvents !== undefined) {
        updates.push(`sync_future_events = $${paramIndex++}`);
        values.push(preferences.syncFutureEvents);
      }
      if (preferences.daysInPast !== undefined) {
        updates.push(`days_in_past = $${paramIndex++}`);
        values.push(preferences.daysInPast);
      }
      if (preferences.daysInFuture !== undefined) {
        updates.push(`days_in_future = $${paramIndex++}`);
        values.push(preferences.daysInFuture);
      }

      if (updates.length === 0) {
        return;
      }

      values.push(userId);

      await query(
        `UPDATE calendar_sync_preferences 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE user_id = $${paramIndex}`,
        values
      );

      logger.info('Sync preferences updated:', { userId });
    } catch (error) {
      logger.error('Error updating sync preferences:', error);
      throw new Error('Failed to update sync preferences');
    }
  }

  /**
   * Map database row to CalendarConnection
   */
  private mapToConnection(row: any): CalendarConnection {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      accessToken: decrypt(row.access_token),
      refreshToken: decrypt(row.refresh_token),
      tokenExpiry: row.token_expiry,
      calendarId: row.calendar_id,
      isActive: row.is_active,
      lastSyncAt: row.last_sync_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(connection: CalendarConnection): boolean {
    const expiryTime = new Date(connection.tokenExpiry).getTime();
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    return expiryTime - now < bufferTime;
  }
}

export default CalendarConnectionService;
