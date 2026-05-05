import { Router, Request, Response, NextFunction } from 'express';
import { Logger, AuthUtils, CryptoUtils } from '@sai-mahendra/utils';
import { ValidationError, AuthenticationError, ConflictError } from '@sai-mahendra/utils';
import { ApiResponse, AuthTokens } from '@sai-mahendra/types';
import { SocialAuthService } from '../services/SocialAuthService';
import { SocialProvider } from '../models/SocialAccount';
import { RefreshTokenModel } from '../models/RefreshToken';
import { authenticate } from '../middleware/auth';

const router = Router();
const socialAuthService = new SocialAuthService();

/**
 * Get authorization URL for social provider
 * GET /auth/social/:provider/authorize
 */
router.get('/:provider/authorize', (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = req.params.provider as SocialProvider;
    
    if (!['google', 'linkedin', 'github'].includes(provider)) {
      throw new ValidationError('Invalid social provider');
    }

    // Generate state parameter for CSRF protection
    const state = CryptoUtils.generateSecureToken();
    
    // Store state in session/redis for validation (simplified here)
    // In production, store this in Redis with expiry
    
    const authUrl = socialAuthService.getAuthorizationUrl(provider, state);

    const response: ApiResponse = {
      success: true,
      data: {
        authUrl,
        state
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Handle OAuth callback from social provider
 * GET /auth/social/:provider/callback
 */
router.get('/:provider/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = req.params.provider as SocialProvider;
    const { code, state, error } = req.query;

    if (error) {
      throw new AuthenticationError(`OAuth error: ${error}`);
    }

    if (!code || typeof code !== 'string') {
      throw new ValidationError('Authorization code is required');
    }

    if (!['google', 'linkedin', 'github'].includes(provider)) {
      throw new ValidationError('Invalid social provider');
    }

    // Validate state parameter (CSRF protection)
    // In production, validate against stored state in Redis
    
    // Handle the OAuth callback
    const result = await socialAuthService.handleCallback(provider, code);

    // If account linking is required
    if (result.requiresLinking) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/link-account?provider=${provider}&email=${encodeURIComponent(result.user.email)}&pending=true`;
      
      return res.redirect(redirectUrl);
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET!;
    const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

    const tokenId = CryptoUtils.generateUUID();
    
    const accessToken = AuthUtils.generateAccessToken(
      {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        jti: tokenId
      },
      jwtSecret,
      accessTokenExpiry
    );

    const refreshToken = AuthUtils.generateRefreshToken(
      result.user.id,
      jwtSecret,
      refreshTokenExpiry
    );

    // Store refresh token
    const refreshTokenHash = CryptoUtils.hash(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshTokenModel.create(result.user.id, refreshTokenHash, expiresAt);

    // Store session
    await RefreshTokenModel.storeSession(result.user.id, {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      loginTime: new Date().toISOString(),
      provider,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }, 15 * 60);

    Logger.info('Social authentication successful', {
      userId: result.user.id,
      provider,
      isNewUser: result.isNewUser
    });

    // Redirect to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}&new_user=${result.isNewUser}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * Link social account to existing user (authenticated)
 * POST /auth/social/:provider/link
 */
router.post('/:provider/link', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = req.params.provider as SocialProvider;
    const { code } = req.body;
    const userId = req.user!.userId;

    if (!code) {
      throw new ValidationError('Authorization code is required');
    }

    if (!['google', 'linkedin', 'github'].includes(provider)) {
      throw new ValidationError('Invalid social provider');
    }

    const socialAccount = await socialAuthService.linkAccount(userId, provider, code);

    Logger.info('Social account linked', { userId, provider });

    const response: ApiResponse = {
      success: true,
      data: {
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully`,
        socialAccount: {
          id: socialAccount.id,
          provider: socialAccount.provider,
          email: socialAccount.email,
          displayName: socialAccount.displayName,
          profilePictureUrl: socialAccount.profilePictureUrl
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Confirm account linking with verification token
 * POST /auth/social/confirm-linking
 */
router.post('/confirm-linking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, code, provider } = req.body;

    if (!token) {
      throw new ValidationError('Verification token is required');
    }

    if (!code) {
      throw new ValidationError('Authorization code is required');
    }

    if (!provider || !['google', 'linkedin', 'github'].includes(provider)) {
      throw new ValidationError('Valid provider is required');
    }

    // Verify the linking request
    const linkingRequest = await socialAuthService.confirmLinking(token);

    // Now link the account
    const socialAccount = await socialAuthService.linkAccount(
      linkingRequest.userId,
      provider as SocialProvider,
      code
    );

    Logger.info('Account linking confirmed and completed', {
      userId: linkingRequest.userId,
      provider
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Account linked successfully',
        socialAccount: {
          id: socialAccount.id,
          provider: socialAccount.provider,
          email: socialAccount.email,
          displayName: socialAccount.displayName
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Unlink social account
 * DELETE /auth/social/:socialAccountId
 */
router.delete('/:socialAccountId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { socialAccountId } = req.params;
    const userId = req.user!.userId;

    await socialAuthService.unlinkAccount(userId, socialAccountId);

    Logger.info('Social account unlinked', { userId, socialAccountId });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Social account unlinked successfully'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Get linked social accounts
 * GET /auth/social/linked
 */
router.get('/linked', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const linkedAccounts = await socialAuthService.getLinkedAccounts(userId);

    const response: ApiResponse = {
      success: true,
      data: {
        linkedAccounts
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Set primary social account
 * PUT /auth/social/:socialAccountId/primary
 */
router.put('/:socialAccountId/primary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { socialAccountId } = req.params;
    const userId = req.user!.userId;

    const { SocialAccountModel } = await import('../models/SocialAccount');
    await SocialAccountModel.setPrimary(socialAccountId, userId);

    Logger.info('Primary social account set', { userId, socialAccountId });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Primary social account updated successfully'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export { router as socialAuthRoutes };
