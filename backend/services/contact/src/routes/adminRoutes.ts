import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { logger } from '@sai-mahendra/shared-utils';
import { ContactService } from '../services/ContactService';
import { InquiryStatus, InquiryCategory, InquiryFilters } from '../types';

const router = Router();

// Note: In production, these routes should be protected with admin authentication middleware
// For now, we'll implement basic validation

// Validation schemas
const inquiryFiltersSchema = Joi.object({
  status: Joi.string().valid(...Object.values(InquiryStatus)).optional(),
  category: Joi.string().valid(...Object.values(InquiryCategory)).optional(),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  search: Joi.string().max(100).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

const responseSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required().trim(),
  sendEmail: Joi.boolean().default(true)
});

const statusUpdateSchema = Joi.object({
  status: Joi.string().valid(...Object.values(InquiryStatus)).required()
});

/**
 * @route GET /api/admin/contact/inquiries
 * @desc Get all contact inquiries with filters and pagination
 * @access Private (Admin)
 */
router.get('/inquiries', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const { error, value } = inquiryFiltersSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_FILTERS',
          message: 'Invalid filter parameters',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const filters: InquiryFilters = value;
    const contactService: ContactService = req.app.locals.contactService;

    const result = await contactService.getInquiries(filters);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          code: result.error?.code || 'FETCH_FAILED',
          message: result.error?.message || 'Failed to fetch inquiries',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error fetching inquiries:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch inquiries',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route GET /api/admin/contact/inquiries/:id
 * @desc Get detailed inquiry information with responses
 * @access Private (Admin)
 */
router.get('/inquiries/:id', async (req: Request, res: Response) => {
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
      res.json({
        success: true,
        data: result.data
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
    logger.error('Error fetching inquiry details:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch inquiry details',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route POST /api/admin/contact/inquiries/:id/respond
 * @desc Respond to a contact inquiry
 * @access Private (Admin)
 */
router.post('/inquiries/:id/respond', async (req: Request, res: Response) => {
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

    // Validate request body
    const { error, value } = responseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_RESPONSE',
          message: 'Invalid response data',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { message, sendEmail } = value;
    
    // In production, get admin ID from authenticated user
    const adminId = req.headers['x-admin-id'] as string || 'admin-user';

    const contactService: ContactService = req.app.locals.contactService;
    const result = await contactService.respondToInquiry(inquiryId, adminId, message, sendEmail);

    if (result.success) {
      logger.info('Admin responded to inquiry', {
        inquiryId,
        adminId,
        responseId: result.data?.id,
        emailSent: sendEmail
      });

      res.json({
        success: true,
        data: {
          responseId: result.data?.id,
          message: 'Response sent successfully'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          code: result.error?.code || 'RESPONSE_FAILED',
          message: result.error?.message || 'Failed to send response',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error responding to inquiry:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to send response',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route PUT /api/admin/contact/inquiries/:id/status
 * @desc Update inquiry status
 * @access Private (Admin)
 */
router.put('/inquiries/:id/status', async (req: Request, res: Response) => {
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

    // Validate request body
    const { error, value } = statusUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_STATUS',
          message: 'Invalid status value',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { status } = value;
    const contactService: ContactService = req.app.locals.contactService;
    const result = await contactService.updateInquiryStatus(inquiryId, status);

    if (result.success) {
      logger.info('Inquiry status updated', {
        inquiryId,
        newStatus: status,
        adminId: req.headers['x-admin-id'] || 'admin-user'
      });

      res.json({
        success: true,
        data: {
          message: 'Status updated successfully'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          code: result.error?.code || 'STATUS_UPDATE_FAILED',
          message: result.error?.message || 'Failed to update status',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error updating inquiry status:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to update status',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route GET /api/admin/contact/stats
 * @desc Get inquiry statistics and metrics
 * @access Private (Admin)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (dateFrom) {
      fromDate = new Date(dateFrom as string);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            code: 'INVALID_DATE_FROM',
            message: 'Invalid dateFrom format',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }
    }

    if (dateTo) {
      toDate = new Date(dateTo as string);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            code: 'INVALID_DATE_TO',
            message: 'Invalid dateTo format',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }
    }

    const contactService: ContactService = req.app.locals.contactService;
    const result = await contactService.getInquiryStats(fromDate, toDate);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          code: result.error?.code || 'STATS_FETCH_FAILED',
          message: result.error?.message || 'Failed to fetch statistics',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error fetching inquiry stats:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch statistics',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route GET /api/admin/contact/inquiries/:id/history
 * @desc Get communication history for an inquiry
 * @access Private (Admin)
 */
router.get('/inquiries/:id/history', async (req: Request, res: Response) => {
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
    const result = await contactService.getCommunicationHistory(inquiryId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          code: result.error?.code || 'HISTORY_FETCH_FAILED',
          message: result.error?.message || 'Failed to fetch communication history',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error fetching communication history:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch communication history',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * @route GET /api/admin/contact/export
 * @desc Export inquiries data as CSV
 * @access Private (Admin)
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'csv', ...filters } = req.query;

    if (format !== 'csv' && format !== 'json') {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_FORMAT',
          message: 'Export format must be csv or json',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    // Validate filters
    const { error, value } = inquiryFiltersSchema.validate(filters);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_FILTERS',
          message: 'Invalid filter parameters',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const exportFilters: InquiryFilters = { ...value, limit: 10000 }; // Large limit for export
    const contactService: ContactService = req.app.locals.contactService;
    const result = await contactService.getInquiries(exportFilters);

    if (result.success && result.data) {
      const inquiries = result.data.items;

      if (format === 'csv') {
        // Generate CSV
        const csvHeader = 'ID,Name,Email,Phone,Subject,Category,Status,Created At,Responded At\n';
        const csvRows = inquiries.map(inquiry => 
          `"${inquiry.id}","${inquiry.name}","${inquiry.email}","${inquiry.phone || ''}","${inquiry.subject}","${inquiry.category}","${inquiry.status}","${inquiry.createdAt.toISOString()}","${inquiry.respondedAt?.toISOString() || ''}"`
        ).join('\n');

        const csv = csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="inquiries-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="inquiries-${new Date().toISOString().split('T')[0]}.json"`);
        res.json({
          exportDate: new Date().toISOString(),
          totalRecords: inquiries.length,
          filters: exportFilters,
          data: inquiries
        });
      }

      logger.info('Inquiries data exported', {
        format,
        recordCount: inquiries.length,
        adminId: req.headers['x-admin-id'] || 'admin-user'
      });

    } else {
      res.status(400).json({
        success: false,
        error: {
          type: 'BUSINESS_LOGIC_ERROR',
          code: 'EXPORT_FAILED',
          message: 'Failed to export data',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

  } catch (error) {
    logger.error('Error exporting inquiries:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'SYSTEM_ERROR',
        code: 'INTERNAL_ERROR',
        message: 'Export failed',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export { router as adminRoutes };