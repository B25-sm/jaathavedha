import request from 'supertest';
import app from '../index';
import { UserModel } from '../models/User';
import { AuthUtils } from '@sai-mahendra/utils';

// Mock the UserModel
jest.mock('../models/User');
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

// Mock AuthUtils
jest.mock('@sai-mahendra/utils', () => ({
  ...jest.requireActual('@sai-mahendra/utils'),
  AuthUtils: {
    hashPassword: jest.fn(),
    verifyPassword: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    generateSecureToken: jest.fn(),
    verifyToken: jest.fn()
  }
}));

const mockAuthUtils = AuthUtils as jest.Mocked<typeof AuthUtils>;

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890'
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserModel.findByEmail.mockResolvedValue(null);
      mockAuthUtils.hashPassword.mockResolvedValue('hashed-password');
      mockUserModel.create.mockResolvedValue(mockUser as any);
      mockAuthUtils.generateSecureToken.mockReturnValue('verification-token');
      mockUserModel.setEmailVerificationToken.mockResolvedValue(true);

      const response = await request(app)
        .post('/auth/register')
        .send(validRegistrationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockAuthUtils.hashPassword).toHaveBeenCalledWith('Test123!@#');
      expect(mockUserModel.create).toHaveBeenCalled();
    });

    it('should return error for existing email', async () => {
      const existingUser = { id: 'user-123', email: 'test@example.com' };
      mockUserModel.findByEmail.mockResolvedValue(existingUser as any);

      const response = await request(app)
        .post('/auth/register')
        .send(validRegistrationData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // Too short
        firstName: '',
        lastName: ''
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Test123!@#'
    };

    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student',
        status: 'active',
        emailVerified: true,
        passwordHash: 'hashed-password'
      };

      mockUserModel.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      mockAuthUtils.verifyPassword.mockResolvedValue(true);
      mockAuthUtils.generateAccessToken.mockReturnValue('access-token');
      mockAuthUtils.generateRefreshToken.mockReturnValue('refresh-token');
      mockUserModel.updateLastLogin.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.tokens.accessToken).toBe('access-token');
      expect(response.body.data.tokens.refreshToken).toBe('refresh-token');
    });

    it('should return error for invalid credentials', async () => {
      mockUserModel.findByEmailWithPassword.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return error for incorrect password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        status: 'active',
        passwordHash: 'hashed-password'
      };

      mockUserModel.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      mockAuthUtils.verifyPassword.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return error for inactive user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        status: 'inactive',
        passwordHash: 'hashed-password'
      };

      mockUserModel.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      mockAuthUtils.verifyPassword.mockResolvedValue(true);

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not active');
    });
  });

  describe('POST /auth/refresh-token', () => {
    it('should refresh access token successfully', async () => {
      const mockPayload = {
        userId: 'user-123',
        type: 'refresh'
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'student',
        status: 'active'
      };

      mockAuthUtils.verifyToken.mockReturnValue(mockPayload as any);
      mockUserModel.findById.mockResolvedValue(mockUser as any);
      mockAuthUtils.generateAccessToken.mockReturnValue('new-access-token');

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBe('new-access-token');
    });

    it('should return error for invalid refresh token', async () => {
      mockAuthUtils.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true
      };

      mockUserModel.verifyEmail.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .post('/auth/verify-email')
        .send({ token: 'verification-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.emailVerified).toBe(true);
    });

    it('should return error for invalid token', async () => {
      mockUserModel.verifyEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/verify-email')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should send password reset email for existing user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      mockUserModel.findByEmail.mockResolvedValue(mockUser as any);
      mockAuthUtils.generateSecureToken.mockReturnValue('reset-token');
      mockUserModel.setPasswordResetToken.mockResolvedValue(true);

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset link');
    });

    it('should return success message even for non-existing email', async () => {
      mockUserModel.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset link');
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      mockAuthUtils.hashPassword.mockResolvedValue('new-hashed-password');
      mockUserModel.resetPassword.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'reset-token',
          newPassword: 'NewPassword123!@#'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('reset successfully');
    });

    it('should return error for invalid or expired token', async () => {
      mockAuthUtils.hashPassword.mockResolvedValue('new-hashed-password');
      mockUserModel.resetPassword.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123!@#'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});