import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { Logger } from '@sai-mahendra/utils';
import { DatabaseUtils } from '@sai-mahendra/utils';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { adminRoutes } from './routes/admin';
import { healthRoutes } from './routes/health';
import { socialAuthRoutes } from './routes/socialAuth';
import { DatabaseConfig } from '@sai-mahendra/types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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

// Request logging
app.use(requestLogger);

// Health check (before authentication)
app.use('/health', healthRoutes);

// API routes
app.use('/auth', authRoutes);
app.use('/auth/social', socialAuthRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);

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
app.use(errorHandler);

// Initialize database connection
const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sai_mahendra_dev',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  ssl: process.env.DB_SSL === 'true'
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  Logger.info('SIGTERM received, shutting down gracefully');
  await DatabaseUtils.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  Logger.info('SIGINT received, shutting down gracefully');
  await DatabaseUtils.close();
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Initialize database
    DatabaseUtils.initialize(dbConfig);
    
    // Test database connection
    const isHealthy = await DatabaseUtils.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }

    app.listen(PORT, () => {
      Logger.info(`User Management Service started on port ${PORT}`);
      Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      Logger.info('Database connection established');
    });
  } catch (error) {
    Logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

startServer();

export default app;