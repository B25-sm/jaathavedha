import { Router, Request, Response, NextFunction } from 'express';
import { ValidationUtils, Logger, PermissionManager, RESOURCES, ACTIONS } from '@sai-mahendra/utils';
import { ValidationError, NotFoundError } from '@sai-mahendra/utils';
import { ApiResponse, UserRole, UserStatus } from '@sai-mahendra/types';
import { UserModel, UserFilters } from '../models/User';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

// All admin routes require admin role
router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

/**
 * Get all users with filtering and pagination
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, role, status, emailVerified, search } = req.query;

    // Validate pagination parameters
    const { value: paginationData, error } = ValidationUtils.validate(
      { page: Number(page), limit: Number(limit) },
      ValidationUtils.ValidationSchemas.pagination
    );

    if (error) {
      throw new ValidationError('Invalid pagination parameters', error.details);
    }

    // Build filters
    const filters: UserFilters = {};
    
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      filters.role = role as UserRole;
    }
    
    if (status && Object.values(UserStatus).includes(status as UserStatus)) {
      filters.status = status as UserStatus;
    }
    
    if (emailVerified !== undefined) {
      filters.emailVerified = emailVerified === 'true';
    }
    
    if (search && typeof search === 'string') {
      filters.search = search.trim();
    }

    const { users, total } = await UserModel.findMany(
      filters,
      paginationData.page,
      paginationData.limit
    );

    const totalPages = Math.ceil(total / paginationData.limit);

    const response: ApiResponse = {
      success: true,
      data: {
        users,
        pagination: {
          page: paginationData.page,
          limit: paginationData.limit,
          total,
          totalPages,
          hasNext: paginationData.page < totalPages,
          hasPrev: paginationData.page > 1
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Get user by ID (admin view with more details)
 */
router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
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
 * Update user role
 */
router.put('/users/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;

    if (!role || !Object.values(UserRole).includes(role)) {
      throw new ValidationError('Valid role is required', {
        validRoles: Object.values(UserRole)
      });
    }

    const user = await UserModel.update(req.params.id, { role });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    Logger.info('User role updated by admin', {
      userId: user.id,
      newRole: role,
      adminId: req.user!.userId
    });

    const response: ApiResponse = {
      success: true,
      data: {
        user,
        message: `User role updated to ${role}`
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Update user status
 */
router.put('/users/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;

    if (!status || !Object.values(UserStatus).includes(status)) {
      throw new ValidationError('Valid status is required', {
        validStatuses: Object.values(UserStatus)
      });
    }

    const user = await UserModel.update(req.params.id, { status });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    Logger.info('User status updated by admin', {
      userId: user.id,
      newStatus: status,
      adminId: req.user!.userId
    });

    const response: ApiResponse = {
      success: true,
      data: {
        user,
        message: `User status updated to ${status}`
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Manually verify user email
 */
router.put('/users/:id/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.update(req.params.id, { emailVerified: true });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    Logger.info('User email verified by admin', {
      userId: user.id,
      adminId: req.user!.userId
    });

    const response: ApiResponse = {
      success: true,
      data: {
        user,
        message: 'User email verified successfully'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Get user statistics
 */
router.get('/stats/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get user counts by role
    const roleStats = await Promise.all(
      Object.values(UserRole).map(async (role) => {
        const { total } = await UserModel.findMany({ role }, 1, 1);
        return { role, count: total };
      })
    );

    // Get user counts by status
    const statusStats = await Promise.all(
      Object.values(UserStatus).map(async (status) => {
        const { total } = await UserModel.findMany({ status }, 1, 1);
        return { status, count: total };
      })
    );

    // Get email verification stats
    const { total: verifiedCount } = await UserModel.findMany({ emailVerified: true }, 1, 1);
    const { total: unverifiedCount } = await UserModel.findMany({ emailVerified: false }, 1, 1);

    // Get total users
    const { total: totalUsers } = await UserModel.findMany({}, 1, 1);

    const response: ApiResponse = {
      success: true,
      data: {
        total: totalUsers,
        byRole: roleStats,
        byStatus: statusStats,
        emailVerification: {
          verified: verifiedCount,
          unverified: unverifiedCount
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Bulk update users
 */
router.put('/users/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIds, updates } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('User IDs array is required');
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates object is required');
    }

    // Validate updates
    const allowedUpdates = ['status', 'role', 'emailVerified'];
    const updateKeys = Object.keys(updates);
    const invalidKeys = updateKeys.filter(key => !allowedUpdates.includes(key));

    if (invalidKeys.length > 0) {
      throw new ValidationError('Invalid update fields', { invalidKeys, allowedUpdates });
    }

    // Perform bulk update
    const updatedUsers = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const user = await UserModel.update(userId, updates);
        if (user) {
          updatedUsers.push(user);
        } else {
          errors.push({ userId, error: 'User not found' });
        }
      } catch (error) {
        errors.push({ userId, error: (error as Error).message });
      }
    }

    Logger.info('Bulk user update performed by admin', {
      adminId: req.user!.userId,
      updatedCount: updatedUsers.length,
      errorCount: errors.length,
      updates
    });

    const response: ApiResponse = {
      success: true,
      data: {
        updated: updatedUsers,
        errors,
        message: `Updated ${updatedUsers.length} users successfully`
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Get role permissions information
 */
router.get('/permissions/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rolePermissions = Object.values(UserRole).map(role => 
      PermissionManager.getPermissionSummary(role)
    );

    const response: ApiResponse = {
      success: true,
      data: {
        roles: rolePermissions,
        resources: Object.values(RESOURCES),
        actions: Object.values(ACTIONS)
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Check user permissions
 */
router.post('/permissions/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, resource, action } = req.body;

    if (!userId || !resource || !action) {
      throw new ValidationError('userId, resource, and action are required');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hasPermission = PermissionManager.hasPermission(user.role, resource, action);
    const allowedActions = PermissionManager.getAllowedActions(user.role, resource);

    const response: ApiResponse = {
      success: true,
      data: {
        userId,
        userRole: user.role,
        resource,
        action,
        hasPermission,
        allowedActions
      }
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };