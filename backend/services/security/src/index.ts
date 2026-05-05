import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import https from 'https';

import { Logger } from '@sai-mahendra/utils';
import { tlsConfigService } from './services/TLSConfigService';
import { keyManagementService } from './services/KeyManagementService';
import { encryptionRoutes } from './routes/encryption';
import { monitoringRoutes } from './routes/monitoring';
import { gdprRoutes } from './routes/gdpr';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3009;

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
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'security-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tls: tlsConfigService.isTLSEnabled()
  });
});

// API routes
app.use('/encryption', encryptionRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/gdpr', gdprRoutes);

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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  Logger.error('Unhandled error', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      type: 'INTERNAL_ERROR',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An internal error occurred' 
        : err.message,
      timestamp: new Date().toISOString()
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  Logger.info('SIGTERM received, shutting down gracefully');
  await keyManagementService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  Logger.info('SIGINT received, shutting down gracefully');
  await keyManagementService.close();
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Validate TLS configuration
    const tlsValid = tlsConfigService.validateConfiguration();
    
    if (tlsConfigService.isTLSEnabled() && !tlsValid) {
      Logger.warn('TLS validation failed, starting without TLS');
    }

    // Start automatic key rotation check (every 24 hours)
    setInterval(async () => {
      try {
        await keyManagementService.performAutomaticRotation();
      } catch (error) {
        Logger.error('Automatic key rotation failed', error as Error);
      }
    }, 24 * 60 * 60 * 1000);

    // Start server with or without TLS
    if (tlsConfigService.isTLSEnabled() && tlsValid) {
      const tlsOptions = tlsConfigService.getHTTPSOptions();
      
      if (tlsOptions) {
        https.createServer(tlsOptions, app).listen(PORT, () => {
          Logger.info(`Security Service started on port ${PORT} with TLS 1.3`);
          Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
      } else {
        startHTTPServer();
      }
    } else {
      startHTTPServer();
    }
  } catch (error) {
    Logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

function startHTTPServer(): void {
  app.listen(PORT, () => {
    Logger.info(`Security Service started on port ${PORT} (HTTP)`);
    Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    Logger.warn('TLS is disabled - this should only be used in development');
  });
}

startServer();

export default app;
