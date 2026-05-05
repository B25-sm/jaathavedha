/**
 * Video Streaming Service
 * Main entry point for video streaming and content delivery service
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { initializeDatabases } from '@sai-mahendra/database';
import { logger, errorHandler, requestLogger } from '@sai-mahendra/utils';

import videoRoutes from './routes/videos';
import liveStreamRoutes from './routes/liveStreams';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow video embedding
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration for video streaming
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length']
}));

// Rate limiting with higher limits for video streaming
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for video streaming
  message: {
    error: {
      type: 'RATE_LIMIT_EXCEEDED',
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for video streaming endpoints
  skip: (req) => {
    return req.path.includes('/stream/') || req.path.includes('/hls/');
  }
});

app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.use('/health', healthRoutes);

// API routes
app.use('/api/videos', videoRoutes);
app.use('/api/live-streams', liveStreamRoutes);

// Video streaming endpoints (no auth required for actual video delivery)
app.get('/stream/:videoId/:quality/:segment', async (req, res) => {
  try {
    // Serve HLS segments
    const { videoId, quality, segment } = req.params;
    
    // Validate session token from query params
    const sessionToken = req.query.token as string;
    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token required' });
    }

    // Implement HLS segment serving logic here
    // This would typically serve from S3/CDN with proper authentication
    
    res.status(200).send('HLS segment would be served here');
  } catch (error) {
    logger.error('Failed to serve video segment', { error, params: req.params });
    res.status(500).json({ error: 'Failed to serve video segment' });
  }
});

app.get('/hls/:videoId/playlist.m3u8', async (req, res) => {
  try {
    // Serve HLS master playlist
    const { videoId } = req.params;
    
    // Validate session token
    const sessionToken = req.query.token as string;
    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token required' });
    }

    // Implement HLS playlist serving logic here
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(200).send('#EXTM3U\n#EXT-X-VERSION:3\n');
  } catch (error) {
    logger.error('Failed to serve HLS playlist', { error, params: req.params });
    res.status(500).json({ error: 'Failed to serve playlist' });
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
app.use(errorHandler);

// Database initialization and server startup
async function startServer() {
  try {
    // Initialize databases
    await initializeDatabases({
      postgres: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'sai_mahendra_dev',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres123',
        ssl: process.env.NODE_ENV === 'production',
        maxConnections: 20,
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        keyPrefix: 'video:',
      },
      mongo: {
        uri: process.env.MONGODB_URL || 'mongodb://localhost:27017',
        database: 'sai_mahendra_video_analytics',
      },
    });

    logger.info('All databases connected successfully');

    // Start the server
    app.listen(PORT, () => {
      logger.info(`Video Streaming Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Video streaming endpoints ready');
    });
  } catch (error) {
    logger.error('Failed to start Video Streaming Service:', error);
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

// Start the server
startServer();

export default app;