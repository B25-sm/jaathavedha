import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';
import { createClient, RedisClientType } from 'redis';
import Queue from 'bull';
import {
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  EmailNotification,
  PushNotification,
  BulkNotification,
  NotificationTemplate,
  NotificationEvent
} from './types';
import { EmailService } from './services/EmailService';
import { PushService } from './services/PushService';
import { NotificationRouter } from './services/NotificationRouter';
import { TriggerService } from './services/TriggerService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3007;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize external services
let redisClient: RedisClientType;
let emailQueue: Queue.Queue;
let pushQueue: Queue.Queue;

// Service instances
let emailService: EmailService;
let pushService: PushService;
let notificationRouter: NotificationRouter;
let triggerService: TriggerService;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: {
      type: 'RATE_LIMIT_EXCEEDED',
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString()
    }
  }
});

app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Redis connection
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      service: 'notification',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      dependencies: {
        redis: 'connected',
        sendgrid: process.env.SENDGRID_API_KEY ? 'configured' : 'not configured',
        firebase: process.env.FIREBASE_PROJECT_ID ? 'configured' : 'not configured'
      },
      queues: {
        email: {
          waiting: await emailQueue.getWaitingCount(),
          active: await emailQueue.getActiveCount(),
          completed: await emailQueue.getCompletedCount(),
          failed: await emailQueue.getFailedCount()
        },
        push: {
          waiting: await pushQueue.getWaitingCount(),
          active: await pushQueue.getActiveCount(),
          completed: await pushQueue.getCompletedCount(),
          failed: await pushQueue.getFailedCount()
        }
      }
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'notification',
      timestamp: new Date().toISOString(),
      error: 'Service dependencies failed'
    });
  }
});

// Email notification endpoints
app.post('/api/notifications/email/send', async (req, res) => {
  try {
    const { to, subject, content, template, templateData, templateId } = req.body;
    
    if (!to || !subject || (!content && !template && !templateId)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: to, subject, and content or template or templateId'
        }
      });
    }
    
    const emailNotification: EmailNotification = {
      to,
      subject,
      html: content || template,
      templateId,
      templateData
    };
    
    // Send email via email service
    const result = await emailService.sendEmail(emailNotification);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          type: 'EMAIL_ERROR',
          code: 'EMAIL_SEND_FAILED',
          message: result.error || 'Failed to send email'
        }
      });
    }
  } catch (error: any) {
    logger.error('Error sending email', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'EMAIL_ERROR',
        code: 'EMAIL_SEND_FAILED',
        message: error.message || 'Failed to send email'
      }
    });
  }
});

app.post('/api/notifications/email/bulk', async (req, res) => {
  try {
    const { recipients, subject, content, template, templateData, templateId } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_RECIPIENTS',
          message: 'Recipients must be a non-empty array'
        }
      });
    }
    
    // Create email notifications for each recipient
    const emailNotifications: EmailNotification[] = recipients.map(recipient => ({
      to: recipient.email,
      subject,
      html: content || template,
      templateId,
      templateData: { ...templateData, ...recipient.data }
    }));
    
    // Send bulk emails
    const result = await emailService.sendBulkEmails(emailNotifications);
    
    res.status(200).json({
      success: true,
      message: `Bulk emails sent`,
      successCount: result.successCount,
      failureCount: result.failureCount
    });
  } catch (error: any) {
    logger.error('Error sending bulk emails', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'EMAIL_ERROR',
        code: 'BULK_EMAIL_SEND_FAILED',
        message: error.message || 'Failed to send bulk emails'
      }
    });
  }
});

// Push notification endpoints
app.post('/api/notifications/push/send', async (req, res) => {
  try {
    const { tokens, userId, title, body, data, imageUrl, clickAction } = req.body;
    
    let deviceTokens = tokens;
    
    // If userId provided, get user's device tokens
    if (userId && (!tokens || tokens.length === 0)) {
      deviceTokens = await pushService.getUserTokens(userId);
    }
    
    if (!deviceTokens || deviceTokens.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'NO_TOKENS',
          message: 'No device tokens provided or found for user'
        }
      });
    }
    
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'title and body are required'
        }
      });
    }
    
    const pushNotification: PushNotification = {
      tokens: deviceTokens,
      title,
      body,
      data,
      imageUrl,
      clickAction
    };
    
    // Send push notification
    const result = await pushService.sendPushNotification(pushNotification);
    
    res.status(200).json({
      success: true,
      message: 'Push notification sent',
      successCount: result.successCount,
      failureCount: result.failureCount
    });
  } catch (error: any) {
    logger.error('Error sending push notification', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'PUSH_SEND_FAILED',
        message: error.message || 'Failed to send push notification'
      }
    });
  }
});

