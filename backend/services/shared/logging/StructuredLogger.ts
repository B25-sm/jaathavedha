import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

export interface LogContext {
  service: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any;
}

export class StructuredLogger {
  private logger: winston.Logger;
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = context;

    const transports: winston.transport[] = [
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}] [${this.context.service}]: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta) : ''
            }`;
          })
        ),
      }),
    ];

    // Add Elasticsearch transport in production
    if (process.env.NODE_ENV === 'production' && process.env.ELASTICSEARCH_URL) {
      transports.push(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL,
          },
          index: 'logstash',
          indexPrefix: 'logstash',
          indexSuffixPattern: 'YYYY.MM.DD',
          transformer: (logData: any) => {
            return {
              '@timestamp': new Date().toISOString(),
              message: logData.message,
              level: logData.level,
              service: this.context.service,
              ...this.context,
              ...logData.meta,
            };
          },
        })
      );
    }

    // File transport for production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new winston.transports.File({
          filename: `logs/${this.context.service}-error.log`,
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        }),
        new winston.transports.File({
          filename: `logs/${this.context.service}-combined.log`,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: this.context,
      transports,
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): StructuredLogger {
    return new StructuredLogger({
      ...this.context,
      ...additionalContext,
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.logger.error(message, {
      ...meta,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : undefined,
    });
  }

  /**
   * Log HTTP request
   */
  logRequest(req: any, res: any, duration: number): void {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.id,
    });
  }

  /**
   * Log database query
   */
  logQuery(query: string, duration: number, params?: any[]): void {
    this.debug('Database Query', {
      query,
      duration,
      params: params ? JSON.stringify(params) : undefined,
    });
  }

  /**
   * Log external API call
   */
  logExternalCall(
    service: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number
  ): void {
    this.info('External API Call', {
      externalService: service,
      method,
      url,
      statusCode,
      duration,
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(event: string, data: Record<string, any>): void {
    this.info('Business Event', {
      event,
      ...data,
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: string, data: Record<string, any>): void {
    this.warn('Security Event', {
      event,
      ...data,
    });
  }
}

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware(logger: StructuredLogger) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    // Generate request ID if not present
    req.id = req.id || generateRequestId();

    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.id);

    // Create child logger with request context
    req.logger = logger.child({
      requestId: req.id,
      userId: req.user?.id,
    });

    // Log when response finishes
    res.on('finish', () => {
      const duration = Date.now() - start;
      req.logger.logRequest(req, res, duration);
    });

    next();
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create logger instance for a service
 */
export function createLogger(serviceName: string): StructuredLogger {
  return new StructuredLogger({ service: serviceName });
}
