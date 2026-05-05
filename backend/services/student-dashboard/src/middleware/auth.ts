/**
 * Authentication Middleware for Student Dashboard Service
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getCache } from '@sai-mahendra/database';
import { AppError } from '@sai-mahendra/utils';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401);
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      throw new AppError('Access token required', 401);
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded || !decoded.userId) {
      throw new AppError('Invalid access token', 401);
    }

    // Check if token is blacklisted
    const cache = getCache();
    const isBlacklisted = await cache.get(`blacklist:${token}`);
    
    if (isBlacklisted) {
      throw new AppError('Token has been revoked', 401);
    }

    // Get user session from cache
    const userSession = await cache.get(`session:${decoded.userId}`);
    
    if (!userSession) {
      throw new AppError('Session expired', 401);
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid access token', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Access token expired', 401));
    } else {
      next(error);
    }
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403));
      return;
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }

    if (!req.user.permissions.includes(permission) && req.user.role !== 'admin') {
      next(new AppError('Insufficient permissions', 403));
      return;
    }

    next();
  };
};

export const requireStudentAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new AppError('Authentication required', 401));
    return;
  }

  // Admin can access any student's data
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Student can only access their own data
  if (req.user.role === 'student') {
    const requestedStudentId = req.params.studentId || req.query.student_id || req.body.student_id;
    
    if (requestedStudentId && requestedStudentId !== req.user.id) {
      next(new AppError('Access denied', 403));
      return;
    }
    
    next();
    return;
  }

  next(new AppError('Insufficient permissions', 403));
};