import axios from 'axios';
import { Pool } from 'pg';
import { UserSearchFilters, UserBulkOperation, ExportOptions } from '../types';

export class UserManagementService {
  private userServiceUrl: string;
  private dbPool: Pool;

  constructor(userServiceUrl: string, dbPool: Pool) {
    this.userServiceUrl = userServiceUrl;
    this.dbPool = dbPool;
  }

  /**
   * Search and filter users with advanced options
   */
  async searchUsers(
    filters: UserSearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const query: any = {
      page,
      limit
    };

    if (filters.search) query.search = filters.search;
    if (filters.role) query.role = filters.role;
    if (filters.status) query.status = filters.status;
    if (filters.emailVerified !== undefined) query.emailVerified = filters.emailVerified;

    const response = await axios.get(`${this.userServiceUrl}/admin/users`, {
      params: query
    });

    return response.data;
  }

  /**
   * Get detailed user information including activity
   */
  async getUserDetails(userId: string): Promise<any> {
    const [userResponse, activityData] = await Promise.all([
      axios.get(`${this.userServiceUrl}/admin/users/${userId}`),
      this.getUserActivity(userId)
    ]);

    return {
      ...userResponse.data.data.user,
      activity: activityData
    };
  }

  /**
   * Get user activity and engagement metrics
   */
  async getUserActivity(userId: string): Promise<any> {
    const query = `
      SELECT 
        COUNT(DISTINCT e.id) as total_enrollments,
        COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) as completed_courses,
        COALESCE(SUM(p.amount), 0) as total_spent,
        MAX(u.last_login_at) as last_login,
        COUNT(DISTINCT p.id) as total_payments
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id
      LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'completed'
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const result = await this.dbPool.query(query, [userId]);
    return result.rows[0] || {};
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: string, adminToken: string): Promise<any> {
    const response = await axios.put(
      `${this.userServiceUrl}/admin/users/${userId}/role`,
      { role },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId: string, status: string, adminToken: string): Promise<any> {
    const response = await axios.put(
      `${this.userServiceUrl}/admin/users/${userId}/status`,
      { status },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Perform bulk operations on users
   */
  async bulkOperation(operation: UserBulkOperation, adminToken: string): Promise<any> {
    const results = {
      successful: [] as string[],
      failed: [] as { userId: string; error: string }[]
    };

    for (const userId of operation.userIds) {
      try {
        switch (operation.operation) {
          case 'update_status':
            await this.updateUserStatus(userId, operation.data.status, adminToken);
            results.successful.push(userId);
            break;

          case 'update_role':
            await this.updateUserRole(userId, operation.data.role, adminToken);
            results.successful.push(userId);
            break;

          case 'delete':
            // Soft delete user
            await this.updateUserStatus(userId, 'deleted', adminToken);
            results.successful.push(userId);
            break;

          default:
            results.failed.push({ userId, error: 'Unknown operation' });
        }
      } catch (error: any) {
        results.failed.push({
          userId,
          error: error.response?.data?.error?.message || error.message
        });
      }
    }

    return results;
  }

  /**
   * Export user data
   */
  async exportUsers(filters: UserSearchFilters, options: ExportOptions): Promise<any> {
    // Get all users matching filters (no pagination for export)
    const users = await this.getAllUsers(filters);

    if (options.format === 'json') {
      return JSON.stringify(users, null, 2);
    }

    if (options.format === 'csv') {
      return this.convertToCSV(users, options.fields);
    }

    throw new Error(`Unsupported export format: ${options.format}`);
  }

  /**
   * Get all users without pagination (for exports)
   */
  private async getAllUsers(filters: UserSearchFilters): Promise<any[]> {
    const users: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.searchUsers(filters, page, 100);
      users.push(...response.data.users);
      hasMore = response.data.pagination.hasNext;
      page++;
    }

    return users;
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any[], fields?: string[]): string {
    if (data.length === 0) return '';

    const selectedFields = fields || Object.keys(data[0]);
    const header = selectedFields.join(',');
    const rows = data.map(item =>
      selectedFields.map(field => {
        const value = item[field];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_users,
        COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
        COUNT(CASE WHEN role = 'instructor' THEN 1 END) as instructors,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d
      FROM users
    `;

    const result = await this.dbPool.query(query);
    return result.rows[0];
  }
}
