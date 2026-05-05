import { Router, Request, Response } from 'express';
import { DatabaseUtils } from '@sai-mahendra/utils';
import { ApiResponse } from '@sai-mahendra/types';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await DatabaseUtils.healthCheck();
    
    const health = {
      service: 'user-management',
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      database: {
        status: dbHealthy ? 'connected' : 'disconnected'
      }
    };

    const response: ApiResponse = {
      success: true,
      data: health
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.status(503).json(response);
  }
});

/**
 * Readiness probe endpoint
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await DatabaseUtils.healthCheck();
    
    if (!dbHealthy) {
      throw new Error('Database not ready');
    }

    const response: ApiResponse = {
      success: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString()
      }
    };

    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'SERVICE_NOT_READY',
        message: 'Service not ready',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.status(503).json(response);
  }
});

/**
 * Liveness probe endpoint
 */
router.get('/live', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString()
    }
  };

  res.status(200).json(response);
});

export { router as healthRoutes };