import { Router, Request, Response, NextFunction } from 'express';
import { FinancialManagementService } from '../services/FinancialManagementService';
import { authenticateAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';
import { AdminAction } from '../types';

export function createFinancialRoutes(financialService: FinancialManagementService): Router {
  const router = Router();

  // All routes require admin authentication
  router.use(authenticateAdmin);

  /**
   * Get all payments with filtering
   */
  router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, programId, status, gateway, startDate, endDate, page, limit } = req.query;

      const filters = {
        userId: userId as string,
        programId: programId as string,
        status: status as string,
        gateway: gateway as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      };

      const result = await financialService.getPayments(
        filters,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Process refund
   */
  router.post(
    '/payments/:id/refund',
    auditLog(AdminAction.PAYMENT_REFUNDED, 'payments'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { amount, reason } = req.body;

        if (!amount || !reason) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              code: 'MISSING_REQUIRED_FIELDS',
              message: 'Amount and reason are required'
            }
          });
        }

        const token = req.headers.authorization?.split(' ')[1] || '';
        const result = await financialService.processRefund(
          req.params.id,
          amount,
          reason,
          req.admin!.userId,
          token
        );

        res.json({
          success: true,
          data: result,
          message: 'Refund processed successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get subscriptions
   */
  router.get('/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, status, page, limit } = req.query;

      const filters = {
        userId: userId as string,
        status: status as string
      };

      const result = await financialService.getSubscriptions(
        filters,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Cancel subscription
   */
  router.post(
    '/subscriptions/:id/cancel',
    auditLog(AdminAction.SUBSCRIPTION_CANCELLED, 'subscriptions'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason } = req.body;

        if (!reason) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              code: 'REASON_REQUIRED',
              message: 'Cancellation reason is required'
            }
          });
        }

        const token = req.headers.authorization?.split(' ')[1] || '';
        const result = await financialService.cancelSubscription(
          req.params.id,
          reason,
          token
        );

        res.json({
          success: true,
          data: result,
          message: 'Subscription cancelled successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Generate revenue report
   */
  router.post(
    '/reports/revenue',
    auditLog(AdminAction.REPORT_GENERATED, 'reports'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              code: 'MISSING_DATES',
              message: 'Start date and end date are required'
            }
          });
        }

        const report = await financialService.generateRevenueReport(
          new Date(startDate),
          new Date(endDate)
        );

        res.json({
          success: true,
          data: report
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Generate refunds report
   */
  router.post(
    '/reports/refunds',
    auditLog(AdminAction.REPORT_GENERATED, 'reports'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              code: 'MISSING_DATES',
              message: 'Start date and end date are required'
            }
          });
        }

        const report = await financialService.generateRefundsReport(
          new Date(startDate),
          new Date(endDate)
        );

        res.json({
          success: true,
          data: report
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get financial statistics
   */
  router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await financialService.getFinancialStatistics();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get payment gateway configuration
   */
  router.get('/gateway/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await financialService.getGatewayConfiguration();

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Update payment gateway configuration
   */
  router.put(
    '/gateway/config/:gateway',
    auditLog(AdminAction.PAYMENT_GATEWAY_CONFIGURED, 'gateway'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await financialService.updateGatewayConfiguration(
          req.params.gateway,
          req.body
        );

        res.json({
          success: true,
          data: result,
          message: 'Gateway configuration updated successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
