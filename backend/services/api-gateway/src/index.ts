import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createClient, RedisClientType } from 'redis';
import winston from 'winston';
import axios from 'axios';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Redis client for session management
let redisClient: RedisClientType;

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
const CIRCUIT_BREAKER_RESET_TIMEOUT = 30000; // 30 seconds

// Service health status
interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

const serviceHealthStatus = new Map<string, ServiceHealth>();

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
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

// Authentication middleware
const authenticateToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: {
        type: 'AUTHENTICATION_ERROR',
        code: 'TOKEN_MISSING',
        message: 'Access token is required',
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    // Check if token is blacklisted in Redis
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been revoked',
          timestamp: new Date().toISOString()
        }
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      error: {
        type: 'AUTHENTICATION_ERROR',
        code: 'TOKEN_INVALID',
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Redis connection
    await redisClient.ping();
    
    // Get all service health statuses
    const services: Record<string, any> = {};
    for (const [name, health] of serviceHealthStatus.entries()) {
      services[name] = {
        status: health.status,
        lastCheck: health.lastCheck,
        responseTime: health.responseTime,
        error: health.error
      };
    }
    
    // Determine overall health
    const allHealthy = Array.from(serviceHealthStatus.values()).every(
      h => h.status === 'healthy'
    );
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      dependencies: {
        redis: 'connected'
      },
      services
    });
  } catch (error: any) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Aggregated health check for all services
app.get('/health/services', async (req, res) => {
  const healthChecks = await Promise.all(
    Object.entries(services).map(async ([name, url]) => {
      const health = serviceHealthStatus.get(name);
      return {
        name,
        url,
        status: health?.status || 'unknown',
        lastCheck: health?.lastCheck,
        responseTime: health?.responseTime,
        error: health?.error
      };
    })
  );
  
  res.json({
    timestamp: new Date().toISOString(),
    services: healthChecks
  });
});

// Service URLs
const services: Record<string, string> = {
  'user-management': process.env.USER_SERVICE_URL || 'http://localhost:3001',
  'course-management': process.env.COURSE_SERVICE_URL || 'http://localhost:3002',
  'payment': process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
  'contact': process.env.CONTACT_SERVICE_URL || 'http://localhost:3004',
  'content-management': process.env.CONTENT_SERVICE_URL || 'http://localhost:3005',
  'analytics': process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006',
  'notification': process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007',
  'admin-panel': process.env.ADMIN_PANEL_SERVICE_URL || 'http://localhost:3008',
  'lms': process.env.LMS_SERVICE_URL || 'http://localhost:3010',
  'live-streaming': process.env.LIVE_STREAMING_SERVICE_URL || 'http://localhost:3011',
  'mobile-api': process.env.MOBILE_API_SERVICE_URL || 'http://localhost:3012',
  'video-streaming': process.env.VIDEO_STREAMING_SERVICE_URL || 'http://localhost:3013',
  'instructor-portal': process.env.INSTRUCTOR_PORTAL_SERVICE_URL || 'http://localhost:3014',
  'student-dashboard': process.env.STUDENT_DASHBOARD_SERVICE_URL || 'http://localhost:3015'
};

// Circuit breaker functions
function getCircuitBreaker(serviceName: string): CircuitBreakerState {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED'
    });
  }
  return circuitBreakers.get(serviceName)!;
}

function recordSuccess(serviceName: string): void {
  const breaker = getCircuitBreaker(serviceName);
  breaker.failures = 0;
  breaker.state = 'CLOSED';
}

function recordFailure(serviceName: string): void {
  const breaker = getCircuitBreaker(serviceName);
  breaker.failures++;
  breaker.lastFailureTime = Date.now();
  
  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    breaker.state = 'OPEN';
    logger.warn(`Circuit breaker OPEN for ${serviceName}`);
    
    // Attempt to reset after timeout
    setTimeout(() => {
      breaker.state = 'HALF_OPEN';
      logger.info(`Circuit breaker HALF_OPEN for ${serviceName}`);
    }, CIRCUIT_BREAKER_RESET_TIMEOUT);
  }
}

function isCircuitOpen(serviceName: string): boolean {
  const breaker = getCircuitBreaker(serviceName);
  
  if (breaker.state === 'OPEN') {
    // Check if enough time has passed to try again
    if (Date.now() - breaker.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
      breaker.state = 'HALF_OPEN';
      return false;
    }
    return true;
  }
  
  return false;
}

