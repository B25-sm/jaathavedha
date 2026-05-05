/**
 * Payment Service
 * Core payment processing logic with multi-gateway support
 */

import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import { RazorpayGateway } from '../gateways/RazorpayGateway';
import { StripeGateway } from '../gateways/StripeGateway';
import {
  Payment,
  PaymentWithDetails,
  CreatePaymentRequest,
  CreateOrderRequest,
  VerifyPaymentRequest,
  RefundRequest,
  PaymentFilters,
  PaginationOptions,
  PaginatedResponse,
  PaymentStats,
  PaymentAnalytics,
  PaymentGatewayConfig,
} from '../types';

export class PaymentService {
  private db = getDatabase();
  private cache = getCache();
  private razorpayGateway: RazorpayGateway;
  private stripeGateway: StripeGateway;

  constructor(config: PaymentGatewayConfig) {
    this.razorpayGateway = new RazorpayGateway(config.razorpay);
    this.stripeGateway = new StripeGateway(config.stripe);
  }

  async createOrder(request: CreateOrderRequest): Promise<{
    payment_id: string;
    gateway_order_id: string;
    amount: number;
    currency: string;
    gateway_data: any;
  }> {
    try {
      // Validate program exists and get pricing
      const program = await this.db.queryOne<{ id: string; price: number; currency: string; is_active: boolean }>(
        'SELECT id, price, currency, is_active FROM programs WHERE id = $1',
        [request.program_id]
      );

      if (!program) {
        throw new AppError('Program not found', 404);
      }

      if (!program.is_active) {
        throw new AppError('Program is not available for purchase', 400);
      }

      // Validate amount matches program price
      if (Math.abs(request.amount - program.price) > 0.01) {
        throw new AppError('Invalid payment amount', 400);
      }

      // Select gateway based on currency and region
      const gateway = this.selectGateway(request.currency || program.currency, request.gateway);

      // Create payment record
      const payment = await this.db.insert<Payment>('payments', {
        user_id: request.user_id,
        program_id: request.program_id,
        amount: request.amount,
        currency: request.currency || program.currency,
        gateway,
        status: 'pending',
      });

      // Create order with selected gateway
      let orderResponse;
      if (gateway === 'razorpay') {
        orderResponse = await this.razorpayGateway.createOrder(request);
      } else {
        orderResponse = await this.stripeGateway.createOrder(request);
      }

      // Update payment with gateway order ID
      await this.db.update(
        'payments',
        { gateway_order_id: orderResponse.gateway_order_id },
        { id: payment.id }
      );

      logger.info('Payment order created successfully', {
        paymentId: payment.id,
        gateway,
        orderId: orderResponse.gateway_order_id,
      });

      return {
        payment_id: payment.id,
        gateway_order_id: orderResponse.gateway_order_id,
        amount: orderResponse.amount,
        currency: orderResponse.currency,
        gateway_data: orderResponse.gateway_data,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create payment order', { error, request });
      throw new AppError('Failed to create payment order', 500);
    }
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<Payment> {
    try {
      // Get payment record
      const payment = await this.db.queryOne<Payment>(
        'SELECT * FROM payments WHERE id = $1',
        [request.payment_id]
      );

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      if (payment.status !== 'pending') {
        throw new AppError('Payment already processed', 400);
      }

      // Verify with appropriate gateway
      let verificationResult;
      if (payment.gateway === 'razorpay') {
        verificationResult = await this.razorpayGateway.verifyPayment(request);
      } else {
        verificationResult = await this.stripeGateway.verifyPayment(request);
      }

      // Update payment record
      const updateData: any = {
        gateway_payment_id: verificationResult.gateway_payment_id,
        status: verificationResult.status,
        failure_reason: verificationResult.failure_reason,
      };

      if (verificationResult.success) {
        updateData.completed_at = new Date();
      }

      const updatedPayment = await this.db.update<Payment>(
        'payments',
        updateData,
        { id: payment.id }
      );

      if (!updatedPayment) {
        throw new AppError('Failed to update payment', 500);
      }

      // If payment successful, create enrollment
      if (verificationResult.success) {
        await this.createEnrollment(payment.user_id, payment.program_id);
        await this.generateInvoice(updatedPayment);
      }

      // Clear user dashboard cache
      await this.cache.del(`dashboard:${payment.user_id}`);

      logger.info('Payment verification completed', {
        paymentId: payment.id,
        success: verificationResult.success,
        status: verificationResult.status,
      });

      return updatedPayment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to verify payment', { error, request });
      throw new AppError('Failed to verify payment', 500);
    }
  }

  async processRefund(request: RefundRequest): Promise<{
    success: boolean;
    refund_id?: string;
    amount?: number;
  }> {
    try {
      // Get payment record
      const payment = await this.db.queryOne<Payment>(
        'SELECT * FROM payments WHERE id = $1',
        [request.payment_id]
      );

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      if (payment.status !== 'completed') {
        throw new AppError('Payment is not eligible for refund', 400);
      }

      if (!payment.gateway_payment_id) {
        throw new AppError('Gateway payment ID not found', 400);
      }

      // Process refund with appropriate gateway
      let refundResult;
      if (payment.gateway === 'razorpay') {
        refundResult = await this.razorpayGateway.processRefund(request, payment.gateway_payment_id);
      } else {
        refundResult = await this.stripeGateway.processRefund(request, payment.gateway_payment_id);
      }

      if (refundResult.success) {
        // Update payment status
        await this.db.update(
          'payments',
          { 
            status: 'refunded',
            metadata: {
              ...payment.metadata,
              refund_id: refundResult.refund_id,
              refund_amount: refundResult.amount,
              refund_reason: request.reason,
              refunded_at: new Date().toISOString(),
            }
          },
          { id: payment.id }
        );

        // Update enrollment status if full refund
        if (!request.amount || request.amount >= payment.amount) {
          await this.cancelEnrollment(payment.user_id, payment.program_id);
        }

        logger.info('Refund processed successfully', {
          paymentId: payment.id,
          refundId: refundResult.refund_id,
          amount: refundResult.amount,
        });
      }

      return {
        success: refundResult.success,
        refund_id: refundResult.refund_id,
        amount: refundResult.amount,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to process refund', { error, request });
      throw new AppError('Failed to process refund', 500);
    }
  }

  async getPayments(
    filters: PaymentFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<PaymentWithDetails>> {
    try {
      const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (filters.user_id) {
        whereConditions.push(`p.user_id = $${paramIndex++}`);
        queryParams.push(filters.user_id);
      }

      if (filters.program_id) {
        whereConditions.push(`p.program_id = $${paramIndex++}`);
        queryParams.push(filters.program_id);
      }

      if (filters.status) {
        whereConditions.push(`p.status = $${paramIndex++}`);
        queryParams.push(filters.status);
      }

      if (filters.gateway) {
        whereConditions.push(`p.gateway = $${paramIndex++}`);
        queryParams.push(filters.gateway);
      }

      if (filters.date_from) {
        whereConditions.push(`p.created_at >= $${paramIndex++}`);
        queryParams.push(filters.date_from);
      }

      if (filters.date_to) {
        whereConditions.push(`p.created_at <= $${paramIndex++}`);
        queryParams.push(filters.date_to);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM payments p
        ${whereClause}
      `;
      const countResult = await this.db.queryOne<{ count: string }>(countQuery, queryParams);
      const total = parseInt(countResult?.count || '0', 10);

      // Get paginated data with user and program details
      const dataQuery = `
        SELECT 
          p.*,
          u.first_name || ' ' || u.last_name as user_name,
          u.email as user_email,
          pr.name as program_name
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN programs pr ON p.program_id = pr.id
        ${whereClause}
        ORDER BY p.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      const data = await this.db.queryMany<any>(dataQuery, [
        ...queryParams,
        limit,
        offset,
      ]);

      // Transform results
      const payments = data.map(row => ({
        id: row.id,
        user_id: row.user_id,
        program_id: row.program_id,
        amount: row.amount,
        currency: row.currency,
        gateway: row.gateway,
        gateway_payment_id: row.gateway_payment_id,
        gateway_order_id: row.gateway_order_id,
        status: row.status,
        payment_method: row.payment_method,
        failure_reason: row.failure_reason,
        metadata: row.metadata,
        created_at: row.created_at,
        completed_at: row.completed_at,
        user_name: row.user_name,
        user_email: row.user_email,
        program_name: row.program_name,
      }));

      return {
        data: payments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get payments', { error, filters, pagination });
      throw new AppError('Failed to retrieve payments', 500);
    }
  }

  async getPaymentById(id: string): Promise<PaymentWithDetails | null> {
    try {
      const payment = await this.db.queryOne<any>(`
        SELECT 
          p.*,
          u.first_name || ' ' || u.last_name as user_name,
          u.email as user_email,
          pr.name as program_name
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN programs pr ON p.program_id = pr.id
        WHERE p.id = $1
      `, [id]);

      if (!payment) return null;

      return {
        id: payment.id,
        user_id: payment.user_id,
        program_id: payment.program_id,
        amount: payment.amount,
        currency: payment.currency,
        gateway: payment.gateway,
        gateway_payment_id: payment.gateway_payment_id,
        gateway_order_id: payment.gateway_order_id,
        status: payment.status,
        payment_method: payment.payment_method,
        failure_reason: payment.failure_reason,
        metadata: payment.metadata,
        created_at: payment.created_at,
        completed_at: payment.completed_at,
        user_name: payment.user_name,
        user_email: payment.user_email,
        program_name: payment.program_name,
      };
    } catch (error) {
      logger.error('Failed to get payment by ID', { error, id });
      throw new AppError('Failed to retrieve payment', 500);
    }
  }

  async getPaymentStats(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<PaymentStats> {
    try {
      const cacheKey = `payment_stats:${dateFrom?.toISOString()}:${dateTo?.toISOString()}`;
      const cached = await this.cache.get<PaymentStats>(cacheKey);
      if (cached) return cached;

      const dateFilter = this.buildDateFilter(dateFrom, dateTo);
      const { whereClause, params } = dateFilter;

      const [
        totalResult,
        successfulResult,
        failedResult,
        amountResult,
        gatewayStatsResult,
      ] = await Promise.all([
        this.db.queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM payments ${whereClause}`, params),
        this.db.queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM payments ${whereClause} AND status = 'completed'`, params),
        this.db.queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM payments ${whereClause} AND status = 'failed'`, params),
        this.db.queryOne<{ total: string, avg: string }>(`
          SELECT 
            COALESCE(SUM(amount), 0) as total,
            COALESCE(AVG(amount), 0) as avg
          FROM payments 
          ${whereClause} AND status = 'completed'
        `, params),
        this.db.queryMany<{ gateway: string; amount: string; count: string }>(`
          SELECT 
            gateway,
            COALESCE(SUM(amount), 0) as amount,
            COUNT(*) as count
          FROM payments 
          ${whereClause} AND status = 'completed'
          GROUP BY gateway
        `, params),
      ]);

      const totalPayments = parseInt(totalResult?.count || '0', 10);
      const successfulPayments = parseInt(successfulResult?.count || '0', 10);
      const failedPayments = parseInt(failedResult?.count || '0', 10);
      const totalAmount = parseFloat(amountResult?.total || '0');
      const averageAmount = parseFloat(amountResult?.avg || '0');

      const stats: PaymentStats = {
        total_payments: totalPayments,
        successful_payments: successfulPayments,
        failed_payments: failedPayments,
        total_amount: totalAmount,
        success_rate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
        average_amount: averageAmount,
        revenue_by_gateway: gatewayStatsResult.map(row => ({
          gateway: row.gateway,
          amount: parseFloat(row.amount),
          count: parseInt(row.count, 10),
        })),
        revenue_by_period: [], // Would implement based on specific period requirements
      };

      // Cache for 10 minutes
      await this.cache.set(cacheKey, stats, { ttl: 600 });

      return stats;
    } catch (error) {
      logger.error('Failed to get payment stats', { error });
      throw new AppError('Failed to retrieve payment statistics', 500);
    }
  }

  // Private helper methods
  private selectGateway(currency: string, preferredGateway?: 'razorpay' | 'stripe'): 'razorpay' | 'stripe' {
    if (preferredGateway) {
      return preferredGateway;
    }

    // Auto-select based on currency
    if (currency === 'INR') {
      return 'razorpay';
    }

    return 'stripe';
  }

  private async createEnrollment(userId: string, programId: string): Promise<void> {
    try {
      // Check if enrollment already exists
      const existingEnrollment = await this.db.queryOne(
        'SELECT id FROM enrollments WHERE user_id = $1 AND program_id = $2',
        [userId, programId]
      );

      if (!existingEnrollment) {
        await this.db.insert('enrollments', {
          user_id: userId,
          program_id: programId,
          status: 'active',
          progress_percentage: 0,
        });

        logger.info('Enrollment created after successful payment', { userId, programId });
      }
    } catch (error) {
      logger.error('Failed to create enrollment', { error, userId, programId });
      // Don't throw error as payment was successful
    }
  }

  private async cancelEnrollment(userId: string, programId: string): Promise<void> {
    try {
      await this.db.update(
        'enrollments',
        { status: 'cancelled' },
        { user_id: userId, program_id: programId }
      );

      logger.info('Enrollment cancelled after refund', { userId, programId });
    } catch (error) {
      logger.error('Failed to cancel enrollment', { error, userId, programId });
    }
  }

  private async generateInvoice(payment: Payment): Promise<void> {
    try {
      // Generate unique invoice number
      const invoiceNumber = `INV-${Date.now()}-${payment.id.slice(-6)}`;

      // Calculate tax (simplified - 18% GST for India, 0% for others)
      const taxRate = payment.currency === 'INR' ? 0.18 : 0;
      const taxAmount = payment.amount * taxRate;
      const totalAmount = payment.amount + taxAmount;

      await this.db.insert('invoices', {
        user_id: payment.user_id,
        payment_id: payment.id,
        invoice_number: invoiceNumber,
        amount: payment.amount,
        currency: payment.currency,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        invoice_date: new Date(),
        status: 'generated',
      });

      logger.info('Invoice generated successfully', { 
        paymentId: payment.id,
        invoiceNumber 
      });
    } catch (error) {
      logger.error('Failed to generate invoice', { error, paymentId: payment.id });
    }
  }

  private buildDateFilter(dateFrom?: Date, dateTo?: Date): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return { whereClause, params };
  }
}