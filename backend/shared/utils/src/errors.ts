import { ApiError, ErrorType } from '@sai-mahendra/types';

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly requestId?: string;

  constructor(
    type: ErrorType,
    code: string,
    message: string,
    statusCode: number = 500,
    details?: any,
    requestId?: string
  ) {
    super(message);
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
    this.name = 'AppError';

    Error.captureStackTrace(this, this.constructor);
  }

  toApiError(): ApiError {
    return {
      type: this.type,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date(),
      requestId: this.requestId || 'unknown'
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any, requestId?: string) {
    super(ErrorType.VALIDATION_ERROR, 'VALIDATION_FAILED', message, 400, details, requestId);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', requestId?: string) {
    super(ErrorType.AUTHENTICATION_ERROR, 'AUTH_FAILED', message, 401, undefined, requestId);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', requestId?: string) {
    super(ErrorType.AUTHORIZATION_ERROR, 'ACCESS_DENIED', message, 403, undefined, requestId);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, requestId?: string) {
    super(ErrorType.BUSINESS_LOGIC_ERROR, 'NOT_FOUND', `${resource} not found`, 404, undefined, requestId);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any, requestId?: string) {
    super(ErrorType.BUSINESS_LOGIC_ERROR, 'CONFLICT', message, 409, details, requestId);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any, requestId?: string) {
    super(
      ErrorType.EXTERNAL_SERVICE_ERROR,
      'EXTERNAL_SERVICE_ERROR',
      `${service}: ${message}`,
      502,
      details,
      requestId
    );
  }
}

export class SystemError extends AppError {
  constructor(message: string, details?: any, requestId?: string) {
    super(ErrorType.SYSTEM_ERROR, 'SYSTEM_ERROR', message, 500, details, requestId);
  }
}

export class ErrorHandler {
  /**
   * Handle different types of errors and convert them to AppError
   */
  static handle(error: any, requestId?: string): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error.name === 'ValidationError') {
      return new ValidationError(error.message, error.details, requestId);
    }

    if (error.name === 'JsonWebTokenError') {
      return new AuthenticationError('Invalid token', requestId);
    }

    if (error.name === 'TokenExpiredError') {
      return new AuthenticationError('Token expired', requestId);
    }

    if (error.code === '23505') { // PostgreSQL unique violation
      return new ConflictError('Resource already exists', { constraint: error.constraint }, requestId);
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
      return new ValidationError('Referenced resource does not exist', { constraint: error.constraint }, requestId);
    }

    // Default to system error
    return new SystemError(error.message || 'An unexpected error occurred', { originalError: error.stack }, requestId);
  }

  /**
   * Check if error is operational (expected) or programming error
   */
  static isOperationalError(error: Error): boolean {
    return error instanceof AppError;
  }
}