import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { logger } from '../index';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors: any[] = [];
    errors.array().map(err => extractedErrors.push({ 
      field: (err as any).param, 
      message: err.msg 
    }));

    logger.warn('Validation errors:', { errors: extractedErrors, path: req.path });

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: extractedErrors
    });
  };
};
