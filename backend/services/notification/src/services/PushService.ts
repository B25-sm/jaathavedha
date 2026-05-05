import admin from 'firebase-admin';
import { Logger } from 'winston';
import { RedisClientType } from 'redis';
import { PushNotification, NotificationStatus } from '../types';

export class PushService {
  private isInitialized: boolean = false;

  constructor(
    private redisClient: RedisClientType,
    private logger: Logger
  ) {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    try {
      if (admin.apps.length > 0) {
        this.isInitialized = true;
        this.logger.info('Firebase Admin already initialized');
        return;
      }

      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn('Firebase credentials not configured');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      });

      this.isInitialized = true;
      this.logger.info('Firebase Admin initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin', { error });
      this.isInitialized = false;
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendPushNotification(
    notification: PushNotification
  ): Promise<{ successCount: number; failureCount: number; responses: any[] }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Firebase Admin not initialized');
      }

      if (!notification.tokens || notification.tokens.length === 0) {
        throw new Error('No device tokens provided');
      }

      // Prepare FCM message
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: notification.data || {},
        tokens: notification.tokens,
        android: {
          priority: 'high',
          notification: {
            sound: notification.sound || 'default',
            clickAction: notification.clickAction,
            channelId: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              badge: notification.badge,
              contentAvailable: true
            }
          }
        },
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [200, 100, 200]
          },
          fcmOptions: {
            link: notification.clickAction
          }
        }
      };

      // Send multicast message
      const response = await admin.messaging().sendMulticast(message);

      this.logger.info('Push notifications sent', {
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalTokens: notification.tokens.length
      });

      // Handle failed tokens
      if (response.failureCount > 0) {
        await this.handleFailedTokens(notification.tokens, response.responses);
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses
      };
    } catch (error: any) {
      this.logger.error('Failed to send push notification', {
        error: error.message,
        tokens: notification.tokens?.length
      });
      throw error;
    }
  }

  /**
   * Send push notification to a topic
   */
  async sendToTopic(
    topic: string,
    notification: Omit<PushNotification, 'tokens'>
  ): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Firebase Admin not initialized');
      }

      const message: admin.messaging.Message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: notification.data || {},
        topic,
        android: {
          priority: 'high',
          notification: {
            sound: notification.sound || 'default',
            clickAction: notification.clickAction
          }
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              badge: notification.badge
            }
          }
        }
      };

      const messageId = await admin.messaging().send(message);

      this.logger.info('Push notification sent to topic', { topic, messageId });

      return { messageId };
    } catch (error: any) {
      this.logger.error('Failed to send push to topic', {
        error: error.message,
        topic
      });
      throw error;
    }
  }

  /**
   * Subscribe device tokens to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Firebase Admin not initialized');
      }

      const response = await admin.messaging().subscribeToTopic(tokens, topic);

      this.logger.info('Tokens subscribed to topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      if (response.failureCount > 0) {
        this.logger.warn('Some tokens failed to subscribe', {
          topic,
          errors: response.errors
        });
      }
    } catch (error) {
      this.logger.error('Failed to subscribe to topic', { error, topic });
      throw error;
    }
  }

  /**
   * Unsubscribe device tokens from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Firebase Admin not initialized');
      }

      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);

      this.logger.info('Tokens unsubscribed from topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      });
    } catch (error) {
      this.logger.error('Failed to unsubscribe from topic', { error, topic });
      throw error;
    }
  }

  /**
   * Register device token for a user
   */
  async registerDeviceToken(userId: string, token: string, platform: 'web' | 'ios' | 'android'): Promise<void> {
    try {
      const tokenKey = `user:${userId}:push_tokens`;
      const tokenData = {
        token,
        platform,
        registeredAt: new Date().toISOString()
      };

      await this.redisClient.hSet(tokenKey, token, JSON.stringify(tokenData));
      await this.redisClient.expire(tokenKey, 90 * 24 * 60 * 60); // 90 days

      this.logger.info('Device token registered', { userId, platform });
    } catch (error) {
      this.logger.error('Failed to register device token', { error, userId });
      throw error;
    }
  }

  /**
   * Get user's device tokens
   */
  async getUserTokens(userId: string): Promise<string[]> {
    try {
      const tokenKey = `user:${userId}:push_tokens`;
      const tokens = await this.redisClient.hGetAll(tokenKey);

      if (!tokens || Object.keys(tokens).length === 0) {
        return [];
      }

      // Return only the token strings
      return Object.keys(tokens);
    } catch (error) {
      this.logger.error('Failed to get user tokens', { error, userId });
      return [];
    }
  }

  /**
   * Remove device token
   */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    try {
      const tokenKey = `user:${userId}:push_tokens`;
      await this.redisClient.hDel(tokenKey, token);

      this.logger.info('Device token removed', { userId, token });
    } catch (error) {
      this.logger.error('Failed to remove device token', { error, userId });
      throw error;
    }
  }

  /**
   * Handle failed tokens (invalid or unregistered)
   */
  private async handleFailedTokens(
    tokens: string[],
    responses: admin.messaging.SendResponse[]
  ): Promise<void> {
    try {
      const failedTokens: string[] = [];

      responses.forEach((response, index) => {
        if (!response.success) {
          const error = response.error;
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokens[index]);
          }
        }
      });

      if (failedTokens.length > 0) {
        // Store failed tokens for cleanup
        const failedKey = 'push:failed_tokens';
        await this.redisClient.sAdd(failedKey, failedTokens);
        await this.redisClient.expire(failedKey, 7 * 24 * 60 * 60); // 7 days

        this.logger.info('Failed tokens recorded for cleanup', {
          count: failedTokens.length
        });
      }
    } catch (error) {
      this.logger.error('Error handling failed tokens', { error });
    }
  }

  /**
   * Schedule push notification
   */
  async schedulePushNotification(
    notification: PushNotification,
    scheduledFor: Date
  ): Promise<{ jobId: string }> {
    try {
      const jobId = `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const scheduleKey = `push:scheduled:${jobId}`;

      await this.redisClient.hSet(scheduleKey, {
        jobId,
        notification: JSON.stringify(notification),
        scheduledFor: scheduledFor.toISOString(),
        status: 'pending'
      });

      // Set expiry for 30 days after scheduled time
      const expirySeconds = Math.floor((scheduledFor.getTime() - Date.now()) / 1000) + (30 * 24 * 60 * 60);
      await this.redisClient.expire(scheduleKey, expirySeconds);

      this.logger.info('Push notification scheduled', { jobId, scheduledFor });

      return { jobId };
    } catch (error) {
      this.logger.error('Failed to schedule push notification', { error });
      throw error;
    }
  }

  /**
   * Track push notification delivery
   */
  async trackDelivery(
    messageId: string,
    status: NotificationStatus,
    metadata?: any
  ): Promise<void> {
    try {
      const trackingKey = `push:tracking:${messageId}`;
      const tracking = {
        messageId,
        status,
        timestamp: new Date().toISOString(),
        ...metadata
      };

      await this.redisClient.hSet(trackingKey, tracking as any);
      await this.redisClient.expire(trackingKey, 30 * 24 * 60 * 60); // 30 days

      this.logger.info('Push notification delivery tracked', { messageId, status });
    } catch (error) {
      this.logger.error('Error tracking push delivery', { error, messageId });
    }
  }
}