app.post('/api/notifications/push/subscribe', async (req, res) => {
  try {
    const { userId, token, platform } = req.body;
    
    if (!userId || !token || !platform) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, token, and platform are required'
        }
      });
    }
    
    await pushService.registerDeviceToken(userId, token, platform);
    
    res.json({
      success: true,
      message: 'Device token registered successfully'
    });
  } catch (error: any) {
    logger.error('Error registering device token', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'TOKEN_REGISTRATION_FAILED',
        message: error.message || 'Failed to register device token'
      }
    });
  }
});

app.delete('/api/notifications/push/unsubscribe', async (req, res) => {
  try {
    const { userId, token } = req.body;
    
    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId and token are required'
        }
      });
    }
    
    await pushService.removeDeviceToken(userId, token);
    
    res.json({
      success: true,
      message: 'Device token removed successfully'
    });
  } catch (error: any) {
    logger.error('Error removing device token', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'TOKEN_REMOVAL_FAILED',
        message: error.message || 'Failed to remove device token'
      }
    });
  }
});

app.post('/api/notifications/push/topic', async (req, res) => {
  try {
    const { topic, title, body, data } = req.body;
    
    if (!topic || !title || !body) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'topic, title, and body are required'
        }
      });
    }
    
    const result = await pushService.sendToTopic(topic, { title, body, data, tokens: [] });
    
    res.json({
      success: true,
      message: 'Push notification sent to topic',
      messageId: result.messageId
    });
  } catch (error: any) {
    logger.error('Error sending push to topic', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'TOPIC_SEND_FAILED',
        message: error.message || 'Failed to send push to topic'
      }
    });
  }
});

// Notification preferences endpoints
app.get('/api/notifications/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const preferences = await notificationRouter.getUserPreferences(userId);
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error: any) {
    logger.error('Error fetching notification preferences', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'PREFERENCES_FETCH_FAILED',
        message: error.message || 'Failed to fetch notification preferences'
      }
    });
  }
});

app.put('/api/notifications/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;
    
    await notificationRouter.updateUserPreferences(userId, preferences);
    
    res.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating notification preferences', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'PREFERENCES_UPDATE_FAILED',
        message: error.message || 'Failed to update notification preferences'
      }
    });
  }
});

// Template management endpoints
app.get('/api/notifications/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = await emailService.getTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND',
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error: any) {
    logger.error('Error fetching template', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'TEMPLATE_FETCH_FAILED',
        message: error.message || 'Failed to fetch template'
      }
    });
  }
});

app.post('/api/notifications/templates', async (req, res) => {
  try {
    const template: NotificationTemplate = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await emailService.saveTemplate(template);
    
    res.status(201).json({
      success: true,
      message: 'Template created successfully'
    });
  } catch (error: any) {
    logger.error('Error creating template', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'TEMPLATE_CREATE_FAILED',
        message: error.message || 'Failed to create template'
      }
    });
  }
});

app.put('/api/notifications/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template: NotificationTemplate = {
      ...req.body,
      id: templateId,
      updatedAt: new Date()
    };
    
    await emailService.saveTemplate(template);
    
    res.json({
      success: true,
      message: 'Template updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating template', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'TEMPLATE_UPDATE_FAILED',
        message: error.message || 'Failed to update template'
      }
    });
  }
});

// Event trigger endpoints
app.post('/api/notifications/events/publish', async (req, res) => {
  try {
    const event: NotificationEvent = {
      ...req.body,
      timestamp: new Date()
    };
    
    await triggerService.publishEvent(event);
    
    res.json({
      success: true,
      message: 'Event published successfully'
    });
  } catch (error: any) {
    logger.error('Error publishing event', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'EVENT_ERROR',
        code: 'EVENT_PUBLISH_FAILED',
        message: error.message || 'Failed to publish event'
      }
    });
  }
});

// Automated trigger endpoints
app.post('/api/notifications/triggers/enrollment', async (req, res) => {
  try {
    const { userId, enrollmentData } = req.body;
    
    if (!userId || !enrollmentData) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId and enrollmentData are required'
        }
      });
    }
    
    await triggerService.sendEnrollmentConfirmation(userId, enrollmentData);
    
    res.json({
      success: true,
      message: 'Enrollment confirmation triggered'
    });
  } catch (error: any) {
    logger.error('Error triggering enrollment confirmation', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'TRIGGER_ERROR',
        code: 'TRIGGER_FAILED',
        message: error.message || 'Failed to trigger notification'
      }
    });
  }
});

