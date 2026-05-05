import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { logger } from '@sai-mahendra/shared-utils';
import { ContactService } from '../services/ContactService';
import { ContactFormData, InquiryCategory } from '../types';

const router = Router();

// Validation schemas
const contactFormSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().trim(),
  email: Joi.string().email().required().lowercase().trim(),
  phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional().allow(''),
  subject: Joi.string().min(5).max(200).required().trim(),
  message: Joi.string().min(10).max(2000).required().trim(),
  category: Joi.string().valid(...Object.values(InquiryCategory)).required(),
  recaptchaToken: Joi.string().optional()
});

/**
 * @route POST /api/contact/submit
 * @desc Submit a new contact inquiry
 * @access Public
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = contactFormSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_INPUT',
          message: 'Invalid form data',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const formData: ContactFormData = value;
    const contactService: ContactService = req.app.locals.contactService;

    // Verify reCAPTCHA if token provided
    if (formData.recaptchaToken) {
      const isValidRecaptcha = await verifyRecaptcha(formData.recaptchaToken);
      if (!isValidRecaptcha) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            code: 'INVALID_RECAPTCHA',
            message: 'reCAPTCHA verification failed',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }
    }

    // Submit inquiry
    const result = await contactService.submitInquiry(formData);

    if (result.success) {
      logger.info('Contact form submitted successfully', {
        inquiryId: result.data?.id,
        email: formData.email,
        category: formData.category,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        data: {
          inquiryId: result.data?.id,
          message: 'Your inquiry has been submitted successfully. We will get back to you within 24 hours.'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          code: result.error?.code || 'SUBMISSION_FAILED',
          message: result.error?.message || 'Failed to submit inquiry',
          details: result.error?.details,
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error in contact form submission:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred. Please try again later.',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route GET /api/contact/inquiry/:id
 * @desc Get inquiry details by ID (for user reference)
 * @access Public (with inquiry ID)
 */
router.get('/inquiry/:id', async (req: Request, res: Response) => {
  try {
    const inquiryId = req.params.id;
    
    if (!inquiryId || inquiryId.length !== 36) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_INQUIRY_ID',
          message: 'Invalid inquiry ID format',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const contactService: ContactService = req.app.locals.contactService;
    const result = await contactService.getInquiry(inquiryId);

    if (result.success && result.data) {
      // Return limited information for public access
      const publicData = {
        id: result.data.id,
        subject: result.data.subject,
        category: result.data.category,
        status: result.data.status,
        createdAt: result.data.createdAt,
        respondedAt: result.data.respondedAt
      };

      res.json({
        success: true,
        data: publicData
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND',
          code: 'INQUIRY_NOT_FOUND',
          message: 'Inquiry not found',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error getting inquiry:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route GET /api/contact/categories
 * @desc Get available inquiry categories
 * @access Public
 */
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = Object.values(InquiryCategory).map(category => ({
      value: category,
      label: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route POST /api/contact/verify-email
 * @desc Verify email deliverability
 * @access Public
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_EMAIL',
          message: 'Valid email address is required',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const emailService = req.app.locals.emailService;
    const verification = await emailService.verifyEmail(email);

    res.json({
      success: true,
      data: verification
    });

  } catch (error) {
    logger.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Email verification failed',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

// Helper function to verify reCAPTCHA
async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      logger.warn('reCAPTCHA secret key not configured');
      return true; // Skip verification if not configured
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`
    });

    const data = await response.json();
    return data.success === true;

  } catch (error) {
    logger.error('reCAPTCHA verification error:', error);
    return false;
  }
}

export { router as contactRoutes };