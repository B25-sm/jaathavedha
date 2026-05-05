import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { createClient, RedisClientType } from 'redis';
import { AnalyticsEvent, EventType, UserMetrics, ReportType, ExportFormat } from './types';
import { MetricsService } from './services/MetricsService';
import { ReportService } from './services/ReportService';
import { AlertService } from './services/AlertService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

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
let mongoDb: Db;
let redisClient: RedisClientType;

// Services
let metricsService: MetricsService;
let reportService: ReportService;
let alertService: AlertService;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for analytics events
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
    // Check MongoDB connection
    await mongoDb.admin().ping();
    
    // Check Redis connection
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      service: 'analytics',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      dependencies: {
        mongodb: 'connected',
        redis: 'connected'
      }
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'analytics',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Real-time event processing with Redis streams
async function processEventStream(event: AnalyticsEvent): Promise<void> {
  try {
    // Add event to Redis stream for real-time processing
    await redisClient.xAdd(
      'analytics:events',
      '*',
      {
        eventType: event.eventType,
        userId: event.userId || 'anonymous',
        sessionId: event.sessionId,
        properties: JSON.stringify(event.properties),
        timestamp: event.timestamp.toISOString()
      }
    );
    
    // Update real-time metrics in Redis
    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      redisClient.incr(`analytics:events:${today}`),
      redisClient.incr(`analytics:events:${event.eventType}:${today}`),
      event.userId && redisClient.sAdd(`analytics:active_users:${today}`, event.userId)
    ]);
    
    // Update user metrics if userId is present
    if (event.userId) {
      await updateUserMetrics(event.userId, event);
    }
  } catch (error) {
    logger.error('Error processing event stream', error);
  }
}

async function updateUserMetrics(userId: string, event: AnalyticsEvent): Promise<void> {
  try {
    const update: any = {
      $inc: { totalPageViews: event.eventType === EventType.PAGE_VIEW ? 1 : 0 },
      $set: { lastActiveAt: new Date(), updatedAt: new Date() },
      $setOnInsert: { userId, createdAt: new Date() }
    };
    
    // Update enrollment count
    if (event.eventType === EventType.ENROLLMENT_COMPLETED) {
      update.$inc.enrollmentCount = 1;
    }
    
    // Update completion count
    if (event.eventType === EventType.COURSE_COMPLETED) {
      update.$inc.completionCount = 1;
    }
    
    // Update revenue
    if (event.eventType === EventType.PAYMENT_COMPLETED && event.properties.amount) {
      update.$inc.totalRevenue = event.properties.amount;
    }
    
    await mongoDb.collection('user_metrics').updateOne(
      { userId },
      update,
      { upsert: true }
    );
  } catch (error) {
    logger.error('Error updating user metrics', error);
  }
}

// Event tracking endpoints
app.post('/api/analytics/events', async (req, res) => {
  try {
    const { eventType, userId, sessionId, properties, timestamp } = req.body;
    
    // Validate required fields
    if (!eventType || !sessionId) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'eventType and sessionId are required'
        }
      });
    }
    
    const event: AnalyticsEvent = {
      eventType,
      userId,
      sessionId,
      properties: properties || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    };
    
    // Store event in MongoDB
    const result = await mongoDb.collection('events').insertOne(event);
    
    // Process event in real-time with Redis streams
    await processEventStream({ ...event, id: result.insertedId.toString() });
    
    res.status(201).json({
      success: true,
      message: 'Event tracked successfully',
      eventId: result.insertedId
    });
  } catch (error) {
    logger.error('Error tracking event', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'EVENT_TRACKING_FAILED',
        message: 'Failed to track event'
      }
    });
  }
});

app.post('/api/analytics/page-view', async (req, res) => {
  try {
    const { page, userId, sessionId, referrer, timestamp } = req.body;
    
    if (!page || !sessionId) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'page and sessionId are required'
        }
      });
    }
    
    const pageView = {
      eventType: EventType.PAGE_VIEW,
      page,
      userId,
      sessionId,
      referrer,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    };
    
    await mongoDb.collection('page_views').insertOne(pageView);
    
    // Process in real-time
    await processEventStream({
      eventType: EventType.PAGE_VIEW,
      userId,
      sessionId,
      properties: { page, referrer },
      timestamp: pageView.timestamp
    });
    
    res.status(201).json({
      success: true,
      message: 'Page view tracked successfully'
    });
  } catch (error) {
    logger.error('Error tracking page view', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'PAGE_VIEW_TRACKING_FAILED',
        message: 'Failed to track page view'
      }
    });
  }
});

// Batch event tracking
app.post('/api/analytics/events/batch', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_BATCH',
          message: 'events must be a non-empty array'
        }
      });
    }
    
    const processedEvents = events.map(e => ({
      eventType: e.eventType,
      userId: e.userId,
      sessionId: e.sessionId,
      properties: e.properties || {},
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    }));
    
    // Store all events
    const result = await mongoDb.collection('events').insertMany(processedEvents);
    
    // Process each event in real-time
    await Promise.all(
      processedEvents.map(event => processEventStream(event))
    );
    
    res.status(201).json({
      success: true,
      message: `${result.insertedCount} events tracked successfully`,
      count: result.insertedCount
    });
  } catch (error) {
    logger.error('Error tracking batch events', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'BATCH_TRACKING_FAILED',
        message: 'Failed to track batch events'
      }
    });
  }
});

