import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { Logger } from 'winston';
import { RedisClientType } from 'redis';
import {
  EmailNotification,
  NotificationTemplate,
  NotificationStatus,
  DeliveryTracking
} from '../types';

export class EmailService {
  private fromEmail: string;
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor(
    private redisClient: RedisClientType,
    private logger: Logger
  ) {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@saimahendra.com';
    
    // Initialize SendGrid
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.info('SendGrid initialized successfully');
    } else {
      this.logger.warn('SendGrid API key not configured');
    }
  }

  /**
   * Send single email
   */
  async sendEmail(notification: EmailNotification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Process template if templateId is provided
      let content = notification.html || notification.text || '';
      let subject = notification.subject;
      
      if (notification.templateId) {
        const template = await this.getTemplate(notification.templateId);
        if (template) {
          content = this.processTemplate(template.content, notification.templateData || {});
          subject = template.subject || subject;
        }
      }
      
      // Prepare email message
      const msg: MailDataRequired = {
        to: notification.to,
        from: notification.from || this.fromEmail,
        subject,
        html: content,
        text: notification.text,
        replyTo: notification.replyTo,
        cc: notification.cc,
        bcc: notification.bcc
      };
      
      // Add attachments if provided
      if (notification.attachments && notification.attachments.length > 0) {
        msg.attachments = notification.attachments.map(att => ({
          filename: att.filename,
          content: att.content.toString('base64'),
          type: att.contentType,
          disposition: 'attachment'
        }));
      }
      
      // Send email via SendGrid
      const response = await sgMail.send(msg);
      
      this.logger.info('Email sent successfully', {
        to: notification.to,
        subject,
        messageId: response[0].headers['x-message-id']
      });
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string
      };
    } catch (error: any) {
      this.logger.error('Failed to send email', {
        error: error.message,
        to: notification.to,
        subject: notification.subject
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(
    notifications: EmailNotification[]
  ): Promise<{ successCount: number; failureCount: number; results: any[] }> {
    try {
      const messages = await Promise.all(
        notifications.map(async (notification) => {
          let content = notification.html || notification.text || '';
          let subject = notification.subject;
          
          if (notification.templateId) {
            const template = await this.getTemplate(notification.templateId);
            if (template) {
              content = this.processTemplate(template.content, notification.templateData || {});
              subject = template.subject || subject;
            }
          }
          
          return {
            to: notification.to,
            from: notification.from || this.fromEmail,
            subject,
            html: content,
            text: notification.text
          } as MailDataRequired;
        })
      );
      
      // Send bulk emails
      const response = await sgMail.send(messages);
      
      const successCount = response.filter(r => r[0].statusCode >= 200 && r[0].statusCode < 300).length;
      const failureCount = notifications.length - successCount;
      
      this.logger.info('Bulk emails sent', {
        total: notifications.length,
        successCount,
        failureCount
      });
      
      return {
        successCount,
        failureCount,
        results: response
      };
    } catch (error: any) {
      this.logger.error('Failed to send bulk emails', { error: error.message });
      throw error;
    }
  }

  /**
   * Process email template with variable substitution
   */
  private processTemplate(template: string, data: Record<string, any>): string {
    let processed = template;
    
    // Replace variables in format {{variableName}}
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processed = processed.replace(regex, data[key]?.toString() || '');
    });
    
    // Handle conditional blocks {{#if variable}}...{{/if}}
    processed = processed.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, variable, content) => {
      return data[variable] ? content : '';
    });
    
    // Handle loops {{#each items}}...{{/each}}
    processed = processed.replace(/{{#each\s+(\w+)}}(.*?){{\/each}}/gs, (match, variable, content) => {
      const items = data[variable];
      if (Array.isArray(items)) {
        return items.map(item => {
          let itemContent = content;
          Object.keys(item).forEach(key => {
            itemContent = itemContent.replace(new RegExp(`{{${key}}}`, 'g'), item[key]);
          });
          return itemContent;
        }).join('');
      }
      return '';
    });
    
    return processed;
  }

  /**
   * Get email template
   */
  async getTemplate(templateId: string): Promise<NotificationTemplate | null> {
    try {
      // Check cache first
      if (this.templates.has(templateId)) {
        return this.templates.get(templateId)!;
      }
      
      // Fetch from Redis
      const templateKey = `template:${templateId}`;
      const templateData = await this.redisClient.hGetAll(templateKey);
      
      if (!templateData || Object.keys(templateData).length === 0) {
        this.logger.warn('Template not found', { templateId });
        return null;
      }
      
      const template: NotificationTemplate = {
        id: templateId,
        name: templateData.name,
        channel: templateData.channel as any,
        type: templateData.type as any,
        subject: templateData.subject,
        content: templateData.content,
        variables: JSON.parse(templateData.variables || '[]'),
        isActive: templateData.isActive === 'true',
        createdAt: new Date(templateData.createdAt),
        updatedAt: new Date(templateData.updatedAt)
      };
      
      // Cache template
      this.templates.set(templateId, template);
      
      return template;
    } catch (error) {
      this.logger.error('Error fetching template', { error, templateId });
      return null;
    }
  }

  /**
   * Create or update email template
   */
  async saveTemplate(template: NotificationTemplate): Promise<void> {
    try {
      const templateId = template.id || `template_${Date.now()}`;
      const templateKey = `template:${templateId}`;
      
      const templateData = {
        id: templateId,
        name: template.name,
        channel: template.channel,
        type: template.type,
        subject: template.subject || '',
        content: template.content,
        variables: JSON.stringify(template.variables),
        isActive: template.isActive.toString(),
        createdAt: template.createdAt.toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await this.redisClient.hSet(templateKey, templateData as any);
      
      // Update cache
      this.templates.set(templateId, { ...template, id: templateId });
      
      this.logger.info('Template saved', { templateId, name: template.name });
    } catch (error) {
      this.logger.error('Error saving template', { error, template });
      throw error;
    }
  }

  /**
   * Handle email bounce
   */
  async handleBounce(messageId: string, bounceData: any): Promise<void> {
    try {
      const bounceKey = `email:bounce:${messageId}`;
      await this.redisClient.hSet(bounceKey, {
        messageId,
        reason: bounceData.reason || 'unknown',
        type: bounceData.type || 'hard',
        timestamp: new Date().toISOString(),
        email: bounceData.email
      });
      
      await this.redisClient.expire(bounceKey, 90 * 24 * 60 * 60); // 90 days
      
      this.logger.info('Email bounce recorded', { messageId, email: bounceData.email });
    } catch (error) {
      this.logger.error('Error handling email bounce', { error, messageId });
    }
  }

  /**
   * Track email delivery
   */
  async trackDelivery(messageId: string, status: NotificationStatus, metadata?: any): Promise<void> {
    try {
      const trackingKey = `email:tracking:${messageId}`;
      const tracking = {
        messageId,
        status,
        timestamp: new Date().toISOString(),
        ...metadata
      };
      
      await this.redisClient.hSet(trackingKey, tracking as any);
      await this.redisClient.expire(trackingKey, 30 * 24 * 60 * 60); // 30 days
      
      this.logger.info('Email delivery tracked', { messageId, status });
    } catch (error) {
      this.logger.error('Error tracking email delivery', { error, messageId });
    }
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(startDate: Date, endDate: Date): Promise<any> {
    try {
      // This would typically query a database
      // For now, return mock stats
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0
      };
    } catch (error) {
      this.logger.error('Error fetching delivery stats', { error });
      throw error;
    }
  }
}
