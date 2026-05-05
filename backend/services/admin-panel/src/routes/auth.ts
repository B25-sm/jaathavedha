import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { redisClient } from '../middleware/auth';
import { logAdminAction } from '../middleware/auditLogger';
import { AdminAction } from '../types';

export function createAuthRoutes(dbPool: Pool): Router {
  const router = Router();

  /**
   * Admin login (delegates to user service but creates admin session)
   */
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            code: 'MISSING_CREDENTIALS',
            message: 'Email and password are required'
          }
        });
      }

      // Verify user exists and is admin
      const userQuery = `
        SELECT id, email, password_hash, role, status
        FROM users
        WHERE email = $1 AND role = 'admin'
      `;

      const userResult = await dbPool.query(userQuery, [email]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            type: 'AUTHENTICATION_ERROR',
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }

      const user = userResult.rows[0];

      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: {
            type: 'AUTHORIZATION_ERROR',
            code: 'ACCOUNT_INACTIVE',
            message: 'Account is not active'
          }
        });
      }

      // Verify password (would use bcrypt in real implementation)
      const bcrypt = require('bcrypt');
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: {
            type: 'AUTHENTICATION_ERROR',
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
      );

      // Create admin session in Redis
      const sessionKey = `admin:session:${user.id}`;
      const sessionData = {
        userId: user.id,
        email: user.email,
        loginAt: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      await redisClient.setEx(
        sessionKey,
        parseInt(process.env.ADMIN_SESSION_TIMEOUT || '3600'),
        JSON.stringify(sessionData)
      );

      // Log admin login
      await logAdminAction(
        { admin: { userId: user.id, email: user.email, role: user.role } } as Request,
        {
          action: AdminAction.ADMIN_LOGIN,
          resource: 'auth',
          status: 'success'
        }
      );

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          },
          expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Admin logout
   */
  router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        // Blacklist the token
        const decoded = jwt.decode(token) as any;
        if (decoded) {
          const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await redisClient.setEx(`admin:blacklist:${token}`, expiresIn, 'true');
          }

          // Remove session
          await redisClient.del(`admin:session:${decoded.userId}`);

          // Log admin logout
          await logAdminAction(
            { admin: { userId: decoded.userId, email: decoded.email, role: decoded.role } } as Request,
            {
              action: AdminAction.ADMIN_LOGOUT,
              resource: 'auth',
              status: 'success'
            }
          );
        }
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Verify admin session
   */
  router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            type: 'AUTHENTICATION_ERROR',
            code: 'TOKEN_MISSING',
            message: 'Access token is required'
          }
        });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fallback-secret'
      ) as any;

      // Check session
      const sessionKey = `admin:session:${decoded.userId}`;
      const session = await redisClient.get(sessionKey);

      if (!session) {
        return res.status(401).json({
          success: false,
          error: {
            type: 'AUTHENTICATION_ERROR',
            code: 'SESSION_EXPIRED',
            message: 'Session has expired'
          }
        });
      }

      res.json({
        success: true,
        data: {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          session: JSON.parse(session)
        }
      });
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            type: 'AUTHENTICATION_ERROR',
            code: 'TOKEN_EXPIRED',
            message: 'Token has expired'
          }
        });
      }

      next(error);
    }
  });

  return router;
}