// User action tracking
app.post('/api/analytics/user-action', async (req, res) => {
  try {
    const { action, userId, sessionId, metadata, timestamp } = req.body;
    
    if (!action || !sessionId) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'action and sessionId are required'
        }
      });
    }
    
    const event: AnalyticsEvent = {
      eventType: EventType.CUSTOM,
      userId,
      sessionId,
      properties: { action, ...metadata },
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    };
    
    const result = await mongoDb.collection('events').insertOne(event);
    await processEventStream({ ...event, id: result.insertedId.toString() });
    
    res.status(201).json({
      success: true,
      message: 'User action tracked successfully'
    });
  } catch (error) {
    logger.error('Error tracking user action', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'ACTION_TRACKING_FAILED',
        message: 'Failed to track user action'
      }
    });
  }
});

// Dashboard and reporting endpoints
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Get real-time metrics from Redis
    const todayKey = today.toISOString().split('T')[0];
    const [activeUsersCount, todayEventsCount] = await Promise.all([
      redisClient.sCard(`analytics:active_users:${todayKey}`),
      redisClient.get(`analytics:events:${todayKey}`)
    ]);
    
    // Get database metrics
    const [
      todayPageViews,
      weeklyPageViews,
      monthlyPageViews,
      todayEvents,
      weeklyEvents,
      monthlyEvents,
      todayRevenue,
      weeklyRevenue,
      monthlyRevenue,
      todayEnrollments,
      weeklyEnrollments,
      monthlyEnrollments,
      topPages,
      alerts
    ] = await Promise.all([
      mongoDb.collection('page_views').countDocuments({ timestamp: { $gte: startOfDay } }),
      mongoDb.collection('page_views').countDocuments({ timestamp: { $gte: startOfWeek } }),
      mongoDb.collection('page_views').countDocuments({ timestamp: { $gte: startOfMonth } }),
      mongoDb.collection('events').countDocuments({ timestamp: { $gte: startOfDay } }),
      mongoDb.collection('events').countDocuments({ timestamp: { $gte: startOfWeek } }),
      mongoDb.collection('events').countDocuments({ timestamp: { $gte: startOfMonth } }),
      // Revenue calculations
      mongoDb.collection('events').aggregate([
        { $match: { eventType: EventType.PAYMENT_COMPLETED, timestamp: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$properties.amount' } } }
      ]).toArray(),
      mongoDb.collection('events').aggregate([
        { $match: { eventType: EventType.PAYMENT_COMPLETED, timestamp: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$properties.amount' } } }
      ]).toArray(),
      mongoDb.collection('events').aggregate([
        { $match: { eventType: EventType.PAYMENT_COMPLETED, timestamp: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$properties.amount' } } }
      ]).toArray(),
      // Enrollment counts
      mongoDb.collection('events').countDocuments({
        eventType: EventType.ENROLLMENT_COMPLETED,
        timestamp: { $gte: startOfDay }
      }),
      mongoDb.collection('events').countDocuments({
        eventType: EventType.ENROLLMENT_COMPLETED,
        timestamp: { $gte: startOfWeek }
      }),
      mongoDb.collection('events').countDocuments({
        eventType: EventType.ENROLLMENT_COMPLETED,
        timestamp: { $gte: startOfMonth }
      }),
      mongoDb.collection('page_views').aggregate([
        { $match: { timestamp: { $gte: startOfWeek } } },
        { $group: { _id: '$page', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray(),
      alertService.getActiveAlerts(10)
    ]);
    
    res.json({
      success: true,
      data: {
        realTime: {
          activeUsers: activeUsersCount,
          todayPageViews,
          todayEvents,
          todayRevenue: todayRevenue[0]?.total || 0,
          todayEnrollments
        },
        trends: {
          pageViews: {
            today: todayPageViews,
            week: weeklyPageViews,
            month: monthlyPageViews
          },
          events: {
            today: todayEvents,
            week: weeklyEvents,
            month: monthlyEvents
          },
          revenue: {
            today: todayRevenue[0]?.total || 0,
            week: weeklyRevenue[0]?.total || 0,
            month: monthlyRevenue[0]?.total || 0
          },
          enrollments: {
            today: todayEnrollments,
            week: weeklyEnrollments,
            month: monthlyEnrollments
          }
        },
        topPages: topPages.map(p => ({ page: p._id, views: p.count })),
        alerts
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard data', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'DASHBOARD_FETCH_FAILED',
        message: 'Failed to fetch dashboard data'
      }
    });
  }
});

app.get('/api/analytics/reports/enrollment', async (req, res) => {
  try {
    const { startDate, endDate, programId } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const metrics = await metricsService.calculateEnrollmentMetrics(
      start,
      end,
      programId as string
    );
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching enrollment report', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'REPORT_FETCH_FAILED',
        message: 'Failed to fetch enrollment report'
      }
    });
  }
});

app.get('/api/analytics/reports/revenue', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const metrics = await metricsService.calculateRevenueMetrics(start, end);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching revenue report', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'REPORT_FETCH_FAILED',
        message: 'Failed to fetch revenue report'
      }
    });
  }
});

