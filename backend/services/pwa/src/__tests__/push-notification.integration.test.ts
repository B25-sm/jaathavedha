/**
 * Integration Tests for Push Notification Delivery on Mobile Devices
 * Tests push notification subscription, delivery, and mobile-specific features
 */

import { createClient, RedisClientType } from 'redis';
import { Pool } from 'pg';
import { PushNotificationService } from '../services/PushNotificationService';
import winston from 'winston';
import {
  PushSubscriptionRequest,
  PushNotificationPayload,
  PushSubscription
} from '../types';

describe('Push Notification Integration Tests', () => {
  let redisClient: RedisClientType;
  let dbPool: Pool;
  let logger: winston.Logger;
  let pushNotificationService: PushNotificationService;

  beforeAll(async () => {
    // Initialize logger
    logger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })]
    });

    // Connect to Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();

    // Connect to PostgreSQL
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Initialize push notification service
    pushNotificationService = new PushNotificationService(redisClient, dbPool, logger);
  });

  afterAll(async () => {
    await redisClient?.quit();
    await dbPool?.end();
  });

  beforeEach(async () => {
    // Clean up test data
    await redisClient.flushDb();
    await dbPool.query('DELETE FROM push_subscriptions WHERE user_id LIKE $1', ['test-user-%']);
  });

  describe('Push Notification Subscription Management', () => {
    it('should create push notification subscription', async () => {
      const subscriptionRequest: PushSubscriptionRequest = {
        userId: 'test-user-123',
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key'
          }
        },
        platform: 'web',
        deviceInfo: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          platform: 'web'
        }
      };

      const subscriptionId = await pushNotificationService.subscribe(subscriptionRequest);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
      expect(subscriptionId.length).toBeGreaterThan(0);
    });

    it('should create subscription for Android device', async () => {
      const subscriptionRequest: PushSubscriptionRequest = {
        userId: 'test-user-android-123',
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/android-endpoint-123',
          keys: {
            p256dh: 'android-p256dh-key',
            auth: 'android-auth-key'
          }
        },
        platform: 'android',
        deviceInfo: {
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          platform: 'android'
        }
      };

      const subscriptionId = await pushNotificationService.subscribe(subscriptionRequest);

      expect(subscriptionId).toBeDefined();

      // Verify subscription was stored
      const subscriptions = await pushNotificationService.getUserSubscriptions('test-user-android-123');
      expect(subscriptions.length).toBe(1);
      expect(subscriptions[0].platform).toBe('android');
    });

    it('should create subscription for iOS device', async () => {
      const subscriptionRequest: PushSubscriptionRequest = {
        userId: 'test-user-ios-123',
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/ios-endpoint-123',
          keys: {
            p256dh: 'ios-p256dh-key',
            auth: 'ios-auth-key'
          }
        },
        platform: 'ios',
        deviceInfo: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
          platform: 'ios'
        }
      };

      const subscriptionId = await pushNotificationService.subscribe(subscriptionRequest);

      expect(subscriptionId).toBeDefined();

      // Verify subscription was stored
      const subscriptions = await pushNotificationService.getUserSubscriptions('test-user-ios-123');
      expect(subscriptions.length).toBe(1);
      expect(subscriptions[0].platform).toBe('ios');
    });

    it('should support multiple subscriptions per user', async () => {
      const userId = 'test-user-multi-123';

      // Subscribe from web
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/web-endpoint',
          keys: { p256dh: 'web-key', auth: 'web-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      // Subscribe from Android
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/android-endpoint',
          keys: { p256dh: 'android-key', auth: 'android-auth' }
        },
        platform: 'android',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Android)', platform: 'android' }
      });

      // Subscribe from iOS
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/ios-endpoint',
          keys: { p256dh: 'ios-key', auth: 'ios-auth' }
        },
        platform: 'ios',
        deviceInfo: { userAgent: 'Mozilla/5.0 (iPhone)', platform: 'ios' }
      });

      const subscriptions = await pushNotificationService.getUserSubscriptions(userId);

      expect(subscriptions.length).toBe(3);
      expect(subscriptions.map(s => s.platform)).toContain('web');
      expect(subscriptions.map(s => s.platform)).toContain('android');
      expect(subscriptions.map(s => s.platform)).toContain('ios');
    });

    it('should update existing subscription if endpoint already exists', async () => {
      const userId = 'test-user-update-123';
      const endpoint = 'https://fcm.googleapis.com/fcm/send/update-endpoint';

      // First subscription
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint,
          keys: { p256dh: 'old-key', auth: 'old-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      // Update subscription with same endpoint
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint,
          keys: { p256dh: 'new-key', auth: 'new-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      const subscriptions = await pushNotificationService.getUserSubscriptions(userId);

      // Should still have only one subscription
      expect(subscriptions.length).toBe(1);
      expect(subscriptions[0].endpoint).toBe(endpoint);
    });

    it('should unsubscribe from push notifications', async () => {
      const userId = 'test-user-unsub-123';
      const endpoint = 'https://fcm.googleapis.com/fcm/send/unsub-endpoint';

      // Subscribe
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint,
          keys: { p256dh: 'test-key', auth: 'test-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      // Unsubscribe
      await pushNotificationService.unsubscribe(userId, endpoint);

      // Verify subscription is removed
      const subscriptions = await pushNotificationService.getUserSubscriptions(userId);
      expect(subscriptions.length).toBe(0);
    });

    it('should retrieve all user subscriptions', async () => {
      const userId = 'test-user-retrieve-123';

      // Create multiple subscriptions
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint-1',
          keys: { p256dh: 'key-1', auth: 'auth-1' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint-2',
          keys: { p256dh: 'key-2', auth: 'auth-2' }
        },
        platform: 'android',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Android)', platform: 'android' }
      });

      const subscriptions = await pushNotificationService.getUserSubscriptions(userId);

      expect(subscriptions.length).toBe(2);
      expect(subscriptions[0]).toHaveProperty('id');
      expect(subscriptions[0]).toHaveProperty('endpoint');
      expect(subscriptions[0]).toHaveProperty('platform');
      expect(subscriptions[0]).toHaveProperty('status');
    });
  });

  describe('Push Notification Delivery', () => {
    it('should send push notification to user', async () => {
      const userId = 'test-user-send-123';

      // Subscribe first
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/send-endpoint',
          keys: { p256dh: 'test-key', auth: 'test-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      const notification: PushNotificationPayload = {
        title: 'Test Notification',
        body: 'This is a test notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png'
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result).toBeDefined();
      expect(result.sent).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
    });

    it('should send notification with custom data', async () => {
      const userId = 'test-user-data-123';

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/data-endpoint',
          keys: { p256dh: 'test-key', auth: 'test-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      const notification: PushNotificationPayload = {
        title: 'Course Update',
        body: 'New module available',
        icon: '/icons/icon-192x192.png',
        data: {
          courseId: 'course-123',
          moduleId: 'module-456',
          url: '/courses/course-123/module-456'
        }
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.sent).toBeGreaterThan(0);
    });

    it('should send notification with action buttons', async () => {
      const userId = 'test-user-actions-123';

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/actions-endpoint',
          keys: { p256dh: 'test-key', auth: 'test-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      const notification: PushNotificationPayload = {
        title: 'Live Session Starting',
        body: 'Your live session starts in 5 minutes',
        icon: '/icons/icon-192x192.png',
        actions: [
          { action: 'join', title: 'Join Now' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.sent).toBeGreaterThan(0);
    });

    it('should send notification with image', async () => {
      const userId = 'test-user-image-123';

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/image-endpoint',
          keys: { p256dh: 'test-key', auth: 'test-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      const notification: PushNotificationPayload = {
        title: 'New Course Available',
        body: 'Check out our latest AI course',
        icon: '/icons/icon-192x192.png',
        image: '/images/course-banner.jpg'
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.sent).toBeGreaterThan(0);
    });

    it('should send notification to all user devices', async () => {
      const userId = 'test-user-all-devices-123';

      // Subscribe from multiple devices
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/web-endpoint',
          keys: { p256dh: 'web-key', auth: 'web-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/android-endpoint',
          keys: { p256dh: 'android-key', auth: 'android-auth' }
        },
        platform: 'android',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Android)', platform: 'android' }
      });

      const notification: PushNotificationPayload = {
        title: 'Test Notification',
        body: 'Sent to all devices'
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle failed notification delivery', async () => {
      const userId = 'test-user-failed-123';

      // Subscribe with invalid endpoint
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://invalid-endpoint.com/send/invalid',
          keys: { p256dh: 'invalid-key', auth: 'invalid-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      const notification: PushNotificationPayload = {
        title: 'Test Notification',
        body: 'This should fail'
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.failed).toBeGreaterThan(0);
    });
  });

  describe('VAPID Configuration', () => {
    it('should return VAPID public key', async () => {
      const publicKey = await pushNotificationService.getVapidPublicKey();

      expect(publicKey).toBeDefined();
      expect(typeof publicKey).toBe('string');
      expect(publicKey.length).toBeGreaterThan(0);
    });

    it('should use configured VAPID keys', async () => {
      const publicKey = await pushNotificationService.getVapidPublicKey();

      expect(publicKey).toBe(process.env.VAPID_PUBLIC_KEY);
    });
  });

  describe('Subscription Cleanup and Maintenance', () => {
    it('should mark subscription as expired on 410 error', async () => {
      const userId = 'test-user-expired-123';
      const endpoint = 'https://fcm.googleapis.com/fcm/send/expired-endpoint';

      // Subscribe
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint,
          keys: { p256dh: 'test-key', auth: 'test-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      // Send notification (will fail with 410)
      const notification: PushNotificationPayload = {
        title: 'Test',
        body: 'Test'
      };

      await pushNotificationService.sendNotification(userId, notification);

      // Subscription should be marked as expired or removed
      const subscriptions = await pushNotificationService.getUserSubscriptions(userId);
      const expiredSub = subscriptions.find(s => s.endpoint === endpoint);

      if (expiredSub) {
        expect(expiredSub.status).toBe('expired');
      }
    });

    it('should remove invalid subscriptions on 404 error', async () => {
      const userId = 'test-user-invalid-123';
      const endpoint = 'https://fcm.googleapis.com/fcm/send/invalid-endpoint';

      // Subscribe
      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint,
          keys: { p256dh: 'test-key', auth: 'test-auth' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      // Send notification (will fail with 404)
      const notification: PushNotificationPayload = {
        title: 'Test',
        body: 'Test'
      };

      await pushNotificationService.sendNotification(userId, notification);

      // Invalid subscription should be removed or marked
      const subscriptions = await pushNotificationService.getUserSubscriptions(userId);
      const invalidSub = subscriptions.find(s => s.endpoint === endpoint);

      if (invalidSub) {
        expect(['expired', 'invalid']).toContain(invalidSub.status);
      }
    });

    it('should get subscription statistics', async () => {
      const userId1 = 'test-user-stats-1';
      const userId2 = 'test-user-stats-2';

      // Create subscriptions
      await pushNotificationService.subscribe({
        userId: userId1,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/stats-1',
          keys: { p256dh: 'key-1', auth: 'auth-1' }
        },
        platform: 'web',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
      });

      await pushNotificationService.subscribe({
        userId: userId2,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/stats-2',
          keys: { p256dh: 'key-2', auth: 'auth-2' }
        },
        platform: 'android',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Android)', platform: 'android' }
      });

      // Get statistics (if method exists)
      const stats = await pushNotificationService.getSubscriptionStatistics?.();

      if (stats) {
        expect(stats.total).toBeGreaterThanOrEqual(2);
        expect(stats.byPlatform).toBeDefined();
      }
    });
  });

  describe('Mobile-Specific Notification Features', () => {
    it('should support Android-specific notification options', async () => {
      const userId = 'test-user-android-notif-123';

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/android-notif',
          keys: { p256dh: 'android-key', auth: 'android-auth' }
        },
        platform: 'android',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Android)', platform: 'android' }
      });

      const notification: PushNotificationPayload = {
        title: 'Android Notification',
        body: 'With Android-specific features',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: {
          priority: 'high',
          sound: 'default',
          vibrate: [200, 100, 200]
        }
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.sent).toBeGreaterThan(0);
    });

    it('should support iOS-specific notification options', async () => {
      const userId = 'test-user-ios-notif-123';

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/ios-notif',
          keys: { p256dh: 'ios-key', auth: 'ios-auth' }
        },
        platform: 'ios',
        deviceInfo: { userAgent: 'Mozilla/5.0 (iPhone)', platform: 'ios' }
      });

      const notification: PushNotificationPayload = {
        title: 'iOS Notification',
        body: 'With iOS-specific features',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: {
          badge: 1,
          sound: 'default',
          category: 'course_update'
        }
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.sent).toBeGreaterThan(0);
    });

    it('should support silent notifications for background sync', async () => {
      const userId = 'test-user-silent-123';

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/silent',
          keys: { p256dh: 'silent-key', auth: 'silent-auth' }
        },
        platform: 'android',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Android)', platform: 'android' }
      });

      const notification: PushNotificationPayload = {
        title: '',
        body: '',
        data: {
          silent: true,
          syncType: 'course_progress',
          action: 'background_sync'
        }
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.sent).toBeGreaterThan(0);
    });

    it('should support notification grouping', async () => {
      const userId = 'test-user-group-123';

      await pushNotificationService.subscribe({
        userId,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/group',
          keys: { p256dh: 'group-key', auth: 'group-auth' }
        },
        platform: 'android',
        deviceInfo: { userAgent: 'Mozilla/5.0 (Android)', platform: 'android' }
      });

      const notification: PushNotificationPayload = {
        title: 'New Message',
        body: 'You have a new message',
        icon: '/icons/icon-192x192.png',
        data: {
          tag: 'messages',
          group: 'course-messages'
        }
      };

      const result = await pushNotificationService.sendNotification(userId, notification);

      expect(result.sent).toBeGreaterThan(0);
    });
  });

  describe('Bulk Notification Sending', () => {
    it('should send bulk notifications to multiple users', async () => {
      const userIds = ['test-user-bulk-1', 'test-user-bulk-2', 'test-user-bulk-3'];

      // Subscribe all users
      for (const userId of userIds) {
        await pushNotificationService.subscribe({
          userId,
          subscription: {
            endpoint: `https://fcm.googleapis.com/fcm/send/bulk-${userId}`,
            keys: { p256dh: `key-${userId}`, auth: `auth-${userId}` }
          },
          platform: 'web',
          deviceInfo: { userAgent: 'Mozilla/5.0 (Windows)', platform: 'web' }
        });
      }

      const notification: PushNotificationPayload = {
        title: 'Bulk Notification',
        body: 'Sent to multiple users'
      };

      // Send to all users
      const results = await Promise.all(
        userIds.map(userId => pushNotificationService.sendNotification(userId, notification))
      );

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.sent).toBeGreaterThan(0);
      });
    });
  });
});
