import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Extended Request interface to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Mock authentication middleware
 * In production, this should validate JWT tokens from the auth service
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required',
        },
      });
      return;
    }

    const token = authHeader.substring(7);

    // TODO: Validate JWT token with auth service
    // For now, we'll use a mock user
    // In production, decode and verify the JWT token

    if (!token) {
      res.status(401).json({
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
        },
      });
      return;
    }

    // Mock user - replace with actual JWT validation
    req.user = {
      id: req.headers['x-user-id'] as string || 'mock-user-id',
      email: 'user@example.com',
      role: 'student',
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      error: {
        type: 'AUTHENTICATION_ERROR',
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      },
    });
  }
};

/**
 * Authorization middleware to check user roles
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'NOT_AUTHENTICATED',
          message: 'User not authenticated',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          type: 'AUTHORIZATION_ERROR',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to access this resource',
        },
      });
      return;
    }

    next();
  };
};

export default { authenticate, authorize };