app.post('/api/notifications/triggers/payment', async (req, res) => {
  try {
    const { userId, paymentData } = req.body;
    
    if (!userId || !paymentData) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId and paymentData are required'
        }
      });
    }
    
    await triggerService.sendPaymentReceipt(userId, paymentData);
    
    res.json({
      success: true,
      message: 'Payment receipt triggered'
    });
  } catch (error: any) {
    logger.error('Error triggering payment receipt', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'TRIGGER_ERROR',
        code: 'TRIGGER_FAILED',
        message: error.message || 'Failed to trigger notification'
      }
    });
  }
});

app.post('/api/notifications/triggers/reminder', async (req, res) => {
  try {
    const { userId, courseData } = req.body;
    
    if (!userId || !courseData) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId and courseData are required'
        }
      });
    }
    
    await triggerService.sendCourseReminder(userId, courseData);
    
    res.json({
      success: true,
      message: 'Course reminder triggered'
    });
  } catch (error: any) {
    logger.error('Error triggering course reminder', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'TRIGGER_ERROR',
        code: 'TRIGGER_FAILED',
        message: error.message || 'Failed to trigger notification'
      }
    });
  }
});

// Queue processing functions
function processEmailQueue() {
  emailQueue.process('send-email', async (job) => {
    const notification = job.data;
    
    try {
      const emailNotification: EmailNotification = {
        to: notification.userId, // This should be email address
        subject: notification.subject || 'Notification',
        html: notification.content,
        templateId: notification.templateId,
        templateData: notification.templateData
      };
      
      const result = await emailService.sendEmail(emailNotification);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      logger.info('Email sent successfully from queue', { 
        userId: notification.userId,
        messageId: result.messageId
      });
    } catch (error: any) {
      logger.error('Failed to send email from queue', { 
        error: error.message,
        notification
      });
      throw error;
    }
  });
}

