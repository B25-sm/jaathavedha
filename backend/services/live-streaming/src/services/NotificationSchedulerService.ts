import { SessionManagementService } from './SessionManagementService';
import { NotificationChannel, SessionNotificationRecord } from '../types';

interface EmailService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

interface PushService {
  sendPush(userId: string, title: string, body: string): Promise<void>;
}

export class NotificationSchedulerService {
  private sessionManagement: SessionManagementService;
  private emailService?: EmailService;
  private pushService?: PushService;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(
    emailService?: EmailService,
    pushService?: PushService
  ) {
    this.sessionManagement = new SessionManagementService();
    this.emailService = emailService;
    this.pushService = pushService;
  }

  // ==================== SCHEDULER ====================

  start(intervalSeconds: number = 60): void {
    if (this.isRunning) {
      console.log('Notification scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting notification scheduler (checking every ${intervalSeconds}s)`);

    // Run immediately
    this.processNotifications();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processNotifications();
    }, intervalSeconds * 1000);
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('Notification scheduler is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('Notification scheduler stopped');
  }

  private async processNotifications(): Promise<void> {
    try {
      const pendingNotifications = await this.sessionManagement.getPendingNotifications(100);
      
      if (pendingNotifications.length === 0) {
        return;
      }

      console.log(`Processing ${pendingNotifications.length} pending notifications`);

      for (const notification of pendingNotifications) {
        await this.sendNotification(notification);
      }
    } catch (error) {
      console.error('Error processing notifications:', error);
    }
  }

  // ==================== NOTIFICATION SENDING ====================

  private async sendNotification(notification: SessionNotificationRecord): Promise<void> {
    try {
      switch (notification.channel) {
        case NotificationChannel.EMAIL:
          await this.sendEmailNotification(notification);
          break;
        case NotificationChannel.PUSH:
          await this.sendPushNotification(notification);
          break;
        case NotificationChannel.SMS:
          await this.sendSMSNotification(notification);
          break;
        case NotificationChannel.WHATSAPP:
          await this.sendWhatsAppNotification(notification);
          break;
        default:
          console.warn(`Unknown notification channel: ${notification.channel}`);
          return;
      }

      await this.sessionManagement.markNotificationSent(notification.id);
      console.log(`Notification sent: ${notification.id} (${notification.notificationType})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.sessionManagement.markNotificationFailed(notification.id, errorMessage);
      console.error(`Failed to send notification ${notification.id}:`, error);
    }
  }

  private async sendEmailNotification(notification: SessionNotificationRecord): Promise<void> {
    if (!this.emailService) {
      throw new Error('Email service not configured');
    }

    if (!notification.userId) {
      throw new Error('User ID required for email notification');
    }

    // In a real implementation, you would fetch the user's email from the database
    // For now, we'll use a placeholder
    const userEmail = notification.metadata?.userEmail || 'user@example.com';

    await this.emailService.sendEmail(
      userEmail,
      notification.title,
      this.formatEmailBody(notification)
    );
  }

  private async sendPushNotification(notification: SessionNotificationRecord): Promise<void> {
    if (!this.pushService) {
      throw new Error('Push service not configured');
    }

    if (!notification.userId) {
      throw new Error('User ID required for push notification');
    }

    await this.pushService.sendPush(
      notification.userId,
      notification.title,
      notification.message
    );
  }

  private async sendSMSNotification(notification: SessionNotificationRecord): Promise<void> {
    // SMS implementation would go here
    // For now, just log
    console.log(`SMS notification: ${notification.title} - ${notification.message}`);
  }

  private async sendWhatsAppNotification(notification: SessionNotificationRecord): Promise<void> {
    // WhatsApp implementation would go here
    // For now, just log
    console.log(`WhatsApp notification: ${notification.title} - ${notification.message}`);
  }

  // ==================== FORMATTING ====================

  private formatEmailBody(notification: SessionNotificationRecord): string {
    const session = notification.metadata?.session;
    
    let body = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">${notification.title}</h2>
            <p>${notification.message}</p>
    `;

    if (session) {
      body += `
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Session Details</h3>
              <p><strong>Title:</strong> ${session.title}</p>
              <p><strong>Start Time:</strong> ${new Date(session.scheduledStart).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${this.calculateDuration(session.scheduledStart, session.scheduledEnd)}</p>
              ${session.meetingUrl ? `<p><strong>Join URL:</strong> <a href="${session.meetingUrl}" style="color: #2563eb;">${session.meetingUrl}</a></p>` : ''}
            </div>
      `;
    }

    body += `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #6b7280;">
                This is an automated notification from Sai Mahendra Platform.
                To manage your notification preferences, visit your account settings.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return body;
  }

  private calculateDuration(start: Date, end: Date): string {
    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // ==================== MANUAL NOTIFICATION ====================

  async sendImmediateNotification(
    sessionId: string,
    userId: string,
    title: string,
    message: string,
    channel: NotificationChannel = NotificationChannel.EMAIL
  ): Promise<void> {
    const notification = await this.sessionManagement.createNotification({
      sessionId,
      userId,
      notificationType: 'session_started' as any,
      title,
      message,
      channel,
      scheduledFor: new Date()
    });

    await this.sendNotification(notification);
  }

  async broadcastToSession(
    sessionId: string,
    title: string,
    message: string,
    channel: NotificationChannel = NotificationChannel.PUSH
  ): Promise<void> {
    // In a real implementation, you would fetch all participants of the session
    // and send notifications to each of them
    console.log(`Broadcasting to session ${sessionId}: ${title} - ${message}`);
  }
}
