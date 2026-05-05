// Test setup file
process.env.NODE_ENV = 'test';
process.env.PORT = '3007';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SENDGRID_API_KEY = 'test_sendgrid_key';
process.env.FROM_EMAIL = 'test@example.com';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = 'test_private_key';

// Mock external services
jest.mock('@sendgrid/mail');
jest.mock('firebase-admin');
jest.mock('redis');
jest.mock('bull');
