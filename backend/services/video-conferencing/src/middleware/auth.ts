import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
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
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      logger.error('JWT_SECRET is not configured');
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'CONFIGURATION_ERROR',
          message: 'Server configuration error',
        },
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as any;

    req.user = {
      id: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
        },
      });
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
        },
      });
      return;
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
      },
    });
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'NOT_AUTHENTICATED',
          message: 'User is not authenticated',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          type: 'AUTHORIZATION_ERROR',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource',
        },
      });
      return;
    }

    next();
  };
};
