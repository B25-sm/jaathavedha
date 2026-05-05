import { DatabaseUtils } from '@sai-mahendra/utils';
import { User, UserRole, UserStatus } from '@sai-mahendra/types';
import { PoolClient } from 'pg';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  emailVerified?: boolean;
  status?: UserStatus;
  role?: UserRole;
}

export interface UserFilters {
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  search?: string; // Search in name or email
}

export class UserModel {
  /**
   * Create a new user
   */
  static async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, first_name, last_name, phone, role, status, 
                email_verified, created_at, updated_at
    `;

    const values = [
      userData.email,
      userData.passwordHash,
      userData.firstName,
      userData.lastName,
      userData.phone || null,
      userData.role || UserRole.STUDENT
    ];

    const result = await DatabaseUtils.query(query, values);
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, first_name, last_name, phone, role, status,
             email_verified, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await DatabaseUtils.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, first_name, last_name, phone, role, status,
             email_verified, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await DatabaseUtils.query(query, [email]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  /**
   * Find user by email with password hash (for authentication)
   */
  static async findByEmailWithPassword(email: string): Promise<(User & { passwordHash: string }) | null> {
    const query = `
      SELECT id, email, password_hash, first_name, last_name, phone, role, status,
             email_verified, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await DatabaseUtils.query(query, [email]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...this.mapRowToUser(row),
      passwordHash: row.password_hash
    };
  }

  /**
   * Update user
   */
  static async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(updateData.firstName);
    }

    if (updateData.lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(updateData.lastName);
    }

    if (updateData.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(updateData.phone);
    }

    if (updateData.emailVerified !== undefined) {
      updates.push(`email_verified = $${paramIndex++}`);
      values.push(updateData.emailVerified);
    }

    if (updateData.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(updateData.status);
    }

    if (updateData.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(updateData.role);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, first_name, last_name, phone, role, status,
                email_verified, created_at, updated_at
    `;

    const result = await DatabaseUtils.query(query, values);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  /**
   * Update password hash
   */
  static async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await DatabaseUtils.query(query, [passwordHash, id]);
    return result.rowCount > 0;
  }

  /**
   * Set email verification token
   */
  static async setEmailVerificationToken(id: string, token: string): Promise<boolean> {
    const query = `
      UPDATE users
      SET email_verification_token = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await DatabaseUtils.query(query, [token, id]);
    return result.rowCount > 0;
  }

  /**
   * Verify email using token
   */
  static async verifyEmail(token: string): Promise<User | null> {
    const query = `
      UPDATE users
      SET email_verified = true, email_verification_token = NULL, updated_at = NOW()
      WHERE email_verification_token = $1
      RETURNING id, email, first_name, last_name, phone, role, status,
                email_verified, created_at, updated_at
    `;

    const result = await DatabaseUtils.query(query, [token]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  /**
   * Verify email directly by user ID (for social authentication)
   */
  static async verifyEmailDirectly(userId: string): Promise<boolean> {
    const query = `
      UPDATE users
      SET email_verified = true, email_verification_token = NULL, updated_at = NOW()
      WHERE id = $1
    `;

    const result = await DatabaseUtils.query(query, [userId]);
    return result.rowCount > 0;
  }

  /**
   * Set password reset token
   */
  static async setPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<boolean> {
    const query = `
      UPDATE users
      SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW()
      WHERE email = $3
    `;

    const result = await DatabaseUtils.query(query, [token, expiresAt, email]);
    return result.rowCount > 0;
  }

  /**
   * Reset password using token
   */
  static async resetPassword(token: string, passwordHash: string): Promise<User | null> {
    const query = `
      UPDATE users
      SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW()
      WHERE password_reset_token = $2 AND password_reset_expires > NOW()
      RETURNING id, email, first_name, last_name, phone, role, status,
                email_verified, created_at, updated_at
    `;

    const result = await DatabaseUtils.query(query, [passwordHash, token]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id: string): Promise<void> {
    const query = `
      UPDATE users
      SET last_login = NOW(), updated_at = NOW()
      WHERE id = $1
    `;

    await DatabaseUtils.query(query, [id]);
  }

  /**
   * Find users with filters and pagination
   */
  static async findMany(
    filters: UserFilters = {},
    page: number = 1,
    limit: number = 10
  ): Promise<{ users: User[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(filters.role);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.emailVerified !== undefined) {
      conditions.push(`email_verified = $${paramIndex++}`);
      values.push(filters.emailVerified);
    }

    if (filters.search) {
      conditions.push(`(
        LOWER(first_name || ' ' || last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(email) LIKE LOWER($${paramIndex})
      )`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count total records
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await DatabaseUtils.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT id, email, first_name, last_name, phone, role, status,
             email_verified, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);
    const dataResult = await DatabaseUtils.query(dataQuery, values);
    
    const users = dataResult.rows.map(row => this.mapRowToUser(row));

    return { users, total };
  }

  /**
   * Delete user (soft delete by setting status to inactive)
   */
  static async delete(id: string): Promise<boolean> {
    const query = `
      UPDATE users
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
    `;

    const result = await DatabaseUtils.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Check if email exists
   */
  static async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = 'SELECT 1 FROM users WHERE email = $1';
    const values: any[] = [email];

    if (excludeId) {
      query += ' AND id != $2';
      values.push(excludeId);
    }

    const result = await DatabaseUtils.query(query, values);
    return result.rows.length > 0;
  }

  /**
   * Map database row to User object
   */
  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      emailVerified: row.email_verified,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}