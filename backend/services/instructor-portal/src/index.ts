/**
 * Instructor Portal Service
 * Main entry point for instructor content management and analytics service
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';

import { initializeDatabases } from '@sai-mahendra/database';
import { logger, errorHandler, requestLogger } from '@sai-mahendra/utils';

import dashboardRoutes from './routes/dashboard';
import contentRoutes from './routes/content';
import settingsRoutes from './routes/settings';
import collaborationRoutes from './routes/collaboration';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3005;

// Initialize Socket.IO for real-time features
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
  crossOriginEmbedderPolicy: false
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
  max: 500, // Higher limit for instructor operations
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
app.use(compression());
app.use(express.json({ limit: '100mb' })); // Higher limit for bulk uploads
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.use('/health', healthRoutes);

// API routes
app.use('/api/instructor/dashboard', dashboardRoutes);
app.use('/api/instructor/content', contentRoutes);
app.use('/api/instructor/settings', settingsRoutes);
app.use('/api/instructor/collaboration', collaborationRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Instructor connected to real-time service', { socketId: socket.id });

  // Join instructor-specific room
  socket.on('join_instructor_room', (instructorId: string) => {
    socket.join(`instructor_${instructorId}`);
    logger.debug('Instructor joined room', { instructorId, socketId: socket.id });
  });

  // Handle upload progress updates
  socket.on('upload_progress', (data: { batchId: string; fileId: string; progress: number }) => {
    // Broadcast progress to instructor room
    socket.to(`instructor_${data.batchId.split('_')[0]}`).emit('upload_progress_update', data);
  });

  // Handle processing status updates
  socket.on('processing_status', (data: { batchId: string; status: string; progress: number }) => {
    socket.to(`instructor_${data.batchId.split('_')[0]}`).emit('processing_status_update', data);
  });

  // Handle live session events
  socket.on('live_session_event', (data: { sessionId: string; event: string; data: any }) => {
    // Broadcast to all participants in the session
    socket.to(`session_${data.sessionId}`).emit('session_event', {
      event: data.event,
      data: data.data,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    logger.info('Instructor disconnected from real-time service', { socketId: socket.id });
  });
});

// Make io available to routes
app.set('io', io);

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
        keyPrefix: 'instructor:',
      },
      mongo: {
        uri: process.env.MONGODB_URL || 'mongodb://localhost:27017',
        database: 'sai_mahendra_instructor_analytics',
      },
    });

    logger.info('All databases connected successfully');

    // Start the server
    server.listen(PORT, () => {
      logger.info(`Instructor Portal Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Real-time features enabled via Socket.IO');
    });
  } catch (error) {
    logger.error('Failed to start Instructor Portal Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
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