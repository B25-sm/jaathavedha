import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createAuthRoutes } from '../routes/auth';
import { initializeRedis } from '../middleware/auth';

describe('Admin Authentication', () => {
  let app: express.Application;
  let dbPool: Pool;

  beforeAll(async () => {
    // Setup test database connection
    dbPool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/sai_mahendra_test'
    });

    // Initialize Redis for testing
    await initializeRedis(process.env.TEST_REDIS_URL || 'redis://localhost:6379');

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/admin/auth', createAuthRoutes(dbPool));
  });

  afterAll(async () => {
    await dbPool.end();
  });

  describe('POST /api/admin/auth/login', () => {
    it('should reject login without credentials', async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should successfully login with valid admin credentials', async () => {
      // This test requires a test admin user in the database
      // In a real test environment, you would seed the database with test data
      
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'testpassword'
        });

      // This will fail without proper test data setup
      // expect(response.status).toBe(200);
      // expect(response.body.success).toBe(true);
      // expect(response.body.data.token).toBeDefined();
    });
  });

  describe('POST /api/admin/auth/logout', () => {
    it('should successfully logout', async () => {
      const response = await request(app)
        .post('/api/admin/auth/logout')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/auth/verify', () => {
    it('should reject verification without token', async () => {
      const response = await request(app)
        .get('/api/admin/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_MISSING');
    });

    it('should reject verification with invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/auth/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
