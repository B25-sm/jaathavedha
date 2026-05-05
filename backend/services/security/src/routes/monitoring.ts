import { Router, Request, Response } from 'express';
import { securityMonitoringService } from '../services/SecurityMonitoringService';
import { Logger } from '@sai-mahendra/utils';

const router = Router();

/**
 * Log security event
 * POST /monitoring/events
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    await securityMonitoringService.logSecurityEvent(event);

    res.json({
      success: true,
      message: 'Security event logged'
    });
  } catch (error) {
    Logger.error('Failed to log security event', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to log security event'
    });
  }
});

/**
 * Log authentication attempt
 * POST /monitoring/auth-attempt
 */
router.post('/auth-attempt', async (req: Request, res: Response) => {
  try {
    const attempt = req.body;

    await securityMonitoringService.logAuthAttempt(attempt);

    res.json({
      success: true,
      message: 'Authentication attempt logged'
    });
  } catch (error) {
    Logger.error('Failed to log auth attempt', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to log auth attempt'
    });
  }
});

/**
 * Check if IP is blocked
 * GET /monitoring/ip/:ipAddress/blocked
 */
router.get('/ip/:ipAddress/blocked', async (req: Request, res: Response) => {
  try {
    const { ipAddress } = req.params;

    const blocked = await securityMonitoringService.isIPBlocked(ipAddress);

    res.json({
      success: true,
      data: {
        ipAddress,
        blocked
      }
    });
  } catch (error) {
    Logger.error('Failed to check IP status', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to check IP status'
    });
  }
});

/**
 * Detect anomalies for user
 * GET /monitoring/anomalies/:userId
 */
router.get('/anomalies/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await securityMonitoringService.detectAnomalies(userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    Logger.error('Anomaly detection failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Anomaly detection failed'
    });
  }
});

/**
 * Get security dashboard metrics
 * GET /monitoring/dashboard
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const metrics = await securityMonitoringService.getDashboardMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    Logger.error('Failed to get dashboard metrics', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard metrics'
    });
  }
});

/**
 * Log data access event
 * POST /monitoring/data-access
 */
router.post('/data-access', async (req: Request, res: Response) => {
  try {
    const access = req.body;

    await securityMonitoringService.logDataAccess(access);

    res.json({
      success: true,
      message: 'Data access logged'
    });
  } catch (error) {
    Logger.error('Failed to log data access', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to log data access'
    });
  }
});

export { router as monitoringRoutes };
