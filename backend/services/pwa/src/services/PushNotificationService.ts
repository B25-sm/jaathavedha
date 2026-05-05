import { Logger } from 'winston';
import { RedisClientType } from 'redis';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import webpush from 'web-push';
import {
  PushSubscription,
  PushSubscriptionRequest
} from '../types';

/**
 * Push Notification Service
 * Manages push notification subscriptions and delivery for PWA
 */
export class PushNotificationService {
  private redis: RedisClientType;
  private db: Pool;
  private logger: Logger;

  constructor(redis: RedisClientType, db: Pool, logger: Logger) {
    this.redis = redis;
    this.db = db;
    this.logger = logger;

    // Configure web-push with VAPID keys
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@saimahendra.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
      );
      this.logger.info('Web Push configured with VAPID keys');
    } else {
      this.logger.warn('VAPID keys not configured - push notifications will not work');
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribe(request: PushSubscriptionRequest): Promise<string> {
    try {
      const subscriptionId = uuidv4();
      const now = new Date();

      // Store subscription in database
      await this.db.query(
        `INSERT INTO push_subscriptions 
         (id, user_id, endpoint, p256dh_key, auth_key, platform, user_agent, created_at, updated_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, endpoint) 
         DO UPDATE SET 
           p256dh_key = $4,
           auth_key = $5,
           platform = $6,
           user_agent = $7,
           updated_at = $9,
           is_active = $10
         RETURNING id`,
        [
          subscriptionId,
          request.userId,
          request.subscription.endpoint,
          request.subscription.keys.p256dh,
          request.subscription.keys.auth,
          request.platform,
          request.userAgent || null,
          now,
          now,
          true
        ]
      );

      // Cache subscription in Redis for quick access
      const cacheKey = `push:subscription:${request.userId}:${request.subscription.endpoint}`;
      await this.redis.setEx(
        cacheKey,
        3600 * 24 * 7, // 7 days
        JSON.stringify({
          id: subscriptionId,
          ...request
        })
      );

      this.logger.info('Push subscription created', {
        subscriptionId,
        userId: request.userId,
        platform: request.platform
      });

      return subscriptionId;
    } catch (error: any) {
      this.logger.error('Error creating push subscription', {
        error: error.message,
        userId: request.userId
      });
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    try {
      // Mark subscription as inactive in database
      await this.db.query(
        `UPDATE push_subscriptions 
         SET is_active = false, updated_at = NOW() 
         WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint]
      );

      // Remove from Redis cache
      const cacheKey = `push:subscription:${userId}:${endpoint}`;
      await this.redis.del(cacheKey);

      this.logger.info('Push subscription removed', { userId, endpoint });
    } catch (error: any) {
      this.logger.error('Error removing push subscription', {
        error: error.message,
        userId,
        endpoint
      });
      throw error;
    }
  }

  /**
   * Get all active subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    try {
      const result = await this.db.query(
        `SELECT id, user_id, endpoint, p256dh_key, auth_key, platform, user_agent, created_at, updated_at, is_active
         FROM push_subscriptions
         WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh_key,
          auth: row.auth_key
        },
        platform: row.platform,
        userAgent: row.user_agent,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isActive: row.is_active
      }));
    } catch (error: any) {
      this.logger.error('Error getting user subscriptions', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Send push notification to user
   */
  async sendNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: any;
      icon?: string;
      badge?: string;
      image?: string;
      actions?: Array<{ action: string; title: string; icon?: string }>;
    }
  ): Promise<{ sent: number; failed: number }> {
    try {
      const subscriptions = await this.getUserSubscriptions(userId);

      if (subscriptions.length === 0) {
        this.logger.warn('No active subscriptions found for user', { userId });
        return { sent: 0, failed: 0 };
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: notification.badge || '/icons/badge-72x72.png',
        image: notification.image,
        actions: notification.actions || [],
        timestamp: Date.now(),
        tag: `notification-${Date.now()}`
      });

      let sent = 0;
      let failed = 0;

      // Send to all user subscriptions
      const sendPromises = subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth
            }
          };

          await webpush.sendNotification(pushSubscription, payload);
          sent++;

          this.logger.info('Push notification sent', {
            userId,
            subscriptionId: subscription.id,
            platform: subscription.platform
          });
        } catch (error: any) {
          failed++;

          // Handle expired or invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            this.logger.warn('Subscription expired or invalid, removing', {
              userId,
              subscriptionId: subscription.id,
              endpoint: subscription.endpoint
            });

            await this.unsubscribe(userId, subscription.endpoint);
          } else {
            this.logger.error('Error sending push notification', {
              error: error.message,
              userId,
              subscriptionId: subscription.id
            });
          }
        }
      });

      await Promise.all(sendPromises);

      this.logger.info('Push notification batch completed', {
        userId,
        sent,
        failed,
        total: subscriptions.length
      });

      return { sent, failed };
    } catch (error: any) {
      this.logger.error('Error sending push notifications', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendBulkNotification(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: any;
      icon?: string;
      badge?: string;
      image?: string;
      actions?: Array<{ action: string; title: string; icon?: string }>;
    }
  ): Promise<{ totalSent: number; totalFailed: number; userResults: any[] }> {
    try {
      const userResults = [];
      let totalSent = 0;
      let totalFailed = 0;

      for (const userId of userIds) {
        const result = await this.sendNotification(userId, notification);
        totalSent += result.sent;
        totalFailed += result.failed;

        userResults.push({
          userId,
          sent: result.sent,
          failed: result.failed
        });
      }

      this.logger.info('Bulk push notification completed', {
        totalUsers: userIds.length,
        totalSent,
        totalFailed
      });

      return { totalSent, totalFailed, userResults };
    } catch (error: any) {
      this.logger.error('Error sending bulk push notifications', {
        error: error.message,
        userCount: userIds.length
      });
      throw error;
    }
  }

  /**
   * Get VAPID public key for client-side subscription
   */
  async getVapidPublicKey(): Promise<string> {
    const publicKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error('VAPID public key not configured');
    }

    return publicKey;
  }

  /**
   * Clean up expired subscriptions
   */
  async cleanupExpiredSubscriptions(): Promise<number> {
    try {
      // Remove subscriptions that haven't been updated in 90 days
      const result = await this.db.query(
        `DELETE FROM push_subscriptions 
         WHERE updated_at < NOW() - INTERVAL '90 days'
         RETURNING id`,
        []
      );

      const deletedCount = result.rowCount || 0;

      this.logger.info('Expired subscriptions cleaned up', { deletedCount });

      return deletedCount;
    } catch (error: any) {
      this.logger.error('Error cleaning up expired subscriptions', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats(): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT 
           COUNT(*) as total_subscriptions,
           COUNT(DISTINCT user_id) as unique_users,
           COUNT(*) FILTER (WHERE platform = 'web') as web_subscriptions,
           COUNT(*) FILTER (WHERE platform = 'android') as android_subscriptions,
           COUNT(*) FILTER (WHERE platform = 'ios') as ios_subscriptions,
           COUNT(*) FILTER (WHERE is_active = true) as active_subscriptions,
           COUNT(*) FILTER (WHERE is_active = false) as inactive_subscriptions
         FROM push_subscriptions`,
        []
      );

      return result.rows[0];
    } catch (error: any) {
      this.logger.error('Error getting subscription stats', {
        error: error.message
      });
      throw error;
    }
  }
}
