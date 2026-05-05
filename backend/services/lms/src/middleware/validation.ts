/**
 * Request Validation Middleware
 * Validates request data using Joi schemas
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

/**
 * Middleware factory to validate requests against Joi schemas
 */
export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => detail.message));
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => detail.message));
      }
    }

    // Validate URL parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => detail.message));
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_REQUEST_DATA',
          message: 'Request validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
}

// Export as 'validate' for convenience
export const validate = validateRequest;

/**
 * Validate pagination parameters
 */
export function validatePagination(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (page < 1) {
    res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'INVALID_PAGE',
        message: 'Page number must be greater than 0',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  if (limit < 1 || limit > 100) {
    res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'INVALID_LIMIT',
        message: 'Limit must be between 1 and 100',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  req.query.page = page.toString();
  req.query.limit = limit.toString();

  next();
}
