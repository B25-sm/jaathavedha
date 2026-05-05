import { EmailService } from '../services/EmailService';
import { NotificationChannel, NotificationType, NotificationTemplate } from '../types';
import { createClient } from 'redis';
import winston from 'winston';

// Mock Redis client
const mockRedisClient = {
  hGetAll: jest.fn(),
  hSet: jest.fn(),
  expire: jest.fn()
} as any;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
} as any;

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = new EmailService(mockRedisClient, mockLogger);
  });

  describe('processTemplate', () => {
    it('should replace variables in template', () => {
      const template = 'Hello {{name}}, welcome to {{program}}!';
      const data = { name: 'John', program: 'AI Course' };
      
      // Access private method through any
      const result = (emailService as any).processTemplate(template, data);
      
      expect(result).toBe('Hello John, welcome to AI Course!');
    });

    it('should handle conditional blocks', () => {
      const template = 'Hello {{name}}{{#if premium}}, you are a premium member{{/if}}!';
      const data = { name: 'John', premium: true };
      
      const result = (emailService as any).processTemplate(template, data);
      
      expect(result).toContain('you are a premium member');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}, {{missingVar}}!';
      const data = { name: 'John' };
      
      const result = (emailService as any).processTemplate(template, data);
      
      expect(result).toBe('Hello John, !');
    });
  });

  describe('getTemplate', () => {
    it('should fetch template from Redis', async () => {
      const templateData = {
        name: 'Test Template',
        channel: NotificationChannel.EMAIL,
        type: NotificationType.TRANSACTIONAL,
        subject: 'Test Subject',
        content: 'Test Content',
        variables: JSON.stringify(['var1', 'var2']),
        isActive: 'true',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRedisClient.hGetAll.mockResolvedValue(templateData);

      const template = await emailService.getTemplate('test_template');

      expect(template).toBeDefined();
      expect(template?.name).toBe('Test Template');
      expect(template?.variables).toEqual(['var1', 'var2']);
    });

    it('should return null for non-existent template', async () => {
      mockRedisClient.hGetAll.mockResolvedValue({});

      const template = await emailService.getTemplate('non_existent');

      expect(template).toBeNull();
    });

    it('should cache fetched templates', async () => {
      const templateData = {
        name: 'Test Template',
        channel: NotificationChannel.EMAIL,
        type: NotificationType.TRANSACTIONAL,
        subject: 'Test',
        content: 'Test',
        variables: JSON.stringify([]),
        isActive: 'true',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockRedisClient.hGetAll.mockResolvedValue(templateData);

      // First call
      await emailService.getTemplate('test_template');
      
      // Second call should use cache
      await emailService.getTemplate('test_template');

      // Redis should only be called once
      expect(mockRedisClient.hGetAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveTemplate', () => {
    it('should save template to Redis', async () => {
      const template: NotificationTemplate = {
        name: 'New Template',
        channel: NotificationChannel.EMAIL,
        type: NotificationType.MARKETING,
        subject: 'New Subject',
        content: 'New Content',
        variables: ['var1'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await emailService.saveTemplate(template);

      expect(mockRedisClient.hSet).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Template saved',
        expect.objectContaining({ name: 'New Template' })
      );
    });

    it('should update existing template', async () => {
      const template: NotificationTemplate = {
        id: 'existing_template',
        name: 'Updated Template',
        channel: NotificationChannel.EMAIL,
        type: NotificationType.TRANSACTIONAL,
        subject: 'Updated',
        content: 'Updated',
        variables: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await emailService.saveTemplate(template);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'template:existing_template',
        expect.any(Object)
      );
    });
  });

  describe('handleBounce', () => {
    it('should record email bounce', async () => {
      const bounceData = {
        email: 'test@example.com',
        reason: 'Invalid email',
        type: 'hard'
      };

      await emailService.handleBounce('msg_123', bounceData);

      expect(mockRedisClient.hSet).toHaveBeenCalled();
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'email:bounce:msg_123',
        90 * 24 * 60 * 60
      );
    });
  });

  describe('trackDelivery', () => {
    it('should track email delivery status', async () => {
      await emailService.trackDelivery('msg_123', 'sent' as any);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'email:tracking:msg_123',
        expect.objectContaining({
          messageId: 'msg_123',
          status: 'sent'
        })
      );
    });

    it('should set expiry on tracking data', async () => {
      await emailService.trackDelivery('msg_123', 'delivered' as any);

      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'email:tracking:msg_123',
        30 * 24 * 60 * 60
      );
    });
  });
});
