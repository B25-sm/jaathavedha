import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';
import { createClient, RedisClientType } from 'redis';
import { Pool } from 'pg';
import { ServiceWorkerConfigService } from './services/ServiceWorkerConfigService';
import { OfflineSyncService } from './services/OfflineSyncService';
import { PushNotificationService } from './services/PushNotificationService';
import { MobileOptimizationService } from './services/MobileOptimizationService';
import {
  PushSubscriptionRequest,
  OfflineDataRequest,
  MobileAPIResponse
} from './types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3015;

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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
let dbPool: Pool;

// Service instances
let swConfigService: ServiceWorkerConfigService;
let offlineSyncService: OfflineSyncService;
let pushNotificationService: PushNotificationService;
let mobileOptimizationService: MobileOptimizationService;

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
    
    // Check database connection
    await dbPool.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      service: 'pwa',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      dependencies: {
        redis: 'connected',
        database: 'connected',
        vapid: process.env.VAPID_PUBLIC_KEY ? 'configured' : 'not configured'
      }
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'pwa',
      timestamp: new Date().toISOString(),
      error: 'Service dependencies failed'
    });
  }
});

// Service Worker Configuration Endpoints
app.get('/api/pwa/sw-config', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const config = await swConfigService.getServiceWorkerConfig(userId);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    logger.error('Error getting service worker config', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'CONFIG_ERROR',
        code: 'SW_CONFIG_FAILED',
        message: error.message || 'Failed to get service worker configuration'
      }
    });
  }
});

app.get('/api/pwa/manifest.json', async (req, res) => {
  try {
    const manifest = await swConfigService.getWebAppManifest();
    
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json(manifest);
  } catch (error: any) {
    logger.error('Error getting web app manifest', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'MANIFEST_ERROR',
        code: 'MANIFEST_FAILED',
        message: error.message || 'Failed to get web app manifest'
      }
    });
  }
});

app.get('/api/pwa/cache-version', async (req, res) => {
  try {
    const version = await swConfigService.getCurrentCacheVersion();
    
    res.json({
      success: true,
      data: { version }
    });
  } catch (error: any) {
    logger.error('Error getting cache version', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'CACHE_ERROR',
        code: 'CACHE_VERSION_FAILED',
        message: error.message || 'Failed to get cache version'
      }
    });
  }
});

app.post('/api/pwa/cache/clear', async (req, res) => {
  try {
    // This endpoint should be admin-only in production
    await swConfigService.clearAllCaches();
    
    res.json({
      success: true,
      message: 'All caches cleared successfully'
    });
  } catch (error: any) {
    logger.error('Error clearing caches', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'CACHE_ERROR',
        code: 'CACHE_CLEAR_FAILED',
        message: error.message || 'Failed to clear caches'
      }
    });
  }
});

// Offline Synchronization Endpoints
app.post('/api/pwa/sync/queue', async (req, res) => {
  try {
    const { userId, endpoint, method, data, priority } = req.body;
    
    if (!userId || !endpoint || !method || !data) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, endpoint, method, and data are required'
        }
      });
    }
    
    const syncId = await offlineSyncService.queueSyncRequest({
      userId,
      endpoint,
      method,
      data,
      priority: priority || 'medium'
    });
    
    res.status(201).json({
      success: true,
      message: 'Sync request queued successfully',
      data: { syncId }
    });
  } catch (error: any) {
    logger.error('Error queuing sync request', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYNC_ERROR',
        code: 'SYNC_QUEUE_FAILED',
        message: error.message || 'Failed to queue sync request'
      }
    });
  }
});

app.post('/api/pwa/sync/process', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const result = await offlineSyncService.processSyncQueue(userId);
    
    res.json({
      success: true,
      message: 'Sync processing completed',
      data: result
    });
  } catch (error: any) {
    logger.error('Error processing sync queue', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYNC_ERROR',
        code: 'SYNC_PROCESS_FAILED',
        message: error.message || 'Failed to process sync queue'
      }
    });
  }
});

app.get('/api/pwa/sync/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const status = await offlineSyncService.getSyncStatus(userId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error('Error getting sync status', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYNC_ERROR',
        code: 'SYNC_STATUS_FAILED',
        message: error.message || 'Failed to get sync status'
      }
    });
  }
});

app.post('/api/pwa/sync/cancel', async (req, res) => {
  try {
    const { userId, syncIds } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_USER_ID',
          message: 'userId is required'
        }
      });
    }
    
    await offlineSyncService.cancelSyncRequests(userId, syncIds);
    
    res.json({
      success: true,
      message: 'Sync requests cancelled successfully'
    });
  } catch (error: any) {
    logger.error('Error cancelling sync requests', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYNC_ERROR',
        code: 'SYNC_CANCEL_FAILED',
        message: error.message || 'Failed to cancel sync requests'
      }
    });
  }
});

app.post('/api/pwa/offline/data', async (req, res) => {
  try {
    const request: OfflineDataRequest = req.body;
    
    if (!request.userId || !request.dataTypes || request.dataTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_REQUEST',
          message: 'userId and dataTypes are required'
        }
      });
    }
    
    const offlineData = await offlineSyncService.getOfflineData(request);
    
    res.json({
      success: true,
      data: offlineData
    });
  } catch (error: any) {
    logger.error('Error getting offline data', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'OFFLINE_DATA_ERROR',
        code: 'OFFLINE_DATA_FAILED',
        message: error.message || 'Failed to get offline data'
      }
    });
  }
});

