import { DatabaseUtils } from '@sai-mahendra/utils';
import { createClient, RedisClientType } from 'redis';

export interface RefreshTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
}

export class RefreshTokenModel {
  private static redisClient: RedisClientType;

  /**
   * Initialize Redis client for session management
   */
  static async initializeRedis(): Promise<void> {
    if (!this.redisClient) {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error', err);
      });

      await this.redisClient.connect();
    }
  }

  /**
   * Store refresh token in database
   */
  static async create(userId: string, tokenHash: string, expiresAt: Date): Promise<RefreshTokenData> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, token_hash, expires_at, created_at
    `;

    const result = await DatabaseUtils.query(query, [userId, tokenHash, expiresAt]);
    return this.mapRowToRefreshToken(result.rows[0]);
  }

  /**
   * Find refresh token by hash
   */
  static async findByTokenHash(tokenHash: string): Promise<RefreshTokenData | null> {
    const query = `
      SELECT id, user_id, token_hash, expires_at, created_at, revoked_at
      FROM refresh_tokens
      WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL
    `;

    const result = await DatabaseUtils.query(query, [tokenHash]);
    return result.rows.length > 0 ? this.mapRowToRefreshToken(result.rows[0]) : null;
  }

  /**
   * Revoke refresh token
   */
  static async revoke(tokenHash: string): Promise<boolean> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = $1 AND revoked_at IS NULL
    `;

    const result = await DatabaseUtils.query(query, [tokenHash]);
    return result.rowCount > 0;
  }

  /**
   * Revoke all refresh tokens for a user
   */
  static async revokeAllForUser(userId: string): Promise<number> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL
    `;

    const result = await DatabaseUtils.query(query, [userId]);
    return result.rowCount;
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpired(): Promise<number> {
    const query = `
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days'
    `;

    const result = await DatabaseUtils.query(query);
    return result.rowCount;
  }

  /**
   * Store session data in Redis
   */
  static async storeSession(userId: string, sessionData: any, ttlSeconds: number = 3600): Promise<void> {
    await this.initializeRedis();
    const key = `session:${userId}`;
    await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(sessionData));
  }

  /**
   * Get session data from Redis
   */
  static async getSession(userId: string): Promise<any | null> {
    await this.initializeRedis();
    const key = `session:${userId}`;
    const data = await this.redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete session from Redis
   */
  static async deleteSession(userId: string): Promise<void> {
    await this.initializeRedis();
    const key = `session:${userId}`;
    await this.redisClient.del(key);
  }

  /**
   * Store blacklisted token in Redis (for logout)
   */
  static async blacklistToken(tokenId: string, ttlSeconds: number): Promise<void> {
    await this.initializeRedis();
    const key = `blacklist:${tokenId}`;
    await this.redisClient.setEx(key, ttlSeconds, 'true');
  }

  /**
   * Check if token is blacklisted
   */
  static async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    await this.initializeRedis();
    const key = `blacklist:${tokenId}`;
    const result = await this.redisClient.get(key);
    return result === 'true';
  }

  /**
   * Store rate limiting data
   */
  static async incrementRateLimit(identifier: string, windowSeconds: number): Promise<number> {
    await this.initializeRedis();
    const key = `rate_limit:${identifier}`;
    
    const multi = this.redisClient.multi();
    multi.incr(key);
    multi.expire(key, windowSeconds);
    
    const results = await multi.exec();
    return results[0] as number;
  }

  /**
   * Get current rate limit count
   */
  static async getRateLimitCount(identifier: string): Promise<number> {
    await this.initializeRedis();
    const key = `rate_limit:${identifier}`;
    const count = await this.redisClient.get(key);
    return count ? parseInt(count) : 0;
  }

  /**
   * Store failed login attempts
   */
  static async recordFailedLogin(email: string): Promise<number> {
    await this.initializeRedis();
    const key = `failed_login:${email}`;
    const count = await this.incrementRateLimit(email, 900); // 15 minutes
    return count;
  }

  /**
   * Get failed login attempts count
   */
  static async getFailedLoginCount(email: string): Promise<number> {
    return this.getRateLimitCount(`failed_login:${email}`);
  }

  /**
   * Clear failed login attempts
   */
  static async clearFailedLogins(email: string): Promise<void> {
    await this.initializeRedis();
    const key = `failed_login:${email}`;
    await this.redisClient.del(key);
  }

  /**
   * Store password reset attempt
   */
  static async recordPasswordResetAttempt(email: string): Promise<number> {
    return this.incrementRateLimit(`password_reset:${email}`, 3600); // 1 hour
  }

  /**
   * Get password reset attempts count
   */
  static async getPasswordResetAttempts(email: string): Promise<number> {
    return this.getRateLimitCount(`password_reset:${email}`);
  }

  /**
   * Map database row to RefreshTokenData
   */
  private static mapRowToRefreshToken(row: any): RefreshTokenData {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined
    };
  }
}