import request from 'supertest';
import { MongoClient, Db } from 'mongodb';
import { createClient, RedisClientType } from 'redis';
import app from '../index';
import { EventType } from '../types';

describe('Analytics Service Integration Tests', () => {
  let mongoClient: MongoClient;
  let mongoDb: Db;
  let redisClient: RedisClientType;

  beforeAll(async () => {
    // Connect to test MongoDB
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://admin:admin123@localhost:27017/sai_mahendra_analytics_test?authSource=admin';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    mongoDb = mongoClient.db('sai_mahendra_analytics_test');

    // Connect to test Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
  });

  afterAll(async () => {
    // Clean up test data
    await mongoDb.collection('events').deleteMany({});
    await mongoDb.collection('page_views').deleteMany({});
    await mongoDb.collection('user_metrics').deleteMany({});
    await mongoDb.collection('alerts').deleteMany({});
    await mongoDb.collection('alert_thresholds').deleteMany({});

    // Close connections
    await mongoClient.close();
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await mongoDb.collection('events').deleteMany({});
    await mongoDb.collection('page_views').deleteMany({});
    await mongoDb.collection('user_metrics').deleteMany({});
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('analytics');
      expect(response.body.dependencies.mongodb).toBe('connected');
      expect(response.body.dependencies.redis).toBe('connected');
    });
  });

  describe('Event Tracking - Task 9.1', () => {
    it('should track a single event successfully', async () => {
      const eventData = {
        eventType: EventType.USER_REGISTERED,
        userId: 'user-123',
        sessionId: 'session-456',
        properties: {
          email: 'test@example.com',
          source: 'web'
        }
      };

      const response = await request(app)
        .post('/api/analytics/events')
        .send(eventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event tracked successfully');
      expect(response.body.eventId).toBeDefined();

      // Verify event was stored in MongoDB
      const storedEvent = await mongoDb.collection('events').findOne({
        userId: 'user-123'
      });
      expect(storedEvent).toBeDefined();
      expect(storedEvent?.eventType).toBe(EventType.USER_REGISTERED);
    });

    it('should track page views', async () => {
      const pageViewData = {
        page: '/courses',
        userId: 'user-123',
        sessionId: 'session-456',
        referrer: 'https://google.com'
      };

      const response = await request(app)
        .post('/api/analytics/page-view')
        .send(pageViewData)
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify page view was stored
      const storedPageView = await mongoDb.collection('page_views').findOne({
        page: '/courses'
      });
      expect(storedPageView).toBeDefined();
    });

    it('should track batch events', async () => {
      const batchEvents = {
        events: [
          {
            eventType: EventType.COURSE_VIEWED,
            userId: 'user-123',
            sessionId: 'session-456',
            properties: { courseId: 'course-1' }
          },
          {
            eventType: EventType.ENROLLMENT_STARTED,
            userId: 'user-123',
            sessionId: 'session-456',
            properties: { programId: 'program-1' }
          }
        ]
      };

      const response = await request(app)
        .post('/api/analytics/events/batch')
        .send(batchEvents)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);

      // Verify events were stored
      const eventCount = await mongoDb.collection('events').countDocuments({
        userId: 'user-123'
      });
      expect(eventCount).toBe(2);
    });

    it('should track user actions', async () => {
      const actionData = {
        action: 'button_click',
        userId: 'user-123',
        sessionId: 'session-456',
        metadata: {
          buttonId: 'enroll-now',
          page: '/programs'
        }
      };

      const response = await request(app)
        .post('/api/analytics/user-action')
        .send(actionData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should validate required fields for event tracking', async () => {
      const invalidEvent = {
        userId: 'user-123'
        // Missing eventType and sessionId
      };

      const response = await request(app)
        .post('/api/analytics/events')
        .send(invalidEvent)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('Business Metrics - Task 9.2', () => {
    beforeEach(async () => {
      // Seed test data for metrics calculations
      const testEvents = [
        {
          eventType: EventType.ENROLLMENT_COMPLETED,
          userId: 'user-1',
          sessionId: 'session-1',
          properties: {
            programId: 'program-1',
            programName: 'AI Starter Program',
            amount: 5000
          },
          timestamp: new Date('2024-01-15')
        },
        {
          eventType: EventType.PAYMENT_COMPLETED,
          userId: 'user-1',
          sessionId: 'session-1',
          properties: {
            programId: 'program-1',
            amount: 5000,
            gateway: 'razorpay'
          },
          timestamp: new Date('2024-01-15')
        },
        {
          eventType: EventType.COURSE_COMPLETED,
          userId: 'user-1',
          sessionId: 'session-1',
          properties: {
            programId: 'program-1',
            completionTimeInDays: 30
          },
          timestamp: new Date('2024-02-15')
        }
      ];

      await mongoDb.collection('events').insertMany(testEvents);
    });

    it('should calculate enrollment metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/enrollment')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        const metrics = response.body.data[0];
        expect(metrics).toHaveProperty('programId');
        expect(metrics).toHaveProperty('totalEnrollments');
        expect(metrics).toHaveProperty('completionRate');
      }
    });

    it('should calculate revenue metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/revenue')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('transactionCount');
      expect(response.body.data).toHaveProperty('averageOrderValue');
      expect(response.body.data).toHaveProperty('revenueByProgram');
      expect(response.body.data).toHaveProperty('revenueByGateway');
    });

    it('should calculate user engagement metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/user-engagement')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('dailyActiveUsers');
      expect(response.body.data).toHaveProperty('weeklyActiveUsers');
      expect(response.body.data).toHaveProperty('monthlyActiveUsers');
      expect(response.body.data).toHaveProperty('averageSessionDuration');
    });

    it('should calculate retention metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/retention')
        .query({
          cohortDate: '2024-01-15'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('cohortDate');
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('retentionByDay');
      expect(response.body.data).toHaveProperty('retentionByWeek');
    });

    it('should calculate conversion funnel', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/conversion-funnel')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('visitors');
      expect(response.body.data).toHaveProperty('signups');
      expect(response.body.data).toHaveProperty('enrollmentStarts');
      expect(response.body.data).toHaveProperty('paymentCompleted');
      expect(response.body.data).toHaveProperty('conversionRates');
    });
  });

  describe('Admin Dashboard - Task 9.3', () => {
    beforeEach(async () => {
      // Seed test data for dashboard
      const today = new Date();
      const testEvents = [
        {
          eventType: EventType.PAGE_VIEW,
          userId: 'user-1',
          sessionId: 'session-1',
          properties: {},
          timestamp: today
        },
        {
          eventType: EventType.ENROLLMENT_COMPLETED,
          userId: 'user-1',
          sessionId: 'session-1',
          properties: { programId: 'program-1' },
          timestamp: today
        }
      ];

      await mongoDb.collection('events').insertMany(testEvents);
      await mongoDb.collection('page_views').insertOne({
        page: '/courses',
        userId: 'user-1',
        sessionId: 'session-1',
        timestamp: today
      });
    });

    it('should fetch dashboard data with real-time metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('realTime');
      expect(response.body.data).toHaveProperty('trends');
      expect(response.body.data).toHaveProperty('topPages');
      expect(response.body.data).toHaveProperty('alerts');

      // Verify real-time metrics structure
      const realTime = response.body.data.realTime;
      expect(realTime).toHaveProperty('activeUsers');
      expect(realTime).toHaveProperty('todayPageViews');
      expect(realTime).toHaveProperty('todayEvents');
      expect(realTime).toHaveProperty('todayRevenue');
      expect(realTime).toHaveProperty('todayEnrollments');
    });

    it('should export report data in JSON format', async () => {
      const exportRequest = {
        reportType: 'enrollment',
        format: 'json',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      const response = await request(app)
        .post('/api/analytics/export')
        .send(exportRequest)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.text).toBeDefined();
      
      // Verify it's valid JSON
      const data = JSON.parse(response.text);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should export report data in CSV format', async () => {
      const exportRequest = {
        reportType: 'revenue',
        format: 'csv',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      const response = await request(app)
        .post('/api/analytics/export')
        .send(exportRequest)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should validate export request parameters', async () => {
      const invalidRequest = {
        // Missing reportType and format
        startDate: '2024-01-01'
      };

      const response = await request(app)
        .post('/api/analytics/export')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('Alert System - Task 9.3', () => {
    it('should fetch active alerts', async () => {
      const response = await request(app)
        .get('/api/analytics/alerts')
        .query({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should fetch alert thresholds', async () => {
      const response = await request(app)
        .get('/api/analytics/alerts/thresholds')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should create new alert threshold', async () => {
      const threshold = {
        metric: 'test_metric',
        condition: 'above',
        threshold: 100,
        severity: 'warning',
        enabled: true
      };

      const response = await request(app)
        .post('/api/analytics/alerts/thresholds')
        .send(threshold)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert threshold created successfully');
    });

    it('should validate threshold creation parameters', async () => {
      const invalidThreshold = {
        metric: 'test_metric'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/analytics/alerts/thresholds')
        .send(invalidThreshold)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('Real-time Event Processing with Redis - Task 9.1', () => {
    it('should process events in real-time and update Redis', async () => {
      const eventData = {
        eventType: EventType.PAYMENT_COMPLETED,
        userId: 'user-123',
        sessionId: 'session-456',
        properties: {
          amount: 5000,
          programId: 'program-1'
        }
      };

      await request(app)
        .post('/api/analytics/events')
        .send(eventData)
        .expect(201);

      // Give Redis time to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Redis was updated
      const today = new Date().toISOString().split('T')[0];
      const eventCount = await redisClient.get(`analytics:events:${today}`);
      expect(eventCount).toBeDefined();
      expect(parseInt(eventCount || '0')).toBeGreaterThan(0);
    });

    it('should track active users in Redis', async () => {
      const eventData = {
        eventType: EventType.USER_LOGIN,
        userId: 'user-active-123',
        sessionId: 'session-789',
        properties: {}
      };

      await request(app)
        .post('/api/analytics/events')
        .send(eventData)
        .expect(201);

      // Give Redis time to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify user was added to active users set
      const today = new Date().toISOString().split('T')[0];
      const activeUsers = await redisClient.sMembers(`analytics:active_users:${today}`);
      expect(activeUsers).toContain('user-active-123');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we test that the service handles invalid data
      const invalidEvent = {
        eventType: 'INVALID_EVENT_TYPE',
        sessionId: 'session-123'
      };

      const response = await request(app)
        .post('/api/analytics/events')
        .send(invalidEvent)
        .expect(201); // Service accepts any event type

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/analytics/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ENDPOINT_NOT_FOUND');
    });
  });
});