// Service health check function
async function checkServiceHealth(serviceName: string, serviceUrl: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    const response = await axios.get(`${serviceUrl}/health`, {
      timeout: 5000,
      validateStatus: (status) => status < 500
    });
    
    const responseTime = Date.now() - startTime;
    
    serviceHealthStatus.set(serviceName, {
      name: serviceName,
      url: serviceUrl,
      status: response.status === 200 ? 'healthy' : 'unhealthy',
      lastCheck: new Date(),
      responseTime,
      error: response.status !== 200 ? `HTTP ${response.status}` : undefined
    });
    
    if (response.status === 200) {
      recordSuccess(serviceName);
    } else {
      recordFailure(serviceName);
    }
    
    logger.debug(`Health check for ${serviceName}: ${response.status} (${responseTime}ms)`);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    serviceHealthStatus.set(serviceName, {
      name: serviceName,
      url: serviceUrl,
      status: 'unhealthy',
      lastCheck: new Date(),
      responseTime,
      error: error.message
    });
    
    recordFailure(serviceName);
    logger.error(`Health check failed for ${serviceName}:`, error.message);
  }
}

// Periodic health checks
function startHealthChecks(): void {
  // Initial health check
  Object.entries(services).forEach(([name, url]) => {
    checkServiceHealth(name, url);
  });
  
  // Periodic health checks every 30 seconds
  setInterval(() => {
    Object.entries(services).forEach(([name, url]) => {
      checkServiceHealth(name, url);
    });
  }, 30000);
  
  logger.info('Health check monitoring started');
}

// Circuit breaker middleware
const circuitBreakerMiddleware = (serviceName: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isCircuitOpen(serviceName)) {
      logger.warn(`Circuit breaker OPEN for ${serviceName}, rejecting request`);
      return res.status(503).json({
        error: {
          type: 'SERVICE_UNAVAILABLE',
          code: 'CIRCUIT_BREAKER_OPEN',
          message: `Service ${serviceName} is temporarily unavailable`,
          timestamp: new Date().toISOString()
        }
      });
    }
    next();
  };
};

// Proxy configuration
const createProxy = (serviceName: string, target: string, pathRewrite?: Record<string, string>) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    timeout: 30000,
    proxyTimeout: 30000,
    onError: (err, req, res) => {
      logger.error('Proxy error', { error: err.message, service: serviceName, target, path: req.url });
      recordFailure(serviceName);
      
      (res as express.Response).status(503).json({
        error: {
          type: 'SERVICE_UNAVAILABLE',
          code: 'PROXY_ERROR',
          message: 'Service temporarily unavailable',
          timestamp: new Date().toISOString()
        }
      });
    },
    onProxyReq: (proxyReq, req: any, res) => {
      // Forward user information to services
      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.userId);
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email);
      }
      
      // Add request ID for tracing
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      proxyReq.setHeader('X-Request-ID', requestId);
      req.requestId = requestId;
    },
    onProxyRes: (proxyRes, req, res) => {
      // Record successful proxy
      recordSuccess(serviceName);
      
      // Add response headers
      proxyRes.headers['X-Gateway-Version'] = '1.0.0';
      if ((req as any).requestId) {
        proxyRes.headers['X-Request-ID'] = (req as any).requestId;
      }
    }
  });
};

// Public routes (no authentication required)
app.use('/api/v1/auth', createProxy('user-management', services['user-management'], { '^/api/v1/auth': '' }));
app.use('/api/v1/contact/submit', createProxy('contact', services['contact'], { '^/api/v1/contact': '/api/contact' }));
app.use('/api/v1/content/public', createProxy('content-management', services['content-management'], { '^/api/v1/content/public': '/api/content/public' }));

