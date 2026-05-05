import axios from 'axios';
import crypto from 'crypto';
import { logger } from '@sai-mahendra/shared-utils';
import { 
  WhatsAppConfig, 
  WhatsAppMessage, 
  WhatsAppWebhookPayload 
} from '../types';

export class WhatsAppService {
  private config: WhatsAppConfig;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  /**
   * Send a text message via WhatsApp Business API
   */
  async sendTextMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const whatsappMessage: WhatsAppMessage = {
        to: this.formatPhoneNumber(to),
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await this.sendMessage(whatsappMessage);
      
      if (response.success && response.data?.messages?.[0]) {
        const messageId = response.data.messages[0].id;
        logger.info('WhatsApp message sent successfully', {
          to,
          messageId,
          messageLength: message.length
        });
        
        return { success: true, messageId };
      }

      return { success: false, error: 'Failed to send message' };

    } catch (error) {
      logger.error('Failed to send WhatsApp message:', {
        error: error instanceof Error ? error.message : error,
        to
      });
      return { success: false, error: 'Message sending failed' };
    }
  }

  /**
   * Send a template message via WhatsApp Business API
   */
  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en',
    components?: any[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const whatsappMessage: WhatsAppMessage = {
        to: this.formatPhoneNumber(to),
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: components || []
        }
      };

      const response = await this.sendMessage(whatsappMessage);
      
      if (response.success && response.data?.messages?.[0]) {
        const messageId = response.data.messages[0].id;
        logger.info('WhatsApp template message sent successfully', {
          to,
          templateName,
          messageId
        });
        
        return { success: true, messageId };
      }

      return { success: false, error: 'Failed to send template message' };

    } catch (error) {
      logger.error('Failed to send WhatsApp template message:', {
        error: error instanceof Error ? error.message : error,
        to,
        templateName
      });
      return { success: false, error: 'Template message sending failed' };
    }
  }

  /**
   * Send contact inquiry notification to admin via WhatsApp
   */
  async sendInquiryNotification(
    adminPhoneNumber: string,
    inquiryId: string,
    name: string,
    email: string,
    subject: string,
    category: string
  ): Promise<boolean> {
    const message = `🔔 *New Contact Inquiry*

*From:* ${name}
*Email:* ${email}
*Category:* ${category}
*Subject:* ${subject}
*Inquiry ID:* ${inquiryId}

Please check the admin panel to respond.`;

    const result = await this.sendTextMessage(adminPhoneNumber, message);
    return result.success;
  }

  /**
   * Send inquiry response notification to user via WhatsApp
   */
  async sendResponseNotification(
    userPhoneNumber: string,
    name: string,
    subject: string,
    responseMessage: string
  ): Promise<boolean> {
    const message = `Hello ${name},

We have responded to your inquiry: "${subject}"

${responseMessage}

Thank you for contacting Sai Mahendra Platform!`;

    const result = await this.sendTextMessage(userPhoneNumber, message);
    return result.success;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookVerifyToken)
        .update(payload)
        .digest('hex');

      const receivedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Process incoming webhook payload
   */
  async processWebhook(payload: WhatsAppWebhookPayload): Promise<{
    processed: boolean;
    messages: Array<{
      from: string;
      message: string;
      timestamp: Date;
    }>;
  }> {
    try {
      const messages: Array<{ from: string; message: string; timestamp: Date }> = [];

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages' && change.value.messages) {
            for (const message of change.value.messages) {
              if (message.type === 'text') {
                messages.push({
                  from: message.from,
                  message: message.text.body,
                  timestamp: new Date(parseInt(message.timestamp) * 1000)
                });

                logger.info('WhatsApp message received', {
                  from: message.from,
                  messageId: message.id,
                  messageLength: message.text.body.length
                });
              }
            }
          }

          // Handle message status updates
          if (change.field === 'messages' && change.value.statuses) {
            for (const status of change.value.statuses) {
              logger.info('WhatsApp message status update', {
                messageId: status.id,
                status: status.status,
                recipientId: status.recipient_id
              });
            }
          }
        }
      }

      return {
        processed: true,
        messages
      };

    } catch (error) {
      logger.error('Failed to process WhatsApp webhook:', error);
      return {
        processed: false,
        messages: []
      };
    }
  }

  /**
   * Get WhatsApp Business Account information
   */
  async getBusinessAccountInfo(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.config.businessAccountId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            fields: 'id,name,timezone_offset_min,message_template_namespace'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      logger.error('Failed to get WhatsApp business account info:', error);
      return {
        success: false,
        error: 'Failed to retrieve account information'
      };
    }
  }

  /**
   * Get available message templates
   */
  async getMessageTemplates(): Promise<{
    success: boolean;
    templates?: Array<{
      id: string;
      name: string;
      status: string;
      language: string;
      category: string;
    }>;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.config.businessAccountId}/message_templates`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            fields: 'id,name,status,language,category'
          }
        }
      );

      return {
        success: true,
        templates: response.data.data || []
      };

    } catch (error) {
      logger.error('Failed to get WhatsApp message templates:', error);
      return {
        success: false,
        error: 'Failed to retrieve message templates'
      };
    }
  }

  /**
   * Check if a phone number is registered on WhatsApp
   */
  async checkPhoneNumber(phoneNumber: string): Promise<{
    isRegistered: boolean;
    formattedNumber?: string;
    error?: string;
  }> {
    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      // This is a simplified check - in production, you might want to use
      // the WhatsApp Business API's phone number validation endpoint
      const response = await axios.post(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: formattedNumber,
          type: 'text',
          text: {
            body: 'Test message for validation'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true // Don't throw on error status codes
        }
      );

      if (response.status === 200) {
        return {
          isRegistered: true,
          formattedNumber
        };
      }

      return {
        isRegistered: false,
        error: 'Phone number not registered on WhatsApp'
      };

    } catch (error) {
      logger.error('Failed to check WhatsApp phone number:', error);
      return {
        isRegistered: false,
        error: 'Phone number validation failed'
      };
    }
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageId: string): Promise<{
    success: boolean;
    status?: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp?: Date;
    error?: string;
  }> {
    try {
      // Note: WhatsApp doesn't provide a direct API to query message status
      // Status updates are typically received via webhooks
      // This is a placeholder implementation
      
      return {
        success: false,
        error: 'Message status tracking not implemented'
      };

    } catch (error) {
      logger.error('Failed to get message status:', error);
      return {
        success: false,
        error: 'Status retrieval failed'
      };
    }
  }

  // Private helper methods

  private async sendMessage(message: WhatsAppMessage): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        ...message
      };

      const response = await axios.post(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('WhatsApp API error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        return {
          success: false,
          error: error.response?.data?.error?.message || error.message
        };
      }

      throw error;
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming India +91 as default)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned;
  }

  private validatePhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid length (10-15 digits)
    if (cleaned.length < 10 || cleaned.length > 15) {
      return false;
    }
    
    // Additional validation rules can be added here
    return true;
  }
}