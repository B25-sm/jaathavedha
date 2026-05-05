import { ContactInquiry, InquiryCategory, InquiryStatus } from '@sai-mahendra/shared-types';

// Extended Contact Types
export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category: InquiryCategory;
  recaptchaToken?: string;
}

export interface InquiryResponse {
  id: string;
  inquiryId: string;
  adminId: string;
  message: string;
  createdAt: Date;
}

export interface ContactInquiryWithResponses extends ContactInquiry {
  responses: InquiryResponse[];
}

// WhatsApp Types
export interface WhatsAppConfig {
  businessAccountId: string;
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
}

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text: {
            body: string;
          };
          type: string;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

// Email Types
export interface EmailConfig {
  sendgridApiKey: string;
  fromEmail: string;
  adminEmail: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

// Communication History
export interface CommunicationHistory {
  id: string;
  inquiryId: string;
  type: 'email' | 'whatsapp' | 'internal_note';
  direction: 'inbound' | 'outbound';
  content: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Admin Types
export interface InquiryFilters {
  status?: InquiryStatus;
  category?: InquiryCategory;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InquiryStats {
  total: number;
  byStatus: Record<InquiryStatus, number>;
  byCategory: Record<InquiryCategory, number>;
  averageResponseTime: number; // in hours
  resolutionRate: number; // percentage
}

// Validation Schemas
export interface ContactFormValidation {
  name: {
    required: true;
    minLength: 2;
    maxLength: 100;
  };
  email: {
    required: true;
    format: 'email';
  };
  phone: {
    required: false;
    format: 'phone';
  };
  subject: {
    required: true;
    minLength: 5;
    maxLength: 200;
  };
  message: {
    required: true;
    minLength: 10;
    maxLength: 2000;
  };
  category: {
    required: true;
    enum: InquiryCategory[];
  };
}

// Service Response Types
export interface ContactServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Notification Types
export interface NotificationPayload {
  type: 'new_inquiry' | 'inquiry_response' | 'status_change';
  inquiryId: string;
  data: Record<string, any>;
  recipients: string[];
}

// Spam Protection
export interface SpamCheckResult {
  isSpam: boolean;
  confidence: number;
  reasons: string[];
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}

export { ContactInquiry, InquiryCategory, InquiryStatus };