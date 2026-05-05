/**
 * Mobile Payment Service
 * Handles mobile-specific payment flows, wallet integration, and touch-optimized experiences
 */

import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import { RazorpayGateway } from '../gateways/RazorpayGateway';
import { StripeGateway } from '../gateways/StripeGateway';
import {
  MobilePaymentRequest,
  MobilePaymentValidation,
  MobilePaymentSession,
  TouchOptimizedPaymentFlow,
  MobilePaymentMethodDetection,
  DeviceInfo,
  MobilePaymentMethodType,
  MobileWalletType,
  Payment,
  PaymentGatewayConfig,
} from '../types';
import crypto from 'crypto';

export class MobilePaymentService {
  private db = getDatabase();
  private cache = getCache();
  private razorpayGateway: RazorpayGateway;
  private stripeGateway: StripeGateway;

  constructor(config: PaymentGatewayConfig) {
    this.razorpayGateway = new RazorpayGateway(config.razorpay);
    this.stripeGateway = new StripeGateway(config.stripe);
  }

  /**
   * Detect available mobile payment methods based on device info
   */
  async detectMobilePaymentMethods(deviceInfo: DeviceInfo): Promise<MobilePaymentMethodDetection> {
    try {
      const detection: MobilePaymentMethodDetection = {
        available_wallets: [],
        upi_apps_installed: [],
        device_capabilities: {
          supports_biometric: false,
          supports_nfc: false,
          supports_qr_scan: true, // Most mobile devices support QR scanning
          supports_deep_links: true,
        },
      };

      // Detect platform-specific wallets
      if (deviceInfo.platform === 'ios') {
        detection.available_wallets.push('apple_pay');
        detection.device_capabilities.supports_biometric = true;
        detection.device_capabilities.supports_nfc = true;
      } else if (deviceInfo.platform === 'android') {
        detection.available_wallets.push('google_pay');
        detection.device_capabilities.supports_biometric = true;
        
        // Android devices commonly have these UPI apps
        detection.upi_apps_installed = [
          'phonepe',
          'paytm',
          'googlepay',
          'bhim',
        ];
      }

      // Common wallets available on both platforms
      detection.available_wallets.push('paytm', 'phonepe', 'amazon_pay');

      // Determine preferred method based on platform and region
      if (deviceInfo.platform === 'ios') {
        detection.preferred_method = 'mobile_wallet';
      } else if (deviceInfo.platform === 'android') {
        detection.preferred_method = 'upi'; // UPI is popular on Android in India
      } else {
        detection.preferred_method = 'card_mobile';
      }

      logger.info('Mobile payment methods detected', {
        platform: deviceInfo.platform,
        walletsCount: detection.available_wallets.length,
        preferredMethod: detection.preferred_method,
      });

      return detection;
    } catch (error) {
      logger.error('Failed to detect mobile payment methods', { error, deviceInfo });
      throw new AppError('Failed to detect payment methods', 500);
    }
  }

  /**
   * Validate mobile payment request
   */
  async validateMobilePayment(request: MobilePaymentRequest): Promise<MobilePaymentValidation> {
    const validation: MobilePaymentValidation = {
      is_valid: true,
      errors: [],
      warnings: [],
      supported_methods: [],
    };

    try {
      // Validate device info
      if (!request.device_info || !request.device_info.platform) {
        validation.is_valid = false;
        validation.errors?.push('Device information is required for mobile payments');
      }

      // Validate payment method type
      if (!request.payment_method_type) {
        validation.is_valid = false;
        validation.errors?.push('Payment method type is required');
      }

      // Validate amount
      if (!request.amount || request.amount <= 0) {
        validation.is_valid = false;
        validation.errors?.push('Invalid payment amount');
      }

      // Validate UPI-specific requirements
      if (request.payment_method_type === 'upi') {
        if (!request.upi_id && !request.wallet_token) {
          validation.is_valid = false;
          validation.errors?.push('UPI ID or wallet token is required for UPI payments');
        }

        // Validate UPI ID format
        if (request.upi_id && !this.isValidUpiId(request.upi_id)) {
          validation.is_valid = false;
          validation.errors?.push('Invalid UPI ID format');
        }
      }

      // Validate wallet-specific requirements
      if (request.payment_method_type === 'mobile_wallet') {
        if (!request.wallet_token) {
          validation.is_valid = false;
          validation.errors?.push('Wallet token is required for wallet payments');
        }
      }

      // Get supported methods for the device
      const detection = await this.detectMobilePaymentMethods(request.device_info);
      validation.supported_methods = this.getSupportedMethodsForDevice(detection);
      validation.recommended_method = detection.preferred_method;

      // Check if requested method is supported
      if (!validation.supported_methods.includes(request.payment_method_type)) {
        validation.warnings?.push(
          `Payment method ${request.payment_method_type} may not be optimal for this device`
        );
      }

      // Platform-specific validations
      if (request.device_info.platform === 'ios' && request.payment_method_type === 'upi') {
        validation.warnings?.push('UPI payments may have limited support on iOS devices');
      }

      logger.info('Mobile payment validation completed', {
        isValid: validation.is_valid,
        errorsCount: validation.errors?.length || 0,
        warningsCount: validation.warnings?.length || 0,
      });

      return validation;
    } catch (error) {
      logger.error('Failed to validate mobile payment', { error, request });
      validation.is_valid = false;
      validation.errors?.push('Payment validation failed');
      return validation;
    }
  }

