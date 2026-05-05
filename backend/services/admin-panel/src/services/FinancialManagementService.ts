import axios from 'axios';
import { Pool } from 'pg';
import { PaymentRefundRequest, FinancialReport } from '../types';

export class FinancialManagementService {
  private paymentServiceUrl: string;
  private dbPool: Pool;

  constructor(paymentServiceUrl: string, dbPool: Pool) {
    this.paymentServiceUrl = paymentServiceUrl;
    this.dbPool = dbPool;
  }

  /**
   * Get all payments with filtering
   */
  async getPayments(
    filters: {
      userId?: string;
      programId?: string;
      status?: string;
      gateway?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`p.user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.programId) {
      conditions.push(`p.program_id = $${paramIndex++}`);
      params.push(filters.programId);
    }

    if (filters.status) {
      conditions.push(`p.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.gateway) {
      conditions.push(`p.gateway = $${paramIndex++}`);
      params.push(filters.gateway);
    }

    if (filters.startDate) {
      conditions.push(`p.created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`p.created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        p.*,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pr.name as program_name
      FROM payments p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN programs pr ON p.program_id = pr.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM payments p
      ${whereClause}
    `;

    const [paymentsResult, countResult] = await Promise.all([
      this.dbPool.query(query, params),
      this.dbPool.query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);

    return {
      payments: paymentsResult.rows,
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
   * Process refund request
   */
  async processRefund(
    paymentId: string,
    amount: number,
    reason: string,
    adminId: string,
    adminToken: string
  ): Promise<any> {
    // Create refund request record
    const insertQuery = `
      INSERT INTO payment_refunds (
        payment_id,
        amount,
        reason,
        admin_id,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, 'pending', NOW())
      RETURNING *
    `;

    const refundResult = await this.dbPool.query(insertQuery, [
      paymentId,
      amount,
      reason,
      adminId
    ]);

    // Call payment service to process refund
    try {
      const response = await axios.post(
        `${this.paymentServiceUrl}/api/payments/refund`,
        {
          paymentId,
          amount,
          reason
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` }
        }
      );

      // Update refund status
      await this.dbPool.query(
        `UPDATE payment_refunds SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [refundResult.rows[0].id]
      );

      return {
        success: true,
        refund: refundResult.rows[0],
        gatewayResponse: response.data
      };
    } catch (error: any) {
      // Update refund status to failed
      await this.dbPool.query(
        `UPDATE payment_refunds SET status = 'failed', error_message = $1 WHERE id = $2`,
        [error.message, refundResult.rows[0].id]
      );

      throw error;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscriptions(
    filters: {
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

    if (filters.userId) {
      conditions.push(`s.user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.status) {
      conditions.push(`s.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        s.*,
        u.email as user_email,
        u.first_name,
        u.last_name,
        p.name as program_name
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      JOIN programs p ON s.program_id = p.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM subscriptions s
      ${whereClause}
    `;

    const [subscriptionsResult, countResult] = await Promise.all([
      this.dbPool.query(query, params),
      this.dbPool.query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);

    return {
      subscriptions: subscriptionsResult.rows,
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
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    reason: string,
    adminToken: string
  ): Promise<any> {
    const response = await axios.put(
      `${this.paymentServiceUrl}/api/subscriptions/${subscriptionId}/cancel`,
      { reason },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Generate revenue report
   */
  async generateRevenueReport(
    startDate: Date,
    endDate: Date
  ): Promise<FinancialReport> {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_transaction,
        COUNT(CASE WHEN gateway = 'razorpay' THEN 1 END) as razorpay_count,
        COUNT(CASE WHEN gateway = 'stripe' THEN 1 END) as stripe_count,
        SUM(CASE WHEN gateway = 'razorpay' THEN amount ELSE 0 END) as razorpay_revenue,
        SUM(CASE WHEN gateway = 'stripe' THEN amount ELSE 0 END) as stripe_revenue
      FROM payments
      WHERE status = 'completed'
        AND created_at >= $1
        AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const result = await this.dbPool.query(query, [startDate, endDate]);

    // Calculate summary
    const summary = {
      totalRevenue: result.rows.reduce((sum, row) => sum + parseFloat(row.total_revenue), 0),
      totalTransactions: result.rows.reduce((sum, row) => sum + parseInt(row.transaction_count), 0),
      averageTransaction: 0,
      byGateway: {
        razorpay: result.rows.reduce((sum, row) => sum + parseFloat(row.razorpay_revenue), 0),
        stripe: result.rows.reduce((sum, row) => sum + parseFloat(row.stripe_revenue), 0)
      }
    };

    summary.averageTransaction = summary.totalRevenue / summary.totalTransactions || 0;

    return {
      reportType: 'revenue',
      startDate,
      endDate,
      data: {
        summary,
        daily: result.rows
      },
      generatedAt: new Date(),
      generatedBy: 'system'
    };
  }

  /**
   * Generate refunds report
   */
  async generateRefundsReport(startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT 
        r.*,
        p.amount as original_amount,
        p.gateway,
        u.email as user_email
      FROM payment_refunds r
      JOIN payments p ON r.payment_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE r.created_at >= $1 AND r.created_at <= $2
      ORDER BY r.created_at DESC
    `;

    const result = await this.dbPool.query(query, [startDate, endDate]);

    const summary = {
      totalRefunds: result.rows.length,
      totalAmount: result.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0),
      byStatus: result.rows.reduce((acc: any, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {})
    };

    return {
      summary,
      refunds: result.rows
    };
  }

  /**
   * Get financial statistics
   */
  async getFinancialStatistics(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'completed' AND created_at >= NOW() - INTERVAL '1 day' THEN amount ELSE 0 END), 0) as revenue_today,
        COALESCE(SUM(CASE WHEN status = 'completed' AND created_at >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as revenue_30d,
        COALESCE(SUM(CASE WHEN status = 'completed' AND created_at >= NOW() - INTERVAL '7 days' THEN amount ELSE 0 END), 0) as revenue_7d,
        ROUND(AVG(CASE WHEN status = 'completed' THEN amount END), 2) as avg_transaction_value
      FROM payments
    `;

    const subscriptionQuery = `
      SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_subscriptions,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_subscriptions
      FROM subscriptions
    `;

    const refundQuery = `
      SELECT 
        COUNT(*) as total_refunds,
        COALESCE(SUM(amount), 0) as total_refunded_amount
      FROM payment_refunds
      WHERE status = 'completed'
    `;

    const [paymentStats, subscriptionStats, refundStats] = await Promise.all([
      this.dbPool.query(query),
      this.dbPool.query(subscriptionQuery),
      this.dbPool.query(refundQuery)
    ]);

    return {
      payments: paymentStats.rows[0],
      subscriptions: subscriptionStats.rows[0],
      refunds: refundStats.rows[0]
    };
  }

  /**
   * Get payment gateway configuration
   */
  async getGatewayConfiguration(): Promise<any> {
    // This would typically fetch from a configuration table
    return {
      razorpay: {
        enabled: true,
        supportedCurrencies: ['INR'],
        supportedMethods: ['card', 'netbanking', 'upi', 'wallet']
      },
      stripe: {
        enabled: true,
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        supportedMethods: ['card', 'paypal', 'apple_pay']
      }
    };
  }

  /**
   * Update payment gateway configuration
   */
  async updateGatewayConfiguration(
    gateway: string,
    config: any
  ): Promise<any> {
    // This would typically update a configuration table
    // For now, we'll just return success
    return {
      success: true,
      message: `${gateway} configuration updated`,
      config
    };
  }
}
