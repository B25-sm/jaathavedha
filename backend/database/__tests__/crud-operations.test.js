/**
 * CRUD Operations Integration Tests
 * Tests Create, Read, Update, Delete operations with real database connections
 * 
 * Validates: Requirements 15.2, 15.8
 */

const { testDbManager } = require('./setup');

describe('CRUD Operations - PostgreSQL', () => {
  let pgClient;

  beforeAll(async () => {
    await testDbManager.connect();
    pgClient = testDbManager.getPostgresClient();
    
    // Run migrations to set up schema
    const MigrationRunner = require('../migrate');
    const migrationRunner = new MigrationRunner();
    migrationRunner.client = pgClient;
    await migrationRunner.createMigrationsTable();
    await migrationRunner.runMigrations();
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    await testDbManager.cleanup();
  });

  describe('User CRUD Operations', () => {
    test('should create a new user', async () => {
      const result = await pgClient.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, first_name, last_name, role, created_at
      `, ['john@example.com', 'hashed_password', 'John', 'Doe', 'student']);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].email).toBe('john@example.com');
      expect(result.rows[0].first_name).toBe('John');
      expect(result.rows[0].role).toBe('student');
      expect(result.rows[0].id).toBeDefined();
    });

    test('should read user by id', async () => {
      // Create user
      const insertResult = await pgClient.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['read@example.com', 'hash', 'Read', 'User']);

      const userId = insertResult.rows[0].id;

      // Read user
      const selectResult = await pgClient.query(`
        SELECT id, email, first_name, last_name FROM users WHERE id = $1
      `, [userId]);

      expect(selectResult.rows.length).toBe(1);
      expect(selectResult.rows[0].email).toBe('read@example.com');
      expect(selectResult.rows[0].first_name).toBe('Read');
    });

    test('should update user information', async () => {
      // Create user
      const insertResult = await pgClient.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['update@example.com', 'hash', 'Original', 'Name']);

      const userId = insertResult.rows[0].id;

      // Update user
      await pgClient.query(`
        UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3
      `, ['Updated', 'Name', userId]);

      // Verify update
      const selectResult = await pgClient.query(`
        SELECT first_name, last_name FROM users WHERE id = $1
      `, [userId]);

      expect(selectResult.rows[0].first_name).toBe('Updated');
      expect(selectResult.rows[0].last_name).toBe('Name');
    });

    test('should delete user', async () => {
      // Create user
      const insertResult = await pgClient.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['delete@example.com', 'hash', 'Delete', 'User']);

      const userId = insertResult.rows[0].id;

      // Delete user
      await pgClient.query(`DELETE FROM users WHERE id = $1`, [userId]);

      // Verify deletion
      const selectResult = await pgClient.query(`
        SELECT * FROM users WHERE id = $1
      `, [userId]);

      expect(selectResult.rows.length).toBe(0);
    });

    test('should list users with pagination', async () => {
      // Create multiple users
      for (let i = 1; i <= 5; i++) {
        await pgClient.query(`
          INSERT INTO users (email, password_hash, first_name, last_name)
          VALUES ($1, $2, $3, $4)
        `, [`user${i}@example.com`, 'hash', `User${i}`, 'Test']);
      }

      // Query with pagination
      const result = await pgClient.query(`
        SELECT id, email FROM users 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `, [3, 0]);

      expect(result.rows.length).toBe(3);
    });
  });

  describe('Program CRUD Operations', () => {
    test('should create a program with JSONB features', async () => {
      const features = {
        live_sessions: 8,
        projects: 4,
        mentorship: true,
      };

      const result = await pgClient.query(`
        INSERT INTO programs (name, description, category, price, duration_weeks, features)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, features
      `, ['Test Program', 'Description', 'starter', 9999.00, 8, JSON.stringify(features)]);

      expect(result.rows[0].name).toBe('Test Program');
      expect(result.rows[0].features).toEqual(features);
    });

    test('should query programs by category', async () => {
      // Create programs in different categories
      await pgClient.query(`
        INSERT INTO programs (name, category, price, duration_weeks)
        VALUES 
          ('Starter 1', 'starter', 9999, 8),
          ('Starter 2', 'starter', 9999, 8),
          ('Membership 1', 'membership', 19999, 16)
      `);

      const result = await pgClient.query(`
        SELECT name, category FROM programs WHERE category = $1
      `, ['starter']);

      expect(result.rows.length).toBe(2);
      expect(result.rows.every(row => row.category === 'starter')).toBe(true);
    });

    test('should update program pricing', async () => {
      const insertResult = await pgClient.query(`
        INSERT INTO programs (name, category, price, duration_weeks)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['Price Test', 'starter', 9999.00, 8]);

      const programId = insertResult.rows[0].id;

      // Update price
      await pgClient.query(`
        UPDATE programs SET price = $1 WHERE id = $2
      `, [12999.00, programId]);

      const selectResult = await pgClient.query(`
        SELECT price FROM programs WHERE id = $1
      `, [programId]);

      expect(parseFloat(selectResult.rows[0].price)).toBe(12999.00);
    });
  });

  describe('Enrollment CRUD Operations', () => {
    test('should create enrollment with user and program', async () => {
      const { userId, programId } = await testDbManager.seedPostgresData();

      const result = await pgClient.query(`
        INSERT INTO enrollments (user_id, program_id, status, progress_percentage)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, program_id, status, progress_percentage
      `, [userId, programId, 'active', 0]);

      expect(result.rows[0].user_id).toBe(userId);
      expect(result.rows[0].program_id).toBe(programId);
      expect(result.rows[0].status).toBe('active');
      expect(result.rows[0].progress_percentage).toBe(0);
    });

    test('should update enrollment progress', async () => {
      const { userId, programId } = await testDbManager.seedPostgresData();

      const insertResult = await pgClient.query(`
        INSERT INTO enrollments (user_id, program_id)
        VALUES ($1, $2)
        RETURNING id
      `, [userId, programId]);

      const enrollmentId = insertResult.rows[0].id;

      // Update progress
      await pgClient.query(`
        UPDATE enrollments SET progress_percentage = $1 WHERE id = $2
      `, [50, enrollmentId]);

      const selectResult = await pgClient.query(`
        SELECT progress_percentage FROM enrollments WHERE id = $1
      `, [enrollmentId]);

      expect(selectResult.rows[0].progress_percentage).toBe(50);
    });

    test('should get user enrollments with program details', async () => {
      const { userId, programId } = await testDbManager.seedPostgresData();

      await pgClient.query(`
        INSERT INTO enrollments (user_id, program_id)
        VALUES ($1, $2)
      `, [userId, programId]);

      const result = await pgClient.query(`
        SELECT e.id, e.status, e.progress_percentage, p.name as program_name
        FROM enrollments e
        JOIN programs p ON e.program_id = p.id
        WHERE e.user_id = $1
      `, [userId]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].program_name).toBe('Test Program');
    });
  });

  describe('Payment CRUD Operations', () => {
    test('should create payment record', async () => {
      const { userId, programId } = await testDbManager.seedPostgresData();

      const result = await pgClient.query(`
        INSERT INTO payments (user_id, program_id, amount, currency, gateway, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, amount, gateway, status
      `, [userId, programId, 9999.00, 'INR', 'razorpay', 'pending']);

      expect(result.rows[0].amount).toBe('9999.00');
      expect(result.rows[0].gateway).toBe('razorpay');
      expect(result.rows[0].status).toBe('pending');
    });

    test('should update payment status', async () => {
      const { userId, programId } = await testDbManager.seedPostgresData();

      const insertResult = await pgClient.query(`
        INSERT INTO payments (user_id, program_id, amount, gateway, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [userId, programId, 9999.00, 'razorpay', 'pending']);

      const paymentId = insertResult.rows[0].id;

      // Update to completed
      await pgClient.query(`
        UPDATE payments 
        SET status = $1, gateway_payment_id = $2, completed_at = NOW()
        WHERE id = $3
      `, ['completed', 'pay_123456789', paymentId]);

      const selectResult = await pgClient.query(`
        SELECT status, gateway_payment_id, completed_at FROM payments WHERE id = $1
      `, [paymentId]);

      expect(selectResult.rows[0].status).toBe('completed');
      expect(selectResult.rows[0].gateway_payment_id).toBe('pay_123456789');
      expect(selectResult.rows[0].completed_at).toBeDefined();
    });

    test('should query payments by status', async () => {
      const { userId, programId } = await testDbManager.seedPostgresData();

      // Create multiple payments
      await pgClient.query(`
        INSERT INTO payments (user_id, program_id, amount, gateway, status)
        VALUES 
          ($1, $2, 9999, 'razorpay', 'completed'),
          ($1, $2, 9999, 'razorpay', 'pending'),
          ($1, $2, 9999, 'stripe', 'completed')
      `, [userId, programId]);

      const result = await pgClient.query(`
        SELECT id, status FROM payments WHERE status = $1
      `, ['completed']);

      expect(result.rows.length).toBe(2);
      expect(result.rows.every(row => row.status === 'completed')).toBe(true);
    });
  });

  describe('Contact Inquiry CRUD Operations', () => {
    test('should create contact inquiry', async () => {
      const result = await pgClient.query(`
        INSERT INTO contact_inquiries (name, email, subject, message, type, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, email, type, status
      `, ['John Doe', 'john@example.com', 'Test Subject', 'Test message', 'general', 'new']);

      expect(result.rows[0].name).toBe('John Doe');
      expect(result.rows[0].type).toBe('general');
      expect(result.rows[0].status).toBe('new');
    });

    test('should update inquiry status', async () => {
      const insertResult = await pgClient.query(`
        INSERT INTO contact_inquiries (name, email, subject, message)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['Jane Doe', 'jane@example.com', 'Subject', 'Message']);

      const inquiryId = insertResult.rows[0].id;

      await pgClient.query(`
        UPDATE contact_inquiries SET status = $1 WHERE id = $2
      `, ['in_progress', inquiryId]);

      const selectResult = await pgClient.query(`
        SELECT status FROM contact_inquiries WHERE id = $1
      `, [inquiryId]);

      expect(selectResult.rows[0].status).toBe('in_progress');
    });
  });

  describe('Complex Queries', () => {
    test('should get user dashboard data with joins', async () => {
      const { userId, programId } = await testDbManager.seedPostgresData();

      // Create enrollment
      await pgClient.query(`
        INSERT INTO enrollments (user_id, program_id, progress_percentage)
        VALUES ($1, $2, $3)
      `, [userId, programId, 25]);

      // Create payment
      await pgClient.query(`
        INSERT INTO payments (user_id, program_id, amount, gateway, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, programId, 9999.00, 'razorpay', 'completed']);

      // Complex query
      const result = await pgClient.query(`
        SELECT 
          u.id as user_id,
          u.email,
          u.first_name,
          u.last_name,
          COUNT(DISTINCT e.id) as enrollment_count,
          COUNT(DISTINCT p.id) as payment_count,
          COALESCE(SUM(p.amount), 0) as total_spent
        FROM users u
        LEFT JOIN enrollments e ON u.id = e.user_id
        LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'completed'
        WHERE u.id = $1
        GROUP BY u.id, u.email, u.first_name, u.last_name
      `, [userId]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].enrollment_count).toBe('1');
      expect(result.rows[0].payment_count).toBe('1');
      expect(parseFloat(result.rows[0].total_spent)).toBe(9999.00);
    });
  });
});

describe('CRUD Operations - MongoDB', () => {
  let mongodb;

  beforeAll(async () => {
    await testDbManager.connect();
    mongodb = testDbManager.getMongoDB();
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    await testDbManager.cleanMongoDB();
  });

  describe('Analytics Events CRUD', () => {
    test('should create analytics event', async () => {
      const collection = mongodb.collection('analytics_events');

      const event = {
        type: 'page_view',
        userId: 'user123',
        data: { page: '/programs', duration: 5000 },
        timestamp: new Date(),
      };

      const result = await collection.insertOne(event);
      expect(result.insertedId).toBeDefined();

      const found = await collection.findOne({ _id: result.insertedId });
      expect(found.type).toBe('page_view');
      expect(found.userId).toBe('user123');
    });

    test('should query events by type', async () => {
      const collection = mongodb.collection('analytics_events');

      await collection.insertMany([
        { type: 'page_view', timestamp: new Date() },
        { type: 'page_view', timestamp: new Date() },
        { type: 'click', timestamp: new Date() },
      ]);

      const events = await collection.find({ type: 'page_view' }).toArray();
      expect(events.length).toBe(2);
    });

    test('should update event data', async () => {
      const collection = mongodb.collection('analytics_events');

      const result = await collection.insertOne({
        type: 'test_event',
        data: { value: 1 },
        timestamp: new Date(),
      });

      await collection.updateOne(
        { _id: result.insertedId },
        { $set: { 'data.value': 2 } }
      );

      const updated = await collection.findOne({ _id: result.insertedId });
      expect(updated.data.value).toBe(2);
    });

    test('should delete old events', async () => {
      const collection = mongodb.collection('analytics_events');

      const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

      await collection.insertMany([
        { type: 'old_event', timestamp: oldDate },
        { type: 'new_event', timestamp: new Date() },
      ]);

      await collection.deleteMany({
        timestamp: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      });

      const remaining = await collection.find({}).toArray();
      expect(remaining.length).toBe(1);
      expect(remaining[0].type).toBe('new_event');
    });
  });

  describe('Content CRUD', () => {
    test('should create content document', async () => {
      const collection = mongodb.collection('content');

      const content = {
        type: 'testimonial',
        title: 'Great Course',
        content: {
          name: 'Student Name',
          text: 'This course changed my life!',
          rating: 5,
        },
        status: 'published',
        version: 1,
        createdAt: new Date(),
      };

      const result = await collection.insertOne(content);
      expect(result.insertedId).toBeDefined();
    });

    test('should query content by type and status', async () => {
      const collection = mongodb.collection('content');

      await collection.insertMany([
        { type: 'testimonial', status: 'published', title: 'Test 1' },
        { type: 'testimonial', status: 'draft', title: 'Test 2' },
        { type: 'hero', status: 'published', title: 'Test 3' },
      ]);

      const published = await collection
        .find({ type: 'testimonial', status: 'published' })
        .toArray();

      expect(published.length).toBe(1);
      expect(published[0].title).toBe('Test 1');
    });

    test('should version content updates', async () => {
      const collection = mongodb.collection('content');

      const result = await collection.insertOne({
        type: 'hero',
        title: 'Main Hero',
        content: { headline: 'Original' },
        status: 'published',
        version: 1,
      });

      // Create new version
      await collection.insertOne({
        type: 'hero',
        title: 'Main Hero',
        content: { headline: 'Updated' },
        status: 'published',
        version: 2,
        previousVersion: result.insertedId,
      });

      const versions = await collection
        .find({ title: 'Main Hero' })
        .sort({ version: -1 })
        .toArray();

      expect(versions.length).toBe(2);
      expect(versions[0].version).toBe(2);
      expect(versions[0].content.headline).toBe('Updated');
    });
  });
});

describe('CRUD Operations - Redis', () => {
  let redisClient;

  beforeAll(async () => {
    await testDbManager.connect();
    redisClient = testDbManager.getRedisClient();
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    await testDbManager.cleanRedis();
  });

  describe('Session Management', () => {
    test('should store and retrieve session data', async () => {
      const sessionId = 'session:user123';
      const sessionData = JSON.stringify({
        userId: 'user123',
        email: 'user@example.com',
        role: 'student',
      });

      await redisClient.set(sessionId, sessionData, 'EX', 3600);

      const retrieved = await redisClient.get(sessionId);
      expect(JSON.parse(retrieved)).toEqual(JSON.parse(sessionData));
    });

    test('should expire sessions after TTL', async () => {
      const sessionId = 'session:expire-test';
      await redisClient.set(sessionId, 'data', 'EX', 1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const retrieved = await redisClient.get(sessionId);
      expect(retrieved).toBeNull();
    });

    test('should delete session on logout', async () => {
      const sessionId = 'session:logout-test';
      await redisClient.set(sessionId, 'data');

      await redisClient.del(sessionId);

      const retrieved = await redisClient.get(sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Caching', () => {
    test('should cache API responses', async () => {
      const cacheKey = 'cache:programs:list';
      const data = JSON.stringify([
        { id: 1, name: 'Program 1' },
        { id: 2, name: 'Program 2' },
      ]);

      await redisClient.set(cacheKey, data, 'EX', 300);

      const cached = await redisClient.get(cacheKey);
      expect(JSON.parse(cached)).toEqual(JSON.parse(data));
    });

    test('should invalidate cache', async () => {
      const cacheKey = 'cache:programs:list';
      await redisClient.set(cacheKey, 'data');

      await redisClient.del(cacheKey);

      const retrieved = await redisClient.get(cacheKey);
      expect(retrieved).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    test('should track request counts', async () => {
      const key = 'ratelimit:user123';

      await redisClient.incr(key);
      await redisClient.incr(key);
      await redisClient.incr(key);

      const count = await redisClient.get(key);
      expect(parseInt(count)).toBe(3);
    });

    test('should reset rate limit after window', async () => {
      const key = 'ratelimit:window-test';

      await redisClient.set(key, '1', 'EX', 1);
      await new Promise(resolve => setTimeout(resolve, 1100));

      const count = await redisClient.get(key);
      expect(count).toBeNull();
    });
  });
});