  /**
   * Create mobile payment session with touch-optimized flow
   */
  async createMobilePaymentSession(request: MobilePaymentRequest): Promise<MobilePaymentSession> {
    try {
      // Validate the payment request
      const validation = await this.validateMobilePayment(request);
      if (!validation.is_valid) {
        throw new AppError(
          `Payment validation failed: ${validation.errors?.join(', ')}`,
          400
        );
      }

      // Get program details
      const program = await this.db.queryOne<{ id: string; price: number; currency: string }>(
        'SELECT id, price, currency FROM programs WHERE id = $1',
        [request.program_id]
      );

      if (!program) {
        throw new AppError('Program not found', 404);
      }

      // Select appropriate gateway
      const gateway = this.selectGatewayForMobile(
        request.device_info,
        request.currency || program.currency
      );

      // Create payment record
      const payment = await this.db.insert<Payment>('payments', {
        user_id: request.user_id,
        program_id: request.program_id,
        amount: request.amount,
        currency: request.currency || program.currency,
        gateway,
        status: 'pending',
        payment_method: request.payment_method_type,
        metadata: {
          device_info: request.device_info,
          payment_method_type: request.payment_method_type,
          wallet_type: request.metadata?.wallet_type,
          is_mobile: true,
        },
      });

      // Generate session ID
      const sessionId = this.generateSessionId();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Create mobile-optimized payment order
      let paymentUrl: string | undefined;
      let deepLink: string | undefined;
      let qrCode: string | undefined;

      if (gateway === 'razorpay') {
        const orderResponse = await this.razorpayGateway.createOrder({
          user_id: request.user_id,
          program_id: request.program_id,
          amount: request.amount,
          currency: request.currency || program.currency,
        });

        // Update payment with order ID
        await this.db.update(
          'payments',
          { gateway_order_id: orderResponse.gateway_order_id },
          { id: payment.id }
        );

        // Generate mobile-specific URLs
        if (request.payment_method_type === 'upi') {
          // Generate UPI deep link
          deepLink = this.generateUpiDeepLink(
            request.amount,
            orderResponse.gateway_order_id,
            request.upi_id
          );
          qrCode = await this.generateQrCode(deepLink);
        } else {
          // Generate payment URL for mobile web
          paymentUrl = this.generateMobilePaymentUrl(
            orderResponse.gateway_order_id,
            request.device_info
          );
        }
      } else {
        // Stripe for international payments
        const orderResponse = await this.stripeGateway.createOrder({
          user_id: request.user_id,
          program_id: request.program_id,
          amount: request.amount,
          currency: request.currency || program.currency,
        });

        await this.db.update(
          'payments',
          { gateway_order_id: orderResponse.gateway_order_id },
          { id: payment.id }
        );

        paymentUrl = this.generateMobilePaymentUrl(
          orderResponse.gateway_order_id,
          request.device_info
        );
      }

      // Create session object
      const session: MobilePaymentSession = {
        session_id: sessionId,
        payment_id: payment.id,
        expires_at: expiresAt,
        payment_url: paymentUrl,
        deep_link: deepLink,
        qr_code: qrCode,
        status: 'initiated',
      };

      // Cache session for quick retrieval
      await this.cache.set(`mobile_payment_session:${sessionId}`, session, {
        ttl: 900, // 15 minutes
      });

      logger.info('Mobile payment session created', {
        sessionId,
        paymentId: payment.id,
        gateway,
        paymentMethodType: request.payment_method_type,
      });

      return session;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create mobile payment session', { error, request });
      throw new AppError('Failed to create payment session', 500);
    }
  }

