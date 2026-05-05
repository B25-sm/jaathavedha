import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { Db } from 'mongodb';
import axios from 'axios';
import { authenticateAdmin } from '../middleware/auth';
import { DashboardMetrics } from '../types';

export function createDashboardRoutes(
  dbPool: Pool,
  mongoDb: Db,
  analyticsServiceUrl: string
): Router {
  const router = Router();

  // All routes require admin authentication
  router.use(authenticateAdmin);

  /**
   * Get comprehensive dashboard metrics
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch metrics from multiple sources in parallel
      const [userStats, enrollmentStats, revenueStats, contentStats, analyticsData] = await Promise.all([
        getUserMetrics(dbPool),
        getEnrollmentMetrics(dbPool),
        getRevenueMetrics(dbPool),
        getContentMetrics(mongoDb),
        getAnalyticsMetrics(analyticsServiceUrl)
      ]);

      const metrics: DashboardMetrics = {
        users: userStats,
        enrollments: enrollmentStats,
        revenue: revenueStats,
        content: contentStats,
        systemHealth: {
          status: 'healthy',
          services: {
            database: true,
            mongodb: true,
            redis: true,
            analytics: true
          }
        }
      };

      res.json({
        success: true,
        data: {
          ...metrics,
          analytics: analyticsData,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get audit logs
   */
  router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 50, adminId, action, startDate, endDate } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (adminId) {
        conditions.push(`admin_id = $${paramIndex++}`);
        params.push(adminId);
      }

      if (action) {
        conditions.push(`action = $${paramIndex++}`);
        params.push(action);
      }

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        params.push(new Date(startDate as string));
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        params.push(new Date(endDate as string));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT *
        FROM admin_audit_logs
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(parseInt(limit as string), offset);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM admin_audit_logs
        ${whereClause}
      `;

      const [logsResult, countResult] = await Promise.all([
        dbPool.query(query, params),
        dbPool.query(countQuery, params.slice(0, -2))
      ]);

      const total = parseInt(countResult.rows[0].total);

      res.json({
        success: true,
        data: {
          logs: logsResult.rows,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            totalPages: Math.ceil(total / parseInt(limit as string)),
            hasNext: parseInt(page as string) < Math.ceil(total / parseInt(limit as string)),
            hasPrev: parseInt(page as string) > 1
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get system health status
   */
  router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const services = {
        database: false,
        mongodb: false,
        redis: false,
        analytics: false,
        userService: false,
        courseService: false,
        paymentService: false,
        contentService: false
      };

      // Check PostgreSQL
      try {
        await dbPool.query('SELECT 1');
        services.database = true;
      } catch (error) {
        console.error('PostgreSQL health check failed:', error);
      }

      // Check MongoDB
      try {
        await mongoDb.admin().ping();
        services.mongodb = true;
      } catch (error) {
        console.error('MongoDB health check failed:', error);
      }

      // Determine overall status
      const healthyCount = Object.values(services).filter(Boolean).length;
      const totalServices = Object.keys(services).length;
      const healthPercentage = (healthyCount / totalServices) * 100;

      let status: 'healthy' | 'degraded' | 'down';
      if (healthPercentage === 100) {
        status = 'healthy';
      } else if (healthPercentage >= 50) {
        status = 'degraded';
      } else {
        status = 'down';
      }

      res.json({
        success: true,
        data: {
          status,
          services,
          healthPercentage,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

// Helper functions

async function getUserMetrics(dbPool: Pool): Promise<any> {
  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new,
      COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
      COUNT(CASE WHEN role = 'instructor' THEN 1 END) as instructors,
      COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
    FROM users
  `;

  const result = await dbPool.query(query);
  const row = result.rows[0];

  return {
    total: parseInt(row.total),
    active: parseInt(row.active),
    new: parseInt(row.new),
    byRole: {
      student: parseInt(row.students),
      instructor: parseInt(row.instructors),
      admin: parseInt(row.admins)
    }
  };
}

async function getEnrollmentMetrics(dbPool: Pool): Promise<any> {
  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN enrolled_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent
    FROM enrollments
  `;

  const result = await dbPool.query(query);
  const row = result.rows[0];

  return {
    total: parseInt(row.total),
    active: parseInt(row.active),
    completed: parseInt(row.completed),
    recent: parseInt(row.recent)
  };
}

async function getRevenueMetrics(dbPool: Pool): Promise<any> {
  const query = `
    SELECT 
      COALESCE(SUM(amount), 0) as total,
      COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN amount ELSE 0 END), 0) as today,
      COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END), 0) as this_month,
      COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') 
                    AND created_at < DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END), 0) as last_month
    FROM payments
    WHERE status = 'completed'
  `;

  const result = await dbPool.query(query);
  const row = result.rows[0];

  return {
    total: parseFloat(row.total),
    today: parseFloat(row.today),
    thisMonth: parseFloat(row.this_month),
    lastMonth: parseFloat(row.last_month)
  };
}

async function getContentMetrics(mongoDb: Db): Promise<any> {
  const stats = await mongoDb.collection('content').aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        published: [
          { $match: { status: 'published' } },
          { $count: 'count' }
        ],
        pending: [
          { $match: { status: 'pending' } },
          { $count: 'count' }
        ]
      }
    }
  ]).toArray();

  const result = stats[0];

  return {
    total: result.total[0]?.count || 0,
    published: result.published[0]?.count || 0,
    pending: result.pending[0]?.count || 0
  };
}

async function getAnalyticsMetrics(analyticsServiceUrl: string): Promise<any> {
  try {
    const response = await axios.get(`${analyticsServiceUrl}/api/analytics/dashboard`, {
      timeout: 5000
    });

    return response.data.data;
  } catch (error) {
    console.error('Failed to fetch analytics metrics:', error);
    return null;
  }
}
