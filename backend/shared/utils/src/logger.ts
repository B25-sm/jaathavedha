import winston from 'winston';

export class Logger {
  private static instance: winston.Logger;

  static getInstance(): winston.Logger {
    if (!this.instance) {
      this.instance = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        defaultMeta: { service: process.env.SERVICE_NAME || 'backend-service' },
        transports: [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' })
        ]
      });

      // Add console transport for development
      if (process.env.NODE_ENV !== 'production') {
        this.instance.add(new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }));
      }
    }

    return this.instance;
  }

  static info(message: string, meta?: any): void {
    this.getInstance().info(message, meta);
  }

  static error(message: string, error?: Error, meta?: any): void {
    this.getInstance().error(message, { error: error?.stack, ...meta });
  }

  static warn(message: string, meta?: any): void {
    this.getInstance().warn(message, meta);
  }

  static debug(message: string, meta?: any): void {
    this.getInstance().debug(message, meta);
  }

  static http(message: string, meta?: any): void {
    this.getInstance().http(message, meta);
  }
}