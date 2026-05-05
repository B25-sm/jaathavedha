import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { initializeDatabase, closeDatabase } from './database';
import logger from './utils/logger';
import calendarRoutes from './routes/calendar';
import CalendarEventService from './services/CalendarEventService';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3016;

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  })
);
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

app.use('/api/calendar', limiter);

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
app.use('/api/calendar', calendarRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Calendar Integration Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/calendar/health',
      googleAuth: '/api/calendar/google/auth',
      outlookAuth: '/api/calendar/outlook/auth',
      connections: '/api/calendar/connections',
      events: '/api/calendar/events',
      sync: '/api/calendar/sync/enrollment',
      preferences: '/api/calendar/preferences',
    },
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
const eventService = new CalendarEventService();

// Mark past events as completed every hour
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Running scheduled task: Mark past events as completed');
      const count = await eventService.markPastEventsCompleted();
      logger.info(`Marked ${count} past events as completed`);
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
      logger.info(`Calendar Integration Service running on port ${PORT}`);
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