// Protected routes (authentication required)
app.use('/api/v1/users', authenticateToken, circuitBreakerMiddleware('user-management'), createProxy('user-management', services['user-management'], { '^/api/v1/users': '/users' }));
app.use('/api/v1/programs', authenticateToken, circuitBreakerMiddleware('course-management'), createProxy('course-management', services['course-management'], { '^/api/v1/programs': '/api/programs' }));
app.use('/api/v1/enrollments', authenticateToken, circuitBreakerMiddleware('course-management'), createProxy('course-management', services['course-management'], { '^/api/v1/enrollments': '/api/enrollments' }));
app.use('/api/v1/payments', authenticateToken, circuitBreakerMiddleware('payment'), createProxy('payment', services['payment'], { '^/api/v1/payments': '/api/payments' }));
app.use('/api/v1/contact/admin', authenticateToken, circuitBreakerMiddleware('contact'), createProxy('contact', services['contact'], { '^/api/v1/contact/admin': '/api/admin/contact' }));
app.use('/api/v1/content', authenticateToken, circuitBreakerMiddleware('content-management'), createProxy('content-management', services['content-management'], { '^/api/v1/content': '/api/content' }));
app.use('/api/v1/analytics', authenticateToken, circuitBreakerMiddleware('analytics'), createProxy('analytics', services['analytics'], { '^/api/v1/analytics': '/api/analytics' }));
app.use('/api/v1/notifications', authenticateToken, circuitBreakerMiddleware('notification'), createProxy('notification', services['notification'], { '^/api/v1/notifications': '/api/notifications' }));

