import { RedisClientType } from 'redis';
import { Logger } from 'winston';
import Queue from 'bull';
import {
  NotificationEvent,
  NotificationRule,
  NotificationChannel,
  NotificationType,
  Notification,
  NotificationPriority,
  NotificationStatus
} from '../types';
import { EmailService } from './EmailService';
import { PushService } from './PushService';

export class TriggerService {
  private eventSubscriber: RedisClientType;
  private rules: Map<string, NotificationRule[]> = new Map();

  constructor(
    private redisClient: RedisClientType,
    private emailService: EmailService,
    private pushService: PushService,
    private emailQueue: Queue.Queue,
    private pushQueue: Queue.Queue,
    private logger: Logger
  ) {
    this.eventSubscriber = redisClient.duplicate();
    this.initializeEventSubscriber();
    this.loadNotificationRules();
  }

  /**
   * Initialize Redis pub/sub for event-driven notifications
   */
  private async initializeEventSubscriber(): Promise<void> {
    try {
      await this.eventSubscriber.connect();

      // Subscribe to notification events
      await this.eventSubscriber.subscribe('notification:events', async (message) => {
        try {
          const event: NotificationEvent = JSON.parse(message);
          await this.handleEvent(event);
        } catch (error) {
          this.logger.error('Error handling notification event', { error, message });
        }
      });

      this.logger.info('Event subscriber initialized');
    } catch (error) {
      this.logger.error('Failed to initialize event subscriber', { error });
    }
  }

  /**
   * Load notification rules from Redis
   */
  private async loadNotificationRules(): Promise<void> {
    try {
      const ruleKeys = await this.redisClient.keys('notification:rule:*');

      for (const key of ruleKeys) {
        const ruleData = await this.redisClient.hGetAll(key);
        if (ruleData && Object.keys(ruleData).length > 0) {
          const rule: NotificationRule = {
            id: ruleData.id,
            eventType: ruleData.eventType,
            channel: ruleData.channel as NotificationChannel,
            templateId: ruleData.templateId,
            conditions: JSON.parse(ruleData.conditions || '{}'),
            isActive: ruleData.isActive === 'true',
            createdAt: new Date(ruleData.createdAt)
          };

          if (rule.isActive) {
            const eventRules = this.rules.get(rule.eventType) || [];
            eventRules.push(rule);
            this.rules.set(rule.eventType, eventRules);
          }
        }
      }

      this.logger.info('Notification rules loaded', { count: ruleKeys.length });
    } catch (error) {
      this.logger.error('Failed to load notification rules', { error });
    }
  }

  /**
   * Handle incoming notification event
   */
  private async handleEvent(event: NotificationEvent): Promise<void> {
    try {
      const rules = this.rules.get(event.eventType) || [];

      if (rules.length === 0) {
        this.logger.debug('No rules found for event type', { eventType: event.eventType });
        return;
      }

      for (const rule of rules) {
        if (this.evaluateConditions(rule.conditions, event.data)) {
          await this.triggerNotification(rule, event);
        }
      }
    } catch (error) {
      this.logger.error('Error handling event', { error, event });
    }
  }

