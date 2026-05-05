import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';
import { Pool } from 'pg';
import { MongoClient, Db } from 'mongodb';
import { initializeRedis, redisClient } from './middleware/auth';
import { initializeAuditLogger } from './middleware/auditLogger';
import { UserManagementService } from './services/UserManagementService';
import { ContentManagementService } from './services/ContentManagementService';
import { CourseManagementService } from './services/CourseManagementService';
import { FinancialManagementService } from './services/FinancialManagementService';
import { createAuthRoutes } from './routes/auth';
import { createUserRoutes } from './routes/users';
import { createContentRoutes } from './routes/content';
import { createCourseRoutes } from './routes/courses';
import { createFinancialRoutes } from './routes/financial';
import { createDashboardRoutes } from './routes/dashboard';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;

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
let dbPool: Pool;
let mongoDb: Db;

// Services
let userService: UserManagementService;
let contentService: ContentManagementService;
let courseService: CourseManagementService;
let financialService: FinancialManagementService;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: {
      type: 'RATE_LIMIT_EXCEEDED',
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Body parsing middleware
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
    await dbPool.query('SELECT 1');
    
    // Check MongoDB connection
    await mongoDb.admin().ping();
    
    // Check Redis connection
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      service: 'admin-panel',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      dependencies: {
        postgresql: 'connected',
        mongodb: 'connected',
        redis: 'connected'
      }
    });
  } catch (error: any) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'admin-panel',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API routes
app.use('/api/admin/auth', createAuthRoutes(dbPool));
app.use('/api/admin/users', createUserRoutes(userService));
app.use('/api/admin/content', createContentRoutes(contentService));
app.use('/api/admin/courses', createCourseRoutes(courseService));
app.use('/api/admin/financial', createFinancialRoutes(financialService));
app.use('/api/admin/dashboard', createDashboardRoutes(
  dbPool,
  mongoDb,
  process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006'
));

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

  // Handle Axios errors
  if (error.response) {
    return res.status(error.response.status || 500).json({
      success: false,
      error: {
        type: 'EXTERNAL_SERVICE_ERROR',
        code: 'SERVICE_REQUEST_FAILED',
        message: error.response.data?.error?.message || 'External service request failed',
        timestamp: new Date().toISOString()
      }
    });
  }

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
  await dbPool.end();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await dbPool.end();
  await redisClient.quit();
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to PostgreSQL
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev'
    });
    await dbPool.query('SELECT 1');
    logger.info('Connected to PostgreSQL');

    // Connect to MongoDB
    const mongoClient = new MongoClient(
      process.env.MONGODB_URL || 'mongodb://admin:admin123@localhost:27017/sai_mahendra_content?authSource=admin'
    );
    await mongoClient.connect();
    mongoDb = mongoClient.db('sai_mahendra_content');
    logger.info('Connected to MongoDB');

    // Connect to Redis
    await initializeRedis(process.env.REDIS_URL || 'redis://localhost:6379');
    logger.info('Connected to Redis');

    // Initialize audit logger
    initializeAuditLogger(dbPool);
    logger.info('Audit logger initialized');

    // Create admin_audit_logs table if it doesn't exist
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL,
        admin_email VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        changes JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create payment_refunds table if it doesn't exist
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS payment_refunds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id UUID NOT NULL REFERENCES payments(id),
        amount DECIMAL(10,2) NOT NULL,
        reason TEXT NOT NULL,
        admin_id UUID NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    logger.info('Database tables initialized');

    // Initialize services
    userService = new UserManagementService(
      process.env.USER_SERVICE_URL || 'http://localhost:3001',
      dbPool
    );

    contentService = new ContentManagementService(
      process.env.CONTENT_SERVICE_URL || 'http://localhost:3005',
      mongoDb
    );

    courseService = new CourseManagementService(
      process.env.COURSE_SERVICE_URL || 'http://localhost:3002',
      dbPool
    );

    financialService = new FinancialManagementService(
      process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
      dbPool
    );

    logger.info('Services initialized');

    app.listen(PORT, () => {
      logger.info(`Admin Panel Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Service URLs:', {
        userService: process.env.USER_SERVICE_URL || 'http://localhost:3001',
        courseService: process.env.COURSE_SERVICE_URL || 'http://localhost:3002',
        paymentService: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
        contentService: process.env.CONTENT_SERVICE_URL || 'http://localhost:3005',
        analyticsService: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006'
      });
    });
  } catch (error) {
    logger.error('Failed to start Admin Panel Service', error);
    process.exit(1);
  }
}

startServer();

export default app;
