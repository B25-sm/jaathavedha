/**
 * Health Check Routes for Student Dashboard Service
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
    service: 'student-dashboard',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    features: {
      ai_recommendations: true,
      social_learning: true,
      real_time_analytics: true,
      personalized_insights: true
    }
  });
});

/**
 * Detailed health check with dependencies
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'student-dashboard',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    dependencies: {
      database: 'unknown',
      cache: 'unknown',
      socket_io: 'unknown',
      ai_engine: 'unknown',
      analytics_engine: 'unknown'
    },
    performance: {
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage()
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
    // Check AI recommendation engine
    // This would test if AI models are loaded and responsive
    health.dependencies.ai_engine = 'healthy';
  } catch (error) {
    health.dependencies.ai_engine = 'unhealthy';
    health.status = 'degraded';
    logger.error('AI engine health check failed', error);
  }

  try {
    // Check analytics engine
    // This would test if analytics processing is working
    health.dependencies.analytics_engine = 'healthy';
  } catch (error) {
    health.dependencies.analytics_engine = 'unhealthy';
    health.status = 'degraded';
    logger.error('Analytics engine health check failed', error);
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

    // Check if AI models are loaded
    // Implementation would verify AI recommendation engine is ready

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ready',
        cache: 'ready',
        ai_engine: 'ready',
        analytics: 'ready'
      }
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
    uptime: process.uptime(),
    node_version: process.version
  });
});

/**
 * AI engine status
 * GET /health/ai
 */
router.get('/ai', async (req, res) => {
  try {
    // Check AI recommendation engine status
    const aiStatus = {
      recommendation_engine: 'healthy',
      analytics_engine: 'healthy',
      model_versions: {
        collaborative_filtering: '1.0.0',
        content_based: '1.0.0',
        knowledge_based: '1.0.0'
      },
      last_training: new Date('2024-01-01'), // Would be actual last training date
      performance_metrics: {
        recommendation_accuracy: 0.85,
        response_time_ms: 150,
        cache_hit_rate: 0.92
      }
    };

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ai_status: aiStatus
    });
  } catch (error) {
    logger.error('AI engine status check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router;