import sgMail from '@sendgrid/mail';
import { logger } from '@sai-mahendra/shared-utils';
import { EmailConfig, EmailData, EmailTemplate } from '../types';

export class EmailService {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    sgMail.setApiKey(config.sendgridApiKey);
  }

  /**
   * Send a single email
   */
  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      const msg = {
        to: emailData.to,
        from: {
          email: this.config.fromEmail,
          name: 'Sai Mahendra Platform'
        },
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || this.stripHtml(emailData.html),
        trackingSettings: {
          clickTracking: {
            enable: true,
            enableText: false
          },
          openTracking: {
            enable: true
          }
        }
      };

      await sgMail.send(msg);
      
      logger.info('Email sent successfully', {
        to: emailData.to,
        subject: emailData.subject,
        templateId: emailData.templateId
      });

      return true;

    } catch (error) {
      logger.error('Failed to send email:', {
        error: error instanceof Error ? error.message : error,
        to: emailData.to,
        subject: emailData.subject
      });
      return false;
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: EmailData[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Process emails in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const promises = batch.map(async (email) => {
        const success = await this.sendEmail(email);
        return success ? 'sent' : 'failed';
      });

      const results = await Promise.all(promises);
      sent += results.filter(r => r === 'sent').length;
      failed += results.filter(r => r === 'failed').length;

      // Add delay between batches to respect rate limits
      if (i + batchSize < emails.length) {
        await this.delay(1000); // 1 second delay
      }
    }

    logger.info('Bulk email sending completed', { sent, failed, total: emails.length });

    return { sent, failed };
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(
    to: string,
    templateId: string,
    templateData: Record<string, any>
  ): Promise<boolean> {
    try {
      const msg = {
        to,
        from: {
          email: this.config.fromEmail,
          name: 'Sai Mahendra Platform'
        },
        templateId,
        dynamicTemplateData: templateData,
        trackingSettings: {
          clickTracking: {
            enable: true,
            enableText: false
          },
          openTracking: {
            enable: true
          }
        }
      };

      await sgMail.send(msg);
      
      logger.info('Template email sent successfully', {
        to,
        templateId,
        dataKeys: Object.keys(templateData)
      });

      return true;

    } catch (error) {
      logger.error('Failed to send template email:', {
        error: error instanceof Error ? error.message : error,
        to,
        templateId
      });
      return false;
    }
  }

  /**
   * Send contact form confirmation email
   */
  async sendContactConfirmation(
    to: string,
    name: string,
    inquiryId: string,
    subject: string,
    category: string
  ): Promise<boolean> {
    const emailData: EmailData = {
      to,
      subject: 'Thank you for contacting Sai Mahendra Platform',
      html: this.generateConfirmationHtml(name, inquiryId, subject, category),
      text: this.generateConfirmationText(name, inquiryId, subject, category)
    };

    return this.sendEmail(emailData);
  }

  /**
   * Send admin notification email
   */
  async sendAdminNotification(
    inquiryId: string,
    name: string,
    email: string,
    phone: string | undefined,
    subject: string,
    message: string,
    category: string
  ): Promise<boolean> {
    const emailData: EmailData = {
      to: this.config.adminEmail,
      subject: `New Contact Inquiry: ${subject}`,
      html: this.generateAdminNotificationHtml(inquiryId, name, email, phone, subject, message, category),
      text: this.generateAdminNotificationText(inquiryId, name, email, phone, subject, message, category)
    };

    return this.sendEmail(emailData);
  }

  /**
   * Send inquiry response email
   */
  async sendInquiryResponse(
    to: string,
    name: string,
    originalSubject: string,
    responseMessage: string,
    inquiryId: string
  ): Promise<boolean> {
    const emailData: EmailData = {
      to,
      subject: `Re: ${originalSubject}`,
      html: this.generateResponseHtml(name, responseMessage, inquiryId),
      text: this.generateResponseText(name, responseMessage, inquiryId)
    };

    return this.sendEmail(emailData);
  }

  /**
   * Verify email deliverability
   */
  async verifyEmail(email: string): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { isValid: false, reason: 'Invalid email format' };
      }

      // Check for common disposable email domains
      const disposableDomains = [
        '10minutemail.com',
        'tempmail.org',
        'guerrillamail.com',
        'mailinator.com',
        'throwaway.email'
      ];

      const domain = email.split('@')[1].toLowerCase();
      if (disposableDomains.includes(domain)) {
        return { isValid: false, reason: 'Disposable email address' };
      }

      return { isValid: true };

    } catch (error) {
      logger.error('Email verification failed:', error);
      return { isValid: false, reason: 'Verification failed' };
    }
  }

  /**
   * Get email delivery statistics
   */
  async getDeliveryStats(startDate: Date, endDate: Date): Promise<{
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
  }> {
    try {
      // This would typically integrate with SendGrid's Event Webhook API
      // For now, return mock data
      return {
        sent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0
      };
    } catch (error) {
      logger.error('Failed to get delivery stats:', error);
      throw error;
    }
  }

  // Private helper methods

  private generateConfirmationHtml(
    name: string,
    inquiryId: string,
    subject: string,
    category: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank you for contacting us</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .inquiry-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You for Contacting Us!</h1>
          </div>
          <div class="content">
            <p>Dear ${name},</p>
            <p>We have received your inquiry and appreciate you taking the time to contact us. Our team will review your message and get back to you within 24 hours.</p>
            
            <div class="inquiry-details">
              <h3>Your Inquiry Details:</h3>
              <ul>
                <li><strong>Subject:</strong> ${subject}</li>
                <li><strong>Category:</strong> ${category}</li>
                <li><strong>Inquiry ID:</strong> ${inquiryId}</li>
                <li><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            
            <p>If you have any urgent questions, please don't hesitate to reach out to us directly.</p>
            <p>Best regards,<br><strong>Sai Mahendra Platform Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} Sai Mahendra Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateConfirmationText(
    name: string,
    inquiryId: string,
    subject: string,
    category: string
  ): string {
    return `
Dear ${name},

Thank you for contacting Sai Mahendra Platform!

We have received your inquiry and will get back to you within 24 hours.

Your inquiry details:
- Subject: ${subject}
- Category: ${category}
- Inquiry ID: ${inquiryId}
- Submitted: ${new Date().toLocaleString()}

Best regards,
Sai Mahendra Platform Team

This is an automated message. Please do not reply to this email.
    `.trim();
  }

  private generateAdminNotificationHtml(
    inquiryId: string,
    name: string,
    email: string,
    phone: string | undefined,
    subject: string,
    message: string,
    category: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Inquiry</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .inquiry-info { background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .message-content { background-color: #e9ecef; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 New Contact Inquiry</h1>
          </div>
          <div class="content">
            <div class="inquiry-info">
              <h3>Contact Information:</h3>
              <ul>
                <li><strong>Name:</strong> ${name}</li>
                <li><strong>Email:</strong> <a href="mailto:${email}">${email}</a></li>
                <li><strong>Phone:</strong> ${phone || 'Not provided'}</li>
                <li><strong>Category:</strong> ${category}</li>
                <li><strong>Subject:</strong> ${subject}</li>
                <li><strong>Inquiry ID:</strong> ${inquiryId}</li>
                <li><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            
            <div class="message-content">
              <h3>Message:</h3>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            
            <p><strong>Action Required:</strong> Please respond to this inquiry within 24 hours.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateAdminNotificationText(
    inquiryId: string,
    name: string,
    email: string,
    phone: string | undefined,
    subject: string,
    message: string,
    category: string
  ): string {
    return `
NEW CONTACT INQUIRY RECEIVED

Contact Information:
- Name: ${name}
- Email: ${email}
- Phone: ${phone || 'Not provided'}
- Category: ${category}
- Subject: ${subject}
- Inquiry ID: ${inquiryId}
- Submitted: ${new Date().toLocaleString()}

Message:
${message}

Action Required: Please respond to this inquiry within 24 hours.
    `.trim();
  }

  private generateResponseHtml(
    name: string,
    responseMessage: string,
    inquiryId: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Response to Your Inquiry</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .response { background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Response to Your Inquiry</h1>
          </div>
          <div class="content">
            <p>Dear ${name},</p>
            <p>Thank you for contacting Sai Mahendra Platform. Here is our response to your inquiry:</p>
            
            <div class="response">
              ${responseMessage.replace(/\n/g, '<br>')}
            </div>
            
            <p>If you have any further questions or need additional assistance, please don't hesitate to contact us again.</p>
            <p>Best regards,<br><strong>Sai Mahendra Platform Team</strong></p>
          </div>
          <div class="footer">
            <p>Inquiry ID: ${inquiryId}</p>
            <p>© ${new Date().getFullYear()} Sai Mahendra Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateResponseText(
    name: string,
    responseMessage: string,
    inquiryId: string
  ): string {
    return `
Dear ${name},

Thank you for contacting Sai Mahendra Platform. Here is our response to your inquiry:

${responseMessage}

If you have any further questions or need additional assistance, please don't hesitate to contact us again.

Best regards,
Sai Mahendra Platform Team

Inquiry ID: ${inquiryId}
    `.trim();
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}