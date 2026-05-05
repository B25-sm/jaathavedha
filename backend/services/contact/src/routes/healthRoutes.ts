import { Router, Request, Response } from 'express';
import { logger } from '@sai-mahendra/shared-utils';
import { healthCheck } from '@sai-mahendra/shared-database';

const router = Router();

/**
 * @route GET /health
 * @desc Basic health check endpoint
 * @access Public
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'contact-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * @route GET /health/detailed
 * @desc Detailed health check with database connections
 * @access Public
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check database connections
    const dbHealth = await healthCheck();
    
    // Check external services
    const externalServices = await checkExternalServices();
    
    const responseTime = Date.now() - startTime;
    
    const isHealthy = dbHealth.postgres && dbHealth.redis && 
                     externalServices.sendgrid && externalServices.whatsapp;
    
    const healthStatus = {
      success: true,
      service: 'contact-service',
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      responseTime: `${responseTime}ms`,
      dependencies: {
        databases: dbHealth,
        externalServices
      },
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    };

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      service: 'contact-service',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      responseTime: '0ms'
    });
  }
});

/**
 * @route GET /health/ready
 * @desc Readiness probe for Kubernetes
 * @access Public
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if service is ready to accept traffic
    const dbHealth = await healthCheck();
    
    if (dbHealth.postgres && dbHealth.redis) {
      res.json({
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Database connections not available'
      });
    }

  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      success: false,
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed'
    });
  }
});

/**
 * @route GET /health/live
 * @desc Liveness probe for Kubernetes
 * @access Public
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if the process is running, it's alive
  res.json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

/**
 * @route GET /health/metrics
 * @desc Basic metrics endpoint for monitoring
 * @access Public
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      service: 'contact-service',
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3003
      }
    };

    res.json(metrics);

  } catch (error) {
    logger.error('Metrics collection failed:', error);
    res.status(500).json({
      success: false,
      error: 'Metrics collection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to check external services
async function checkExternalServices(): Promise<{
  sendgrid: boolean;
  whatsapp: boolean;
}> {
  const services = {
    sendgrid: false,
    whatsapp: false
  };

  try {
    // Check SendGrid API key configuration
    if (process.env.SENDGRID_API_KEY) {
      services.sendgrid = true;
    }

    // Check WhatsApp configuration
    if (process.env.WHATSAPP_ACCESS_TOKEN && 
        process.env.WHATSAPP_PHONE_NUMBER_ID) {
      services.whatsapp = true;
    }

  } catch (error) {
    logger.error('External service check failed:', error);
  }

  return services;
}

export { router as healthRoutes };