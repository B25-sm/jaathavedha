/**
 * Push Notification Service
 * Handles mobile push notifications via Firebase Cloud Messaging (FCM) and APNS
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import * as admin from 'firebase-admin';
import { SendNotificationRequest, NotificationSubscription, PushNotification } from '../types';

export class PushNotificationService {
  private db: Pool;
  private redis: Redis;
  private fcmInitialized: boolean = false;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    try {
      if (!admin.apps.length) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        
        if (serviceAccount) {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
          });
          this.fcmInitialized = true;
        } else {
          console.warn('Firebase service account not configured. Push notifications will be disabled.');
        }
      } else {
        this.fcmInitialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      this.fcmInitialized = false;
    }
  }

  /**
   * Register device for push notifications
   */
  async registerDevice(
    userId: string,
    deviceId: string,
    deviceToken: string,
    platform: 'ios' | 'android' | 'web',
    deviceInfo?: any
  ): Promise<any> {
    // Store device token
    const result = await this.db.query(
      `INSERT INTO user_devices 
       (user_id, device_id, device_type, device_name, os_version, app_version, 
        ${platform === 'ios' ? 'apns_token' : 'fcm_token'}, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (user_id, device_id) 
       DO UPDATE SET 
         ${platform === 'ios' ? 'apns_token' : 'fcm_token'} = EXCLUDED.${platform === 'ios' ? 'apns_token' : 'fcm_token'},
         is_active = true,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        deviceId,
        platform,
        deviceInfo?.deviceName || 'Unknown Device',
        deviceInfo?.osVersion || 'Unknown',
        deviceInfo?.appVersion || '1.0.0',
        deviceToken,
      ]
    );

    // Create default notification subscription
    await this.db.query(
      `INSERT INTO notification_subscriptions 
       (user_id, device_id, enabled)
       VALUES ($1, $2, true)
       ON CONFLICT (user_id, device_id) DO NOTHING`,
      [userId, deviceId]
    );

    return {
      userId,
      deviceId,
      deviceToken,
      platform,
      registeredAt: new Date(),
      success: true,
    };
  }

  /**
   * Unregister device
   */
  async unregisterDevice(userId: string, deviceId: string): Promise<void> {
    await this.db.query(
      `UPDATE user_devices SET is_active = false WHERE user_id = $1 AND device_id = $2`,
      [userId, deviceId]
    );
  }

  /**
   * Send push notification to user
   */
  async sendNotification(
    userId: string,
    notification: SendNotificationRequest
  ): Promise<PushNotification> {
    const {
      title,
      body,
      data = {},
      imageUrl,
      actionUrl,
      category,
      priority = 'normal',
      scheduledFor,
    } = notification;

    // Store notification in database
    const result = await this.db.query(
      `INSERT INTO push_notifications 
       (user_id, title, body, data, image_url, action_url, category, priority, 
        scheduled_for, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        title,
        body,
        data,
        imageUrl,
        actionUrl,
        category,
        priority,
        scheduledFor || null,
        scheduledFor ? 'scheduled' : 'sent',
      ]
    );

    const notificationRecord = result.rows[0];

    // If not scheduled, send immediately
    if (!scheduledFor) {
      await this.sendImmediately(notificationRecord.id, userId, {
        title,
        body,
        data,
        imageUrl,
        actionUrl,
        category,
        priority,
      });
    }

    return {
      id: notificationRecord.id,
      userId,
      title,
      body,
      data,
      imageUrl,
      actionUrl,
      category,
      priority,
      scheduledFor,
      status: notificationRecord.status,
      createdAt: notificationRecord.created_at,
    };
  }

  /**
   * Send notification immediately
   */
  private async sendImmediately(
    notificationId: string,
    userId: string,
    notification: any
  ): Promise<void> {
    if (!this.fcmInitialized) {
      console.warn('Firebase not initialized. Skipping notification send.');
      await this.db.query(
        `UPDATE push_notifications SET status = 'failed' WHERE id = $1`,
        [notificationId]
      );
      return;
    }

    // Get user's active devices with tokens
    const devicesResult = await this.db.query(
      `SELECT ud.device_id, ud.device_type, ud.fcm_token, ud.apns_token, ns.enabled, 
              ns.quiet_hours_start, ns.quiet_hours_end, ns.categories
       FROM user_devices ud
       LEFT JOIN notification_subscriptions ns ON ud.user_id = ns.user_id AND ud.device_id = ns.device_id
       WHERE ud.user_id = $1 AND ud.is_active = true 
         AND (ud.fcm_token IS NOT NULL OR ud.apns_token IS NOT NULL)`,
      [userId]
    );

    const devices = devicesResult.rows;

    if (devices.length === 0) {
      await this.db.query(
        `UPDATE push_notifications SET status = 'failed' WHERE id = $1`,
        [notificationId]
      );
      return;
    }

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    for (const device of devices) {
      // Check if notifications are enabled
      if (!device.enabled) {
        continue;
      }

      // Check quiet hours
      if (this.isQuietHours(device.quiet_hours_start, device.quiet_hours_end)) {
        continue;
      }

      // Check if category is subscribed
      if (device.categories && !device.categories.includes(notification.category)) {
        continue;
      }

      const token = device.fcm_token || device.apns_token;

      try {
        const message: admin.messaging.Message = {
          token,
          notification: {
            title: notification.title,
            body: notification.body,
            imageUrl: notification.imageUrl,
          },
          data: {
            ...notification.data,
            actionUrl: notification.actionUrl || '',
            category: notification.category,
            notificationId,
          },
          android: {
            priority: notification.priority === 'high' ? 'high' : 'normal',
            notification: {
              channelId: notification.category,
              priority: notification.priority === 'high' ? 'high' : 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: notification.title,
                  body: notification.body,
                },
                sound: 'default',
                badge: 1,
              },
            },
          },
        };

        const response = await admin.messaging().send(message);
        sentCount++;
        deliveredCount++;
      } catch (error: any) {
        console.error(`Failed to send notification to device ${device.device_id}:`, error);
        failedCount++;

        // If token is invalid, deactivate device
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          await this.db.query(
            `UPDATE user_devices SET is_active = false WHERE device_id = $1`,
            [device.device_id]
          );
        }
      }
    }

    // Update notification status
    await this.db.query(
      `UPDATE push_notifications 
       SET status = 'sent', 
           sent_at = NOW(),
           delivery_stats = jsonb_build_object(
             'sent', $2,
             'delivered', $3,
             'failed', $4,
             'opened', 0
           )
       WHERE id = $1`,
      [notificationId, sentCount, deliveredCount, failedCount]
    );
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    userIds: string[],
    notification: SendNotificationRequest
  ): Promise<any> {
    const results = [];

    for (const userId of userIds) {
      try {
        const result = await this.sendNotification(userId, notification);
        results.push({ userId, success: true, notificationId: result.id });
      } catch (error: any) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    return {
      total: userIds.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Get notification preferences
   */
  async getPreferences(userId: string, deviceId: string): Promise<NotificationSubscription> {
    const result = await this.db.query(
      `SELECT * FROM notification_subscriptions 
       WHERE user_id = $1 AND device_id = $2`,
      [userId, deviceId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return {
        userId,
        deviceId,
        categories: ['course_update', 'assignment', 'live_session', 'achievement', 'reminder', 'general'],
        enabled: true,
      };
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      deviceId: row.device_id,
      categories: row.categories,
      enabled: row.enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      timezone: row.timezone,
    };
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    deviceId: string,
    preferences: Partial<NotificationSubscription>
  ): Promise<NotificationSubscription> {
    const { categories, enabled, quietHoursStart, quietHoursEnd, timezone } = preferences;

    const result = await this.db.query(
      `INSERT INTO notification_subscriptions 
       (user_id, device_id, categories, enabled, quiet_hours_start, quiet_hours_end, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, device_id) 
       DO UPDATE SET 
         categories = COALESCE(EXCLUDED.categories, notification_subscriptions.categories),
         enabled = COALESCE(EXCLUDED.enabled, notification_subscriptions.enabled),
         quiet_hours_start = COALESCE(EXCLUDED.quiet_hours_start, notification_subscriptions.quiet_hours_start),
         quiet_hours_end = COALESCE(EXCLUDED.quiet_hours_end, notification_subscriptions.quiet_hours_end),
         timezone = COALESCE(EXCLUDED.timezone, notification_subscriptions.timezone),
         updated_at = NOW()
       RETURNING *`,
      [userId, deviceId, categories, enabled, quietHoursStart, quietHoursEnd, timezone]
    );

    const row = result.rows[0];
    return {
      userId: row.user_id,
      deviceId: row.device_id,
      categories: row.categories,
      enabled: row.enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      timezone: row.timezone,
    };
  }

  /**
   * Track notification opened
   */
  async trackNotificationOpened(notificationId: string): Promise<void> {
    await this.db.query(
      `UPDATE push_notifications 
       SET delivery_stats = jsonb_set(
         delivery_stats,
         '{opened}',
         to_jsonb((delivery_stats->>'opened')::int + 1)
       )
       WHERE id = $1`,
      [notificationId]
    );
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(userId: string, limit: number = 50): Promise<PushNotification[]> {
    const result = await this.db.query(
      `SELECT * FROM push_notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      deviceIds: row.device_ids,
      title: row.title,
      body: row.body,
      data: row.data,
      imageUrl: row.image_url,
      actionUrl: row.action_url,
      category: row.category,
      priority: row.priority,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      status: row.status,
      deliveryStats: row.delivery_stats,
      createdAt: row.created_at,
    }));
  }

  /**
   * Check if current time is in quiet hours
   */
  private isQuietHours(start?: string, end?: string): boolean {
    if (!start || !end) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications(): Promise<void> {
    const result = await this.db.query(
      `SELECT * FROM push_notifications 
       WHERE status = 'scheduled' AND scheduled_for <= NOW()
       ORDER BY scheduled_for ASC
       LIMIT 100`
    );

    for (const notification of result.rows) {
      await this.sendImmediately(notification.id, notification.user_id, {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        imageUrl: notification.image_url,
        actionUrl: notification.action_url,
        category: notification.category,
        priority: notification.priority,
      });
    }
  }
}
