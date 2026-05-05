/**
 * Integration Tests for Mobile Payment Flows and Validation
 * Tests mobile wallet payments, UPI, touch-optimized flows, and payment method detection
 */

import { MobilePaymentService } from '../services/MobilePaymentService';
import { RazorpayGateway } from '../gateways/RazorpayGateway';
import { StripeGateway } from '../gateways/StripeGateway';
import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';
import winston from 'winston';
import {
  MobilePaymentRequest,
  DeviceInfo,
  MobileWalletType,
  MobilePaymentMethodType
} from '../types';

describe('Mobile Payment Integration Tests', () => {
  let mobilePaymentService: MobilePaymentService;
  let razorpayGateway: RazorpayGateway;
  let stripeGateway: StripeGateway;
  let dbPool: Pool;
  let redisClient: RedisClientType;
  let logger: winston.Logger;

  beforeAll(async () => {
    // Initialize logger
    logger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })]
    });

    // Connect to Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();

    // Connect to PostgreSQL
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Initialize payment gateways
    razorpayGateway = new RazorpayGateway(
      process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
      process.env.RAZORPAY_KEY_SECRET || 'test_secret',
      logger
    );

    stripeGateway = new StripeGateway(
      process.env.STRIPE_SECRET_KEY || 'sk_test_key',
      logger
    );

    // Initialize mobile payment service
    mobilePaymentService = new MobilePaymentService(
      razorpayGateway,
      stripeGateway,
      redisClient,
      dbPool,
      logger
    );
  });

  afterAll(async () => {
    await redisClient?.quit();
    await dbPool?.end();
  });

  beforeEach(async () => {
    // Clean up test data
    await redisClient.flushDb();
  });

  describe('Mobile Payment Method Detection', () => {
    it('should detect Apple Pay on iOS devices', async () => {
      const deviceInfo: DeviceInfo = {
        platform: 'ios',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        screenWidth: 390,
        screenHeight: 844,
        deviceType: 'mobile'
      };

      const methods = await mobilePaymentService.detectAvailablePaymentMethods(deviceInfo);

      expect(methods).toBeDefined();
      expect(methods.availableWallets).toContain('apple_pay');
      expect(methods.capabilities.biometric).toBe(true);
      expect(methods.capabilities.nfc).toBe(true);
      expect(methods.recommendedMethods).toContain('apple_pay');
    });

    it('should detect Google Pay on Android devices', async () => {
      const deviceInfo: DeviceInfo = {
        platform: 'android',
        userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        screenWidth: 412,
        screenHeight: 915,
        deviceType: 'mobile'
      };

      const methods = await mobilePaymentService.detectAvailablePaymentMethods(deviceInfo);

      expect(methods).toBeDefined();
      expect(methods.availableWallets).toContain('google_pay');
      expect(methods.capabilities.qrScanning).toBe(true);
      expect(methods.recommendedMethods).toContain('google_pay');
    });

    it('should detect UPI apps on Android devices', async () => {
      const deviceInfo: DeviceInfo = {
        platform: 'android',
        userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        screenWidth: 412,
        screenHeight: 915,
        deviceType: 'mobile'
      };

      const methods = await mobilePaymentService.detectAvailablePaymentMethods(deviceInfo);

      expect(methods).toBeDefined();
      expect(methods.availableWallets).toContain('paytm');
      expect(methods.availableWallets).toContain('phonepe');
      expect(methods.capabilities.deepLinks).toBe(true);
    });

    it('should detect common wallets on both platforms', async () => {
      const iosDevice: DeviceInfo = {
        platform: 'ios',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        screenWidth: 390,
        screenHeight: 844,
        deviceType: 'mobile'
      };

      const androidDevice: DeviceInfo = {
        platform: 'android',
        userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        screenWidth: 412,
        screenHeight: 915,
        deviceType: 'mobile'
      };

      const iosMethods = await mobilePaymentService.detectAvailablePaymentMethods(iosDevice);
      const androidMethods = await mobilePaymentService.detectAvailablePaymentMethods(androidDevice);

      // Both should support card payments
      expect(iosMethods.recommendedMethods).toContain('card_mobile');
      expect(androidMethods.recommendedMethods).toContain('card_mobile');
    });

    it('should detect device capabilities correctly', async () => {
      const deviceInfo: DeviceInfo = {
        platform: 'android',
        userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        screenWidth: 412,
        screenHeight: 915,
        deviceType: 'mobile'
      };

      const methods = await mobilePaymentService.detectAvailablePaymentMethods(deviceInfo);

      expect(methods.capabilities).toBeDefined();
      expect(methods.capabilities.biometric).toBeDefined();
      expect(methods.capabilities.nfc).toBeDefined();
      expect(methods.capabilities.qrScanning).toBeDefined();
      expect(methods.capabilities.deepLinks).toBeDefined();
    });
  });

  describe('Mobile Payment Validation', () => {
    it('should validate valid mobile payment request', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject payment without device info', async () => {
      const paymentRequest: any = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Device information is required');
    });

    it('should reject invalid amount', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: -100,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Amount'))).toBe(true);
    });

    it('should validate UPI ID format', async () => {
      const validUpiIds = [
        'user@paytm',
        'test.user@phonepe',
        'john_doe@ybl',
        'user123@okaxis'
      ];

      for (const upiId of validUpiIds) {
        const paymentRequest: MobilePaymentRequest = {
          userId: 'test-user-123',
          amount: 1000,
          currency: 'INR',
          programId: 'program-123',
          paymentMethodType: 'upi',
          deviceInfo: {
            platform: 'android',
            userAgent: 'Mozilla/5.0 (Linux; Android 13)',
            screenWidth: 412,
            screenHeight: 915,
            deviceType: 'mobile'
          },
          upiId
        };

        const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should reject invalid UPI ID format', async () => {
      const invalidUpiIds = [
        'invalid-upi',
        'user@',
        '@paytm',
        'user@@paytm',
        'user paytm'
      ];

      for (const upiId of invalidUpiIds) {
        const paymentRequest: MobilePaymentRequest = {
          userId: 'test-user-123',
          amount: 1000,
          currency: 'INR',
          programId: 'program-123',
          paymentMethodType: 'upi',
          deviceInfo: {
            platform: 'android',
            userAgent: 'Mozilla/5.0 (Linux; Android 13)',
            screenWidth: 412,
            screenHeight: 915,
            deviceType: 'mobile'
          },
          upiId
        };

        const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);
        expect(validation.isValid).toBe(false);
      }
    });

    it('should warn about UPI on iOS', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'ios',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
          screenWidth: 390,
          screenHeight: 844,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('UPI') && w.includes('iOS'))).toBe(true);
    });

    it('should validate wallet token for wallet payments', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'mobile_wallet',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        walletType: 'paytm',
        walletToken: 'wallet_token_123'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('Mobile Payment Session Management', () => {
    it('should create mobile payment session', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const session = await mobilePaymentService.createMobilePaymentSession(paymentRequest);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.expiresAt).toBeDefined();
      expect(session.gateway).toBeDefined();
      expect(session.paymentUrl).toBeDefined();
    });

    it('should generate UPI deep link for UPI payments', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const session = await mobilePaymentService.createMobilePaymentSession(paymentRequest);

      expect(session.upiDeepLink).toBeDefined();
      expect(session.upiDeepLink).toMatch(/^upi:\/\//);
    });

    it('should generate QR code for UPI payments', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const session = await mobilePaymentService.createMobilePaymentSession(paymentRequest);

      expect(session.qrCode).toBeDefined();
      expect(session.qrCode).toMatch(/^data:image/);
    });

    it('should set session expiry to 15 minutes', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const session = await mobilePaymentService.createMobilePaymentSession(paymentRequest);

      const expiryTime = new Date(session.expiresAt).getTime();
      const currentTime = Date.now();
      const diffMinutes = (expiryTime - currentTime) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(14);
      expect(diffMinutes).toBeLessThanOrEqual(15);
    });

    it('should retrieve existing session by ID', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const createdSession = await mobilePaymentService.createMobilePaymentSession(paymentRequest);
      const retrievedSession = await mobilePaymentService.getMobilePaymentSession(createdSession.sessionId);

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.sessionId).toBe(createdSession.sessionId);
      expect(retrievedSession.amount).toBe(createdSession.amount);
    });
  });

  describe('Touch-Optimized Payment Flow', () => {
    it('should generate 4-step payment flow', async () => {
      const sessionId = 'test-session-123';
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const flow = await mobilePaymentService.getTouchOptimizedFlow(sessionId, paymentRequest);

      expect(flow).toBeDefined();
      expect(flow.steps).toHaveLength(4);
      expect(flow.currentStep).toBe(1);
      expect(flow.totalSteps).toBe(4);
    });

    it('should have correct step names', async () => {
      const sessionId = 'test-session-123';
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const flow = await mobilePaymentService.getTouchOptimizedFlow(sessionId, paymentRequest);

      expect(flow.steps[0].name).toBe('method_selection');
      expect(flow.steps[1].name).toBe('details_entry');
      expect(flow.steps[2].name).toBe('confirmation');
      expect(flow.steps[3].name).toBe('processing');
    });

    it('should support back button navigation', async () => {
      const sessionId = 'test-session-123';
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const flow = await mobilePaymentService.getTouchOptimizedFlow(sessionId, paymentRequest);

      // First step should not have back button
      expect(flow.steps[0].canGoBack).toBe(false);

      // Middle steps should have back button
      expect(flow.steps[1].canGoBack).toBe(true);
      expect(flow.steps[2].canGoBack).toBe(true);

      // Last step should not have back button
      expect(flow.steps[3].canGoBack).toBe(false);
    });

    it('should include step-specific data', async () => {
      const sessionId = 'test-session-123';
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const flow = await mobilePaymentService.getTouchOptimizedFlow(sessionId, paymentRequest);

      flow.steps.forEach(step => {
        expect(step.data).toBeDefined();
        expect(step.actions).toBeDefined();
        expect(Array.isArray(step.actions)).toBe(true);
      });
    });
  });

  describe('Gateway Selection Logic', () => {
    it('should select Razorpay for INR currency', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'upi',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        upiId: 'test@paytm'
      };

      const gateway = mobilePaymentService.selectGateway(paymentRequest);

      expect(gateway).toBe('razorpay');
    });

    it('should select Stripe for iOS with international currency', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'USD',
        programId: 'program-123',
        paymentMethodType: 'mobile_wallet',
        deviceInfo: {
          platform: 'ios',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
          screenWidth: 390,
          screenHeight: 844,
          deviceType: 'mobile'
        },
        walletType: 'apple_pay'
      };

      const gateway = mobilePaymentService.selectGateway(paymentRequest);

      expect(gateway).toBe('stripe');
    });

    it('should select Stripe for Android with international currency', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'EUR',
        programId: 'program-123',
        paymentMethodType: 'mobile_wallet',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        walletType: 'google_pay'
      };

      const gateway = mobilePaymentService.selectGateway(paymentRequest);

      expect(gateway).toBe('stripe');
    });
  });

  describe('Mobile Wallet Integration', () => {
    it('should support Google Pay payments', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'USD',
        programId: 'program-123',
        paymentMethodType: 'mobile_wallet',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        walletType: 'google_pay',
        walletToken: 'google_pay_token_123'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.isValid).toBe(true);
      expect(validation.supportedMethods).toContain('mobile_wallet');
    });

    it('should support Apple Pay payments', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'USD',
        programId: 'program-123',
        paymentMethodType: 'mobile_wallet',
        deviceInfo: {
          platform: 'ios',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
          screenWidth: 390,
          screenHeight: 844,
          deviceType: 'mobile'
        },
        walletType: 'apple_pay',
        walletToken: 'apple_pay_token_123'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.isValid).toBe(true);
      expect(validation.supportedMethods).toContain('mobile_wallet');
    });

    it('should support Paytm wallet', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'mobile_wallet',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        walletType: 'paytm',
        walletToken: 'paytm_token_123'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.isValid).toBe(true);
    });

    it('should support PhonePe wallet', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'mobile_wallet',
        deviceInfo: {
          platform: 'android',
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
          screenWidth: 412,
          screenHeight: 915,
          deviceType: 'mobile'
        },
        walletType: 'phonepe',
        walletToken: 'phonepe_token_123'
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle expired session gracefully', async () => {
      const expiredSessionId = 'expired-session-123';

      await expect(
        mobilePaymentService.getMobilePaymentSession(expiredSessionId)
      ).rejects.toThrow();
    });

    it('should handle invalid session ID', async () => {
      const invalidSessionId = 'invalid-session-123';

      await expect(
        mobilePaymentService.getMobilePaymentSession(invalidSessionId)
      ).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      const incompleteRequest: any = {
        userId: 'test-user-123',
        amount: 1000
        // Missing currency, programId, paymentMethodType, deviceInfo
      };

      const validation = await mobilePaymentService.validatePaymentRequest(incompleteRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle unsupported payment method for platform', async () => {
      const paymentRequest: MobilePaymentRequest = {
        userId: 'test-user-123',
        amount: 1000,
        currency: 'INR',
        programId: 'program-123',
        paymentMethodType: 'mobile_wallet',
        deviceInfo: {
          platform: 'ios',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
          screenWidth: 390,
          screenHeight: 844,
          deviceType: 'mobile'
        },
        walletType: 'paytm' // Paytm not typically available on iOS
      };

      const validation = await mobilePaymentService.validatePaymentRequest(paymentRequest);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });
});
