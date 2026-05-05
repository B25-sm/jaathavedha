import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;

export async function initializeRedis(url: string): Promise<void> {
  redisClient = createClient({ url });
  await redisClient.connect();
}

export interface AdminUser {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminUser;
    }
  }
}

/**
 * Authenticate admin user via JWT token
 */
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_MISSING',
          message: 'Access token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as any;

    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`admin:blacklist:${token}`);
    if (isBlacklisted) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been revoked',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Verify admin role
    if (decoded.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          type: 'AUTHORIZATION_ERROR',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin access required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Check session validity
    const sessionKey = `admin:session:${decoded.userId}`;
    const session = await redisClient.get(sessionKey);
    
    if (!session) {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'SESSION_EXPIRED',
          message: 'Admin session has expired',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Update session activity
    await redisClient.expire(
      sessionKey,
      parseInt(process.env.ADMIN_SESSION_TIMEOUT || '3600')
    );

    req.admin = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(403).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_INVALID',
          message: 'Invalid token',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_SERVER_ERROR',
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

export { redisClient };
