/**
 * Razorpay Payment Gateway Integration
 * Handles Razorpay API interactions for Indian payments
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logger, AppError } from '@sai-mahendra/utils';
import {
  GatewayOrderResponse,
  GatewayPaymentResponse,
  CreateOrderRequest,
  VerifyPaymentRequest,
  WebhookEvent,
  RefundRequest,
} from '../types';

export class RazorpayGateway {
  private razorpay: Razorpay;
  private webhookSecret: string;

  constructor(config: { key_id: string; key_secret: string; webhook_secret: string }) {
    this.razorpay = new Razorpay({
      key_id: config.key_id,
      key_secret: config.key_secret,
    });
    this.webhookSecret = config.webhook_secret;
  }

  async createOrder(request: CreateOrderRequest): Promise<GatewayOrderResponse> {
    try {
      const options = {
        amount: Math.round(request.amount * 100), // Convert to paise
        currency: request.currency || 'INR',
        receipt: `order_${request.user_id}_${Date.now()}`,
        notes: {
          user_id: request.user_id,
          program_id: request.program_id,
        },
      };

      const order = await this.razorpay.orders.create(options);

      logger.info('Razorpay order created successfully', {
        orderId: order.id,
        amount: order.amount,
        userId: request.user_id,
      });

      return {
        gateway_order_id: order.id,
        amount: order.amount / 100, // Convert back to rupees
        currency: order.currency,
        gateway_data: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          receipt: order.receipt,
          status: order.status,
          created_at: order.created_at,
        },
      };
    } catch (error) {
      logger.error('Failed to create Razorpay order', { error, request });
      throw new AppError('Failed to create payment order', 500);
    }
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<GatewayPaymentResponse> {
    try {
      // Verify signature
      if (request.signature && request.gateway_order_id) {
        const isValid = this.verifySignature(
          request.gateway_order_id,
          request.gateway_payment_id,
          request.signature
        );

        if (!isValid) {
          logger.warn('Invalid Razorpay payment signature', {
            paymentId: request.gateway_payment_id,
            orderId: request.gateway_order_id,
          });
          
          return {
            success: false,
            payment_id: request.payment_id,
            gateway_payment_id: request.gateway_payment_id,
            amount: 0,
            currency: 'INR',
            status: 'failed',
            failure_reason: 'Invalid payment signature',
          };
        }
      }

      // Fetch payment details from Razorpay
      const payment = await this.razorpay.payments.fetch(request.gateway_payment_id);

      logger.info('Razorpay payment verified successfully', {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
      });

      return {
        success: payment.status === 'captured',
        payment_id: request.payment_id,
        gateway_payment_id: payment.id,
        amount: payment.amount / 100, // Convert to rupees
        currency: payment.currency,
        status: this.mapRazorpayStatus(payment.status),
        failure_reason: payment.status !== 'captured' ? payment.error_description : undefined,
      };
    } catch (error) {
      logger.error('Failed to verify Razorpay payment', { error, request });
      
      return {
        success: false,
        payment_id: request.payment_id,
        gateway_payment_id: request.gateway_payment_id,
        amount: 0,
        currency: 'INR',
        status: 'failed',
        failure_reason: 'Payment verification failed',
      };
    }
  }

  async processRefund(request: RefundRequest, gatewayPaymentId: string): Promise<{
    success: boolean;
    refund_id?: string;
    amount?: number;
    status?: string;
    failure_reason?: string;
  }> {
    try {
      const refundOptions: any = {
        payment_id: gatewayPaymentId,
        notes: {
          reason: request.reason,
          refund_request_id: request.payment_id,
        },
      };

      if (request.amount) {
        refundOptions.amount = Math.round(request.amount * 100); // Convert to paise
      }

      const refund = await this.razorpay.payments.refund(gatewayPaymentId, refundOptions);

      logger.info('Razorpay refund processed successfully', {
        refundId: refund.id,
        paymentId: gatewayPaymentId,
        amount: refund.amount,
      });

      return {
        success: true,
        refund_id: refund.id,
        amount: refund.amount / 100, // Convert to rupees
        status: refund.status,
      };
    } catch (error) {
      logger.error('Failed to process Razorpay refund', { error, request, gatewayPaymentId });
      
      return {
        success: false,
        failure_reason: 'Refund processing failed',
      };
    }
  }

  async createSubscription(planId: string, customerId: string, options: any): Promise<any> {
    try {
      const subscriptionOptions = {
        plan_id: planId,
        customer_id: customerId,
        total_count: options.total_count || 12, // Default to 12 months
        quantity: 1,
        notes: options.notes || {},
      };

      const subscription = await this.razorpay.subscriptions.create(subscriptionOptions);

      logger.info('Razorpay subscription created successfully', {
        subscriptionId: subscription.id,
        planId,
        customerId,
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create Razorpay subscription', { error, planId, customerId });
      throw new AppError('Failed to create subscription', 500);
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const subscription = await this.razorpay.subscriptions.cancel(subscriptionId);
      
      logger.info('Razorpay subscription cancelled successfully', {
        subscriptionId: subscription.id,
        status: subscription.status,
      });

      return subscription.status === 'cancelled';
    } catch (error) {
      logger.error('Failed to cancel Razorpay subscription', { error, subscriptionId });
      return false;
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Failed to verify Razorpay webhook signature', { error });
      return false;
    }
  }

  processWebhookEvent(payload: any): WebhookEvent {
    return {
      gateway: 'razorpay',
      event_type: payload.event,
      data: payload.payload,
      timestamp: new Date(payload.created_at * 1000),
    };
  }

  private verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    try {
      const body = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.razorpay.key_secret)
        .update(body)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Failed to verify Razorpay signature', { error });
      return false;
    }
  }

  private mapRazorpayStatus(status: string): 'pending' | 'completed' | 'failed' | 'refunded' {
    switch (status) {
      case 'captured':
        return 'completed';
      case 'authorized':
      case 'created':
        return 'pending';
      case 'refunded':
        return 'refunded';
      case 'failed':
      default:
        return 'failed';
    }
  }

  /**
   * Create UPI payment intent for mobile
   */
  async createUpiPayment(options: {
    amount: number;
    currency: string;
    upi_id?: string;
    description: string;
    customer_id: string;
  }): Promise<any> {
    try {
      const paymentOptions = {
        amount: Math.round(options.amount * 100),
        currency: options.currency || 'INR',
        method: 'upi',
        customer_id: options.customer_id,
        description: options.description,
        notes: {
          upi_id: options.upi_id,
        },
      };

      const payment = await this.razorpay.payments.create(paymentOptions as any);

      logger.info('Razorpay UPI payment created', {
        paymentId: payment.id,
        amount: payment.amount,
      });

      return payment;
    } catch (error) {
      logger.error('Failed to create Razorpay UPI payment', { error, options });
      throw new AppError('Failed to create UPI payment', 500);
    }
  }

  /**
   * Create mobile wallet payment
   */
  async createWalletPayment(options: {
    amount: number;
    currency: string;
    wallet: string;
    customer_id: string;
    description: string;
  }): Promise<any> {
    try {
      const paymentOptions = {
        amount: Math.round(options.amount * 100),
        currency: options.currency || 'INR',
        method: 'wallet',
        wallet: options.wallet,
        customer_id: options.customer_id,
        description: options.description,
      };

      const payment = await this.razorpay.payments.create(paymentOptions as any);

      logger.info('Razorpay wallet payment created', {
        paymentId: payment.id,
        wallet: options.wallet,
        amount: payment.amount,
      });

      return payment;
    } catch (error) {
      logger.error('Failed to create Razorpay wallet payment', { error, options });
      throw new AppError('Failed to create wallet payment', 500);
    }
  }

  /**
   * Get supported mobile wallets
   */
  getSupportedMobileWallets(): string[] {
    return [
      'paytm',
      'phonepe',
      'amazonpay',
      'mobikwik',
      'freecharge',
      'jiomoney',
      'airtel',
      'olamoney',
    ];
  }

  /**
   * Validate UPI VPA (Virtual Payment Address)
   */
  async validateUpiVpa(vpa: string): Promise<boolean> {
    try {
      // Razorpay doesn't have a direct VPA validation API
      // This is a basic format validation
      const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
      return upiRegex.test(vpa);
    } catch (error) {
      logger.error('Failed to validate UPI VPA', { error, vpa });
      return false;
    }
  }

  /**
   * Create QR code for UPI payment
   */
  async createUpiQrCode(options: {
    amount: number;
    description: string;
    customer_id: string;
  }): Promise<{ qr_code_url: string; payment_id: string }> {
    try {
      const qrCodeOptions = {
        type: 'upi_qr',
        name: 'Sai Mahendra Platform',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: Math.round(options.amount * 100),
        description: options.description,
        customer_id: options.customer_id,
      };

      const qrCode = await this.razorpay.qrCode.create(qrCodeOptions as any);

      logger.info('Razorpay UPI QR code created', {
        qrCodeId: qrCode.id,
        amount: options.amount,
      });

      return {
        qr_code_url: qrCode.image_url,
        payment_id: qrCode.id,
      };
    } catch (error) {
      logger.error('Failed to create UPI QR code', { error, options });
      throw new AppError('Failed to create QR code', 500);
    }
  }

  // Utility methods
  async getPaymentMethods(): Promise<string[]> {
    return [
      'card',
      'netbanking',
      'upi',
      'wallet',
      'emi',
      'paylater',
    ];
  }

  async getMobilePaymentMethods(): Promise<string[]> {
    return [
      'upi',
      'wallet',
      'card',
      'netbanking',
    ];
  }

  getSupportedCurrencies(): string[] {
    return ['INR'];
  }

  getMinimumAmount(currency: string = 'INR'): number {
    return currency === 'INR' ? 1 : 0.5; // Minimum 1 INR
  }

  getMaximumAmount(currency: string = 'INR'): number {
    return currency === 'INR' ? 1000000 : 50000; // Maximum 10 lakh INR
  }

  formatAmount(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }
}