  /**
   * Get touch-optimized payment flow steps
   */
  async getTouchOptimizedFlow(
    sessionId: string,
    currentStep: number = 1
  ): Promise<TouchOptimizedPaymentFlow> {
    try {
      const session = await this.cache.get<MobilePaymentSession>(
        `mobile_payment_session:${sessionId}`
      );

      if (!session) {
        throw new AppError('Payment session not found or expired', 404);
      }

      const payment = await this.db.queryOne<Payment>(
        'SELECT * FROM payments WHERE id = $1',
        [session.payment_id]
      );

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      const totalSteps = 4; // method_selection, details_entry, confirmation, processing
      const steps: TouchOptimizedPaymentFlow['current_step'][] = [
        'method_selection',
        'details_entry',
        'confirmation',
        'processing',
      ];

      const flow: TouchOptimizedPaymentFlow = {
        step: currentStep,
        total_steps: totalSteps,
        current_step: steps[currentStep - 1] || 'method_selection',
        data: {
          payment_id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          payment_method: payment.payment_method,
          session_id: sessionId,
        },
        can_go_back: currentStep > 1 && currentStep < totalSteps,
      };

      // Add step-specific data and actions
      switch (flow.current_step) {
        case 'method_selection':
          flow.data.available_methods = await this.getAvailableMethodsForPayment(payment);
          flow.next_action = 'select_payment_method';
          break;

        case 'details_entry':
          flow.data.payment_url = session.payment_url;
          flow.data.deep_link = session.deep_link;
          flow.data.qr_code = session.qr_code;
          flow.next_action = 'enter_payment_details';
          break;

        case 'confirmation':
          flow.data.summary = {
            amount: payment.amount,
            currency: payment.currency,
            method: payment.payment_method,
          };
          flow.next_action = 'confirm_payment';
          break;

        case 'processing':
          flow.data.status = payment.status;
          flow.next_action = payment.status === 'completed' ? 'view_receipt' : 'check_status';
          flow.can_go_back = false;
          break;
      }

      return flow;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get touch-optimized flow', { error, sessionId });
      throw new AppError('Failed to retrieve payment flow', 500);
    }
  }