function processPushQueue() {
  pushQueue.process('send-push', async (job) => {
    const notification = job.data;
    
    try {
      // Get user's device tokens
      const tokens = await pushService.getUserTokens(notification.userId);
      
      if (tokens.length === 0) {
        logger.warn('No device tokens found for user', { userId: notification.userId });
        return;
      }
      
      const pushNotification: PushNotification = {
        tokens,
        title: notification.subject || 'Notification',
        body: notification.content,
        data: notification.templateData
      };
      
      const result = await pushService.sendPushNotification(pushNotification);
      
      logger.info('Push notification sent from queue', { 
        userId: notification.userId,
        successCount: result.successCount,
        failureCount: result.failureCount
      });
    } catch (error: any) {
      logger.error('Failed to send push notification from queue', { 
        error: error.message,
        notification
      });
      throw error;
    }
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      type: 'NOT_FOUND',
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    }
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      type: 'INTERNAL_SERVER_ERROR',
      code: 'UNEXPECTED_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await emailQueue.close();
  await pushQueue.close();
  await redisClient?.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await emailQueue.close();
  await pushQueue.close();
  await redisClient?.quit();
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    logger.info('Connected to Redis');
    
    // Initialize job queues
    emailQueue = new Queue('email notifications', process.env.REDIS_URL || 'redis://localhost:6379');
    pushQueue = new Queue('push notifications', process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Initialize services
    emailService = new EmailService(redisClient, logger);
    pushService = new PushService(redisClient, logger);
    notificationRouter = new NotificationRouter(redisClient, logger);
    triggerService = new TriggerService(
      redisClient,
      emailService,
      pushService,
      emailQueue,
      pushQueue,
      logger
    );
    
    // Start queue processors
    processEmailQueue();
    processPushQueue();
    
    // Initialize default notification rules and templates
    await triggerService.initializeDefaultRules();
    await initializeDefaultTemplates();
    
    logger.info('Notification services initialized');
    
    app.listen(PORT, () => {
      logger.info(`Notification Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start Notification Service', error);
    process.exit(1);
  }
}

// Initialize default email templates
async function initializeDefaultTemplates(): Promise<void> {
  const defaultTemplates: NotificationTemplate[] = [
    {
      id: 'enrollment_confirmation',
      name: 'Enrollment Confirmation',
      channel: NotificationChannel.EMAIL,
      type: NotificationType.TRANSACTIONAL,
      subject: 'Welcome to {{programName}}!',
      content: `
        <h1>Welcome to {{programName}}!</h1>
        <p>Hi {{userName}},</p>
        <p>Congratulations! You have successfully enrolled in {{programName}}.</p>
        <p><strong>Enrollment Details:</strong></p>
        <ul>
          <li>Program: {{programName}}</li>
          <li>Start Date: {{startDate}}</li>
          <li>Duration: {{duration}}</li>
        </ul>
        <p>You can access your course materials from your dashboard.</p>
        <p>Best regards,<br>Sai Mahendra Team</p>
      `,
      variables: ['userName', 'programName', 'startDate', 'duration'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'payment_receipt',
      name: 'Payment Receipt',
      channel: NotificationChannel.EMAIL,
      type: NotificationType.TRANSACTIONAL,
      subject: 'Payment Receipt - {{transactionId}}',
      content: `
        <h1>Payment Receipt</h1>
        <p>Hi {{userName}},</p>
        <p>Thank you for your payment. Here are the details:</p>
        <p><strong>Transaction Details:</strong></p>
        <ul>
          <li>Transaction ID: {{transactionId}}</li>
          <li>Amount: {{amount}} {{currency}}</li>
          <li>Date: {{paymentDate}}</li>
          <li>Program: {{programName}}</li>
        </ul>
        <p>Your payment has been successfully processed.</p>
        <p>Best regards,<br>Sai Mahendra Team</p>
      `,
      variables: ['userName', 'transactionId', 'amount', 'currency', 'paymentDate', 'programName'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'course_reminder',
      name: 'Course Reminder',
      channel: NotificationChannel.PUSH,
      type: NotificationType.ENGAGEMENT,
      subject: 'Don\'t forget your course!',
      content: 'You have pending lessons in {{courseName}}. Continue learning today!',
      variables: ['courseName'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'deadline_notification',
      name: 'Deadline Notification',
      channel: NotificationChannel.EMAIL,
      type: NotificationType.ENGAGEMENT,
      subject: 'Upcoming Deadline - {{courseName}}',
      content: `
        <h1>Upcoming Deadline</h1>
        <p>Hi {{userName}},</p>
        <p>This is a reminder that you have an upcoming deadline:</p>
        <p><strong>Details:</strong></p>
        <ul>
          <li>Course: {{courseName}}</li>
          <li>Assignment: {{assignmentName}}</li>
          <li>Due Date: {{dueDate}}</li>
        </ul>
        <p>Make sure to complete your assignment before the deadline.</p>
        <p>Best regards,<br>Sai Mahendra Team</p>
      `,
      variables: ['userName', 'courseName', 'assignmentName', 'dueDate'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'subscription_renewal',
      name: 'Subscription Renewal',
      channel: NotificationChannel.EMAIL,
      type: NotificationType.TRANSACTIONAL,
      subject: 'Your subscription will renew soon',
      content: `
        <h1>Subscription Renewal Notice</h1>
        <p>Hi {{userName}},</p>
        <p>Your subscription to {{programName}} will automatically renew on {{renewalDate}}.</p>
        <p><strong>Renewal Details:</strong></p>
        <ul>
          <li>Amount: {{amount}} {{currency}}</li>
          <li>Renewal Date: {{renewalDate}}</li>
          <li>Payment Method: {{paymentMethod}}</li>
        </ul>
        <p>If you wish to cancel, please do so before the renewal date.</p>
        <p>Best regards,<br>Sai Mahendra Team</p>
      `,
      variables: ['userName', 'programName', 'renewalDate', 'amount', 'currency', 'paymentMethod'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'payment_failure',
      name: 'Payment Failure',
      channel: NotificationChannel.EMAIL,
      type: NotificationType.TRANSACTIONAL,
      subject: 'Payment Failed - Action Required',
      content: `
        <h1>Payment Failed</h1>
        <p>Hi {{userName}},</p>
        <p>We were unable to process your payment for {{programName}}.</p>
        <p><strong>Failure Details:</strong></p>
        <ul>
          <li>Reason: {{failureReason}}</li>
          <li>Amount: {{amount}} {{currency}}</li>
          <li>Date: {{attemptDate}}</li>
        </ul>
        <p>Please update your payment method to continue your subscription.</p>
        <p>Best regards,<br>Sai Mahendra Team</p>
      `,
      variables: ['userName', 'programName', 'failureReason', 'amount', 'currency', 'attemptDate'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const template of defaultTemplates) {
    try {
      await emailService.saveTemplate(template);
    } catch (error) {
      logger.error('Error creating default template', { error, template: template.name });
    }
  }

  logger.info('Default templates initialized');
}

startServer();

export default app;