app.get('/api/analytics/reports/user-engagement', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const metrics = await metricsService.calculateEngagementMetrics(start, end);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching engagement report', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'REPORT_FETCH_FAILED',
        message: 'Failed to fetch engagement report'
      }
    });
  }
});

app.get('/api/analytics/reports/retention', async (req, res) => {
  try {
    const { cohortDate } = req.query;
    
    const date = cohortDate ? new Date(cohortDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const metrics = await metricsService.calculateRetentionMetrics(date);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching retention report', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'REPORT_FETCH_FAILED',
        message: 'Failed to fetch retention report'
      }
    });
  }
});

app.get('/api/analytics/reports/conversion-funnel', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const funnel = await metricsService.calculateConversionFunnel(start, end);
    
    res.json({
      success: true,
      data: funnel
    });
  } catch (error) {
    logger.error('Error fetching conversion funnel', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'REPORT_FETCH_FAILED',
        message: 'Failed to fetch conversion funnel'
      }
    });
  }
});

// Data export endpoint
app.post('/api/analytics/export', async (req, res) => {
  try {
    const { reportType, format, startDate, endDate, filters } = req.body;
    
    if (!reportType || !format) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'reportType and format are required'
        }
      });
    }
    
    const exportData = await reportService.exportReport({
      reportType: reportType as ReportType,
      format: format as ExportFormat,
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date(),
      filters
    });
    
    // Set appropriate content type
    const contentType = format === ExportFormat.JSON ? 'application/json' : 'text/csv';
    const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error) {
    logger.error('Error exporting report', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'EXPORT_ERROR',
        code: 'EXPORT_FAILED',
        message: 'Failed to export report'
      }
    });
  }
});

// Alert management endpoints
app.get('/api/analytics/alerts', async (req, res) => {
  try {
    const { limit } = req.query;
    const alerts = await alertService.getActiveAlerts(
      limit ? parseInt(limit as string) : 50
    );
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Error fetching alerts', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'ALERTS_FETCH_FAILED',
        message: 'Failed to fetch alerts'
      }
    });
  }
});

app.get('/api/analytics/alerts/thresholds', async (req, res) => {
  try {
    const thresholds = await alertService.getActiveThresholds();
    
    res.json({
      success: true,
      data: thresholds
    });
  } catch (error) {
    logger.error('Error fetching alert thresholds', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'THRESHOLDS_FETCH_FAILED',
        message: 'Failed to fetch alert thresholds'
      }
    });
  }
});

app.post('/api/analytics/alerts/thresholds', async (req, res) => {
  try {
    const threshold = req.body;
    
    if (!threshold.metric || !threshold.condition || threshold.threshold === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'metric, condition, and threshold are required'
        }
      });
    }
    
    await alertService.createThreshold(threshold);
    
    res.status(201).json({
      success: true,
      message: 'Alert threshold created successfully'
    });
  } catch (error) {
    logger.error('Error creating alert threshold', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'THRESHOLD_CREATE_FAILED',
        message: 'Failed to create alert threshold'
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
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisClient?.quit();
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    const mongoClient = new MongoClient(
      process.env.MONGODB_URL || 'mongodb://admin:admin123@localhost:27017/sai_mahendra_analytics?authSource=admin'
    );
    await mongoClient.connect();
    mongoDb = mongoClient.db('sai_mahendra_analytics');
    logger.info('Connected to MongoDB');
    
    // Create indexes for better query performance
    await mongoDb.collection('events').createIndex({ eventType: 1, timestamp: -1 });
    await mongoDb.collection('events').createIndex({ userId: 1, timestamp: -1 });
    await mongoDb.collection('events').createIndex({ sessionId: 1 });
    await mongoDb.collection('page_views').createIndex({ page: 1, timestamp: -1 });
    await mongoDb.collection('user_metrics').createIndex({ userId: 1 }, { unique: true });
    await mongoDb.collection('alerts').createIndex({ timestamp: -1 });
    
    // Connect to Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    logger.info('Connected to Redis');
    
    // Initialize services
    metricsService = new MetricsService(mongoDb, redisClient);
    reportService = new ReportService(mongoDb, metricsService);
    alertService = new AlertService(mongoDb, redisClient, logger);
    
    // Initialize default alert thresholds
    await alertService.initializeDefaultThresholds();
    logger.info('Alert thresholds initialized');
    
    // Start periodic alert checking (every 5 minutes)
    setInterval(async () => {
      try {
        await alertService.checkThresholds();
      } catch (error) {
        logger.error('Error checking alert thresholds', error);
      }
    }, 5 * 60 * 1000);
    
    app.listen(PORT, () => {
      logger.info(`Analytics Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start Analytics Service', error);
    process.exit(1);
  }
}

startServer();

export default app;