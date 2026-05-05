/**
 * Student Dashboard Service
 * Main entry point for advanced student dashboard and AI-powered learning features
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cron from 'node-cron';

import { initializeDatabases } from '@sai-mahendra/database';
import { logger, errorHandler, requestLogger } from '@sai-mahendra/utils';

import dashboardRoutes from './routes/dashboard';
import socialRoutes from './routes/social';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3006;

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
  max: 200, // Higher limit for dashboard interactions
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.use('/health', healthRoutes);

// API routes
app.use('/api/student/dashboard', dashboardRoutes);
app.use('/api/student/social', socialRoutes);

// Socket.IO connection handling for real-time features
io.on('connection', (socket) => {
  logger.info('Student connected to real-time dashboard', { socketId: socket.id });

  // Join student-specific room
  socket.on('join_student_room', (studentId: string) => {
    socket.join(`student_${studentId}`);
    logger.debug('Student joined room', { studentId, socketId: socket.id });
  });

  // Handle learning progress updates
  socket.on('progress_update', (data: { studentId: string; courseId: string; progress: number }) => {
    // Broadcast progress to student's connected devices
    socket.to(`student_${data.studentId}`).emit('progress_updated', {
      courseId: data.courseId,
      progress: data.progress,
      timestamp: new Date()
    });
  });

  // Handle achievement unlocks
  socket.on('achievement_unlocked', (data: { studentId: string; achievement: any }) => {
    socket.to(`student_${data.studentId}`).emit('new_achievement', {
      achievement: data.achievement,
      timestamp: new Date()
    });
  });

  // Handle study streak updates
  socket.on('streak_update', (data: { studentId: string; streak: number }) => {
    socket.to(`student_${data.studentId}`).emit('streak_updated', {
      streak: data.streak,
      timestamp: new Date()
    });
  });

  // Handle social learning notifications
  socket.on('social_notification', (data: { studentId: string; type: string; message: string }) => {
    socket.to(`student_${data.studentId}`).emit('social_update', {
      type: data.type,
      message: data.message,
      timestamp: new Date()
    });
  });

  // Handle study session tracking
  socket.on('study_session_start', (data: { studentId: string; courseId: string }) => {
    socket.join(`study_session_${data.studentId}`);
    logger.debug('Study session started', { studentId: data.studentId, courseId: data.courseId });
  });

  socket.on('study_session_end', (data: { studentId: string; duration: number }) => {
    socket.leave(`study_session_${data.studentId}`);
    logger.debug('Study session ended', { studentId: data.studentId, duration: data.duration });
  });

  socket.on('disconnect', () => {
    logger.info('Student disconnected from real-time dashboard', { socketId: socket.id });
  });
});

// Make io available to routes
app.set('io', io);

// Scheduled tasks for analytics and recommendations
cron.schedule('0 */6 * * *', async () => {
  // Update AI recommendations every 6 hours
  logger.info('Running scheduled AI recommendation updates');
  try {
    // Implementation would update recommendations for active students
  } catch (error) {
    logger.error('Failed to update AI recommendations', error);
  }
});

cron.schedule('0 2 * * *', async () => {
  // Daily analytics processing at 2 AM
  logger.info('Running daily analytics processing');
  try {
    // Implementation would process daily learning analytics
  } catch (error) {
    logger.error('Failed to process daily analytics', error);
  }
});

cron.schedule('0 0 * * 0', async () => {
  // Weekly learning insights generation on Sundays
  logger.info('Running weekly learning insights generation');
  try {
    // Implementation would generate weekly insights for all students
  } catch (error) {
    logger.error('Failed to generate weekly insights', error);
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
        keyPrefix: 'student:',
      },
      mongo: {
        uri: process.env.MONGODB_URL || 'mongodb://localhost:27017',
        database: 'sai_mahendra_student_analytics',
      },
    });

    logger.info('All databases connected successfully');

    // Start the server
    server.listen(PORT, () => {
      logger.info(`Student Dashboard Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Real-time features enabled via Socket.IO');
      logger.info('AI-powered recommendations and analytics active');
    });
  } catch (error) {
    logger.error('Failed to start Student Dashboard Service:', error);
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