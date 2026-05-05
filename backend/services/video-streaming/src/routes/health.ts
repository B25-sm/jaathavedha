/**
 * Health Check Routes
 */

import express from 'express';
import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();

/**
 * Basic health check
 * GET /health
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'video-streaming',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  });
});

/**
 * Detailed health check with dependencies
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'video-streaming',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    dependencies: {
      database: 'unknown',
      cache: 'unknown',
      aws_s3: 'unknown',
      ffmpeg: 'unknown'
    }
  };

  try {
    // Check database connection
    const db = getDatabase();
    await db.queryOne('SELECT 1');
    health.dependencies.database = 'healthy';
  } catch (error) {
    health.dependencies.database = 'unhealthy';
    health.status = 'degraded';
    logger.error('Database health check failed', error);
  }

  try {
    // Check Redis cache
    const cache = getCache();
    await cache.set('health_check', 'ok', { ttl: 10 });
    await cache.get('health_check');
    health.dependencies.cache = 'healthy';
  } catch (error) {
    health.dependencies.cache = 'unhealthy';
    health.status = 'degraded';
    logger.error('Cache health check failed', error);
  }

  try {
    // Check AWS S3 connectivity
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3();
    await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET }).promise();
    health.dependencies.aws_s3 = 'healthy';
  } catch (error) {
    health.dependencies.aws_s3 = 'unhealthy';
    health.status = 'degraded';
    logger.error('AWS S3 health check failed', error);
  }

  try {
    // Check FFmpeg availability
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.getAvailableFormats((err, formats) => {
      if (err) {
        health.dependencies.ffmpeg = 'unhealthy';
        health.status = 'degraded';
      } else {
        health.dependencies.ffmpeg = 'healthy';
      }
    });
  } catch (error) {
    health.dependencies.ffmpeg = 'unhealthy';
    health.status = 'degraded';
    logger.error('FFmpeg health check failed', error);
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Readiness check
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if service is ready to accept requests
    const db = getDatabase();
    await db.queryOne('SELECT 1');
    
    const cache = getCache();
    await cache.get('ready_check');

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Liveness check
 * GET /health/live
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if this endpoint responds, the service is alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

export default router;