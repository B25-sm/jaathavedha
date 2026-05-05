import { Router, Request, Response } from 'express';
import { encryptionService } from '../services/EncryptionService';
import { keyManagementService } from '../services/KeyManagementService';
import { Logger } from '@sai-mahendra/utils';

const router = Router();

/**
 * Encrypt data
 * POST /encryption/encrypt
 */
router.post('/encrypt', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required'
      });
    }

    const encrypted = encryptionService.encrypt(data);

    res.json({
      success: true,
      data: {
        encrypted,
        keyVersion: encryptionService.getKeyVersion()
      }
    });
  } catch (error) {
    Logger.error('Encryption failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Encryption failed'
    });
  }
});

/**
 * Decrypt data
 * POST /encryption/decrypt
 */
router.post('/decrypt', async (req: Request, res: Response) => {
  try {
    const { encrypted } = req.body;

    if (!encrypted) {
      return res.status(400).json({
        success: false,
        error: 'Encrypted data is required'
      });
    }

    const decrypted = encryptionService.decrypt(encrypted);

    res.json({
      success: true,
      data: {
        decrypted
      }
    });
  } catch (error) {
    Logger.error('Decryption failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Decryption failed'
    });
  }
});

/**
 * Generate encryption key
 * POST /encryption/keys/generate
 */
router.post('/keys/generate', async (req: Request, res: Response) => {
  try {
    const { purpose } = req.body;

    if (!purpose) {
      return res.status(400).json({
        success: false,
        error: 'Purpose is required'
      });
    }

    const keyId = await keyManagementService.generateKey(purpose);

    res.json({
      success: true,
      data: {
        keyId,
        purpose
      }
    });
  } catch (error) {
    Logger.error('Key generation failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Key generation failed'
    });
  }
});

/**
 * Rotate encryption key
 * POST /encryption/keys/:keyId/rotate
 */
router.post('/keys/:keyId/rotate', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;

    const newKeyId = await keyManagementService.rotateKey(keyId);

    res.json({
      success: true,
      data: {
        oldKeyId: keyId,
        newKeyId
      }
    });
  } catch (error) {
    Logger.error('Key rotation failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Key rotation failed'
    });
  }
});

/**
 * Get active keys
 * GET /encryption/keys
 */
router.get('/keys', async (req: Request, res: Response) => {
  try {
    const keys = keyManagementService.getActiveKeys();

    res.json({
      success: true,
      data: {
        keys
      }
    });
  } catch (error) {
    Logger.error('Failed to get keys', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get keys'
    });
  }
});

export { router as encryptionRoutes };
