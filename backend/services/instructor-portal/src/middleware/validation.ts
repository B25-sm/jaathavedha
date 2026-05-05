/**
 * Request Validation Middleware for Instructor Portal
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '@sai-mahendra/utils';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      next(new AppError('Validation failed', 400, errorDetails));
      return;
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      next(new AppError('Query validation failed', 400, errorDetails));
      return;
    }

    // Replace request query with validated data
    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      next(new AppError('Parameter validation failed', 400, errorDetails));
      return;
    }

    // Replace request params with validated data
    req.params = value;
    next();
  };
};

export const validateFileUpload = (
  allowedTypes: string[] = [],
  maxSize: number = 10 * 1024 * 1024, // 10MB default
  maxFiles: number = 10
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      next(new AppError('No files provided', 400));
      return;
    }

    if (files.length > maxFiles) {
      next(new AppError(`Maximum ${maxFiles} files allowed`, 400));
      return;
    }

    for (const file of files) {
      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        next(new AppError(`Invalid file type: ${file.mimetype}`, 400));
        return;
      }

      // Check file size
      if (file.size > maxSize) {
        next(new AppError(`File ${file.originalname} exceeds maximum size of ${maxSize} bytes`, 400));
        return;
      }

      // Check for potentially dangerous file names
      if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        next(new AppError(`Invalid file name: ${file.originalname}`, 400));
        return;
      }
    }

    next();
  };
};