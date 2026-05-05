import { Request, Response, NextFunction } from 'express';
import { AuthUtils, AuthenticationError, AuthorizationError, PermissionManager } from '@sai-mahendra/utils';
import { UserRole, JwtPayload } from '@sai-mahendra/types';
import { RefreshTokenModel } from '../models/RefreshToken';
import { UserModel } from '../models/User';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { tokenId?: string };
    }
  }
}

/**
 * Middleware to authenticate JWT tokens with blacklist checking
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = AuthUtils.verifyToken(token, jwtSecret) as JwtPayload & { jti?: string };
    
    // Check if token is blacklisted (for logout functionality)
    if (payload.jti) {
      const isBlacklisted = await RefreshTokenModel.isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked');
      }
    }

    // Verify user still exists and is active
    const user = await UserModel.findById(payload.userId);
    if (!user || user.status !== 'active') {
      throw new AuthenticationError('User not found or inactive');
    }

    // Update payload with current user data
    req.user = {
      ...payload,
      role: user.role, // Use current role from database
      tokenId: payload.jti
    };
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to authorize based on user roles
 */
export function authorize(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const hasPermission = AuthUtils.hasRole(req.user.role, requiredRole);
      
      if (!hasPermission) {
        throw new AuthorizationError(`Requires ${requiredRole} role or higher`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check specific resource and action permissions
 */
export function requirePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const hasPermission = PermissionManager.hasPermission(req.user.role, resource, action);
      
      if (!hasPermission) {
        throw new AuthorizationError(`Insufficient permissions for ${action} on ${resource}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check multiple permissions (user must have at least one)
 */
export function requireAnyPermission(permissions: Array<{ resource: string; action: string }>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const hasAnyPermission = PermissionManager.hasAnyPermission(req.user.role, permissions);
      
      if (!hasAnyPermission) {
        throw new AuthorizationError('Insufficient permissions for this operation');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check multiple permissions (user must have all)
 */
export function requireAllPermissions(permissions: Array<{ resource: string; action: string }>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const hasAllPermissions = PermissionManager.hasAllPermissions(req.user.role, permissions);
      
      if (!hasAllPermissions) {
        throw new AuthorizationError('Insufficient permissions for this operation');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user can access their own resources or is admin
 */
export function authorizeOwnerOrAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const targetUserId = req.params.userId || req.params.id;
    const isOwner = req.user.userId === targetUserId;
    const isAdmin = req.user.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('Access denied: can only access own resources');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to check resource ownership with fallback to admin
 */
export function authorizeResourceOwner(resourceIdParam: string = 'id', userIdField: string = 'userId') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      // Admin can access any resource
      if (req.user.role === UserRole.ADMIN) {
        return next();
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        throw new AuthorizationError('Resource ID not provided');
      }

      // This would need to be implemented per resource type
      // For now, we'll use a simple user ID comparison
      const targetUserId = req.params[userIdField] || req.body[userIdField];
      
      if (req.user.userId !== targetUserId) {
        throw new AuthorizationError('Access denied: can only access own resources');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to add user permissions to request object
 */
export function attachPermissions(req: Request, res: Response, next: NextFunction): void {
  try {
    if (req.user) {
      const permissions = PermissionManager.getRolePermissions(req.user.role);
      (req as any).permissions = permissions;
      (req as any).hasPermission = (resource: string, action: string) => 
        PermissionManager.hasPermission(req.user!.role, resource, action);
    }
    
    next();
  } catch (error) {
    next(error);
  }
}