  /**
   * Process mobile wallet payment
   */
  async processMobileWalletPayment(
    sessionId: string,
    walletType: MobileWalletType,
    walletToken: string
  ): Promise<{ success: boolean; payment_id: string; status: string }> {
    try {
      const session = await this.cache.get<MobilePaymentSession>(
        `mobile_payment_session:${sessionId}`
      );

      if (!session) {
        throw new AppError('Payment session not found or expired', 404);
      }

      const payment = await this.db.queryOne<Payment>(
        'SELECT * FROM payments WHERE id = $1',
        [session.payment_id]
      );

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      // Update payment with wallet information
      await this.db.update(
        'payments',
        {
          metadata: {
            ...payment.metadata,
            wallet_type: walletType,
            wallet_token: walletToken,
          },
        },
        { id: payment.id }
      );

      // Process payment through appropriate gateway
      // In a real implementation, this would integrate with wallet-specific APIs
      logger.info('Mobile wallet payment processed', {
        paymentId: payment.id,
        walletType,
        sessionId,
      });

      return {
        success: true,
        payment_id: payment.id,
        status: 'processing',
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to process mobile wallet payment', { error, sessionId });
      throw new AppError('Failed to process wallet payment', 500);
    }
  }

  /**
   * Process UPI payment
   */
  async processUpiPayment(
    sessionId: string,
    upiId: string
  ): Promise<{ success: boolean; payment_id: string; deep_link: string }> {
    try {
      const session = await this.cache.get<MobilePaymentSession>(
        `mobile_payment_session:${sessionId}`
      );

      if (!session) {
        throw new AppError('Payment session not found or expired', 404);
      }

      if (!this.isValidUpiId(upiId)) {
        throw new AppError('Invalid UPI ID format', 400);
      }

      const payment = await this.db.queryOne<Payment>(
        'SELECT * FROM payments WHERE id = $1',
        [session.payment_id]
      );

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      // Update payment with UPI information
      await this.db.update(
        'payments',
        {
          metadata: {
            ...payment.metadata,
            upi_id: upiId,
          },
        },
        { id: payment.id }
      );

      // Generate UPI deep link
      const deepLink = this.generateUpiDeepLink(
        payment.amount,
        payment.gateway_order_id || payment.id,
        upiId
      );

      logger.info('UPI payment initiated', {
        paymentId: payment.id,
        upiId,
        sessionId,
      });

      return {
        success: true,
        payment_id: payment.id,
        deep_link: deepLink,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to process UPI payment', { error, sessionId });
      throw new AppError('Failed to process UPI payment', 500);
    }
  }

  // Private helper methods

  private selectGatewayForMobile(
    deviceInfo: DeviceInfo,
    currency: string
  ): 'razorpay' | 'stripe' {
    // For Indian market and INR currency, prefer Razorpay
    if (currency === 'INR') {
      return 'razorpay';
    }

    // For iOS with Apple Pay, use Stripe
    if (deviceInfo.platform === 'ios') {
      return 'stripe';
    }

    // For Android with Google Pay in international markets, use Stripe
    if (deviceInfo.platform === 'android' && currency !== 'INR') {
      return 'stripe';
    }

    // Default to Stripe for international payments
    return 'stripe';
  }

  private getSupportedMethodsForDevice(
    detection: MobilePaymentMethodDetection
  ): MobilePaymentMethodType[] {
    const methods: MobilePaymentMethodType[] = ['card_mobile'];

    if (detection.available_wallets.length > 0) {
      methods.push('mobile_wallet');
    }

    if (detection.upi_apps_installed.length > 0) {
      methods.push('upi');
    }

    methods.push('netbanking_mobile');

    return methods;
  }

  private isValidUpiId(upiId: string): boolean {
    // UPI ID format: username@bankname
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    return upiRegex.test(upiId);
  }

  private generateSessionId(): string {
    return `mob_${crypto.randomBytes(16).toString('hex')}`;
  }

  private generateUpiDeepLink(amount: number, orderId: string, upiId?: string): string {
    // UPI deep link format
    const merchantId = 'saimahendra';
    const merchantName = 'Sai Mahendra Platform';
    
    const params = new URLSearchParams({
      pa: upiId || 'merchant@upi', // Payee address
      pn: merchantName,
      mc: '8299', // Merchant category code for education
      tid: orderId,
      tr: orderId, // Transaction reference
      tn: `Payment for order ${orderId}`,
      am: amount.toFixed(2),
      cu: 'INR',
    });

    return `upi://pay?${params.toString()}`;
  }

  private generateMobilePaymentUrl(orderId: string, deviceInfo: DeviceInfo): string {
    // Generate mobile-optimized payment URL
    const baseUrl = process.env.PAYMENT_BASE_URL || 'https://pay.saimahendra.com';
    const params = new URLSearchParams({
      order_id: orderId,
      platform: deviceInfo.platform,
      mobile: 'true',
    });

    return `${baseUrl}/checkout?${params.toString()}`;
  }

  private async generateQrCode(data: string): Promise<string> {
    // In a real implementation, this would generate an actual QR code image
    // For now, return a base64 placeholder
    return `data:image/png;base64,${Buffer.from(data).toString('base64')}`;
  }

  private async getAvailableMethodsForPayment(payment: Payment): Promise<any[]> {
    const methods = [];

    if (payment.currency === 'INR') {
      methods.push(
        { type: 'upi', name: 'UPI', icon: 'upi-icon' },
        { type: 'mobile_wallet', name: 'Mobile Wallets', icon: 'wallet-icon' },
        { type: 'card_mobile', name: 'Credit/Debit Card', icon: 'card-icon' },
        { type: 'netbanking_mobile', name: 'Net Banking', icon: 'bank-icon' }
      );
    } else {
      methods.push(
        { type: 'card_mobile', name: 'Credit/Debit Card', icon: 'card-icon' },
        { type: 'mobile_wallet', name: 'Digital Wallets', icon: 'wallet-icon' }
      );
    }

    return methods;
  }
}
