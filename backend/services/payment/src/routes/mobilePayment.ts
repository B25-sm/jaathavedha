/**
 * Mobile Payment Routes
 * API endpoints for mobile-specific payment operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { MobilePaymentService } from '../services/MobilePaymentService';
import { PaymentGatewayConfig } from '../types';
import { logger } from '@sai-mahendra/utils';

export function createMobilePaymentRoutes(config: PaymentGatewayConfig): Router {
  const router = Router();
  const mobilePaymentService = new MobilePaymentService(config);

  /**
   * POST /mobile/detect-methods
   * Detect available payment methods for mobile device
   */
  router.post('/detect-methods', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { device_info } = req.body;

      if (!device_info) {
        return res.status(400).json({
          error: 'Device information is required',
        });
      }

      const detection = await mobilePaymentService.detectMobilePaymentMethods(device_info);

      res.json({
        success: true,
        data: detection,
      });
    } catch (error) {
      logger.error('Failed to detect mobile payment methods', { error });
      next(error);
    }
  });

  /**
   * POST /mobile/validate
   * Validate mobile payment request
   */
  router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = await mobilePaymentService.validateMobilePayment(req.body);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error('Failed to validate mobile payment', { error });
      next(error);
    }
  });

  /**
   * POST /mobile/create-session
   * Create mobile payment session
   */
  router.post('/create-session', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await mobilePaymentService.createMobilePaymentSession(req.body);

      res.status(201).json({
        success: true,
        data: session,
      });
    } catch (error) {
      logger.error('Failed to create mobile payment session', { error });
      next(error);
    }
  });

  /**
   * GET /mobile/session/:sessionId
   * Get mobile payment session details
   */
  router.get('/session/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const flow = await mobilePaymentService.getTouchOptimizedFlow(sessionId);

      res.json({
        success: true,
        data: flow,
      });
    } catch (error) {
      logger.error('Failed to get payment session', { error });
      next(error);
    }
  });

  /**
   * GET /mobile/flow/:sessionId/:step
   * Get specific step in touch-optimized payment flow
   */
  router.get('/flow/:sessionId/:step', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, step } = req.params;
      const stepNumber = parseInt(step, 10);

      if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 4) {
        return res.status(400).json({
          error: 'Invalid step number. Must be between 1 and 4',
        });
      }

      const flow = await mobilePaymentService.getTouchOptimizedFlow(sessionId, stepNumber);

      res.json({
        success: true,
        data: flow,
      });
    } catch (error) {
      logger.error('Failed to get payment flow step', { error });
      next(error);
    }
  });

  /**
   * POST /mobile/wallet/pay
   * Process mobile wallet payment
   */
  router.post('/wallet/pay', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { session_id, wallet_type, wallet_token } = req.body;

      if (!session_id || !wallet_type || !wallet_token) {
        return res.status(400).json({
          error: 'Session ID, wallet type, and wallet token are required',
        });
      }

      const result = await mobilePaymentService.processMobileWalletPayment(
        session_id,
        wallet_type,
        wallet_token
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to process mobile wallet payment', { error });
      next(error);
    }
  });

  /**
   * POST /mobile/upi/pay
   * Process UPI payment
   */
  router.post('/upi/pay', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { session_id, upi_id } = req.body;

      if (!session_id || !upi_id) {
        return res.status(400).json({
          error: 'Session ID and UPI ID are required',
        });
      }

      const result = await mobilePaymentService.processUpiPayment(session_id, upi_id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to process UPI payment', { error });
      next(error);
    }
  });

  /**
   * POST /mobile/apple-pay/session
   * Create Apple Pay session
   */
  router.post('/apple-pay/session', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, currency, domain } = req.body;

      if (!amount || !currency || !domain) {
        return res.status(400).json({
          error: 'Amount, currency, and domain are required',
        });
      }

      // This would integrate with the Stripe gateway's Apple Pay functionality
      res.json({
        success: true,
        message: 'Apple Pay session creation endpoint',
        data: {
          amount,
          currency,
          domain,
        },
      });
    } catch (error) {
      logger.error('Failed to create Apple Pay session', { error });
      next(error);
    }
  });

  /**
   * POST /mobile/google-pay/payment
   * Create Google Pay payment
   */
  router.post('/google-pay/payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, currency, customer_id } = req.body;

      if (!amount || !currency) {
        return res.status(400).json({
          error: 'Amount and currency are required',
        });
      }

      // This would integrate with the Stripe gateway's Google Pay functionality
      res.json({
        success: true,
        message: 'Google Pay payment creation endpoint',
        data: {
          amount,
          currency,
          customer_id,
        },
      });
    } catch (error) {
      logger.error('Failed to create Google Pay payment', { error });
      next(error);
    }
  });

  return router;
}
