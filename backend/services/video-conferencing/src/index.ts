import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { initializeDatabase, closeDatabase } from './database';
import logger from './utils/logger';
import meetingsRoutes from './routes/meetings';
import recordingsRoutes from './routes/recordings';
import attendanceRoutes from './routes/attendance';
import webhooksRoutes from './routes/webhooks';
import MeetingService from './services/MeetingService';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3017;

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  })
);

// Raw body for webhooks (signature verification)
app.use(
  '/api/video-conferencing/webhooks',
  express.raw({ type: 'application/json' })
);

// JSON body parser for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: {
      type: 'RATE_LIMIT_ERROR',
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later',
    },
  },
});

app.use('/api/video-conferencing', limiter);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Routes
app.use('/api/video-conferencing/meetings', meetingsRoutes);
app.use('/api/video-conferencing/recordings', recordingsRoutes);
app.use('/api/video-conferencing/attendance', attendanceRoutes);
app.use('/api/video-conferencing/webhooks', webhooksRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Video Conferencing Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/video-conferencing/health',
      meetings: '/api/video-conferencing/meetings',
      recordings: '/api/video-conferencing/recordings',
      attendance: '/api/video-conferencing/attendance',
      webhooks: '/api/video-conferencing/webhooks',
    },
  });
});

// Health check endpoint
app.get('/api/video-conferencing/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    error: {
      type: 'SYSTEM_ERROR',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      type: 'NOT_FOUND',
      code: 'ENDPOINT_NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

// Scheduled tasks
const meetingService = new MeetingService();

// Mark past meetings as completed every hour
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Running scheduled task: Mark past meetings as completed');
      const count = await meetingService.markPastMeetingsCompleted();
      logger.info(`Marked ${count} past meetings as completed`);
    } catch (error) {
      logger.error('Error in scheduled task:', error);
    }
  });
}

// Initialize and start server
const startServer = async () => {
  try {
    // Initialize database connections
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Video Conferencing Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    await closeDatabase();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;
