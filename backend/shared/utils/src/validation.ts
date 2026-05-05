import Joi from 'joi';
import { UserRole, ProgramCategory, PaymentGateway } from '@sai-mahendra/types';

export const ValidationSchemas = {
  // User validation schemas
  userRegistration: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
  }),

  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  userProfileUpdate: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
  }),

  passwordReset: Joi.object({
    email: Joi.string().email().required()
  }),

  passwordResetConfirm: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
  }),

  // Program validation schemas
  programCreate: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().min(10).max(2000).required(),
    category: Joi.string().valid(...Object.values(ProgramCategory)).required(),
    price: Joi.number().min(0).required(),
    durationWeeks: Joi.number().integer().min(1).max(104).required(),
    features: Joi.object().optional()
  }),

  // Enrollment validation schemas
  enrollmentCreate: Joi.object({
    programId: Joi.string().uuid().required()
  }),

  // Payment validation schemas
  paymentCreate: Joi.object({
    programId: Joi.string().uuid().required(),
    gateway: Joi.string().valid(...Object.values(PaymentGateway)).required(),
    amount: Joi.number().min(0).required(),
    currency: Joi.string().length(3).uppercase().required()
  }),

  // Contact form validation schemas
  contactSubmit: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    subject: Joi.string().min(5).max(200).required(),
    message: Joi.string().min(10).max(2000).required(),
    category: Joi.string().valid('general', 'enrollment', 'technical_support', 'billing').required()
  }),

  // Common validation schemas
  uuid: Joi.string().uuid(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
};

export class ValidationUtils {
  /**
   * Validate data against a Joi schema
   */
  static validate<T>(data: any, schema: Joi.Schema): { value: T; error?: Joi.ValidationError } {
    const result = schema.validate(data, { abortEarly: false, stripUnknown: true });
    return {
      value: result.value,
      error: result.error
    };
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Sanitize string input to prevent XSS
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }
}