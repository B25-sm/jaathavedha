import { Router, Request, Response } from 'express';
import { gdprComplianceService } from '../services/GDPRComplianceService';
import { Logger } from '@sai-mahendra/utils';

const router = Router();

/**
 * Export user data (GDPR Right to Data Portability)
 * GET /gdpr/export/:userId
 */
router.get('/export/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const exportData = await gdprComplianceService.exportUserData(userId);

    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    Logger.error('Data export failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Data export failed'
    });
  }
});

/**
 * Delete user data (GDPR Right to Erasure)
 * DELETE /gdpr/delete/:userId
 */
router.delete('/delete/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Deletion reason is required'
      });
    }

    const result = await gdprComplianceService.deleteUserData(userId, reason);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    Logger.error('Data deletion failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Data deletion failed'
    });
  }
});

/**
 * Anonymize user data
 * POST /gdpr/anonymize/:userId
 */
router.post('/anonymize/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    await gdprComplianceService.anonymizeUserData(userId);

    res.json({
      success: true,
      message: 'User data anonymized successfully'
    });
  } catch (error) {
    Logger.error('Data anonymization failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Data anonymization failed'
    });
  }
});

/**
 * Record user consent
 * POST /gdpr/consent
 */
router.post('/consent', async (req: Request, res: Response) => {
  try {
    const consent = req.body;

    if (!consent.userId || !consent.consentType || consent.granted === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, consentType, and granted are required'
      });
    }

    await gdprComplianceService.recordConsent(consent);

    res.json({
      success: true,
      message: 'Consent recorded successfully'
    });
  } catch (error) {
    Logger.error('Failed to record consent', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to record consent'
    });
  }
});

/**
 * Get user consent status
 * GET /gdpr/consent/:userId
 */
router.get('/consent/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const status = await gdprComplianceService.getUserConsentStatus(userId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    Logger.error('Failed to get consent status', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get consent status'
    });
  }
});

/**
 * Withdraw consent
 * POST /gdpr/consent/:userId/withdraw
 */
router.post('/consent/:userId/withdraw', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { consentType, reason } = req.body;

    if (!consentType) {
      return res.status(400).json({
        success: false,
        error: 'consentType is required'
      });
    }

    await gdprComplianceService.withdrawConsent(userId, consentType, reason);

    res.json({
      success: true,
      message: 'Consent withdrawn successfully'
    });
  } catch (error) {
    Logger.error('Failed to withdraw consent', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to withdraw consent'
    });
  }
});

/**
 * Check if user has required consents
 * GET /gdpr/consent/:userId/required
 */
router.get('/consent/:userId/required', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const hasRequired = await gdprComplianceService.hasRequiredConsents(userId);

    res.json({
      success: true,
      data: {
        userId,
        hasRequiredConsents: hasRequired
      }
    });
  } catch (error) {
    Logger.error('Failed to check required consents', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to check required consents'
    });
  }
});

export { router as gdprRoutes };