// Admin routes (admin role required)
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: {
        type: 'AUTHORIZATION_ERROR',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin access required',
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

app.use('/api/v1/admin', authenticateToken, requireAdmin, circuitBreakerMiddleware('user-management'), createProxy('user-management', services['user-management'], { '^/api/v1/admin': '/admin' }));

// Admin Panel routes (comprehensive admin operations)
app.use('/api/v1/admin-panel', authenticateToken, requireAdmin, circuitBreakerMiddleware('admin-panel'), createProxy('admin-panel', services['admin-panel'], { '^/api/v1/admin-panel': '/api/admin' }));

// NEW SERVICE ROUTES - Tasks 22-27

// LMS routes (Interactive Learning)
app.use('/api/v1/lms/interactive', authenticateToken, circuitBreakerMiddleware('lms'), createProxy('lms', services['lms'], { '^/api/v1/lms/interactive': '/api/interactive' }));
app.use('/api/v1/lms/collaborative', authenticateToken, circuitBreakerMiddleware('lms'), createProxy('lms', services['lms'], { '^/api/v1/lms/collaborative': '/api/collaborative' }));
app.use('/api/v1/lms/gamification', authenticateToken, circuitBreakerMiddleware('lms'), createProxy('lms', services['lms'], { '^/api/v1/lms/gamification': '/api/gamification' }));
app.use('/api/v1/lms/assessments', authenticateToken, circuitBreakerMiddleware('lms'), createProxy('lms', services['lms'], { '^/api/v1/lms/assessments': '/api/assessments' }));

// Live Streaming routes
app.use('/api/v1/live/sessions', authenticateToken, circuitBreakerMiddleware('live-streaming'), createProxy('live-streaming', services['live-streaming'], { '^/api/v1/live/sessions': '/api/sessions' }));
app.use('/api/v1/live/interactive', authenticateToken, circuitBreakerMiddleware('live-streaming'), createProxy('live-streaming', services['live-streaming'], { '^/api/v1/live/interactive': '/api/interactive' }));
app.use('/api/v1/live/analytics', authenticateToken, circuitBreakerMiddleware('live-streaming'), createProxy('live-streaming', services['live-streaming'], { '^/api/v1/live/analytics': '/api/analytics' }));

// Mobile API routes
app.use('/api/v1/mobile/sync', authenticateToken, circuitBreakerMiddleware('mobile-api'), createProxy('mobile-api', services['mobile-api'], { '^/api/v1/mobile/sync': '/api/sync' }));
app.use('/api/v1/mobile/downloads', authenticateToken, circuitBreakerMiddleware('mobile-api'), createProxy('mobile-api', services['mobile-api'], { '^/api/v1/mobile/downloads': '/api/downloads' }));
app.use('/api/v1/mobile/notifications', authenticateToken, circuitBreakerMiddleware('mobile-api'), createProxy('mobile-api', services['mobile-api'], { '^/api/v1/mobile/notifications': '/api/notifications' }));
app.use('/api/v1/mobile/analytics', authenticateToken, circuitBreakerMiddleware('mobile-api'), createProxy('mobile-api', services['mobile-api'], { '^/api/v1/mobile/analytics': '/api/analytics' }));

// Video Streaming routes
app.use('/api/v1/videos', authenticateToken, circuitBreakerMiddleware('video-streaming'), createProxy('video-streaming', services['video-streaming'], { '^/api/v1/videos': '/api/videos' }));
app.use('/api/v1/videos/stream', authenticateToken, circuitBreakerMiddleware('video-streaming'), createProxy('video-streaming', services['video-streaming'], { '^/api/v1/videos/stream': '/stream' }));

// Instructor Portal routes
app.use('/api/v1/instructor/dashboard', authenticateToken, circuitBreakerMiddleware('instructor-portal'), createProxy('instructor-portal', services['instructor-portal'], { '^/api/v1/instructor/dashboard': '/api/dashboard' }));
app.use('/api/v1/instructor/content', authenticateToken, circuitBreakerMiddleware('instructor-portal'), createProxy('instructor-portal', services['instructor-portal'], { '^/api/v1/instructor/content': '/api/content' }));
app.use('/api/v1/instructor/collaboration', authenticateToken, circuitBreakerMiddleware('instructor-portal'), createProxy('instructor-portal', services['instructor-portal'], { '^/api/v1/instructor/collaboration': '/api/collaboration' }));

// Student Dashboard routes
app.use('/api/v1/student/dashboard', authenticateToken, circuitBreakerMiddleware('student-dashboard'), createProxy('student-dashboard', services['student-dashboard'], { '^/api/v1/student/dashboard': '/api/dashboard' }));
app.use('/api/v1/student/social', authenticateToken, circuitBreakerMiddleware('student-dashboard'), createProxy('student-dashboard', services['student-dashboard'], { '^/api/v1/student/social': '/api/social' }));

// Legacy routes (backward compatibility - no version prefix)
app.use('/api/auth', createProxy('user-management', services['user-management'], { '^/api/auth': '' }));
app.use('/api/contact/submit', createProxy('contact', services['contact'], { '^/api/contact': '/api/contact' }));
app.use('/api/content/public', createProxy('content-management', services['content-management'], { '^/api/content/public': '/api/content/public' }));
app.use('/api/users', authenticateToken, circuitBreakerMiddleware('user-management'), createProxy('user-management', services['user-management'], { '^/api/users': '/users' }));
app.use('/api/programs', authenticateToken, circuitBreakerMiddleware('course-management'), createProxy('course-management', services['course-management'], { '^/api/programs': '/api/programs' }));
app.use('/api/enrollments', authenticateToken, circuitBreakerMiddleware('course-management'), createProxy('course-management', services['course-management'], { '^/api/enrollments': '/api/enrollments' }));
app.use('/api/payments', authenticateToken, circuitBreakerMiddleware('payment'), createProxy('payment', services['payment'], { '^/api/payments': '/api/payments' }));
app.use('/api/contact/admin', authenticateToken, circuitBreakerMiddleware('contact'), createProxy('contact', services['contact'], { '^/api/contact/admin': '/api/admin/contact' }));
app.use('/api/content', authenticateToken, circuitBreakerMiddleware('content-management'), createProxy('content-management', services['content-management'], { '^/api/content': '/api/content' }));
app.use('/api/analytics', authenticateToken, circuitBreakerMiddleware('analytics'), createProxy('analytics', services['analytics'], { '^/api/analytics': '/api/analytics' }));
app.use('/api/notifications', authenticateToken, circuitBreakerMiddleware('notification'), createProxy('notification', services['notification'], { '^/api/notifications': '/api/notifications' }));
app.use('/api/admin', authenticateToken, requireAdmin, circuitBreakerMiddleware('user-management'), createProxy('user-management', services['user-management'], { '^/api/admin': '/admin' }));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
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
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    redisClient.on('connect', () => logger.info('Connected to Redis'));
    
    await redisClient.connect();
    
    // Start health check monitoring
    startHealthChecks();
    
    app.listen(PORT, () => {
      logger.info(`API Gateway started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Service URLs:', services);
      logger.info('Features enabled: Circuit Breaker, Health Checks, API Versioning, Rate Limiting');
    });
  } catch (error) {
    logger.error('Failed to start API Gateway', error);
    process.exit(1);
  }
}

startServer();

export default app;