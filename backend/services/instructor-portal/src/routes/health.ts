/**
 * Health Check Routes for Instructor Portal Service
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
    service: 'instructor-portal',
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
    service: 'instructor-portal',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    dependencies: {
      database: 'unknown',
      cache: 'unknown',
      socket_io: 'unknown',
      file_system: 'unknown'
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
    // Check Socket.IO
    const io = req.app.get('io');
    if (io && io.engine) {
      health.dependencies.socket_io = 'healthy';
    } else {
      health.dependencies.socket_io = 'unhealthy';
      health.status = 'degraded';
    }
  } catch (error) {
    health.dependencies.socket_io = 'unhealthy';
    health.status = 'degraded';
    logger.error('Socket.IO health check failed', error);
  }

  try {
    // Check file system access
    const fs = require('fs');
    const testPath = '/tmp/instructor-portal-health-check';
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath);
    health.dependencies.file_system = 'healthy';
  } catch (error) {
    health.dependencies.file_system = 'unhealthy';
    health.status = 'degraded';
    logger.error('File system health check failed', error);
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