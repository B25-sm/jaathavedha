import { ContactService } from '../services/ContactService';
import { EmailService } from '../services/EmailService';
import { WhatsAppService } from '../services/WhatsAppService';
import { ContactFormData, InquiryCategory, InquiryStatus } from '../types';

// Mock dependencies
const mockDb = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
};

const mockEmailService = {
  sendEmail: jest.fn(),
  sendContactConfirmation: jest.fn(),
  sendAdminNotification: jest.fn(),
  sendInquiryResponse: jest.fn(),
  verifyEmail: jest.fn()
} as unknown as EmailService;

const mockWhatsAppService = {
  sendTextMessage: jest.fn(),
  sendTemplateMessage: jest.fn(),
  sendInquiryNotification: jest.fn(),
  sendResponseNotification: jest.fn()
} as unknown as WhatsAppService;

describe('ContactService', () => {
  let contactService: ContactService;

  beforeEach(() => {
    jest.clearAllMocks();
    contactService = new ContactService(
      mockDb as any,
      mockEmailService,
      mockWhatsAppService
    );
  });

  describe('submitInquiry', () => {
    const validFormData: ContactFormData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+919876543210',
      subject: 'Test Inquiry',
      message: 'This is a test inquiry message',
      category: InquiryCategory.GENERAL
    };

    it('should successfully submit a valid inquiry', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // For communication history

      const result = await contactService.submitInquiry(validFormData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('John Doe');
      expect(result.data?.email).toBe('john@example.com');
      expect(result.data?.status).toBe(InquiryStatus.NEW);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should reject inquiry with invalid email', async () => {
      const invalidData = { ...validFormData, email: 'invalid-email' };

      const result = await contactService.submitInquiry(invalidData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should reject inquiry with short name', async () => {
      const invalidData = { ...validFormData, name: 'A' };

      const result = await contactService.submitInquiry(invalidData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject inquiry with short message', async () => {
      const invalidData = { ...validFormData, message: 'Short' };

      const result = await contactService.submitInquiry(invalidData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should detect spam inquiries', async () => {
      const spamData = {
        ...validFormData,
        message: 'Buy viagra now! Click here http://spam.com http://spam2.com http://spam3.com'
      };

      const result = await contactService.submitInquiry(spamData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SPAM_DETECTED');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should trim and normalize input data', async () => {
      const untrimmedData = {
        ...validFormData,
        name: '  John Doe  ',
        email: '  JOHN@EXAMPLE.COM  ',
        subject: '  Test Subject  '
      };

      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await contactService.submitInquiry(untrimmedData);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('John Doe');
      expect(result.data?.email).toBe('john@example.com');
    });
  });

  describe('getInquiry', () => {
    it('should retrieve inquiry with responses', async () => {
      const mockInquiry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+919876543210',
        subject: 'Test',
        message: 'Test message',
        category: 'general',
        status: 'new',
        created_at: new Date()
      };

      const mockResponses = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          inquiry_id: mockInquiry.id,
          admin_id: 'admin-123',
          message: 'Response message',
          created_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: [mockInquiry] });
      mockDb.query.mockResolvedValueOnce({ rows: mockResponses });

      const result = await contactService.getInquiry(mockInquiry.id);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(mockInquiry.id);
      expect(result.data?.responses).toHaveLength(1);
    });

    it('should return error for non-existent inquiry', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await contactService.getInquiry('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('respondToInquiry', () => {
    it('should successfully respond to inquiry', async () => {
      const mockInquiry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+919876543210',
        subject: 'Test',
        message: 'Test message',
        category: 'general',
        status: 'new',
        created_at: new Date()
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockInquiry] }); // Get inquiry
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // Insert response
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // Update status
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // Log communication

      const result = await contactService.respondToInquiry(
        mockInquiry.id,
        'admin-123',
        'Thank you for your inquiry',
        true
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledTimes(4);
    });

    it('should return error for non-existent inquiry', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await contactService.respondToInquiry(
        'non-existent-id',
        'admin-123',
        'Response message',
        false
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('updateInquiryStatus', () => {
    it('should successfully update inquiry status', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // Log communication

      const result = await contactService.updateInquiryStatus(
        '123e4567-e89b-12d3-a456-426614174000',
        InquiryStatus.RESOLVED
      );

      expect(result.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should return error for non-existent inquiry', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await contactService.updateInquiryStatus(
        'non-existent-id',
        InquiryStatus.RESOLVED
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getInquiries', () => {
    it('should retrieve inquiries with pagination', async () => {
      const mockInquiries = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+919876543210',
          subject: 'Test 1',
          message: 'Test message 1',
          category: 'general',
          status: 'new',
          created_at: new Date()
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+919876543211',
          subject: 'Test 2',
          message: 'Test message 2',
          category: 'enrollment',
          status: 'in_progress',
          created_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '2' }] }); // Count
      mockDb.query.mockResolvedValueOnce({ rows: mockInquiries }); // Inquiries

      const result = await contactService.getInquiries({ page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(2);
      expect(result.data?.pagination.total).toBe(2);
      expect(result.data?.pagination.page).toBe(1);
    });

    it('should filter inquiries by status', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await contactService.getInquiries({
        status: InquiryStatus.NEW,
        page: 1,
        limit: 20
      });

      expect(result.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getInquiryStats', () => {
    it('should calculate inquiry statistics', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { status: 'new', count: '3' },
          { status: 'in_progress', count: '4' },
          { status: 'resolved', count: '2' },
          { status: 'closed', count: '1' }
        ]
      });
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { category: 'general', count: '5' },
          { category: 'enrollment', count: '3' },
          { category: 'technical_support', count: '1' },
          { category: 'billing', count: '1' }
        ]
      });
      mockDb.query.mockResolvedValueOnce({ rows: [{ avg_hours: '2.5' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ resolved: '3' }] });

      const result = await contactService.getInquiryStats();

      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(10);
      expect(result.data?.byStatus.new).toBe(3);
      expect(result.data?.averageResponseTime).toBe(2.5);
      expect(result.data?.resolutionRate).toBe(30);
    });
  });
});
