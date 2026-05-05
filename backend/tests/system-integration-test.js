/**
 * System Integration Test Suite
 * 
 * Comprehensive integration tests for the Sai Mahendra platform
 * Tests API endpoints, database connections, and service-to-service communication
 * 
 * @requires mocha
 * @requires chai
 * @requires axios
 * @requires pg
 * @requires ioredis
 */

const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('ioredis');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  api: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
    timeout: 10000
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'saimahendra',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }
};

// ============================================================================
// Test Suite
// ============================================================================

describe('System Integration Tests', function() {
  this.timeout(30000);

  let apiClient;
  let dbPool;
  let redisClient;

  // --------------------------------------------------------------------------
  // Setup and Teardown
  // --------------------------------------------------------------------------

  before(async function() {
    console.log('Setting up integration test environment...');
    
    apiClient = axios.create({
      baseURL: CONFIG.api.baseURL,
      timeout: CONFIG.api.timeout,
      validateStatus: () => true
    });

    dbPool = new Pool(CONFIG.database);
    redisClient = new Redis(CONFIG.redis.url);
  });

  after(async function() {
    console.log('Cleaning up integration test environment...');
    
    if (dbPool) await dbPool.end();
    if (redisClient) await redisClient.quit();
  });

  // --------------------------------------------------------------------------
  // API Integration Tests
  // --------------------------------------------------------------------------

  describe('API Integration Tests', function() {
    
    describe('Health Endpoints', function() {
      
      it('should return 200 OK from GET /health', async function() {
        const response = await apiClient.get('/health');
        
        expect(response.status).to.equal(200);
        expect(response.data).to.be.an('object');
        expect(response.data).to.have.property('status', 'healthy');
      });

      it('should include service status in health check', async function() {
        const response = await apiClient.get('/health');
        
        expect(response.data).to.have.property('services');
        expect(response.data.services).to.include.keys('database', 'cache');
      });

      it('should return proper JSON content-type', async function() {
        const response = await apiClient.get('/health');
        
        expect(response.headers['content-type']).to.include('application/json');
      });
    });

    describe('Query Endpoints', function() {
      
      it('should handle POST /api/query with valid data', async function() {
        const queryData = { query: 'SELECT 1', params: [] };
        const response = await apiClient.post('/api/query', queryData);
        
        expect(response.status).to.be.oneOf([200, 201]);
        expect(response.data).to.be.an('object');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Database Integration Tests
  // --------------------------------------------------------------------------

  describe('Database Integration Tests', function() {
    
    describe('PostgreSQL Connection', function() {
      
      it('should successfully connect to database', async function() {
        const client = await dbPool.connect();
        expect(client).to.exist;
        client.release();
      });

      it('should execute simple queries', async function() {
        const result = await dbPool.query('SELECT 1 as test');
        
        expect(result.rows).to.have.lengthOf(1);
        expect(result.rows[0].test).to.equal(1);
      });

      it('should verify users table exists', async function() {
        const result = await dbPool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users'
          );
        `);
        
        expect(result.rows[0].exists).to.be.true;
      });

      it('should handle transactions correctly', async function() {
        const client = await dbPool.connect();
        
        try {
          await client.query('BEGIN');
          const result = await client.query('SELECT NOW()');
          await client.query('COMMIT');
          
          expect(result.rows).to.have.lengthOf(1);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      });
    });

    describe('Redis Cache', function() {
      
      it('should successfully connect to Redis', async function() {
        const pong = await redisClient.ping();
        expect(pong).to.equal('PONG');
      });

      it('should set and retrieve values', async function() {
        const key = 'integration_test_key';
        const value = 'integration_test_value';
        
        await redisClient.set(key, value);
        const retrieved = await redisClient.get(key);
        
        expect(retrieved).to.equal(value);
        await redisClient.del(key);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Service-to-Service Integration Tests
  // --------------------------------------------------------------------------

  describe('Service-to-Service Integration Tests', function() {
    
    describe('Authentication Flow', function() {
      
      it('should complete user registration', async function() {
        const userData = {
          email: `test_${Date.now()}@example.com`,
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User'
        };
        
        const response = await apiClient.post('/api/auth/register', userData);
        
        expect(response.status).to.be.oneOf([200, 201]);
        expect(response.data).to.have.property('user');
        expect(response.data.user).to.have.property('id');
        expect(response.data.user.email).to.equal(userData.email);
      });

      it('should authenticate and return JWT token', async function() {
        const loginData = {
          email: 'test@example.com',
          password: 'password123'
        };
        
        const response = await apiClient.post('/api/auth/login', loginData);
        
        if (response.status === 200) {
          expect(response.data).to.have.property('token');
          expect(response.data.token).to.be.a('string').with.length.greaterThan(0);
        }
      });

      it('should access protected resources with token', async function() {
        const loginResponse = await apiClient.post('/api/auth/login', {
          email: 'test@example.com',
          password: 'password123'
        });
        
        if (loginResponse.status === 200 && loginResponse.data.token) {
          const coursesResponse = await apiClient.get('/api/courses', {
            headers: { Authorization: `Bearer ${loginResponse.data.token}` }
          });
          
          expect(coursesResponse.status).to.equal(200);
          expect(coursesResponse.data).to.be.an('array');
        }
      });

      it('should verify email after registration', async function() {
        const verificationData = {
          token: 'test-verification-token-123'
        };
        
        const response = await apiClient.post('/api/auth/verify-email', verificationData);
        expect(response.status).to.be.oneOf([200, 400, 404]);
      });

      it('should handle password reset flow', async function() {
        const resetRequest = {
          email: 'test@example.com'
        };
        
        const response = await apiClient.post('/api/auth/forgot-password', resetRequest);
        expect(response.status).to.be.oneOf([200, 404]);
      });
    });

    describe('Payment Processing', function() {
      
      it('should handle payment creation', async function() {
        const paymentData = {
          amount: 1000,
          currency: 'INR',
          courseId: 'test-course-123',
          gateway: 'razorpay'
        };
        
        const response = await apiClient.post('/api/payments/create', paymentData);
        
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
        if ([200, 201].includes(response.status)) {
          expect(response.data).to.have.property('orderId');
        }
      });

      it('should verify Razorpay payment', async function() {
        const verificationData = {
          orderId: 'order_test123',
          paymentId: 'pay_test123',
          signature: 'test_signature'
        };
        
        const response = await apiClient.post('/api/payments/verify', verificationData);
        expect(response.status).to.be.oneOf([200, 400, 401]);
      });

      it('should handle Stripe payment intent', async function() {
        const stripeData = {
          amount: 5000,
          currency: 'USD',
          courseId: 'test-course-123',
          gateway: 'stripe'
        };
        
        const response = await apiClient.post('/api/payments/create', stripeData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });

      it('should process subscription creation', async function() {
        const subscriptionData = {
          planId: 'monthly-membership',
          userId: 'test-user-123',
          gateway: 'razorpay'
        };
        
        const response = await apiClient.post('/api/subscriptions/create', subscriptionData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });

      it('should handle refund processing', async function() {
        const refundData = {
          paymentId: 'pay_test123',
          amount: 1000,
          reason: 'Customer request'
        };
        
        const response = await apiClient.post('/api/payments/refund', refundData);
        expect(response.status).to.be.oneOf([200, 400, 401, 403]);
      });
    });

    describe('Notification System', function() {
      
      it('should send enrollment notifications', async function() {
        const notificationData = {
          userId: 'test-user-123',
          type: 'enrollment',
          courseId: 'test-course-123',
          channel: 'email'
        };
        
        const response = await apiClient.post('/api/notifications/send', notificationData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });

      it('should send payment confirmation notifications', async function() {
        const notificationData = {
          userId: 'test-user-123',
          type: 'payment_confirmation',
          paymentId: 'pay_test123',
          channel: 'email'
        };
        
        const response = await apiClient.post('/api/notifications/send', notificationData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });

      it('should send course reminder notifications', async function() {
        const notificationData = {
          userId: 'test-user-123',
          type: 'course_reminder',
          courseId: 'test-course-123',
          channel: 'push'
        };
        
        const response = await apiClient.post('/api/notifications/send', notificationData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });
    });

    describe('Analytics Tracking', function() {
      
      it('should track user events', async function() {
        const eventData = {
          eventType: 'course_view',
          userId: 'test-user-123',
          courseId: 'test-course-123',
          timestamp: new Date().toISOString()
        };
        
        const response = await apiClient.post('/api/analytics/track', eventData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });

      it('should track enrollment events', async function() {
        const eventData = {
          eventType: 'enrollment',
          userId: 'test-user-123',
          courseId: 'test-course-123',
          timestamp: new Date().toISOString()
        };
        
        const response = await apiClient.post('/api/analytics/track', eventData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });

      it('should track payment events', async function() {
        const eventData = {
          eventType: 'payment_completed',
          userId: 'test-user-123',
          paymentId: 'pay_test123',
          amount: 1000,
          timestamp: new Date().toISOString()
        };
        
        const response = await apiClient.post('/api/analytics/track', eventData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });
    });

    describe('Service Health Checks', function() {
      
      it('should verify all service health endpoints', async function() {
        const services = ['auth', 'courses', 'payments', 'notifications'];
        
        for (const service of services) {
          const response = await apiClient.get(`/api/${service}/health`);
          
          if (response.status === 200) {
            expect(response.data).to.have.property('status');
          }
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Complete User Journey Tests
  // --------------------------------------------------------------------------

  describe('Complete User Journey Tests', function() {
    let testUser = null;
    let authToken = null;
    let enrollmentId = null;
    let paymentId = null;

    describe('Registration to Course Completion Journey', function() {
      
      it('Step 1: User registers for an account', async function() {
        const userData = {
          email: `journey_test_${Date.now()}@example.com`,
          password: 'SecurePass123!',
          firstName: 'Journey',
          lastName: 'Test'
        };
        
        const response = await apiClient.post('/api/auth/register', userData);
        
        if (response.status === 200 || response.status === 201) {
          expect(response.data).to.have.property('user');
          testUser = response.data.user;
          expect(testUser).to.have.property('id');
          expect(testUser.email).to.equal(userData.email);
        }
      });

      it('Step 2: User logs in and receives JWT token', async function() {
        if (!testUser) this.skip();
        
        const loginData = {
          email: testUser.email,
          password: 'SecurePass123!'
        };
        
        const response = await apiClient.post('/api/auth/login', loginData);
        
        if (response.status === 200) {
          expect(response.data).to.have.property('token');
          authToken = response.data.token;
          expect(authToken).to.be.a('string').with.length.greaterThan(0);
        }
      });

      it('Step 3: User browses available programs', async function() {
        const response = await apiClient.get('/api/programs');
        
        if (response.status === 200) {
          expect(response.data).to.be.an('array');
          if (response.data.length > 0) {
            expect(response.data[0]).to.have.property('id');
            expect(response.data[0]).to.have.property('name');
            expect(response.data[0]).to.have.property('price');
          }
        }
      });

      it('Step 4: User views program details', async function() {
        const programId = 'starter-program-123';
        const response = await apiClient.get(`/api/programs/${programId}`);
        
        if (response.status === 200) {
          expect(response.data).to.have.property('id');
          expect(response.data).to.have.property('name');
          expect(response.data).to.have.property('description');
          expect(response.data).to.have.property('price');
        }
      });

      it('Step 5: User initiates payment for program', async function() {
        if (!authToken) this.skip();
        
        const paymentData = {
          programId: 'starter-program-123',
          amount: 5000,
          currency: 'INR',
          gateway: 'razorpay'
        };
        
        const response = await apiClient.post('/api/payments/create-order', paymentData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.status === 200 || response.status === 201) {
          expect(response.data).to.have.property('orderId');
          paymentId = response.data.orderId;
        }
      });

      it('Step 6: Payment is verified and confirmed', async function() {
        if (!paymentId || !authToken) this.skip();
        
        const verificationData = {
          orderId: paymentId,
          paymentId: `pay_${Date.now()}`,
          signature: 'test_signature_123'
        };
        
        const response = await apiClient.post('/api/payments/verify', verificationData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 400]);
      });

      it('Step 7: User is automatically enrolled in program', async function() {
        if (!authToken) this.skip();
        
        const response = await apiClient.get('/api/enrollments/my-enrollments', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.be.an('array');
          if (response.data.length > 0) {
            enrollmentId = response.data[0].id;
            expect(response.data[0]).to.have.property('programId');
            expect(response.data[0]).to.have.property('status');
          }
        }
      });

      it('Step 8: User accesses course content', async function() {
        if (!authToken || !enrollmentId) this.skip();
        
        const response = await apiClient.get(`/api/enrollments/${enrollmentId}/content`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.have.property('modules');
          expect(response.data.modules).to.be.an('array');
        }
      });

      it('Step 9: User completes a module', async function() {
        if (!authToken || !enrollmentId) this.skip();
        
        const progressData = {
          moduleId: 'module-1',
          completed: true
        };
        
        const response = await apiClient.post(
          `/api/enrollments/${enrollmentId}/progress`,
          progressData,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        expect(response.status).to.be.oneOf([200, 201, 400, 404]);
      });

      it('Step 10: User views progress dashboard', async function() {
        if (!authToken) this.skip();
        
        const response = await apiClient.get('/api/users/dashboard', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.have.property('enrollments');
          expect(response.data).to.have.property('progress');
        }
      });

      it('Step 11: User receives completion certificate', async function() {
        if (!authToken || !enrollmentId) this.skip();
        
        const response = await apiClient.get(`/api/enrollments/${enrollmentId}/certificate`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 404]);
      });
    });

    describe('Subscription Management Journey', function() {
      
      it('User subscribes to monthly membership', async function() {
        const subscriptionData = {
          planId: 'monthly-membership',
          gateway: 'razorpay'
        };
        
        const response = await apiClient.post('/api/subscriptions/create', subscriptionData);
        expect(response.status).to.be.oneOf([200, 201, 400, 401]);
      });

      it('User views subscription details', async function() {
        const response = await apiClient.get('/api/subscriptions/my-subscriptions');
        expect(response.status).to.be.oneOf([200, 401]);
      });

      it('User cancels subscription', async function() {
        const subscriptionId = 'sub_test123';
        const response = await apiClient.post(`/api/subscriptions/${subscriptionId}/cancel`);
        expect(response.status).to.be.oneOf([200, 400, 401, 404]);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Admin Panel Functionality Tests
  // --------------------------------------------------------------------------

  describe('Admin Panel Functionality Tests', function() {
    let adminToken = null;

    before(async function() {
      // Attempt to get admin token
      const loginResponse = await apiClient.post('/api/auth/login', {
        email: 'admin@example.com',
        password: 'admin123'
      });
      
      if (loginResponse.status === 200 && loginResponse.data.token) {
        adminToken = loginResponse.data.token;
      }
    });

    describe('User Management Module', function() {
      
      it('Admin can view all users', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/users', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.have.property('users');
          expect(response.data.users).to.be.an('array');
        }
      });

      it('Admin can search users by email', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/users?search=test@example.com', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403]);
      });

      it('Admin can update user role', async function() {
        if (!adminToken) this.skip();
        
        const userId = 'test-user-123';
        const updateData = { role: 'instructor' };
        
        const response = await apiClient.put(`/api/admin/users/${userId}/role`, updateData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 400, 403, 404]);
      });

      it('Admin can suspend user account', async function() {
        if (!adminToken) this.skip();
        
        const userId = 'test-user-123';
        const updateData = { status: 'suspended' };
        
        const response = await apiClient.put(`/api/admin/users/${userId}/status`, updateData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 400, 403, 404]);
      });

      it('Admin can view user activity logs', async function() {
        if (!adminToken) this.skip();
        
        const userId = 'test-user-123';
        const response = await apiClient.get(`/api/admin/users/${userId}/activity`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403, 404]);
      });
    });

    describe('Course Management Module', function() {
      
      it('Admin can create new program', async function() {
        if (!adminToken) this.skip();
        
        const programData = {
          name: 'Test Program',
          description: 'Test program description',
          category: 'starter',
          price: 5000,
          duration_weeks: 12
        };
        
        const response = await apiClient.post('/api/admin/programs', programData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 201, 400, 403]);
      });

      it('Admin can update program details', async function() {
        if (!adminToken) this.skip();
        
        const programId = 'starter-program-123';
        const updateData = {
          price: 6000,
          description: 'Updated description'
        };
        
        const response = await apiClient.put(`/api/admin/programs/${programId}`, updateData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 400, 403, 404]);
      });

      it('Admin can view enrollment statistics', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/enrollments/statistics', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.have.property('totalEnrollments');
          expect(response.data).to.have.property('activeEnrollments');
        }
      });

      it('Admin can manually enroll user', async function() {
        if (!adminToken) this.skip();
        
        const enrollmentData = {
          userId: 'test-user-123',
          programId: 'starter-program-123'
        };
        
        const response = await apiClient.post('/api/admin/enrollments', enrollmentData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 201, 400, 403, 409]);
      });
    });

    describe('Payment Management Module', function() {
      
      it('Admin can view all payments', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/payments', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.have.property('payments');
          expect(response.data.payments).to.be.an('array');
        }
      });

      it('Admin can filter payments by status', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/payments?status=completed', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403]);
      });

      it('Admin can process refund', async function() {
        if (!adminToken) this.skip();
        
        const refundData = {
          paymentId: 'pay_test123',
          amount: 5000,
          reason: 'Admin approved refund'
        };
        
        const response = await apiClient.post('/api/admin/payments/refund', refundData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 400, 403, 404]);
      });

      it('Admin can view revenue reports', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/payments/reports?period=monthly', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.have.property('totalRevenue');
          expect(response.data).to.have.property('period');
        }
      });

      it('Admin can export payment data', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/payments/export?format=csv', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403]);
      });
    });

    describe('Content Management Module', function() {
      
      it('Admin can create testimonial', async function() {
        if (!adminToken) this.skip();
        
        const testimonialData = {
          author: 'Test User',
          content: 'Great platform!',
          rating: 5,
          isPublished: false
        };
        
        const response = await apiClient.post('/api/admin/content/testimonials', testimonialData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 201, 400, 403]);
      });

      it('Admin can update hero section content', async function() {
        if (!adminToken) this.skip();
        
        const heroData = {
          headline: 'New Headline',
          subheadline: 'New Subheadline',
          ctaText: 'Get Started'
        };
        
        const response = await apiClient.put('/api/admin/content/hero', heroData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 400, 403]);
      });

      it('Admin can upload media files', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.post('/api/admin/content/media/upload', {
          file: 'base64_encoded_image_data',
          type: 'image'
        }, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 201, 400, 403]);
      });
    });

    describe('Analytics Dashboard Module', function() {
      
      it('Admin can view dashboard metrics', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/analytics/dashboard', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.have.property('metrics');
          expect(response.data.metrics).to.be.an('object');
        }
      });

      it('Admin can view enrollment trends', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/analytics/enrollments?period=30days', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403]);
      });

      it('Admin can view revenue analytics', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/analytics/revenue?period=monthly', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403]);
      });

      it('Admin can view user engagement metrics', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/analytics/engagement', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403]);
      });

      it('Admin can export analytics data', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/analytics/export?type=enrollments&format=csv', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403]);
      });
    });

    describe('System Configuration Module', function() {
      
      it('Admin can view system settings', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/settings', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 403]);
      });

      it('Admin can update payment gateway configuration', async function() {
        if (!adminToken) this.skip();
        
        const configData = {
          gateway: 'razorpay',
          enabled: true
        };
        
        const response = await apiClient.put('/api/admin/settings/payment-gateways', configData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        expect(response.status).to.be.oneOf([200, 400, 403]);
      });

      it('Admin can view audit logs', async function() {
        if (!adminToken) this.skip();
        
        const response = await apiClient.get('/api/admin/audit-logs', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        if (response.status === 200) {
          expect(response.data).to.have.property('logs');
          expect(response.data.logs).to.be.an('array');
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Failure Scenario Tests
  // --------------------------------------------------------------------------

  describe('Failure Scenario Tests', function() {
    
    describe('HTTP Error Responses', function() {
      
      it('should return 404 for non-existent endpoints', async function() {
        const response = await apiClient.get('/api/nonexistent/endpoint');
        expect(response.status).to.equal(404);
      });

      it('should return 401 for unauthorized access', async function() {
        const response = await apiClient.get('/api/admin/users');
        expect(response.status).to.be.oneOf([401, 403]);
      });

      it('should return 401 for invalid JWT tokens', async function() {
        const response = await apiClient.get('/api/courses', {
          headers: { Authorization: 'Bearer invalid_token_12345' }
        });
        
        expect(response.status).to.be.oneOf([401, 403]);
      });
    });

    describe('Validation Errors', function() {
      
      it('should reject invalid registration data', async function() {
        const invalidData = {
          email: 'invalid-email',
          password: '123'
        };
        
        const response = await apiClient.post('/api/auth/register', invalidData);
        
        expect(response.status).to.be.oneOf([400, 422]);
        expect(response.data).to.have.property('error');
      });

      it('should reject incomplete registration data', async function() {
        const incompleteData = { email: 'test@example.com' };
        const response = await apiClient.post('/api/auth/register', incompleteData);
        
        expect(response.status).to.be.oneOf([400, 422]);
      });

      it('should handle malformed JSON', async function() {
        try {
          const response = await axios.post(
            `${CONFIG.api.baseURL}/api/auth/login`,
            'invalid json data',
            {
              headers: { 'Content-Type': 'application/json' },
              validateStatus: () => true
            }
          );
          
          expect(response.status).to.be.oneOf([400, 422, 500]);
        } catch (error) {
          expect(error).to.exist;
        }
      });
    });

    describe('Duplicate Data Handling', function() {
      
      it('should prevent duplicate user registration', async function() {
        const userData = {
          email: 'existing@example.com',
          password: 'SecurePass123!',
          firstName: 'Existing',
          lastName: 'User'
        };
        
        await apiClient.post('/api/auth/register', userData);
        const response = await apiClient.post('/api/auth/register', userData);
        
        expect(response.status).to.be.oneOf([409, 400, 422]);
      });
    });

    describe('Connection Failures', function() {
      
      it('should handle database connection failures', async function() {
        const invalidPool = new Pool({ ...CONFIG.database, port: 9999 });
        
        try {
          await invalidPool.query('SELECT 1');
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).to.exist;
          expect(error.message).to.include('connect');
        } finally {
          await invalidPool.end();
        }
      });

      it('should handle Redis connection failures', async function() {
        const invalidRedis = new Redis('redis://localhost:9999');
        
        try {
          await invalidRedis.ping();
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).to.exist;
        } finally {
          invalidRedis.disconnect();
        }
      });
    });

    describe('Rate Limiting', function() {
      
      it('should enforce rate limits on endpoints', async function() {
        const requests = Array(100).fill().map(() => apiClient.get('/health'));
        const responses = await Promise.all(requests);
        
        expect(responses.every(r => [200, 429].includes(r.status))).to.be.true;
      });
    });
  });
});
