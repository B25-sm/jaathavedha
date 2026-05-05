/**
 * Jest setup file for PWA service integration tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3015';
process.env.LOG_LEVEL = 'error';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xYjEB6LWmOhRqjSHEHnysVZHkA4xWqvxRL6O9pSUK7TgkPcnWPLVc';
process.env.VAPID_PRIVATE_KEY = 'UUxI4O8-FbRouAevSmBQ6o8FwXTpQUiMcN5VqtxVLWc';
process.env.VAPID_SUBJECT = 'mailto:test@saimahendra.com';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.SW_CACHE_VERSION = 'v1.0.0-test';
process.env.SW_CACHE_MAX_AGE = '86400';
process.env.SYNC_BATCH_SIZE = '50';
process.env.SYNC_MAX_RETRIES = '3';
process.env.SYNC_RETRY_DELAY = '1000';
process.env.MOBILE_IMAGE_QUALITY = '80';
process.env.MOBILE_MAX_PAYLOAD_SIZE = '1048576';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console logs during tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
