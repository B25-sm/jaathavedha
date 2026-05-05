import { Pool } from 'pg';
import { createClient as createRedisClient, RedisClientType } from 'redis';
import { MongoClient } from 'mongodb';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      message?: string;
      details?: any;
    };
  };
  uptime: number;
  version: string;
}

export interface HealthCheckConfig {
  serviceName: string;
  version: string;
  postgres?: {
    pool: Pool;
    timeout?: number;
  };
  redis?: {
    client: RedisClientType;
    timeout?: number;
  };
  mongodb?: {
    client: MongoClient;
    timeout?: number;
  };
  externalServices?: {
    name: string;
    url: string;
    timeout?: number;
    method?: 'GET' | 'POST' | 'HEAD';
  }[];
  customChecks?: {
    name: string;
    check: () => Promise<{ status: 'up' | 'down' | 'degraded'; message?: string; details?: any }>;
  }[];
}

export class HealthCheckService {
  private config: HealthCheckConfig;
  private startTime: Date;

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.startTime = new Date();
  }

  /**
   * Perform comprehensive health check
   */
  async check(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};
    const checkPromises: Promise<void>[] = [];

    // Check PostgreSQL
    if (this.config.postgres) {
      checkPromises.push(
        this.checkPostgres(this.config.postgres).then((result) => {
          checks.postgres = result;
        })
      );
    }

    // Check Redis
    if (this.config.redis) {
      checkPromises.push(
        this.checkRedis(this.config.redis).then((result) => {
          checks.redis = result;
        })
      );
    }

    // Check MongoDB
    if (this.config.mongodb) {
      checkPromises.push(
        this.checkMongoDB(this.config.mongodb).then((result) => {
          checks.mongodb = result;
        })
      );
    }

    // Check external services
    if (this.config.externalServices) {
      for (const service of this.config.externalServices) {
        checkPromises.push(
          this.checkExternalService(service).then((result) => {
            checks[service.name] = result;
          })
        );
      }
    }

    // Run custom checks
    if (this.config.customChecks) {
      for (const customCheck of this.config.customChecks) {
        checkPromises.push(
          this.runCustomCheck(customCheck).then((result) => {
            checks[customCheck.name] = result;
          })
        );
      }
    }

    // Wait for all checks to complete
    await Promise.all(checkPromises);

    // Determine overall status
    const status = this.determineOverallStatus(checks);

    return {
      status,
      timestamp: new Date(),
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      version: this.config.version,
    };
  }

  /**
   * Lightweight readiness check (for Kubernetes readiness probe)
   */
  async ready(): Promise<boolean> {
    try {
      // Check critical dependencies only
      const criticalChecks: Promise<boolean>[] = [];

      if (this.config.postgres) {
        criticalChecks.push(
          this.checkPostgres(this.config.postgres).then((r) => r.status === 'up')
        );
      }

      if (this.config.redis) {
        criticalChecks.push(
          this.checkRedis(this.config.redis).then((r) => r.status === 'up')
        );
      }

      const results = await Promise.all(criticalChecks);
      return results.every((r) => r === true);
    } catch (error) {
      return false;
    }
  }

  /**
   * Lightweight liveness check (for Kubernetes liveness probe)
   */
  async alive(): Promise<boolean> {
    // Simple check that the service is running
    return true;
  }

  /**
   * Check PostgreSQL connection
   */
  private async checkPostgres(config: {
    pool: Pool;
    timeout?: number;
  }): Promise<HealthCheckResult['checks'][string]> {
    const start = Date.now();
    const timeout = config.timeout || 5000;

    try {
      const client = await Promise.race([
        config.pool.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);

      try {
        await client.query('SELECT 1');
        const responseTime = Date.now() - start;

        // Check connection pool stats
        const poolStats = {
          total: config.pool.totalCount,
          idle: config.pool.idleCount,
          waiting: config.pool.waitingCount,
        };

        return {
          status: 'up',
          responseTime,
          details: poolStats,
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedis(config: {
    client: RedisClientType;
    timeout?: number;
  }): Promise<HealthCheckResult['checks'][string]> {
    const start = Date.now();
    const timeout = config.timeout || 5000;

    try {
      const pong = await Promise.race([
        config.client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);

      const responseTime = Date.now() - start;

      if (pong === 'PONG') {
        // Get Redis info
        const info = await config.client.info('stats');
        const connections = info.match(/connected_clients:(\d+)/)?.[1];

        return {
          status: 'up',
          responseTime,
          details: {
            connections: connections ? parseInt(connections) : 'unknown',
          },
        };
      }

      return {
        status: 'down',
        responseTime,
        message: 'Invalid PING response',
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check MongoDB connection
   */
  private async checkMongoDB(config: {
    client: MongoClient;
    timeout?: number;
  }): Promise<HealthCheckResult['checks'][string]> {
    const start = Date.now();
    const timeout = config.timeout || 5000;

    try {
      const adminDb = config.client.db().admin();
      
      const ping = await Promise.race([
        adminDb.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);

      const responseTime = Date.now() - start;

      if (ping.ok === 1) {
        return {
          status: 'up',
          responseTime,
        };
      }

      return {
        status: 'down',
        responseTime,
        message: 'MongoDB ping failed',
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check external service
   */
  private async checkExternalService(config: {
    name: string;
    url: string;
    timeout?: number;
    method?: 'GET' | 'POST' | 'HEAD';
  }): Promise<HealthCheckResult['checks'][string]> {
    const start = Date.now();
    const timeout = config.timeout || 10000;
    const method = config.method || 'GET';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(config.url, {
        method,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - start;

      if (response.ok) {
        return {
          status: 'up',
          responseTime,
          details: {
            statusCode: response.status,
          },
        };
      }

      return {
        status: 'degraded',
        responseTime,
        message: `HTTP ${response.status}`,
        details: {
          statusCode: response.status,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run custom health check
   */
  private async runCustomCheck(config: {
    name: string;
    check: () => Promise<{ status: 'up' | 'down' | 'degraded'; message?: string; details?: any }>;
  }): Promise<HealthCheckResult['checks'][string]> {
    const start = Date.now();

    try {
      const result = await config.check();
      const responseTime = Date.now() - start;

      return {
        ...result,
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(
    checks: HealthCheckResult['checks']
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map((c) => c.status);

    // If any critical check is down, service is unhealthy
    if (statuses.includes('down')) {
      const downCount = statuses.filter((s) => s === 'down').length;
      const totalCount = statuses.length;

      // If more than 50% of checks are down, service is unhealthy
      if (downCount / totalCount > 0.5) {
        return 'unhealthy';
      }

      // Otherwise, service is degraded
      return 'degraded';
    }

    // If any check is degraded, service is degraded
    if (statuses.includes('degraded')) {
      return 'degraded';
    }

    // All checks passed
    return 'healthy';
  }

  /**
   * Get service uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get service version
   */
  getVersion(): string {
    return this.config.version;
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.config.serviceName;
  }
}

/**
 * Express middleware for health check endpoints
 */
export function createHealthCheckMiddleware(healthCheck: HealthCheckService) {
  return {
    // Full health check endpoint
    health: async (req: any, res: any) => {
      try {
        const result = await healthCheck.check();
        const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(result);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },

    // Readiness probe endpoint
    ready: async (req: any, res: any) => {
      try {
        const isReady = await healthCheck.ready();
        if (isReady) {
          res.status(200).json({ status: 'ready' });
        } else {
          res.status(503).json({ status: 'not ready' });
        }
      } catch (error) {
        res.status(503).json({ status: 'not ready' });
      }
    },

    // Liveness probe endpoint
    alive: async (req: any, res: any) => {
      try {
        const isAlive = await healthCheck.alive();
        if (isAlive) {
          res.status(200).json({ status: 'alive' });
        } else {
          res.status(503).json({ status: 'dead' });
        }
      } catch (error) {
        res.status(503).json({ status: 'dead' });
      }
    },
  };
}
