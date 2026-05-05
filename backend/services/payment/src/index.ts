import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { PaymentService } from './services/PaymentService';
import { MobilePaymentService } from './services/MobilePaymentService';
import { RazorpayGateway } from './gateways/RazorpayGateway';
import { StripeGateway } from './gateways/StripeGateway';
import { createMobilePaymentRoutes } from './routes/mobilePayment';
import { PaymentGatewayConfig } from './types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

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

// Database connections
let pgPool: Pool;
let redisClient: any;
let paymentService: PaymentService;
let mobilePaymentService: MobilePaymentService;
let gatewayConfig: PaymentGatewayConfig;

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
    // Check PostgreSQL connection
    await pgPool.query('SELECT 1');
    
    // Check Redis connection
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      service: 'payment',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      dependencies: {
        postgresql: 'connected',
        redis: 'connected',
        razorpay: process.env.RAZORPAY_KEY_ID ? 'configured' : 'not configured',
        stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured'
      }
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'payment',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Payment endpoints
app.post('/api/payments/create-order', async (req, res) => {
  try {
    const { userId, programId, amount, currency, gateway } = req.body;
    
    if (!userId || !programId || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: userId, programId, amount, currency'
        }
      });
    }
    
    const order = await paymentService.createOrder({
      userId,
      programId,
      amount: parseFloat(amount),
      currency,
      gateway: gateway || 'razorpay'
    });
    
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error creating payment order', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PAYMENT_ERROR',
        code: 'ORDER_CREATION_FAILED',
        message: 'Failed to create payment order'
      }
    });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  try {
    const { orderId, paymentId, signature, gateway } = req.body;
    
    if (!orderId || !paymentId) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: orderId, paymentId'
        }
      });
    }
    
    const verification = await paymentService.verifyPayment({
      orderId,
      paymentId,
      signature,
      gateway: gateway || 'razorpay'
    });
    
    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error('Error verifying payment', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PAYMENT_ERROR',
        code: 'VERIFICATION_FAILED',
        message: 'Failed to verify payment'
      }
    });
  }
});

// Webhook endpoints
app.post('/api/payments/webhook/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing signature'
      });
    }
    
    await paymentService.handleWebhook('razorpay', req.body, signature);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Razorpay webhook error', error);
    res.status(400).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

app.post('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing signature'
      });
    }
    
    await paymentService.handleWebhook('stripe', req.body, signature);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Stripe webhook error', error);
    res.status(400).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

// Subscription endpoints
app.get('/api/subscriptions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const subscriptions = await paymentService.getUserSubscriptions(userId);
    
    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    logger.error('Error fetching user subscriptions', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'SUBSCRIPTIONS_FETCH_FAILED',
        message: 'Failed to fetch user subscriptions'
      }
    });
  }
});

app.post('/api/subscriptions/create', async (req, res) => {
  try {
    const { userId, programId, billingCycle, gateway } = req.body;
    
    if (!userId || !programId || !billingCycle) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: userId, programId, billingCycle'
        }
      });
    }
    
    const subscription = await paymentService.createSubscription({
      userId,
      programId,
      billingCycle,
      gateway: gateway || 'razorpay'
    });
    
    res.status(201).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    logger.error('Error creating subscription', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PAYMENT_ERROR',
        code: 'SUBSCRIPTION_CREATION_FAILED',
        message: 'Failed to create subscription'
      }
    });
  }
});

// Refund endpoints
app.post('/api/payments/refund', async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_PAYMENT_ID',
          message: 'Payment ID is required'
        }
      });
    }
    
    const refund = await paymentService.processRefund({
      paymentId,
      amount: amount ? parseFloat(amount) : undefined,
      reason
    });
    
    res.json({
      success: true,
      data: refund
    });
  } catch (error) {
    logger.error('Error processing refund', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PAYMENT_ERROR',
        code: 'REFUND_FAILED',
        message: 'Failed to process refund'
      }
    });
  }
});

// Mobile payment routes
app.use('/api/payments/mobile', createMobilePaymentRoutes(gatewayConfig));

// Admin endpoints
app.get('/api/admin/payments/reports', async (req, res) => {
  try {
    const { startDate, endDate, gateway } = req.query;
    
    const reports = await paymentService.getPaymentReports({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      gateway: gateway as string
    });
    
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    logger.error('Error fetching payment reports', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'REPORTS_FETCH_FAILED',
        message: 'Failed to fetch payment reports'
      }
    });
  }
});

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
  await pgPool.end();
  await redisClient?.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await pgPool.end();
  await redisClient?.quit();
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to PostgreSQL
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test PostgreSQL connection
    await pgPool.query('SELECT 1');
    logger.info('Connected to PostgreSQL');
    
    // Connect to Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    logger.info('Connected to Redis');
    
    // Initialize payment gateways
    gatewayConfig = {
      razorpay: {
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!,
        webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET!,
      },
      stripe: {
        secret_key: process.env.STRIPE_SECRET_KEY!,
        webhook_secret: process.env.STRIPE_WEBHOOK_SECRET!,
        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY!,
      },
    };
    
    const razorpayGateway = new RazorpayGateway(gatewayConfig.razorpay);
    const stripeGateway = new StripeGateway({
      secret_key: gatewayConfig.stripe.secret_key,
      webhook_secret: gatewayConfig.stripe.webhook_secret,
    });
    
    // Initialize payment services
    paymentService = new PaymentService(gatewayConfig);
    mobilePaymentService = new MobilePaymentService(gatewayConfig);
    
    app.listen(PORT, () => {
      logger.info(`Payment Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start Payment Service', error);
    process.exit(1);
  }
}

startServer();

export default app;