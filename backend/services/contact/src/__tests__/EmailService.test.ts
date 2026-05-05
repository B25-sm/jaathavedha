import { EmailService } from '../services/EmailService';
import { EmailConfig, EmailData } from '../types';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn()
}));

import sgMail from '@sendgrid/mail';

describe('EmailService', () => {
  let emailService: EmailService;
  const mockConfig: EmailConfig = {
    sendgridApiKey: 'test-api-key',
    fromEmail: 'test@example.com',
    adminEmail: 'admin@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = new EmailService(mockConfig);
  });

  describe('sendEmail', () => {
    it('should successfully send an email', async () => {
      const emailData: EmailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content'
      };

      (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await emailService.sendEmail(emailData);

      expect(result).toBe(true);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          from: expect.objectContaining({
            email: mockConfig.fromEmail
          })
        })
      );
    });

    it('should handle email sending failure', async () => {
      const emailData: EmailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>'
      };

      (sgMail.send as jest.Mock).mockRejectedValueOnce(new Error('SendGrid error'));

      const result = await emailService.sendEmail(emailData);

      expect(result).toBe(false);
    });

    it('should strip HTML from text if not provided', async () => {
      const emailData: EmailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test <strong>content</strong></p>'
      };

      (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 202 }]);

      await emailService.sendEmail(emailData);

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Test content')
        })
      );
    });
  });

  describe('sendBulkEmails', () => {
    it('should send multiple emails in batches', async () => {
      const emails: EmailData[] = Array.from({ length: 15 }, (_, i) => ({
        to: `recipient${i}@example.com`,
        subject: `Test Email ${i}`,
        html: `<p>Test content ${i}</p>`
      }));

      (sgMail.send as jest.Mock).mockResolvedValue([{ statusCode: 202 }]);

      const result = await emailService.sendBulkEmails(emails);

      expect(result.sent).toBe(15);
      expect(result.failed).toBe(0);
      expect(sgMail.send).toHaveBeenCalledTimes(15);
    });

    it('should handle partial failures in bulk sending', async () => {
      const emails: EmailData[] = Array.from({ length: 5 }, (_, i) => ({
        to: `recipient${i}@example.com`,
        subject: `Test Email ${i}`,
        html: `<p>Test content ${i}</p>`
      }));

      (sgMail.send as jest.Mock)
        .mockResolvedValueOnce([{ statusCode: 202 }])
        .mockResolvedValueOnce([{ statusCode: 202 }])
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce([{ statusCode: 202 }])
        .mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await emailService.sendBulkEmails(emails);

      expect(result.sent).toBe(4);
      expect(result.failed).toBe(1);
    });
  });

  describe('sendTemplateEmail', () => {
    it('should send email using template', async () => {
      const templateId = 'template-123';
      const templateData = {
        name: 'John Doe',
        subject: 'Test Subject'
      };

      (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await emailService.sendTemplateEmail(
        'recipient@example.com',
        templateId,
        templateData
      );

      expect(result).toBe(true);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId,
          dynamicTemplateData: templateData
        })
      );
    });
  });

  describe('sendContactConfirmation', () => {
    it('should send contact confirmation email', async () => {
      (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await emailService.sendContactConfirmation(
        'user@example.com',
        'John Doe',
        'inquiry-123',
        'Test Subject',
        'general'
      );

      expect(result).toBe(true);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Thank you for contacting Sai Mahendra Platform'
        })
      );
    });
  });

  describe('sendAdminNotification', () => {
    it('should send admin notification email', async () => {
      (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await emailService.sendAdminNotification(
        'inquiry-123',
        'John Doe',
        'john@example.com',
        '+919876543210',
        'Test Subject',
        'Test message',
        'general'
      );

      expect(result).toBe(true);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockConfig.adminEmail,
          subject: expect.stringContaining('New Contact Inquiry')
        })
      );
    });
  });

  describe('sendInquiryResponse', () => {
    it('should send inquiry response email', async () => {
      (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await emailService.sendInquiryResponse(
        'user@example.com',
        'John Doe',
        'Original Subject',
        'Response message',
        'inquiry-123'
      );

      expect(result).toBe(true);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Re: Original Subject'
        })
      );
    });
  });

  describe('verifyEmail', () => {
    it('should validate correct email format', async () => {
      const result = await emailService.verifyEmail('valid@example.com');

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const result = await emailService.verifyEmail('invalid-email');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid email format');
    });

    it('should reject disposable email addresses', async () => {
      const result = await emailService.verifyEmail('test@10minutemail.com');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Disposable email address');
    });

    it('should accept valid email from trusted domain', async () => {
      const result = await emailService.verifyEmail('user@gmail.com');

      expect(result.isValid).toBe(true);
    });
  });
});
