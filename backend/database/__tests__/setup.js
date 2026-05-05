/**
 * Test Setup and Configuration
 * Provides database connections and test utilities for integration tests
 */

const { Client } = require('pg');
const { MongoClient } = require('mongodb');
const Redis = require('ioredis');

// Test database configuration
const TEST_DB_CONFIG = {
  postgres: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 5432,
    database: process.env.TEST_DB_NAME || 'sai_mahendra_test',
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
  },
  mongodb: {
    url: process.env.TEST_MONGO_URL || 'mongodb://localhost:27017',
    dbName: 'sai_mahendra_test',
  },
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: process.env.TEST_REDIS_PORT || 6379,
    db: 15, // Use separate DB for tests
  },
};

class TestDatabaseManager {
  constructor() {
    this.pgClient = null;
    this.mongoClient = null;
    this.redisClient = null;
  }

  /**
   * Initialize all database connections
   */
  async connect() {
    // PostgreSQL connection
    this.pgClient = new Client(TEST_DB_CONFIG.postgres);
    await this.pgClient.connect();

    // MongoDB connection
    this.mongoClient = new MongoClient(TEST_DB_CONFIG.mongodb.url);
    await this.mongoClient.connect();
    this.mongodb = this.mongoClient.db(TEST_DB_CONFIG.mongodb.dbName);

    // Redis connection
    this.redisClient = new Redis(TEST_DB_CONFIG.redis);

    console.log('✅ Test databases connected');
  }

  /**
   * Clean up all test data
   */
  async cleanup() {
    // Clean PostgreSQL tables
    await this.cleanPostgres();

    // Clean MongoDB collections
    await this.cleanMongoDB();

    // Clean Redis keys
    await this.cleanRedis();

    console.log('✅ Test databases cleaned');
  }

  /**
   * Clean PostgreSQL test data
   */
  async cleanPostgres() {
    const tables = [
      'inquiry_responses',
      'contact_inquiries',
      'invoices',
      'subscriptions',
      'payments',
      'user_progress',
      'enrollments',
      'course_modules',
      'courses',
      'programs',
      'refresh_tokens',
      'users',
      'migrations',
    ];

    for (const table of tables) {
      try {
        await this.pgClient.query(`TRUNCATE TABLE ${table} CASCADE`);
      } catch (error) {
        // Table might not exist, ignore
      }
    }
  }

  /**
   * Clean MongoDB test data
   */
  async cleanMongoDB() {
    const collections = await this.mongodb.listCollections().toArray();
    
    for (const collection of collections) {
      await this.mongodb.collection(collection.name).deleteMany({});
    }
  }

  /**
   * Clean Redis test data
   */
  async cleanRedis() {
    await this.redisClient.flushdb();
  }

  /**
   * Close all database connections
   */
  async disconnect() {
    if (this.pgClient) {
      await this.pgClient.end();
    }

    if (this.mongoClient) {
      await this.mongoClient.close();
    }

    if (this.redisClient) {
      await this.redisClient.quit();
    }

    console.log('✅ Test databases disconnected');
  }

  /**
   * Get PostgreSQL client
   */
  getPostgresClient() {
    return this.pgClient;
  }

  /**
   * Get MongoDB database
   */
  getMongoDB() {
    return this.mongodb;
  }

  /**
   * Get Redis client
   */
  getRedisClient() {
    return this.redisClient;
  }

  /**
   * Seed test data for PostgreSQL
   */
  async seedPostgresData() {
    // Create test user
    const userResult = await this.pgClient.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      'test@example.com',
      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.PjqIvO',
      'Test',
      'User',
      'student',
      true,
    ]);

    const userId = userResult.rows[0].id;

    // Create test program
    const programResult = await this.pgClient.query(`
      INSERT INTO programs (name, description, category, price, duration_weeks, features)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      'Test Program',
      'Test program description',
      'starter',
      9999.00,
      8,
      JSON.stringify({ test: true }),
    ]);

    const programId = programResult.rows[0].id;

    return { userId, programId };
  }

  /**
   * Seed test data for MongoDB
   */
  async seedMongoDBData() {
    const analyticsCollection = this.mongodb.collection('analytics_events');
    const contentCollection = this.mongodb.collection('content');

    await analyticsCollection.insertOne({
      type: 'test_event',
      data: { test: true },
      timestamp: new Date(),
    });

    await contentCollection.insertOne({
      type: 'testimonial',
      title: 'Test Testimonial',
      content: { name: 'Test User', text: 'Test content' },
      status: 'published',
      version: 1,
      createdAt: new Date(),
    });

    return { analyticsCollection, contentCollection };
  }
}

// Export singleton instance
const testDbManager = new TestDatabaseManager();

module.exports = {
  testDbManager,
  TEST_DB_CONFIG,
};
