import { RedisClientType } from 'redis';
import { Logger } from 'winston';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  UserPreferences,
  NotificationType
} from '../types';

export class NotificationRouter {
  constructor(
    private redisClient: RedisClientType,
    private logger: Logger
  ) {}

  /**
   * Route notification to appropriate channel based on user preferences
   */
  async routeNotification(notification: Notification): Promise<NotificationChannel[]> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(notification.userId);
      
      // Check if notification type is allowed for the channel
      const allowedChannels = this.getAllow edChannels(notification, preferences);
      
      // Check quiet hours for push notifications
      const filteredChannels = await this.filterByQuietHours(
        allowedChannels,
        preferences
      );
      
      return filteredChannels;
    } catch (error) {
      this.logger.error('Error routing notification', { error, notification });
      // Default to email for transactional notifications
      return notification.type === NotificationType.TRANSACTIONAL
        ? [NotificationChannel.EMAIL]
        : [];
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const prefsKey = `user:${userId}:preferences`;
      const prefs = await this.redisClient.hGetAll(prefsKey);
      
      if (!prefs || Object.keys(prefs).length === 0) {
        // Return default preferences
        return this.getDefaultPreferences(userId);
      }
      
      return {
        userId,
        email: {
          transactional: prefs.email_transactional !== 'false',
          marketing: prefs.email_marketing !== 'false',
          engagement: prefs.email_engagement !== 'false'
        },
        push: {
          enabled: prefs.push_enabled !== 'false',
          quietHours: {
            start: prefs.push_quiet_start || '22:00',
            end: prefs.push_quiet_end || '08:00'
          }
        },
        sms: {
          enabled: prefs.sms_enabled === 'true',
          emergencyOnly: prefs.sms_emergency_only !== 'false'
        },
        whatsapp: {
          enabled: prefs.whatsapp_enabled === 'true'
        },
        updatedAt: new Date(prefs.updated_at || Date.now())
      };
    } catch (error) {
      this.logger.error('Error fetching user preferences', { error, userId });
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    try {
      const prefsKey = `user:${userId}:preferences`;
      const updates: Record<string, string> = {
        updated_at: new Date().toISOString()
      };
      
      if (preferences.email) {
        updates.email_transactional = preferences.email.transactional?.toString() || 'true';
        updates.email_marketing = preferences.email.marketing?.toString() || 'true';
        updates.email_engagement = preferences.email.engagement?.toString() || 'true';
      }
      
      if (preferences.push) {
        updates.push_enabled = preferences.push.enabled?.toString() || 'true';
        if (preferences.push.quietHours) {
          updates.push_quiet_start = preferences.push.quietHours.start || '22:00';
          updates.push_quiet_end = preferences.push.quietHours.end || '08:00';
        }
      }
      
      if (preferences.sms) {
        updates.sms_enabled = preferences.sms.enabled?.toString() || 'false';
        updates.sms_emergency_only = preferences.sms.emergencyOnly?.toString() || 'true';
      }
      
      if (preferences.whatsapp) {
        updates.whatsapp_enabled = preferences.whatsapp.enabled?.toString() || 'false';
      }
      
      await this.redisClient.hSet(prefsKey, updates);
      this.logger.info('User preferences updated', { userId });
    } catch (error) {
      this.logger.error('Error updating user preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Get allowed channels based on notification type and user preferences
   */
  private getAllowedChannels(
    notification: Notification,
    preferences: UserPreferences
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    
    // Email channel
    if (this.isEmailAllowed(notification.type, preferences)) {
      channels.push(NotificationChannel.EMAIL);
    }
    
    // Push channel
    if (preferences.push.enabled && notification.type !== NotificationType.MARKETING) {
      channels.push(NotificationChannel.PUSH);
    }
    
    // SMS channel (only for urgent transactional)
    if (
      preferences.sms.enabled &&
      notification.type === NotificationType.TRANSACTIONAL &&
      !preferences.sms.emergencyOnly
    ) {
      channels.push(NotificationChannel.SMS);
    }
    
    // WhatsApp channel
    if (preferences.whatsapp.enabled) {
      channels.push(NotificationChannel.WHATSAPP);
    }
    
    // If specified channel is in allowed list, prioritize it
    if (notification.channel && channels.includes(notification.channel)) {
      return [notification.channel];
    }
    
    return channels;
  }

  /**
   * Check if email is allowed for notification type
   */
  private isEmailAllowed(type: NotificationType, preferences: UserPreferences): boolean {
    switch (type) {
      case NotificationType.TRANSACTIONAL:
        return preferences.email.transactional;
      case NotificationType.MARKETING:
        return preferences.email.marketing;
      case NotificationType.ENGAGEMENT:
        return preferences.email.engagement;
      case NotificationType.SYSTEM:
        return true; // System notifications always allowed
      default:
        return false;
    }
  }

  /**
   * Filter channels based on quiet hours
   */
  private async filterByQuietHours(
    channels: NotificationChannel[],
    preferences: UserPreferences
  ): Promise<NotificationChannel[]> {
    // Check if current time is within quiet hours
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const isQuietHours = this.isWithinQuietHours(
      currentTime,
      preferences.push.quietHours.start,
      preferences.push.quietHours.end
    );
    
    if (isQuietHours) {
      // Remove push notifications during quiet hours
      return channels.filter(ch => ch !== NotificationChannel.PUSH);
    }
    
    return channels;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isWithinQuietHours(current: string, start: string, end: string): boolean {
    const [currentHour, currentMin] = current.split(':').map(Number);
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (startMinutes <= endMinutes) {
      // Same day range (e.g., 22:00 to 23:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight range (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      email: {
        transactional: true,
        marketing: true,
        engagement: true
      },
      push: {
        enabled: true,
        quietHours: {
          start: '22:00',
          end: '08:00'
        }
      },
      sms: {
        enabled: false,
        emergencyOnly: true
      },
      whatsapp: {
        enabled: false
      },
      updatedAt: new Date()
    };
  }

  /**
   * Track notification delivery
   */
  async trackDelivery(
    notificationId: string,
    channel: NotificationChannel,
    status: NotificationStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const trackingKey = `notification:${notificationId}:tracking`;
      const tracking = {
        channel,
        status,
        timestamp: new Date().toISOString(),
        ...metadata
      };
      
      await this.redisClient.hSet(trackingKey, tracking as any);
      await this.redisClient.expire(trackingKey, 30 * 24 * 60 * 60); // 30 days
      
      this.logger.info('Notification delivery tracked', { notificationId, channel, status });
    } catch (error) {
      this.logger.error('Error tracking notification delivery', { error, notificationId });
    }
  }
}