// Push Notification Subscription Endpoints
app.post('/api/pwa/push/subscribe', async (req, res) => {
  try {
    const subscriptionRequest: PushSubscriptionRequest = req.body;
    
    if (!subscriptionRequest.userId || !subscriptionRequest.subscription) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_SUBSCRIPTION',
          message: 'userId and subscription are required'
        }
      });
    }
    
    const subscriptionId = await pushNotificationService.subscribe(subscriptionRequest);
    
    res.status(201).json({
      success: true,
      message: 'Push subscription created successfully',
      data: { subscriptionId }
    });
  } catch (error: any) {
    logger.error('Error creating push subscription', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'SUBSCRIPTION_FAILED',
        message: error.message || 'Failed to create push subscription'
      }
    });
  }
});

app.delete('/api/pwa/push/unsubscribe', async (req, res) => {
  try {
    const { userId, endpoint } = req.body;
    
    if (!userId || !endpoint) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId and endpoint are required'
        }
      });
    }
    
    await pushNotificationService.unsubscribe(userId, endpoint);
    
    res.json({
      success: true,
      message: 'Push subscription removed successfully'
    });
  } catch (error: any) {
    logger.error('Error removing push subscription', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'UNSUBSCRIBE_FAILED',
        message: error.message || 'Failed to remove push subscription'
      }
    });
  }
});

app.get('/api/pwa/push/subscriptions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const subscriptions = await pushNotificationService.getUserSubscriptions(userId);
    
    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error: any) {
    logger.error('Error getting user subscriptions', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'GET_SUBSCRIPTIONS_FAILED',
        message: error.message || 'Failed to get user subscriptions'
      }
    });
  }
});

app.post('/api/pwa/push/send', async (req, res) => {
  try {
    const { userId, title, body, data, icon, badge, image, actions } = req.body;
    
    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, title, and body are required'
        }
      });
    }
    
    const result = await pushNotificationService.sendNotification(userId, {
      title,
      body,
      data,
      icon,
      badge,
      image,
      actions
    });
    
    res.json({
      success: true,
      message: 'Push notification sent',
      data: result
    });
  } catch (error: any) {
    logger.error('Error sending push notification', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'SEND_NOTIFICATION_FAILED',
        message: error.message || 'Failed to send push notification'
      }
    });
  }
});

app.get('/api/pwa/push/vapid-public-key', async (req, res) => {
  try {
    const publicKey = await pushNotificationService.getVapidPublicKey();
    
    res.json({
      success: true,
      data: { publicKey }
    });
  } catch (error: any) {
    logger.error('Error getting VAPID public key', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'PUSH_ERROR',
        code: 'VAPID_KEY_FAILED',
        message: error.message || 'Failed to get VAPID public key'
      }
    });
  }
});

// Mobile Optimization Endpoints
app.post('/api/pwa/mobile/optimize', async (req, res) => {
  try {
    const { data, compressionEnabled } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_DATA',
          message: 'data is required'
        }
      });
    }
    
    const optimizedResponse = await mobileOptimizationService.optimizeResponse(
      data,
      compressionEnabled !== false
    );
    
    res.json(optimizedResponse);
  } catch (error: any) {
    logger.error('Error optimizing mobile response', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'OPTIMIZATION_ERROR',
        code: 'OPTIMIZATION_FAILED',
        message: error.message || 'Failed to optimize response'
      }
    });
  }
});

app.get('/api/pwa/mobile/config', async (req, res) => {
  try {
    const config = await mobileOptimizationService.getMobileConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    logger.error('Error getting mobile config', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'CONFIG_ERROR',
        code: 'MOBILE_CONFIG_FAILED',
        message: error.message || 'Failed to get mobile configuration'
      }
    });
  }
});

app.post('/api/pwa/mobile/image/optimize', async (req, res) => {
  try {
    const { imageUrl, quality, maxWidth, maxHeight } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_IMAGE_URL',
          message: 'imageUrl is required'
        }
      });
    }
    
    const optimizedUrl = await mobileOptimizationService.optimizeImage(
      imageUrl,
      quality,
      maxWidth,
      maxHeight
    );
    
    res.json({
      success: true,
      data: { optimizedUrl }
    });
  } catch (error: any) {
    logger.error('Error optimizing image', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'IMAGE_ERROR',
        code: 'IMAGE_OPTIMIZATION_FAILED',
        message: error.message || 'Failed to optimize image'
      }
    });
  }
});

app.get('/api/pwa/mobile/network-status', async (req, res) => {
  try {
    const userAgent = req.get('User-Agent') || '';
    const networkInfo = mobileOptimizationService.detectNetworkCapabilities(userAgent);
    
    res.json({
      success: true,
      data: networkInfo
    });
  } catch (error: any) {
    logger.error('Error detecting network status', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'NETWORK_ERROR',
        code: 'NETWORK_DETECTION_FAILED',
        message: error.message || 'Failed to detect network status'
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
  await redisClient?.quit();
  await dbPool?.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisClient?.quit();
  await dbPool?.end();
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
    
    // Connect to PostgreSQL
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    await dbPool.query('SELECT 1');
    logger.info('Connected to PostgreSQL');
    
    // Initialize services
    swConfigService = new ServiceWorkerConfigService(redisClient, logger);
    offlineSyncService = new OfflineSyncService(redisClient, dbPool, logger);
    pushNotificationService = new PushNotificationService(redisClient, dbPool, logger);
    mobileOptimizationService = new MobileOptimizationService(redisClient, logger);
    
    logger.info('PWA services initialized');
    
    app.listen(PORT, () => {
      logger.info(`PWA Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start PWA Service', error);
    process.exit(1);
  }
}

startServer();

export default app;
