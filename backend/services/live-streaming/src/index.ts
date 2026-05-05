/**
 * Live Streaming and Virtual Classroom Service
 * WebRTC-based live streaming with interactive features
 */

import express, { Request } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { Db } from 'mongodb';
import winston from 'winston';

dotenv.config();

// Initialize logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
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

// Database connections (will be initialized in startServer)
export let pgPool: Pool;
export let mongoDb: Db;

export function getMongoDb(): Db {
  if (!mongoDb) {
    throw new Error('MongoDB not initialized');
  }
  return mongoDb;
}

// Extend Express Request to include io and user
declare global {
  namespace Express {
    interface Request {
      io?: SocketIOServer;
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
      };
    }
  }
}

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3011;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Body parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Make io available to routes
app.use((req: Request, res, next) => {
  req.io = io;
  next();
});

// Import routes after io is set up
import sessionRoutes from './routes/sessions';
import interactiveRoutes from './routes/interactive';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';
import { setupWebRTCSignaling } from './websocket/signaling';

// Routes
app.use('/health', healthRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/interactive', interactiveRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err: any, req: Request, res: any, next: any) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Setup WebRTC signaling
setupWebRTCSignaling(io);

async function startServer() {
  try {
    // Initialize PostgreSQL
    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'sai_mahendra_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
      max: 20,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    await pgPool.query('SELECT NOW()');
    logger.info('PostgreSQL connected');

    // Initialize MongoDB
    const { MongoClient } = require('mongodb');
    const mongoClient = new MongoClient(
      process.env.MONGODB_URL || 'mongodb://localhost:27017'
    );
    await mongoClient.connect();
    mongoDb = mongoClient.db('sai_mahendra_live');
    logger.info('MongoDB connected');

    httpServer.listen(PORT, () => {
      logger.info(`Live Streaming Service running on port ${PORT}`);
      logger.info('WebRTC signaling server ready');
      logger.info('Interactive features enabled');
    });
  } catch (error) {
    logger.error('Failed to start Live Streaming Service:', error);
    process.exit(1);
  }
}

startServer();

export default app;
