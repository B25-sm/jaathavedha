/**
 * Mobile Learning Application Backend API
 * Mobile-optimized endpoints with offline sync and push notifications
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { initializeDatabases } from '@sai-mahendra/database';
import { logger, errorHandler, requestLogger } from '@sai-mahendra/utils';

import syncRoutes from './routes/sync';
import downloadsRoutes from './routes/downloads';
import notificationsRoutes from './routes/notifications';
import analyticsRoutes, { initAnalyticsService } from './routes/analytics';
import contentRoutes from './routes/content';
import healthRoutes from './routes/health';
import videoPlayerRoutes, { initializeVideoPlayerRoutes } from './routes/videoPlayer';
import voiceNotesRoutes, { initializeVoiceNoteRoutes } from './routes/voiceNotes';
import assignmentsRoutes, { initializeAssignmentRoutes } from './routes/assignments';
import socialRoutes, { initializeSocialRoutes } from './routes/social';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3012;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Higher limit for mobile
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Body parsing
app.use(compression());
app.use(express.json({ limit: '50mb' })); // Larger for mobile uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/video-player', videoPlayerRoutes);
app.use('/api/voice-notes', voiceNotesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/social', socialRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.use(errorHandler);

async function startServer() {
  try {
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
        keyPrefix: 'mobile:',
      },
      mongo: {
        uri: process.env.MONGODB_URL || 'mongodb://localhost:27017',
        database: 'sai_mahendra_mobile',
      },
    });

    logger.info('All databases connected');

    // Initialize route services with database connections
    const { db, redis } = await import('@sai-mahendra/database');
    initAnalyticsService(db, redis);
    initializeVideoPlayerRoutes(db, redis);
    initializeVoiceNoteRoutes(db, redis);
    initializeAssignmentRoutes(db, redis);
    initializeSocialRoutes(db, redis);

    app.listen(PORT, () => {
      logger.info(`Mobile API Service running on port ${PORT}`);
      logger.info('Mobile-optimized endpoints ready');
      logger.info('Mobile learning features enabled');
    });
  } catch (error) {
    logger.error('Failed to start Mobile API Service:', error);
    process.exit(1);
  }
}

startServer();

export default app;
