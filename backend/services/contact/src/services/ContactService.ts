import { v4 as uuidv4 } from 'uuid';
import { PostgresDatabase } from '@sai-mahendra/shared-database';
import { logger } from '@sai-mahendra/shared-utils';
import {
  ContactFormData,
  ContactInquiry,
  ContactInquiryWithResponses,
  InquiryResponse,
  InquiryFilters,
  InquiryStats,
  ContactServiceResponse,
  PaginatedResponse,
  CommunicationHistory,
  SpamCheckResult,
  InquiryCategory,
  InquiryStatus
} from '../types';
import { EmailService } from './EmailService';
import { WhatsAppService } from './WhatsAppService';

export class ContactService {
  constructor(
    private db: PostgresDatabase,
    private emailService: EmailService,
    private whatsappService: WhatsAppService
  ) {}

  /**
   * Submit a new contact inquiry
   */
  async submitInquiry(formData: ContactFormData): Promise<ContactServiceResponse<ContactInquiry>> {
    try {
      // Validate form data
      const validation = this.validateContactForm(formData);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid form data',
            details: validation.errors
          }
        };
      }

      // Check for spam
      const spamCheck = await this.checkForSpam(formData);
      if (spamCheck.isSpam) {
        logger.warn('Spam inquiry detected', { 
          email: formData.email, 
          confidence: spamCheck.confidence,
          reasons: spamCheck.reasons 
        });
        
        return {
          success: false,
          error: {
            code: 'SPAM_DETECTED',
            message: 'Your inquiry could not be processed. Please try again later.'
          }
        };
      }

      // Create inquiry record
      const inquiryId = uuidv4();
      const inquiry: ContactInquiry = {
        id: inquiryId,
        name: formData.name.trim(),
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone?.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        category: formData.category,
        status: InquiryStatus.NEW,
        createdAt: new Date()
      };

      // Save to database
      await this.db.query(
        `INSERT INTO contact_inquiries 
         (id, name, email, phone, subject, message, category, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          inquiry.id,
          inquiry.name,
          inquiry.email,
          inquiry.phone,
          inquiry.subject,
          inquiry.message,
          inquiry.category,
          inquiry.status,
          inquiry.createdAt
        ]
      );

      // Log communication history
      await this.logCommunication({
        inquiryId: inquiry.id,
        type: 'email',
        direction: 'inbound',
        content: `New inquiry submitted: ${inquiry.subject}`,
        metadata: {
          category: inquiry.category,
          source: 'contact_form'
        }
      });

      // Send confirmation email to user
      await this.sendConfirmationEmail(inquiry);

      // Send notification to admin
      await this.sendAdminNotification(inquiry);

      logger.info('Contact inquiry submitted successfully', { 
        inquiryId: inquiry.id,
        category: inquiry.category,
        email: inquiry.email 
      });

      return {
        success: true,
        data: inquiry
      };

    } catch (error) {
      logger.error('Error submitting contact inquiry:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to submit inquiry. Please try again later.'
        }
      };
    }
  }

  /**
   * Get inquiry by ID with responses
   */
  async getInquiry(inquiryId: string): Promise<ContactServiceResponse<ContactInquiryWithResponses>> {
    try {
      // Get inquiry
      const inquiryResult = await this.db.query(
        'SELECT * FROM contact_inquiries WHERE id = $1',
        [inquiryId]
      );

      if (inquiryResult.rows.length === 0) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Inquiry not found'
          }
        };
      }

      const inquiry = this.mapRowToInquiry(inquiryResult.rows[0]);

      // Get responses
      const responsesResult = await this.db.query(
        'SELECT * FROM inquiry_responses WHERE inquiry_id = $1 ORDER BY created_at ASC',
        [inquiryId]
      );

      const responses = responsesResult.rows.map(this.mapRowToResponse);

      return {
        success: true,
        data: {
          ...inquiry,
          responses
        }
      };

    } catch (error) {
      logger.error('Error getting inquiry:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve inquiry'
        }
      };
    }
  }

  /**
   * Get inquiries with filters and pagination
   */
  async getInquiries(filters: InquiryFilters): Promise<ContactServiceResponse<PaginatedResponse<ContactInquiry>>> {
    try {
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build query conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
      }

      if (filters.category) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(filters.category);
      }

      if (filters.dateFrom) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.dateTo);
      }

      if (filters.search) {
        conditions.push(`(
          name ILIKE $${paramIndex} OR 
          email ILIKE $${paramIndex} OR 
          subject ILIKE $${paramIndex} OR 
          message ILIKE $${paramIndex}
        )`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total FROM contact_inquiries ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Get inquiries
      const inquiriesResult = await this.db.query(
        `SELECT * FROM contact_inquiries ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const inquiries = inquiriesResult.rows.map(this.mapRowToInquiry);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          items: inquiries,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      };

    } catch (error) {
      logger.error('Error getting inquiries:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve inquiries'
        }
      };
    }
  }

  /**
   * Respond to an inquiry
   */
  async respondToInquiry(
    inquiryId: string,
    adminId: string,
    message: string,
    sendEmail: boolean = true
  ): Promise<ContactServiceResponse<InquiryResponse>> {
    try {
      // Get inquiry
      const inquiryResult = await this.db.query(
        'SELECT * FROM contact_inquiries WHERE id = $1',
        [inquiryId]
      );

      if (inquiryResult.rows.length === 0) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Inquiry not found'
          }
        };
      }

      const inquiry = this.mapRowToInquiry(inquiryResult.rows[0]);

      // Create response
      const responseId = uuidv4();
      const response: InquiryResponse = {
        id: responseId,
        inquiryId,
        adminId,
        message: message.trim(),
        createdAt: new Date()
      };

      // Save response
      await this.db.query(
        `INSERT INTO inquiry_responses (id, inquiry_id, admin_id, message, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [response.id, response.inquiryId, response.adminId, response.message, response.createdAt]
      );

      // Update inquiry status
      await this.updateInquiryStatus(inquiryId, InquiryStatus.IN_PROGRESS);

      // Log communication
      await this.logCommunication({
        inquiryId,
        type: 'email',
        direction: 'outbound',
        content: `Admin response: ${message.substring(0, 100)}...`,
        metadata: {
          adminId,
          responseId: response.id
        }
      });

      // Send email response if requested
      if (sendEmail) {
        await this.sendResponseEmail(inquiry, response);
      }

      logger.info('Inquiry response sent', { 
        inquiryId, 
        responseId: response.id,
        adminId 
      });

      return {
        success: true,
        data: response
      };

    } catch (error) {
      logger.error('Error responding to inquiry:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send response'
        }
      };
    }
  }

  /**
   * Update inquiry status
   */
  async updateInquiryStatus(
    inquiryId: string,
    status: InquiryStatus
  ): Promise<ContactServiceResponse<void>> {
    try {
      const result = await this.db.query(
        'UPDATE contact_inquiries SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, inquiryId]
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Inquiry not found'
          }
        };
      }

      // Log status change
      await this.logCommunication({
        inquiryId,
        type: 'internal_note',
        direction: 'outbound',
        content: `Status changed to: ${status}`,
        metadata: {
          previousStatus: status,
          newStatus: status
        }
      });

      return { success: true };

    } catch (error) {
      logger.error('Error updating inquiry status:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update status'
        }
      };
    }
  }

  /**
   * Get inquiry statistics
   */
  async getInquiryStats(dateFrom?: Date, dateTo?: Date): Promise<ContactServiceResponse<InquiryStats>> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (dateFrom) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(dateTo);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const totalResult = await this.db.query(
        `SELECT COUNT(*) as total FROM contact_inquiries ${whereClause}`,
        params
      );

      // Get counts by status
      const statusResult = await this.db.query(
        `SELECT status, COUNT(*) as count FROM contact_inquiries ${whereClause} GROUP BY status`,
        params
      );

      // Get counts by category
      const categoryResult = await this.db.query(
        `SELECT category, COUNT(*) as count FROM contact_inquiries ${whereClause} GROUP BY category`,
        params
      );

      // Calculate average response time
      const responseTimeResult = await this.db.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (ir.created_at - ci.created_at))/3600) as avg_hours
         FROM contact_inquiries ci
         JOIN inquiry_responses ir ON ci.id = ir.inquiry_id
         ${whereClause}`,
        params
      );

      // Calculate resolution rate
      const resolvedResult = await this.db.query(
        `SELECT COUNT(*) as resolved FROM contact_inquiries 
         ${whereClause} ${conditions.length > 0 ? 'AND' : 'WHERE'} status IN ('resolved', 'closed')`,
        params
      );

      const total = parseInt(totalResult.rows[0].total);
      const resolved = parseInt(resolvedResult.rows[0].resolved);

      const byStatus: Record<InquiryStatus, number> = {
        [InquiryStatus.NEW]: 0,
        [InquiryStatus.IN_PROGRESS]: 0,
        [InquiryStatus.RESOLVED]: 0,
        [InquiryStatus.CLOSED]: 0
      };

      statusResult.rows.forEach(row => {
        byStatus[row.status as InquiryStatus] = parseInt(row.count);
      });

      const byCategory: Record<InquiryCategory, number> = {
        [InquiryCategory.GENERAL]: 0,
        [InquiryCategory.ENROLLMENT]: 0,
        [InquiryCategory.TECHNICAL_SUPPORT]: 0,
        [InquiryCategory.BILLING]: 0
      };

      categoryResult.rows.forEach(row => {
        byCategory[row.category as InquiryCategory] = parseInt(row.count);
      });

      const stats: InquiryStats = {
        total,
        byStatus,
        byCategory,
        averageResponseTime: parseFloat(responseTimeResult.rows[0]?.avg_hours || '0'),
        resolutionRate: total > 0 ? (resolved / total) * 100 : 0
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      logger.error('Error getting inquiry stats:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve statistics'
        }
      };
    }
  }

  /**
   * Get communication history for an inquiry
   */
  async getCommunicationHistory(inquiryId: string): Promise<ContactServiceResponse<CommunicationHistory[]>> {
    try {
      const result = await this.db.query(
        'SELECT * FROM communication_history WHERE inquiry_id = $1 ORDER BY created_at ASC',
        [inquiryId]
      );

      const history = result.rows.map(row => ({
        id: row.id,
        inquiryId: row.inquiry_id,
        type: row.type,
        direction: row.direction,
        content: row.content,
        metadata: row.metadata,
        createdAt: row.created_at
      }));

      return {
        success: true,
        data: history
      };

    } catch (error) {
      logger.error('Error getting communication history:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve communication history'
        }
      };
    }
  }

  // Private helper methods

  private validateContactForm(formData: ContactFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!formData.name || formData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    if (!formData.email || !this.isValidEmail(formData.email)) {
      errors.push('Valid email address is required');
    }

    if (formData.phone && !this.isValidPhone(formData.phone)) {
      errors.push('Invalid phone number format');
    }

    if (!formData.subject || formData.subject.trim().length < 5) {
      errors.push('Subject must be at least 5 characters long');
    }

    if (!formData.message || formData.message.trim().length < 10) {
      errors.push('Message must be at least 10 characters long');
    }

    if (!Object.values(InquiryCategory).includes(formData.category)) {
      errors.push('Invalid inquiry category');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  private async checkForSpam(formData: ContactFormData): Promise<SpamCheckResult> {
    const reasons: string[] = [];
    let confidence = 0;

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /viagra|cialis|pharmacy/i,
      /make money|earn \$|get rich/i,
      /click here|visit now/i,
      /free offer|limited time/i
    ];

    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(formData.message) || pattern.test(formData.subject)) {
        reasons.push('Contains suspicious keywords');
        confidence += 0.3;
      }
    });

    // Check for excessive links
    const linkCount = (formData.message.match(/https?:\/\/\S+/g) || []).length;
    if (linkCount > 2) {
      reasons.push('Contains too many links');
      confidence += 0.4;
    }

    // Check for repeated characters
    if (/(.)\1{4,}/.test(formData.message)) {
      reasons.push('Contains repeated characters');
      confidence += 0.2;
    }

    return {
      isSpam: confidence > 0.5,
      confidence,
      reasons
    };
  }

  private async sendConfirmationEmail(inquiry: ContactInquiry): Promise<void> {
    try {
      await this.emailService.sendEmail({
        to: inquiry.email,
        subject: 'Thank you for contacting Sai Mahendra Platform',
        html: `
          <h2>Thank you for your inquiry!</h2>
          <p>Dear ${inquiry.name},</p>
          <p>We have received your inquiry and will get back to you within 24 hours.</p>
          <p><strong>Your inquiry details:</strong></p>
          <ul>
            <li><strong>Subject:</strong> ${inquiry.subject}</li>
            <li><strong>Category:</strong> ${inquiry.category}</li>
            <li><strong>Inquiry ID:</strong> ${inquiry.id}</li>
          </ul>
          <p>Best regards,<br>Sai Mahendra Platform Team</p>
        `,
        text: `Thank you for your inquiry! We have received your message and will get back to you within 24 hours. Inquiry ID: ${inquiry.id}`
      });
    } catch (error) {
      logger.error('Failed to send confirmation email:', error);
    }
  }

  private async sendAdminNotification(inquiry: ContactInquiry): Promise<void> {
    try {
      await this.emailService.sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@saimahendra.com',
        subject: `New Contact Inquiry: ${inquiry.subject}`,
        html: `
          <h2>New Contact Inquiry Received</h2>
          <p><strong>From:</strong> ${inquiry.name} (${inquiry.email})</p>
          <p><strong>Phone:</strong> ${inquiry.phone || 'Not provided'}</p>
          <p><strong>Category:</strong> ${inquiry.category}</p>
          <p><strong>Subject:</strong> ${inquiry.subject}</p>
          <p><strong>Message:</strong></p>
          <p>${inquiry.message}</p>
          <p><strong>Inquiry ID:</strong> ${inquiry.id}</p>
          <p><strong>Submitted:</strong> ${inquiry.createdAt.toISOString()}</p>
        `,
        text: `New inquiry from ${inquiry.name} (${inquiry.email}): ${inquiry.subject}`
      });
    } catch (error) {
      logger.error('Failed to send admin notification:', error);
    }
  }

  private async sendResponseEmail(inquiry: ContactInquiry, response: InquiryResponse): Promise<void> {
    try {
      await this.emailService.sendEmail({
        to: inquiry.email,
        subject: `Re: ${inquiry.subject}`,
        html: `
          <h2>Response to your inquiry</h2>
          <p>Dear ${inquiry.name},</p>
          <p>Thank you for contacting us. Here is our response to your inquiry:</p>
          <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff;">
            ${response.message.replace(/\n/g, '<br>')}
          </div>
          <p>If you have any further questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>Sai Mahendra Platform Team</p>
          <hr>
          <p><small>Inquiry ID: ${inquiry.id}</small></p>
        `,
        text: `Response to your inquiry: ${response.message}`
      });
    } catch (error) {
      logger.error('Failed to send response email:', error);
    }
  }

  private async logCommunication(data: {
    inquiryId: string;
    type: 'email' | 'whatsapp' | 'internal_note';
    direction: 'inbound' | 'outbound';
    content: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO communication_history (id, inquiry_id, type, direction, content, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          data.inquiryId,
          data.type,
          data.direction,
          data.content,
          JSON.stringify(data.metadata || {}),
          new Date()
        ]
      );
    } catch (error) {
      logger.error('Failed to log communication:', error);
    }
  }

  private mapRowToInquiry(row: any): ContactInquiry {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      subject: row.subject,
      message: row.message,
      category: row.category,
      status: row.status,
      createdAt: row.created_at,
      respondedAt: row.responded_at
    };
  }

  private mapRowToResponse(row: any): InquiryResponse {
    return {
      id: row.id,
      inquiryId: row.inquiry_id,
      adminId: row.admin_id,
      message: row.message,
      createdAt: row.created_at
    };
  }
}