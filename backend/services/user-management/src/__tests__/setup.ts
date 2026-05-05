import { DatabaseUtils } from '@sai-mahendra/utils';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

// Mock DatabaseUtils
jest.mock('@sai-mahendra/utils', () => ({
  ...jest.requireActual('@sai-mahendra/utils'),
  DatabaseUtils: {
    initialize: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    query: jest.fn(),
    transaction: jest.fn(),
    close: jest.fn()
  }
}));

// Mock Logger to prevent console output during tests
jest.mock('@sai-mahendra/utils', () => ({
  ...jest.requireActual('@sai-mahendra/utils'),
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn()
  }
}));

// Global test setup
beforeAll(async () => {
  // Any global setup can go here
});

afterAll(async () => {
  // Any global cleanup can go here
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
});