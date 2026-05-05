/**
 * Authentication Middleware
 * JWT-based authentication for mobile API
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { MobileRequestContext } from '../types';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      mobileContext?: MobileRequestContext;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_MISSING',
          message: 'Authentication token is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    req.user = decoded;

    // Extract mobile context from headers
    const deviceId = req.headers['x-device-id'] as string;
    const deviceType = req.headers['x-device-type'] as 'ios' | 'android' | 'web';
    const appVersion = req.headers['x-app-version'] as string;
    const connectionType = req.headers['x-connection-type'] as string;
    const batteryLevel = req.headers['x-battery-level']
      ? parseInt(req.headers['x-battery-level'] as string)
      : undefined;

    if (deviceId && deviceType && appVersion) {
      req.mobileContext = {
        userId: decoded.userId,
        deviceId,
        deviceType,
        appVersion,
        connectionType,
        batteryLevel,
      };
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_INVALID',
          message: 'Invalid authentication token',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
};

export const requireMobileContext = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.mobileContext) {
    res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'MOBILE_CONTEXT_MISSING',
        message: 'Mobile context headers are required (X-Device-Id, X-Device-Type, X-App-Version)',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  next();
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};
