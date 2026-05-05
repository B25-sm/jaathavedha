import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

export const validateRequest = (schema: Joi.ObjectSchema) => {
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

      logger.warn('Request validation failed', { errors });

      res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_REQUEST_DATA',
          message: 'Request validation failed',
          details: errors,
        },
      });
      return;
    }

    req.body = value;
    next();
  };
};

export const createMeetingSchema = Joi.object({
  provider: Joi.string().valid('zoom', 'google_meet').required(),
  session_id: Joi.string().uuid().required(),
  instructor_id: Joi.string().uuid().required(),
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  start_time: Joi.date().iso().greater('now').required(),
  duration_minutes: Joi.number().integer().min(15).max(480).required(),
  timezone: Joi.string().optional(),
  settings: Joi.object({
    waiting_room: Joi.boolean().optional(),
    auto_recording: Joi.boolean().optional(),
    mute_upon_entry: Joi.boolean().optional(),
    allow_screen_sharing: Joi.boolean().optional(),
    allow_chat: Joi.boolean().optional(),
    host_video: Joi.boolean().optional(),
    participant_video: Joi.boolean().optional(),
  }).optional(),
  attendee_emails: Joi.array().items(Joi.string().email()).optional(),
});

export const updateMeetingSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  start_time: Joi.date().iso().greater('now').optional(),
  duration_minutes: Joi.number().integer().min(15).max(480).optional(),
  settings: Joi.object({
    waiting_room: Joi.boolean().optional(),
    auto_recording: Joi.boolean().optional(),
    mute_upon_entry: Joi.boolean().optional(),
    allow_screen_sharing: Joi.boolean().optional(),
    allow_chat: Joi.boolean().optional(),
    host_video: Joi.boolean().optional(),
    participant_video: Joi.boolean().optional(),
  }).optional(),
}).min(1);

export const recordAttendanceSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  join_time: Joi.date().iso().required(),
  leave_time: Joi.date().iso().optional(),
});
