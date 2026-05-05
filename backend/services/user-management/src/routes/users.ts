import { Router, Request, Response, NextFunction } from 'express';
import { ValidationSchemas, ValidationUtils, AuthUtils, Logger } from '@sai-mahendra/utils';
import { ValidationError, NotFoundError, ConflictError } from '@sai-mahendra/utils';
import { ApiResponse } from '@sai-mahendra/types';
import { UserModel } from '../models/User';
import { EmailService } from '../services/EmailService';
import { authenticate, authorizeOwnerOrAdmin } from '../middleware/auth';

const router = Router();

/**
 * Get user profile by ID
 */
router.get('/:id', authenticate, authorizeOwnerOrAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.findById(req.params.id);
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
 * Update user profile
 */
router.put('/:id', authenticate, authorizeOwnerOrAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value: updateData, error } = ValidationUtils.validate(
      req.body,
      ValidationSchemas.userProfileUpdate
    );

    if (error) {
      throw new ValidationError('Invalid update data', error.details);
    }

    const user = await UserModel.update(req.params.id, updateData);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    Logger.info('User profile updated', { 
      userId: user.id, 
      updatedBy: req.user!.userId,
      fields: Object.keys(updateData)
    });

    const response: ApiResponse = {
      success: true,
      data: { 
        user,
        message: 'Profile updated successfully'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Change password
 */
router.put('/:id/password', authenticate, authorizeOwnerOrAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }

    // Validate new password format
    const { error } = ValidationUtils.validate(
      { password: newPassword },
      ValidationSchemas.userRegistration.extract('password')
    );

    if (error) {
      throw new ValidationError('Invalid new password format', error.details);
    }

    // Only the user themselves can change their password (not even admin)
    if (req.user!.userId !== req.params.id) {
      throw new ValidationError('Users can only change their own password');
    }

    // Get user with current password hash
    const user = await UserModel.findByEmailWithPassword(req.user!.email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValidPassword = await AuthUtils.verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await AuthUtils.hashPassword(newPassword);

    // Update password
    const success = await UserModel.updatePassword(req.params.id, newPasswordHash);
    if (!success) {
      throw new NotFoundError('User not found');
    }

    // Send password change confirmation email
    const user = await UserModel.findById(req.params.id);
    if (user) {
      await EmailService.sendPasswordChangeConfirmation(user.email, user.firstName);
    }

    Logger.info('User password changed', { userId: req.params.id });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Password changed successfully'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Resend email verification
 */
router.post('/:id/resend-verification', authenticate, authorizeOwnerOrAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.emailVerified) {
      throw new ConflictError('Email is already verified');
    }

    // Generate new verification token
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

    Logger.info('Email verification resent', { userId: user.id, email: user.email });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Verification email sent successfully'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Delete user account (soft delete)
 */
router.delete('/:id', authenticate, authorizeOwnerOrAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await UserModel.delete(req.params.id);
    if (!success) {
      throw new NotFoundError('User not found');
    }

    Logger.info('User account deleted', { 
      userId: req.params.id, 
      deletedBy: req.user!.userId 
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Account deleted successfully'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export { router as userRoutes };