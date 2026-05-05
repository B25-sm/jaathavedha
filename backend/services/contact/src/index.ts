import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { logger, errorHandler, requestLogger } from '@sai-mahendra/shared-utils';
import { initializeDatabases } from '@sai-mahendra/shared-database';
import { contactRoutes } from './routes/contactRoutes';
import { whatsappRoutes } from './routes/whatsappRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { ContactService } from './services/ContactService';
import { WhatsAppService } from './services/WhatsAppService';
import { EmailService } from './services/EmailService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5'), // 5 requests per window
  message: {
    error: {
      type: 'RATE_LIMIT_ERROR',
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to contact form submissions
app.use('/api/contact/submit', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Initialize services
let contactService: ContactService;
let whatsappService: WhatsAppService;
let emailService: EmailService;

// Routes
app.use('/health', healthRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/admin/contact', adminRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      type: 'NOT_FOUND',
      code: 'ENDPOINT_NOT_FOUND',
      message: 'The requested endpoint was not found',
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  });
});

async function startServer() {
  try {
    // Initialize database connections
    const databases = await initializeDatabases({
      postgres: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'sai_mahendra',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: process.env.NODE_ENV === 'production'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      },
      mongo: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sai_mahendra',
        options: {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        }
      }
    });

    // Initialize services
    emailService = new EmailService({
      sendgridApiKey: process.env.SENDGRID_API_KEY!,
      fromEmail: process.env.FROM_EMAIL || 'noreply@saimahendra.com',
      adminEmail: process.env.ADMIN_EMAIL || 'admin@saimahendra.com'
    });

    whatsappService = new WhatsAppService({
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!
    });

    contactService = new ContactService(
      databases.postgres,
      emailService,
      whatsappService
    );

    // Make services available globally
    app.locals.contactService = contactService;
    app.locals.whatsappService = whatsappService;
    app.locals.emailService = emailService;

    // Start server
    app.listen(PORT, () => {
      logger.info(`Contact Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

  } catch (error) {
    logger.error('Failed to start Contact Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

export default app;