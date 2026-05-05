import axios from 'axios';
import { Pool } from 'pg';
import { CourseAnalytics } from '../types';

export class CourseManagementService {
  private courseServiceUrl: string;
  private dbPool: Pool;

  constructor(courseServiceUrl: string, dbPool: Pool) {
    this.courseServiceUrl = courseServiceUrl;
    this.dbPool = dbPool;
  }

  /**
   * Get all programs with analytics
   */
  async getPrograms(page: number = 1, limit: number = 20): Promise<any> {
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        p.*,
        COUNT(DISTINCT e.id) as enrollment_count,
        COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) as completion_count,
        COALESCE(SUM(pay.amount), 0) as total_revenue,
        ROUND(AVG(CASE WHEN e.status = 'completed' THEN 100 ELSE e.progress_percentage END), 2) as avg_progress
      FROM programs p
      LEFT JOIN enrollments e ON p.id = e.program_id
      LEFT JOIN payments pay ON p.id = pay.program_id AND pay.status = 'completed'
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = 'SELECT COUNT(*) as total FROM programs';

    const [programsResult, countResult] = await Promise.all([
      this.dbPool.query(query, [limit, offset]),
      this.dbPool.query(countQuery)
    ]);

    const total = parseInt(countResult.rows[0].total);

    return {
      programs: programsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Create new program
   */
  async createProgram(programData: any, adminToken: string): Promise<any> {
    const response = await axios.post(
      `${this.courseServiceUrl}/api/programs`,
      programData,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Update program
   */
  async updateProgram(
    programId: string,
    updates: any,
    adminToken: string
  ): Promise<any> {
    const response = await axios.put(
      `${this.courseServiceUrl}/api/programs/${programId}`,
      updates,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Delete program
   */
  async deleteProgram(programId: string, adminToken: string): Promise<any> {
    const response = await axios.delete(
      `${this.courseServiceUrl}/api/programs/${programId}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Get course analytics
   */
  async getCourseAnalytics(programId?: string): Promise<CourseAnalytics[]> {
    let query = `
      SELECT 
        p.id as course_id,
        p.name as course_name,
        COUNT(DISTINCT e.id) as enrollment_count,
        ROUND(
          COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END)::numeric / 
          NULLIF(COUNT(DISTINCT e.id), 0) * 100, 
          2
        ) as completion_rate,
        ROUND(AVG(e.progress_percentage), 2) as average_progress,
        COALESCE(SUM(pay.amount), 0) as revenue,
        COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.user_id END) as active_students
      FROM programs p
      LEFT JOIN enrollments e ON p.id = e.program_id
      LEFT JOIN payments pay ON p.id = pay.program_id AND pay.status = 'completed'
    `;

    const params: any[] = [];
    if (programId) {
      query += ' WHERE p.id = $1';
      params.push(programId);
    }

    query += ' GROUP BY p.id, p.name ORDER BY enrollment_count DESC';

    const result = await this.dbPool.query(query, params);
    return result.rows;
  }

  /**
   * Get enrollment details
   */
  async getEnrollments(
    filters: {
      programId?: string;
      userId?: string;
      status?: string;
    },
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.programId) {
      conditions.push(`e.program_id = $${paramIndex++}`);
      params.push(filters.programId);
    }

    if (filters.userId) {
      conditions.push(`e.user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.status) {
      conditions.push(`e.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        e.*,
        u.email as user_email,
        u.first_name,
        u.last_name,
        p.name as program_name,
        p.category as program_category
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN programs p ON e.program_id = p.id
      ${whereClause}
      ORDER BY e.enrolled_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM enrollments e
      ${whereClause}
    `;

    const [enrollmentsResult, countResult] = await Promise.all([
      this.dbPool.query(query, params),
      this.dbPool.query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);

    return {
      enrollments: enrollmentsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Update enrollment status
   */
  async updateEnrollmentStatus(
    enrollmentId: string,
    status: string
  ): Promise<any> {
    const query = `
      UPDATE enrollments
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.dbPool.query(query, [status, enrollmentId]);

    if (result.rows.length === 0) {
      throw new Error('Enrollment not found');
    }

    return result.rows[0];
  }

  /**
   * Get enrollment statistics
   */
  async getEnrollmentStatistics(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_enrollments,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_enrollments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_enrollments,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_enrollments,
        COUNT(CASE WHEN enrolled_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_enrollments_30d,
        COUNT(CASE WHEN enrolled_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_enrollments_7d,
        ROUND(AVG(progress_percentage), 2) as avg_progress
      FROM enrollments
    `;

    const result = await this.dbPool.query(query);
    return result.rows[0];
  }

  /**
   * Get top performing courses
   */
  async getTopCourses(limit: number = 10): Promise<any> {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.category,
        COUNT(DISTINCT e.id) as enrollment_count,
        COALESCE(SUM(pay.amount), 0) as revenue,
        ROUND(AVG(e.progress_percentage), 2) as avg_progress
      FROM programs p
      LEFT JOIN enrollments e ON p.id = e.program_id
      LEFT JOIN payments pay ON p.id = pay.program_id AND pay.status = 'completed'
      GROUP BY p.id, p.name, p.category
      ORDER BY enrollment_count DESC, revenue DESC
      LIMIT $1
    `;

    const result = await this.dbPool.query(query, [limit]);
    return result.rows;
  }
}
