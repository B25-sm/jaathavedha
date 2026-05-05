/**
 * Stripe Payment Gateway Integration
 * Handles Stripe API interactions for international payments
 */

import Stripe from 'stripe';
import { logger, AppError } from '@sai-mahendra/utils';
import {
  GatewayOrderResponse,
  GatewayPaymentResponse,
  CreateOrderRequest,
  VerifyPaymentRequest,
  WebhookEvent,
  RefundRequest,
} from '../types';

export class StripeGateway {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(config: { secret_key: string; webhook_secret: string }) {
    this.stripe = new Stripe(config.secret_key, {
      apiVersion: '2023-10-16',
    });
    this.webhookSecret = config.webhook_secret;
  }

  async createOrder(request: CreateOrderRequest): Promise<GatewayOrderResponse> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100), // Convert to cents
        currency: request.currency || 'usd',
        metadata: {
          user_id: request.user_id,
          program_id: request.program_id,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Stripe payment intent created successfully', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        userId: request.user_id,
      });

      return {
        gateway_order_id: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert back to dollars
        currency: paymentIntent.currency,
        gateway_data: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          created: paymentIntent.created,
        },
      };
    } catch (error) {
      logger.error('Failed to create Stripe payment intent', { error, request });
      throw new AppError('Failed to create payment order', 500);
    }
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<GatewayPaymentResponse> {
    try {
      // Fetch payment intent from Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(request.gateway_payment_id);

      logger.info('Stripe payment verified successfully', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
      });

      return {
        success: paymentIntent.status === 'succeeded',
        payment_id: request.payment_id,
        gateway_payment_id: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert to dollars
        currency: paymentIntent.currency,
        status: this.mapStripeStatus(paymentIntent.status),
        failure_reason: paymentIntent.status !== 'succeeded' ? 
          paymentIntent.last_payment_error?.message : undefined,
      };
    } catch (error) {
      logger.error('Failed to verify Stripe payment', { error, request });
      
      return {
        success: false,
        payment_id: request.payment_id,
        gateway_payment_id: request.gateway_payment_id,
        amount: 0,
        currency: 'usd',
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
      const refundOptions: Stripe.RefundCreateParams = {
        payment_intent: gatewayPaymentId,
        metadata: {
          reason: request.reason,
          refund_request_id: request.payment_id,
        },
      };

      if (request.amount) {
        refundOptions.amount = Math.round(request.amount * 100); // Convert to cents
      }

      const refund = await this.stripe.refunds.create(refundOptions);

      logger.info('Stripe refund processed successfully', {
        refundId: refund.id,
        paymentIntentId: gatewayPaymentId,
        amount: refund.amount,
      });

      return {
        success: true,
        refund_id: refund.id,
        amount: refund.amount ? refund.amount / 100 : undefined, // Convert to dollars
        status: refund.status,
      };
    } catch (error) {
      logger.error('Failed to process Stripe refund', { error, request, gatewayPaymentId });
      
      return {
        success: false,
        failure_reason: 'Refund processing failed',
      };
    }
  }

  async createSubscription(customerId: string, priceId: string, options: any): Promise<any> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata: options.metadata || {},
        trial_period_days: options.trial_days,
      });

      logger.info('Stripe subscription created successfully', {
        subscriptionId: subscription.id,
        customerId,
        priceId,
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create Stripe subscription', { error, customerId, priceId });
      throw new AppError('Failed to create subscription', 500);
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      
      logger.info('Stripe subscription cancelled successfully', {
        subscriptionId: subscription.id,
        status: subscription.status,
      });

      return subscription.status === 'canceled';
    } catch (error) {
      logger.error('Failed to cancel Stripe subscription', { error, subscriptionId });
      return false;
    }
  }

  async createCustomer(email: string, name: string, metadata: any = {}): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata,
      });

      logger.info('Stripe customer created successfully', {
        customerId: customer.id,
        email,
      });

      return customer.id;
    } catch (error) {
      logger.error('Failed to create Stripe customer', { error, email });
      throw new AppError('Failed to create customer', 500);
    }
  }

  async createPrice(productId: string, amount: number, currency: string, interval: string): Promise<string> {
    try {
      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        recurring: interval !== 'one_time' ? { interval: interval as any } : undefined,
      });

      logger.info('Stripe price created successfully', {
        priceId: price.id,
        amount,
        currency,
        interval,
      });

      return price.id;
    } catch (error) {
      logger.error('Failed to create Stripe price', { error, productId, amount });
      throw new AppError('Failed to create price', 500);
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return true;
    } catch (error) {
      logger.error('Failed to verify Stripe webhook signature', { error });
      return false;
    }
  }

  processWebhookEvent(payload: string, signature: string): WebhookEvent {
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    
    return {
      gateway: 'stripe',
      event_type: event.type,
      data: event.data,
      timestamp: new Date(event.created * 1000),
    };
  }

  private mapStripeStatus(status: string): 'pending' | 'completed' | 'failed' | 'refunded' {
    switch (status) {
      case 'succeeded':
        return 'completed';
      case 'processing':
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'pending';
      case 'canceled':
      case 'requires_capture':
        return 'failed';
      default:
        return 'failed';
    }
  }

  /**
   * Create payment intent with mobile wallet support
   */
  async createMobileWalletPayment(options: {
    amount: number;
    currency: string;
    wallet_type: 'apple_pay' | 'google_pay';
    customer_id?: string;
    description: string;
  }): Promise<any> {
    try {
      const paymentIntentOptions: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(options.amount * 100),
        currency: options.currency.toLowerCase(),
        description: options.description,
        payment_method_types: [options.wallet_type === 'apple_pay' ? 'card' : 'card'],
        metadata: {
          wallet_type: options.wallet_type,
        },
      };

      if (options.customer_id) {
        paymentIntentOptions.customer = options.customer_id;
      }

      // Enable specific wallet
      if (options.wallet_type === 'apple_pay') {
        paymentIntentOptions.payment_method_options = {
          card: {
            request_three_d_secure: 'automatic',
          },
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentOptions);

      logger.info('Stripe mobile wallet payment created', {
        paymentIntentId: paymentIntent.id,
        walletType: options.wallet_type,
        amount: paymentIntent.amount,
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create Stripe mobile wallet payment', { error, options });
      throw new AppError('Failed to create wallet payment', 500);
    }
  }

  /**
   * Create Apple Pay session
   */
  async createApplePaySession(options: {
    amount: number;
    currency: string;
    domain: string;
  }): Promise<any> {
    try {
      // Apple Pay requires domain verification
      // This would typically be done through Stripe's Apple Pay domain registration
      logger.info('Creating Apple Pay session', options);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(options.amount * 100),
        currency: options.currency.toLowerCase(),
        payment_method_types: ['card'],
        metadata: {
          payment_type: 'apple_pay',
        },
      });

      return {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      };
    } catch (error) {
      logger.error('Failed to create Apple Pay session', { error, options });
      throw new AppError('Failed to create Apple Pay session', 500);
    }
  }

  /**
   * Create Google Pay payment
   */
  async createGooglePayPayment(options: {
    amount: number;
    currency: string;
    customer_id?: string;
  }): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(options.amount * 100),
        currency: options.currency.toLowerCase(),
        payment_method_types: ['card'],
        customer: options.customer_id,
        metadata: {
          payment_type: 'google_pay',
        },
      });

      logger.info('Google Pay payment created', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
      });

      return {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      };
    } catch (error) {
      logger.error('Failed to create Google Pay payment', { error, options });
      throw new AppError('Failed to create Google Pay payment', 500);
    }
  }

  /**
   * Verify Apple Pay domain
   */
  async verifyApplePayDomain(domain: string): Promise<boolean> {
    try {
      await this.stripe.applePayDomains.create({ domain_name: domain });
      logger.info('Apple Pay domain verified', { domain });
      return true;
    } catch (error) {
      logger.error('Failed to verify Apple Pay domain', { error, domain });
      return false;
    }
  }

  /**
   * Get mobile payment methods configuration
   */
  getMobilePaymentMethodsConfig(): any {
    return {
      apple_pay: {
        supported: true,
        requires_domain_verification: true,
        supported_networks: ['visa', 'mastercard', 'amex', 'discover'],
      },
      google_pay: {
        supported: true,
        requires_merchant_id: true,
        supported_networks: ['visa', 'mastercard', 'amex', 'discover'],
      },
    };
  }

  // Utility methods
  async getPaymentMethods(): Promise<string[]> {
    return [
      'card',
      'paypal',
      'apple_pay',
      'google_pay',
      'link',
      'klarna',
      'afterpay_clearpay',
    ];
  }

  async getMobilePaymentMethods(): Promise<string[]> {
    return [
      'apple_pay',
      'google_pay',
      'card',
      'link',
    ];
  }

  getSupportedCurrencies(): string[] {
    return [
      'usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'sek', 'nok', 'dkk',
      'pln', 'czk', 'huf', 'bgn', 'hrk', 'ron', 'isk', 'try', 'ils', 'mxn',
      'brl', 'myr', 'sgd', 'nzd', 'hkd', 'krw', 'thb', 'php', 'idr', 'vnd',
    ];
  }

  getMinimumAmount(currency: string = 'usd'): number {
    const minimums: Record<string, number> = {
      usd: 0.50,
      eur: 0.50,
      gbp: 0.30,
      cad: 0.50,
      aud: 0.50,
      jpy: 50,
      // Add more as needed
    };
    return minimums[currency.toLowerCase()] || 0.50;
  }

  getMaximumAmount(currency: string = 'usd'): number {
    // Stripe's default maximum is $999,999.99 for most currencies
    return currency.toLowerCase() === 'jpy' ? 99999999 : 999999.99;
  }

  formatAmount(amount: number, currency: string = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // In a real implementation, you would fetch this from a currency API
    // For now, return a placeholder
    logger.warn('Exchange rate calculation not implemented', { fromCurrency, toCurrency });
    return 1;
  }
}