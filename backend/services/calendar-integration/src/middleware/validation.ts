import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

/**
 * Validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Validation error:', { errors });

      res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_INPUT',
          message: 'Validation failed',
          details: errors,
        },
      });
      return;
    }

    req.body = value;
    next();
  };
};

/**
 * Validation schemas
 */
export const schemas = {
  createEvent: Joi.object({
    sessionId: Joi.string().uuid().optional(),
    enrollmentId: Joi.string().uuid().optional(),
    title: Joi.string().required().max(500),
    description: Joi.string().optional().allow(''),
    location: Joi.string().optional().allow(''),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
    timezone: Joi.string().optional(),
    meetingUrl: Joi.string().uri().optional().allow(''),
    attendees: Joi.array().items(Joi.string().email()).optional(),
    reminders: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().valid('email', 'popup', 'notification').required(),
          minutesBefore: Joi.number().integer().min(0).max(10080).required(),
        })
      )
      .optional(),
  }),

  updateEvent: Joi.object({
    title: Joi.string().max(500).optional(),
    description: Joi.string().optional().allow(''),
    location: Joi.string().optional().allow(''),
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    timezone: Joi.string().optional(),
    meetingUrl: Joi.string().uri().optional().allow(''),
    attendees: Joi.array().items(Joi.string().email()).optional(),
    reminders: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().valid('email', 'popup', 'notification').required(),
          minutesBefore: Joi.number().integer().min(0).max(10080).required(),
        })
      )
      .optional(),
    status: Joi.string().valid('scheduled', 'cancelled', 'completed', 'rescheduled').optional(),
  }),

  syncPreferences: Joi.object({
    autoSyncEnabled: Joi.boolean().optional(),
    syncInterval: Joi.number().integer().min(5).max(1440).optional(),
    providers: Joi.array().items(Joi.string().valid('google', 'outlook')).optional(),
    syncPastEvents: Joi.boolean().optional(),
    syncFutureEvents: Joi.boolean().optional(),
    daysInPast: Joi.number().integer().min(0).max(365).optional(),
    daysInFuture: Joi.number().integer().min(0).max(365).optional(),
  }),

  syncEnrollment: Joi.object({
    enrollmentId: Joi.string().uuid().required(),
  }),
};

export default { validate, schemas };
