import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { JwtPayload, UserRole } from '@sai-mahendra/types';

export class AuthUtils {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  static generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, expiresIn: string): string {
    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(userId: string, secret: string, expiresIn: string): string {
    return jwt.sign({ userId, type: 'refresh' }, secret, { expiresIn });
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string, secret: string): JwtPayload {
    return jwt.verify(token, secret) as JwtPayload;
  }

  /**
   * Check if user has required role
   */
  static hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy = {
      [UserRole.STUDENT]: 1,
      [UserRole.INSTRUCTOR]: 2,
      [UserRole.ADMIN]: 3
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Generate secure random token for password reset, email verification, etc.
   */
  static generateSecureToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }
}