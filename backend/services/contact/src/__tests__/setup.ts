// Jest setup file for Contact Service tests

// Mock logger to prevent console output during tests
jest.mock('@sai-mahendra/shared-utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  errorHandler: jest.fn(),
  requestLogger: jest.fn()
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.FROM_EMAIL = 'test@example.com';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = 'test-business-id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
