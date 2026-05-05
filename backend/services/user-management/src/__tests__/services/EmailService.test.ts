import { EmailService } from '../../services/EmailService';
import nodemailer from 'nodemailer';
import { Logger } from '@sai-mahendra/utils';

// Mock nodemailer
jest.mock('nodemailer');
const mockNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

// Mock Logger
jest.mock('@sai-mahendra/utils', () => ({
  ...jest.requireActual('@sai-mahendra/utils'),
  Logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('EmailService', () => {
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransporter = {
      verify: jest.fn(),
      sendMail: jest.fn()
    };

    mockNodemailer.createTransporter.mockReturnValue(mockTransporter);
    
    // Set up environment variables
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASSWORD = 'password';
    process.env.FROM_NAME = 'Test Platform';
    process.env.FROM_EMAIL = 'noreply@test.com';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.FROM_NAME;
    delete process.env.FROM_EMAIL;
  });

  describe('initialize', () => {
    it('should create transporter with correct configuration', () => {
      EmailService.initialize();

      expect(mockNodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password'
        }
      });
    });

    it('should verify transporter connection on success', () => {
      mockTransporter.verify.mockImplementation((callback) => {
        callback(null, true);
      });

      EmailService.initialize();

      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Email service is ready to send messages');
    });

    it('should log error on verification failure', () => {
      const error = new Error('Connection failed');
      mockTransporter.verify.mockImplementation((callback) => {
        callback(error, false);
      });

      EmailService.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith('Email service configuration error', error);
    });

    it('should use default values when environment variables are not set', () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;

      EmailService.initialize();

      expect(mockNodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password'
        }
      });
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      mockTransporter.verify.mockImplementation((callback) => {
        callback(null, true);
      });
    });

    it('should send email successfully', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const emailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test text'
      };

      const result = await EmailService.sendEmail(emailOptions);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'Test Platform <noreply@test.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test text'
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Email sent successfully', {
        messageId: 'test-message-id',
        to: 'recipient@example.com',
        subject: 'Test Subject'
      });
    });

    it('should handle email sending failure', async () => {
      const error = new Error('Send failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      const emailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      };

      const result = await EmailService.sendEmail(emailOptions);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send email', error, {
        to: 'recipient@example.com',
        subject: 'Test Subject'
      });
    });

    it('should use fallback FROM address when FROM_EMAIL is not set', async () => {
      delete process.env.FROM_EMAIL;
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });

      const emailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      };

      await EmailService.sendEmail(emailOptions);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Test Platform <test@example.com>'
        })
      );
    });
  });

  describe('sendEmailVerification', () => {
    beforeEach(() => {
      mockTransporter.verify.mockImplementation((callback) => {
        callback(null, true);
      });
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    });

    it('should send email verification with correct content', async () => {
      const verificationData = {
        firstName: 'John',
        verificationToken: 'test-token',
        verificationUrl: 'https://example.com/verify?token=test-token'
      };

      const result = await EmailService.sendEmailVerification('john@example.com', verificationData);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          subject: 'Verify Your Email - Sai Mahendra Platform',
          html: expect.stringContaining('Hi John'),
          html: expect.stringContaining(verificationData.verificationUrl),
          text: expect.stringContaining('Hi John')
        })
      );
    });

    it('should include verification URL in both HTML and text versions', async () => {
      const verificationData = {
        firstName: 'Jane',
        verificationToken: 'test-token-123',
        verificationUrl: 'https://platform.com/verify?token=test-token-123'
      };

      await EmailService.sendEmailVerification('jane@example.com', verificationData);

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(verificationData.verificationUrl);
      expect(callArgs.text).toContain(verificationData.verificationUrl);
    });
  });

  describe('sendPasswordReset', () => {
    beforeEach(() => {
      mockTransporter.verify.mockImplementation((callback) => {
        callback(null, true);
      });
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    });

    it('should send password reset email with correct content', async () => {
      const resetData = {
        firstName: 'Alice',
        resetToken: 'reset-token-123',
        resetUrl: 'https://example.com/reset?token=reset-token-123'
      };

      const result = await EmailService.sendPasswordReset('alice@example.com', resetData);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          subject: 'Reset Your Password - Sai Mahendra Platform',
          html: expect.stringContaining('Hi Alice'),
          html: expect.stringContaining(resetData.resetUrl),
          text: expect.stringContaining('Hi Alice')
        })
      );
    });

    it('should include security warnings in password reset email', async () => {
      const resetData = {
        firstName: 'Bob',
        resetToken: 'reset-token-456',
        resetUrl: 'https://example.com/reset?token=reset-token-456'
      };

      await EmailService.sendPasswordReset('bob@example.com', resetData);

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('expire in 1 hour');
      expect(callArgs.html).toContain('Security Notice');
      expect(callArgs.text).toContain('expire in 1 hour');
    });
  });

  describe('sendWelcomeEmail', () => {
    beforeEach(() => {
      mockTransporter.verify.mockImplementation((callback) => {
        callback(null, true);
      });
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    });

    it('should send welcome email with correct content', async () => {
      const result = await EmailService.sendWelcomeEmail('welcome@example.com', 'Charlie');

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'welcome@example.com',
          subject: 'Welcome to Sai Mahendra Platform!',
          html: expect.stringContaining('Hi Charlie'),
          html: expect.stringContaining('🎉 Welcome'),
          text: expect.stringContaining('Hi Charlie')
        })
      );
    });

    it('should include dashboard link in welcome email', async () => {
      process.env.FRONTEND_URL = 'https://myplatform.com';

      await EmailService.sendWelcomeEmail('user@example.com', 'David');

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('https://myplatform.com/dashboard');
      expect(callArgs.text).toContain('https://myplatform.com/dashboard');
    });

    it('should use default URL when FRONTEND_URL is not set', async () => {
      delete process.env.FRONTEND_URL;

      await EmailService.sendWelcomeEmail('user@example.com', 'Eve');

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('https://saimahendra.com/dashboard');
      expect(callArgs.text).toContain('https://saimahendra.com/dashboard');
    });
  });

  describe('sendPasswordChangeConfirmation', () => {
    beforeEach(() => {
      mockTransporter.verify.mockImplementation((callback) => {
        callback(null, true);
      });
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    });

    it('should send password change confirmation with correct content', async () => {
      const result = await EmailService.sendPasswordChangeConfirmation('user@example.com', 'Frank');

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Password Changed Successfully - Sai Mahendra Platform',
          html: expect.stringContaining('Hi Frank'),
          html: expect.stringContaining('✅ Password Changed Successfully'),
          text: expect.stringContaining('Hi Frank')
        })
      );
    });

    it('should include security information in password change email', async () => {
      await EmailService.sendPasswordChangeConfirmation('user@example.com', 'Grace');

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Change made on:');
      expect(callArgs.html).toContain('existing sessions have been terminated');
      expect(callArgs.text).toContain('existing sessions have been terminated');
    });

    it('should include current timestamp in confirmation email', async () => {
      const beforeTime = new Date();
      
      await EmailService.sendPasswordChangeConfirmation('user@example.com', 'Henry');
      
      const afterTime = new Date();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      
      // Check that the email contains a timestamp between before and after
      const timestampMatch = callArgs.text.match(/Change made on: (.+)/);
      expect(timestampMatch).toBeTruthy();
      
      const emailTimestamp = new Date(timestampMatch[1]);
      expect(emailTimestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(emailTimestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });
});