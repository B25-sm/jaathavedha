import { Request, Response, NextFunction } from 'express';
import { Logger, AppError, ErrorHandler } from '@sai-mahendra/utils';
import { ApiResponse } from '@sai-mahendra/types';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  
  // Handle the error using the utility error handler
  const appError = ErrorHandler.handle(error, requestId);
  
  // Log the error
  Logger.error('Request error', appError, {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Send error response
  const response: ApiResponse = {
    success: false,
    error: appError.toApiError()
  };

  res.status(appError.statusCode).json(response);
}