  /**
   * Evaluate rule conditions against event data
   */
  private evaluateConditions(conditions: Record<string, any>, data: Record<string, any>): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true; // No conditions means always trigger
    }

    for (const [key, value] of Object.entries(conditions)) {
      if (data[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Trigger notification based on rule
   */
  private async triggerNotification(rule: NotificationRule, event: NotificationEvent): Promise<void> {
    try {
      const userId = event.userId || event.data.userId;
      if (!userId) {
        this.logger.warn('No userId in event data', { event });
        return;
      }

      const notification: Notification = {
        userId,
        channel: rule.channel,
        type: this.getNotificationType(event.eventType),
        priority: this.getNotificationPriority(event.eventType),
        status: NotificationStatus.PENDING,
        templateId: rule.templateId,
        templateData: event.data,
        content: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Queue notification for delivery
      await this.queueNotification(notification);

      this.logger.info('Notification triggered', {
        eventType: event.eventType,
        userId,
        channel: rule.channel
      });
    } catch (error) {
      this.logger.error('Error triggering notification', { error, rule, event });
    }
  }

  /**
   * Queue notification for delivery
   */
  private async queueNotification(notification: Notification): Promise<void> {
    try {
      if (notification.channel === NotificationChannel.EMAIL) {
        await this.emailQueue.add('send-email', notification);
      } else if (notification.channel === NotificationChannel.PUSH) {
        await this.pushQueue.add('send-push', notification);
      }
    } catch (error) {
      this.logger.error('Error queuing notification', { error, notification });
    }
  }

  /**
   * Get notification type based on event type
   */
  private getNotificationType(eventType: string): NotificationType {
    if (eventType.includes('payment') || eventType.includes('enrollment')) {
      return NotificationType.TRANSACTIONAL;
    } else if (eventType.includes('reminder') || eventType.includes('deadline')) {
      return NotificationType.ENGAGEMENT;
    } else if (eventType.includes('announcement')) {
      return NotificationType.MARKETING;
    }
    return NotificationType.SYSTEM;
  }

  /**
   * Get notification priority based on event type
   */
  private getNotificationPriority(eventType: string): NotificationPriority {
    if (eventType.includes('urgent') || eventType.includes('failure')) {
      return NotificationPriority.URGENT;
    } else if (eventType.includes('payment') || eventType.includes('enrollment')) {
      return NotificationPriority.HIGH;
    } else if (eventType.includes('reminder')) {
      return NotificationPriority.MEDIUM;
    }
    return NotificationPriority.LOW;
  }

  /**
   * Publish notification event
   */
  async publishEvent(event: NotificationEvent): Promise<void> {
    try {
      await this.redisClient.publish('notification:events', JSON.stringify(event));
      this.logger.info('Event published', { eventType: event.eventType });
    } catch (error) {
      this.logger.error('Error publishing event', { error, event });
      throw error;
    }
  }

  /**
   * Create notification rule
   */
  async createRule(rule: NotificationRule): Promise<void> {
    try {
      const ruleId = rule.id || `rule_${Date.now()}`;
      const ruleKey = `notification:rule:${ruleId}`;

      const ruleData = {
        id: ruleId,
        eventType: rule.eventType,
        channel: rule.channel,
        templateId: rule.templateId,
        conditions: JSON.stringify(rule.conditions || {}),
        isActive: rule.isActive.toString(),
        createdAt: new Date().toISOString()
      };

      await this.redisClient.hSet(ruleKey, ruleData as any);

      // Update in-memory rules
      if (rule.isActive) {
        const eventRules = this.rules.get(rule.eventType) || [];
        eventRules.push({ ...rule, id: ruleId });
        this.rules.set(rule.eventType, eventRules);
      }

      this.logger.info('Notification rule created', { ruleId, eventType: rule.eventType });
    } catch (error) {
      this.logger.error('Error creating notification rule', { error, rule });
      throw error;
    }
  }

  /**
   * Send enrollment confirmation notification
   */
  async sendEnrollmentConfirmation(userId: string, enrollmentData: any): Promise<void> {
    await this.publishEvent({
      eventType: 'enrollment.completed',
      userId,
      data: enrollmentData,
      timestamp: new Date()
    });
  }

  /**
   * Send payment receipt notification
   */
  async sendPaymentReceipt(userId: string, paymentData: any): Promise<void> {
    await this.publishEvent({
      eventType: 'payment.completed',
      userId,
      data: paymentData,
      timestamp: new Date()
    });
  }

  /**
   * Send course reminder notification
   */
  async sendCourseReminder(userId: string, courseData: any): Promise<void> {
    await this.publishEvent({
      eventType: 'course.reminder',
      userId,
      data: courseData,
      timestamp: new Date()
    });
  }

  /**
   * Send deadline notification
   */
  async sendDeadlineNotification(userId: string, deadlineData: any): Promise<void> {
    await this.publishEvent({
      eventType: 'course.deadline',
      userId,
      data: deadlineData,
      timestamp: new Date()
    });
  }

  /**
   * Send subscription renewal notification
   */
  async sendSubscriptionRenewal(userId: string, subscriptionData: any): Promise<void> {
    await this.publishEvent({
      eventType: 'subscription.renewal',
      userId,
      data: subscriptionData,
      timestamp: new Date()
    });
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailure(userId: string, failureData: any): Promise<void> {
    await this.publishEvent({
      eventType: 'payment.failure',
      userId,
      data: failureData,
      timestamp: new Date()
    });
  }

  /**
   * Initialize default notification rules
   */
  async initializeDefaultRules(): Promise<void> {
    const defaultRules: NotificationRule[] = [
      {
        eventType: 'enrollment.completed',
        channel: NotificationChannel.EMAIL,
        templateId: 'enrollment_confirmation',
        isActive: true,
        createdAt: new Date()
      },
      {
        eventType: 'payment.completed',
        channel: NotificationChannel.EMAIL,
        templateId: 'payment_receipt',
        isActive: true,
        createdAt: new Date()
      },
      {
        eventType: 'course.reminder',
        channel: NotificationChannel.PUSH,
        templateId: 'course_reminder',
        isActive: true,
        createdAt: new Date()
      },
      {
        eventType: 'course.deadline',
        channel: NotificationChannel.EMAIL,
        templateId: 'deadline_notification',
        isActive: true,
        createdAt: new Date()
      },
      {
        eventType: 'subscription.renewal',
        channel: NotificationChannel.EMAIL,
        templateId: 'subscription_renewal',
        isActive: true,
        createdAt: new Date()
      },
      {
        eventType: 'payment.failure',
        channel: NotificationChannel.EMAIL,
        templateId: 'payment_failure',
        isActive: true,
        createdAt: new Date()
      }
    ];

    for (const rule of defaultRules) {
      try {
        await this.createRule(rule);
      } catch (error) {
        this.logger.error('Error creating default rule', { error, rule });
      }
    }

    this.logger.info('Default notification rules initialized');
  }
}
