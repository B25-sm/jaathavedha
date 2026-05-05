import { Router, Request, Response } from 'express';
import { logger } from '@sai-mahendra/shared-utils';
import { WhatsAppService } from '../services/WhatsAppService';
import { WhatsAppWebhookPayload } from '../types';

const router = Router();

/**
 * @route GET /api/whatsapp/webhook
 * @desc WhatsApp webhook verification
 * @access Public (WhatsApp servers)
 */
router.get('/webhook', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('WhatsApp webhook verification failed', {
        mode,
        tokenMatch: token === verifyToken
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: 'Webhook verification failed'
        }
      });
    }

  } catch (error) {
    logger.error('Error in WhatsApp webhook verification:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Webhook verification error'
      }
    });
  }
});

/**
 * @route POST /api/whatsapp/webhook
 * @desc Handle incoming WhatsApp messages and status updates
 * @access Public (WhatsApp servers)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = JSON.stringify(req.body);

    if (!signature) {
      logger.warn('WhatsApp webhook received without signature');
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Webhook signature required'
        }
      });
    }

    const whatsappService: WhatsAppService = req.app.locals.whatsappService;

    // Verify webhook signature
    const isValidSignature = whatsappService.verifyWebhookSignature(payload, signature);
    if (!isValidSignature) {
      logger.warn('WhatsApp webhook signature verification failed');
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature'
        }
      });
    }

    const webhookPayload: WhatsAppWebhookPayload = req.body;

    // Process the webhook payload
    const result = await whatsappService.processWebhook(webhookPayload);

    if (result.processed) {
      logger.info('WhatsApp webhook processed successfully', {
        messagesCount: result.messages.length
      });

      // Handle incoming messages (could trigger auto-responses or notifications)
      for (const message of result.messages) {
        await handleIncomingMessage(message.from, message.message, message.timestamp);
      }

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully'
      });
    } else {
      logger.error('Failed to process WhatsApp webhook');
      res.status(400).json({
        success: false,
        error: {
          code: 'PROCESSING_FAILED',
          message: 'Failed to process webhook'
        }
      });
    }

  } catch (error) {
    logger.error('Error processing WhatsApp webhook:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Webhook processing error'
      }
    });
  }
});

/**
 * @route POST /api/whatsapp/send-message
 * @desc Send a WhatsApp message (admin only)
 * @access Private (Admin)
 */
router.post('/send-message', async (req: Request, res: Response) => {
  try {
    // Note: This would typically require admin authentication
    // For now, we'll implement basic validation

    const { to, message, type = 'text' } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Phone number and message are required',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const whatsappService: WhatsAppService = req.app.locals.whatsappService;

    let result;
    if (type === 'template') {
      const { templateName, languageCode = 'en', components } = req.body;
      if (!templateName) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            code: 'MISSING_TEMPLATE_NAME',
            message: 'Template name is required for template messages',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      result = await whatsappService.sendTemplateMessage(to, templateName, languageCode, components);
    } else {
      result = await whatsappService.sendTextMessage(to, message);
    }

    if (result.success) {
      logger.info('WhatsApp message sent via API', {
        to,
        messageId: result.messageId,
        type
      });

      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          message: 'Message sent successfully'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'EXTERNAL_SERVICE_ERROR',
          code: 'MESSAGE_SEND_FAILED',
          message: result.error || 'Failed to send message',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error sending WhatsApp message:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to send message',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route GET /api/whatsapp/templates
 * @desc Get available WhatsApp message templates
 * @access Private (Admin)
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const whatsappService: WhatsAppService = req.app.locals.whatsappService;
    const result = await whatsappService.getMessageTemplates();

    if (result.success) {
      res.json({
        success: true,
        data: result.templates || []
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'EXTERNAL_SERVICE_ERROR',
          code: 'TEMPLATES_FETCH_FAILED',
          message: result.error || 'Failed to fetch templates',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error fetching WhatsApp templates:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch templates',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route POST /api/whatsapp/verify-number
 * @desc Verify if a phone number is registered on WhatsApp
 * @access Private (Admin)
 */
router.post('/verify-number', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_PHONE_NUMBER',
          message: 'Phone number is required',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const whatsappService: WhatsAppService = req.app.locals.whatsappService;
    const result = await whatsappService.checkPhoneNumber(phoneNumber);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error verifying WhatsApp number:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Phone number verification failed',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route GET /api/whatsapp/account-info
 * @desc Get WhatsApp Business Account information
 * @access Private (Admin)
 */
router.get('/account-info', async (req: Request, res: Response) => {
  try {
    const whatsappService: WhatsAppService = req.app.locals.whatsappService;
    const result = await whatsappService.getBusinessAccountInfo();

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'EXTERNAL_SERVICE_ERROR',
          code: 'ACCOUNT_INFO_FAILED',
          message: result.error || 'Failed to fetch account information',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error fetching WhatsApp account info:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch account information',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

// Helper function to handle incoming messages
async function handleIncomingMessage(
  from: string,
  message: string,
  timestamp: Date
): Promise<void> {
  try {
    logger.info('Processing incoming WhatsApp message', {
      from,
      messageLength: message.length,
      timestamp
    });

    // Here you could implement:
    // 1. Auto-responses for common queries
    // 2. Ticket creation for support requests
    // 3. Integration with existing inquiry system
    // 4. Notification to admin team

    // Example auto-response for business hours
    const businessHours = isBusinessHours();
    if (!businessHours) {
      // Could send an auto-response about business hours
      logger.info('Message received outside business hours', { from });
    }

    // Example: Create a contact inquiry from WhatsApp message
    // This would integrate with the ContactService to create an inquiry
    // from the WhatsApp message

  } catch (error) {
    logger.error('Error handling incoming WhatsApp message:', error);
  }
}

// Helper function to check business hours
function isBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Business hours: Monday-Friday 9 AM - 6 PM
  const isWeekday = day >= 1 && day <= 5;
  const isBusinessHour = hour >= 9 && hour < 18;

  return isWeekday && isBusinessHour;
}

export { router as whatsappRoutes };