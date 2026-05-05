/**
 * Request Validation Middleware
 * Validates request data using Joi schemas
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    // Validate query
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    // Validate params
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
};

export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  if (limit < 1 || limit > 100) {
    res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'INVALID_PAGINATION',
        message: 'Limit must be between 1 and 100',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (offset < 0) {
    res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'INVALID_PAGINATION',
        message: 'Offset must be non-negative',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  req.query.limit = limit.toString();
  req.query.offset = offset.toString();

  next();
};
