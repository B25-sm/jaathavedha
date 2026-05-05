import { WhatsAppService } from '../services/WhatsAppService';
import { WhatsAppConfig, WhatsAppWebhookPayload } from '../types';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WhatsAppService', () => {
  let whatsappService: WhatsAppService;
  const mockConfig: WhatsAppConfig = {
    businessAccountId: 'test-business-id',
    accessToken: 'test-access-token',
    phoneNumberId: 'test-phone-id',
    webhookVerifyToken: 'test-verify-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    whatsappService = new WhatsAppService(mockConfig);
  });

  describe('sendTextMessage', () => {
    it('should successfully send a text message', async () => {
      const mockResponse = {
        data: {
          messages: [{ id: 'msg-123' }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await whatsappService.sendTextMessage(
        '+919876543210',
        'Test message'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          messaging_product: 'whatsapp',
          to: expect.any(String),
          type: 'text',
          text: { body: 'Test message' }
        }),
        expect.any(Object)
      );
    });

    it('should handle message sending failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: { message: 'Invalid phone number' } }
        },
        isAxiosError: true
      });

      const result = await whatsappService.sendTextMessage(
        'invalid-number',
        'Test message'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should format phone numbers correctly', async () => {
      const mockResponse = {
        data: {
          messages: [{ id: 'msg-123' }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await whatsappService.sendTextMessage('9876543210', 'Test message');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          to: '919876543210' // Should add country code
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendTemplateMessage', () => {
    it('should successfully send a template message', async () => {
      const mockResponse = {
        data: {
          messages: [{ id: 'msg-456' }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await whatsappService.sendTemplateMessage(
        '+919876543210',
        'welcome_template',
        'en',
        []
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-456');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'template',
          template: expect.objectContaining({
            name: 'welcome_template',
            language: { code: 'en' }
          })
        }),
        expect.any(Object)
      );
    });

    it('should handle template sending failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { error: { message: 'Template not found' } }
        },
        isAxiosError: true
      });

      const result = await whatsappService.sendTemplateMessage(
        '+919876543210',
        'non_existent_template',
        'en'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
    });
  });

  describe('sendInquiryNotification', () => {
    it('should send inquiry notification to admin', async () => {
      const mockResponse = {
        data: {
          messages: [{ id: 'msg-789' }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await whatsappService.sendInquiryNotification(
        '+919876543210',
        'inquiry-123',
        'John Doe',
        'john@example.com',
        'Test Subject',
        'general'
      );

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: expect.objectContaining({
            body: expect.stringContaining('New Contact Inquiry')
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendResponseNotification', () => {
    it('should send response notification to user', async () => {
      const mockResponse = {
        data: {
          messages: [{ id: 'msg-101' }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await whatsappService.sendResponseNotification(
        '+919876543210',
        'John Doe',
        'Test Subject',
        'Response message'
      );

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: expect.objectContaining({
            body: expect.stringContaining('John Doe')
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', mockConfig.webhookVerifyToken)
        .update(payload)
        .digest('hex');

      const result = whatsappService.verifyWebhookSignature(
        payload,
        `sha256=${expectedSignature}`
      );

      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'sha256=invalid-signature';

      const result = whatsappService.verifyWebhookSignature(
        payload,
        invalidSignature
      );

      expect(result).toBe(false);
    });
  });

  describe('processWebhook', () => {
    it('should process incoming message webhook', async () => {
      const webhookPayload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+919876543210',
                    phone_number_id: 'phone-123'
                  },
                  messages: [
                    {
                      from: '919876543211',
                      id: 'msg-123',
                      timestamp: '1234567890',
                      text: {
                        body: 'Hello, I need help'
                      },
                      type: 'text'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const result = await whatsappService.processWebhook(webhookPayload);

      expect(result.processed).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].message).toBe('Hello, I need help');
      expect(result.messages[0].from).toBe('919876543211');
    });

    it('should process message status update webhook', async () => {
      const webhookPayload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+919876543210',
                    phone_number_id: 'phone-123'
                  },
                  statuses: [
                    {
                      id: 'msg-123',
                      status: 'delivered',
                      timestamp: '1234567890',
                      recipient_id: '919876543211'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const result = await whatsappService.processWebhook(webhookPayload);

      expect(result.processed).toBe(true);
      expect(result.messages).toHaveLength(0); // Status updates don't create messages
    });

    it('should handle webhook processing errors', async () => {
      const invalidPayload = {} as WhatsAppWebhookPayload;

      const result = await whatsappService.processWebhook(invalidPayload);

      expect(result.processed).toBe(false);
      expect(result.messages).toHaveLength(0);
    });
  });

  describe('getBusinessAccountInfo', () => {
    it('should retrieve business account information', async () => {
      const mockAccountInfo = {
        id: 'account-123',
        name: 'Test Business',
        timezone_offset_min: 330,
        message_template_namespace: 'test-namespace'
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockAccountInfo });

      const result = await whatsappService.getBusinessAccountInfo();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAccountInfo);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(mockConfig.businessAccountId),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockConfig.accessToken}`
          })
        })
      );
    });

    it('should handle account info retrieval failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      const result = await whatsappService.getBusinessAccountInfo();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getMessageTemplates', () => {
    it('should retrieve available message templates', async () => {
      const mockTemplates = {
        data: [
          {
            id: 'template-1',
            name: 'welcome_template',
            status: 'APPROVED',
            language: 'en',
            category: 'MARKETING'
          },
          {
            id: 'template-2',
            name: 'order_confirmation',
            status: 'APPROVED',
            language: 'en',
            category: 'TRANSACTIONAL'
          }
        ]
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockTemplates });

      const result = await whatsappService.getMessageTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(2);
      expect(result.templates?.[0].name).toBe('welcome_template');
    });

    it('should handle template retrieval failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      const result = await whatsappService.getMessageTemplates();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('checkPhoneNumber', () => {
    it('should validate registered WhatsApp number', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { messages: [{ id: 'msg-123' }] }
      });

      const result = await whatsappService.checkPhoneNumber('+919876543210');

      expect(result.isRegistered).toBe(true);
      expect(result.formattedNumber).toBe('919876543210');
    });

    it('should detect unregistered phone number', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 404,
        data: { error: 'Phone number not registered' }
      });

      const result = await whatsappService.checkPhoneNumber('+919876543210');

      expect(result.isRegistered).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle phone number validation errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Validation error'));

      const result = await whatsappService.checkPhoneNumber('invalid-number');

      expect(result.isRegistered).toBe(false);
      expect(result.error).toBe('Phone number validation failed');
    });
  });
});
