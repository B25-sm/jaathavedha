/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user information to requests
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '@sai-mahendra/database';

export interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  name: string;
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token with Redis session store
    const redis = getRedisClient();
    const sessionData = await redis.get(`session:${token}`);

    if (!sessionData) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Parse user data from session
    const user: AuthUser = JSON.parse(sessionData);

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        code: 'AUTH_MIDDLEWARE_ERROR',
        message: 'Error processing authentication',
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Export as 'authenticate' for convenience
export const authenticate = authMiddleware;

/**
 * Middleware to check if user has required role
 */
export function requireRole(...roles: Array<'student' | 'instructor' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'NOT_AUTHENTICATED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          type: 'AUTHORIZATION_ERROR',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'User does not have required permissions',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication - attaches user if token is present but doesn't require it
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const redis = getRedisClient();
      const sessionData = await redis.get(`session:${token}`);

      if (sessionData) {
        req.user = JSON.parse(sessionData);
      }
    }

    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
