import { Router, Request, Response, NextFunction } from 'express';
import { ValidationSchemas, ValidationUtils, AuthUtils, Logger, CryptoUtils } from '@sai-mahendra/utils';
import { ValidationError, ConflictError, AuthenticationError, NotFoundError } from '@sai-mahendra/utils';
import { ApiResponse, AuthTokens, UserRole } from '@sai-mahendra/types';
import { UserModel } from '../models/User';
import { RefreshTokenModel } from '../models/RefreshToken';
import { EmailService } from '../services/EmailService';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const { value: userData, error } = ValidationUtils.validate(
      req.body,
      ValidationSchemas.userRegistration
    );

    if (error) {
      throw new ValidationError('Invalid registration data', error.details);
    }

    // Check if email already exists
    const existingUser = await UserModel.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await AuthUtils.hashPassword(userData.password);

    // Create user
    const user = await UserModel.create({
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone
    });

    // Generate email verification token
    const verificationToken = AuthUtils.generateSecureToken();
    await UserModel.setEmailVerificationToken(user.id, verificationToken);

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    
    await EmailService.sendEmailVerification(user.email, {
      firstName: user.firstName,
      verificationToken,
      verificationUrl
    });

    Logger.info('User registered successfully', { userId: user.id, email: user.email });

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified
        },
        message: 'Registration successful. Please check your email for verification.'
      }
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Login user
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const { value: loginData, error } = ValidationUtils.validate(
      req.body,
      ValidationSchemas.userLogin
    );

    if (error) {
      throw new ValidationError('Invalid login data', error.details);
    }

    // Check for too many failed login attempts
    const failedAttempts = await RefreshTokenModel.getFailedLoginCount(loginData.email);
    if (failedAttempts >= 5) {
      throw new AuthenticationError('Account temporarily locked due to too many failed login attempts');
    }

    // Find user with password
    const user = await UserModel.findByEmailWithPassword(loginData.email);
    if (!user) {
      await RefreshTokenModel.recordFailedLogin(loginData.email);
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await AuthUtils.verifyPassword(loginData.password, user.passwordHash);
    if (!isValidPassword) {
      await RefreshTokenModel.recordFailedLogin(loginData.email);
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new AuthenticationError('Account is not active');
    }

    // Clear failed login attempts on successful login
    await RefreshTokenModel.clearFailedLogins(loginData.email);

    // Generate tokens with unique IDs
    const jwtSecret = process.env.JWT_SECRET!;
    const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

    const tokenId = CryptoUtils.generateUUID();
    const refreshTokenId = CryptoUtils.generateUUID();

    const accessToken = AuthUtils.generateAccessToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        jti: tokenId
      },
      jwtSecret,
      accessTokenExpiry
    );

    const refreshToken = AuthUtils.generateRefreshToken(
      user.id,
      jwtSecret,
      refreshTokenExpiry
    );

    // Store refresh token in database
    const refreshTokenHash = CryptoUtils.hash(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshTokenModel.create(user.id, refreshTokenHash, expiresAt);

    // Store session data in Redis
    await RefreshTokenModel.storeSession(user.id, {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginTime: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }, 15 * 60); // 15 minutes

    // Update last login
    await UserModel.updateLastLogin(user.id);

    Logger.info('User logged in successfully', { 
      userId: user.id, 
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const tokens: AuthTokens = {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified
        },
        tokens
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh access token
 */
router.post('/refresh-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Verify refresh token
    const jwtSecret = process.env.JWT_SECRET!;
    const payload = AuthUtils.verifyToken(refreshToken, jwtSecret);

    if (payload.type !== 'refresh') {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if refresh token exists in database and is not revoked
    const refreshTokenHash = CryptoUtils.hash(refreshToken);
    const storedToken = await RefreshTokenModel.findByTokenHash(refreshTokenHash);
    
    if (!storedToken) {
      throw new AuthenticationError('Refresh token not found or expired');
    }

    // Find user
    const user = await UserModel.findById(payload.userId);
    if (!user || user.status !== 'active') {
      throw new AuthenticationError('User not found or inactive');
    }

    // Generate new access token
    const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    const tokenId = CryptoUtils.generateUUID();
    
    const accessToken = AuthUtils.generateAccessToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        jti: tokenId
      },
      jwtSecret,
      accessTokenExpiry
    );

    // Update session data
    await RefreshTokenModel.storeSession(user.id, {
      userId: user.id,
      email: user.email,
      role: user.role,
      refreshTime: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }, 15 * 60);

    const tokens: AuthTokens = {
      accessToken,
      refreshToken, // Keep the same refresh token
      expiresIn: 15 * 60 // 15 minutes in seconds
    };

    const response: ApiResponse = {
      success: true,
      data: { tokens }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Verify email
 */
router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Verification token is required');
    }

    const user = await UserModel.verifyEmail(token);
    if (!user) {
      throw new NotFoundError('Invalid or expired verification token');
    }

    // Send welcome email
    await EmailService.sendWelcomeEmail(user.email, user.firstName);

    Logger.info('Email verified successfully', { userId: user.id, email: user.email });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Request password reset
 */
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value: resetData, error } = ValidationUtils.validate(
      req.body,
      ValidationSchemas.passwordReset
    );

    if (error) {
      throw new ValidationError('Invalid email', error.details);
    }

    // Check rate limiting for password reset attempts
    const attempts = await RefreshTokenModel.getPasswordResetAttempts(resetData.email);
    if (attempts >= 3) {
      throw new ValidationError('Too many password reset attempts. Please try again later.');
    }

    const user = await UserModel.findByEmail(resetData.email);
    if (!user) {
      // Don't reveal if email exists or not, but still record the attempt
      await RefreshTokenModel.recordPasswordResetAttempt(resetData.email);
      
      const response: ApiResponse = {
        success: true,
        data: {
          message: 'If the email exists, a password reset link has been sent.'
        }
      };
      return res.status(200).json(response);
    }

    // Record the attempt
    await RefreshTokenModel.recordPasswordResetAttempt(resetData.email);

    // Generate reset token
    const resetToken = AuthUtils.generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await UserModel.setPasswordResetToken(user.email, resetToken, expiresAt);

    // Send password reset email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    await EmailService.sendPasswordReset(user.email, {
      firstName: user.firstName,
      resetToken,
      resetUrl
    });

    Logger.info('Password reset requested', { 
      userId: user.id, 
      email: user.email,
      ip: req.ip
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'If the email exists, a password reset link has been sent.'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Reset password
 */
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value: resetData, error } = ValidationUtils.validate(
      req.body,
      ValidationSchemas.passwordResetConfirm
    );

    if (error) {
      throw new ValidationError('Invalid reset data', error.details);
    }

    // Hash new password
    const passwordHash = await AuthUtils.hashPassword(resetData.newPassword);

    // Reset password
    const user = await UserModel.resetPassword(resetData.token, passwordHash);
    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    // Revoke all existing refresh tokens for security
    await RefreshTokenModel.revokeAllForUser(user.id);

    // Clear session
    await RefreshTokenModel.deleteSession(user.id);

    // Send password change confirmation email
    await EmailService.sendPasswordChangeConfirmation(user.email, user.firstName);

    Logger.info('Password reset successfully', { 
      userId: user.id, 
      email: user.email,
      ip: req.ip
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Password reset successfully. Please log in with your new password.'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Get current user profile
 */
router.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.findById(req.user!.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const response: ApiResponse = {
      success: true,
      data: { user }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Logout user (blacklist token and clear session)
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tokenId = req.user!.tokenId;

    // Blacklist the current access token
    if (tokenId) {
      const ttl = 15 * 60; // Match access token expiry
      await RefreshTokenModel.blacklistToken(tokenId, ttl);
    }

    // Clear session from Redis
    await RefreshTokenModel.deleteSession(userId);

    // Optionally revoke refresh token if provided
    const { refreshToken } = req.body;
    if (refreshToken) {
      const refreshTokenHash = CryptoUtils.hash(refreshToken);
      await RefreshTokenModel.revoke(refreshTokenHash);
    }

    Logger.info('User logged out', { 
      userId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Logged out successfully'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Logout from all devices (revoke all refresh tokens)
 */
router.post('/logout-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Revoke all refresh tokens
    const revokedCount = await RefreshTokenModel.revokeAllForUser(userId);

    // Clear session
    await RefreshTokenModel.deleteSession(userId);

    Logger.info('User logged out from all devices', { 
      userId,
      revokedTokens: revokedCount,
      ip: req.ip
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: `Logged out from all devices. ${revokedCount} sessions terminated.`
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };