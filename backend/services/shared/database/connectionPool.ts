import { Pool, PoolConfig, PoolClient, QueryResult } from 'pg';
import winston from 'winston';

export interface DatabasePoolConfig extends PoolConfig {
  // Connection pool settings
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  
  // Performance settings
  statement_timeout?: number;
  query_timeout?: number;
  
  // Monitoring
  enableMonitoring?: boolean;
}

export class DatabaseConnectionPool {
  private pool: Pool;
  private logger: winston.Logger;
  private config: DatabasePoolConfig;
  private stats = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalQueryTime: 0,
    slowQueries: 0,
  };

  constructor(config: DatabasePoolConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;

    // Create pool with optimized settings
    this.pool = new Pool({
      ...config,
      // Optimized defaults
      min: config.min || 2,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
      
      // Statement timeout (30 seconds default)
      statement_timeout: config.statement_timeout || 30000,
      query_timeout: config.query_timeout || 30000,
    });

    // Pool event handlers
    this.pool.on('connect', (client) => {
      this.logger.debug('New database client connected');
    });

    this.pool.on('acquire', (client) => {
      this.logger.debug('Client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      this.logger.debug('Client removed from pool');
    });

    this.pool.on('error', (err, client) => {
      this.logger.error('Unexpected database pool error:', err);
    });

    // Log pool stats periodically if monitoring is enabled
    if (config.enableMonitoring) {
      setInterval(() => {
        this.logPoolStats();
      }, 60000); // Every minute
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      const result = await this.pool.query<T>(text, params);
      
      const duration = Date.now() - startTime;
      this.stats.successfulQueries++;
      this.stats.totalQueryTime += duration;

      // Log slow queries (> 1 second)
      if (duration > 1000) {
        this.stats.slowQueries++;
        this.logger.warn('Slow query detected', {
          duration: `${duration}ms`,
          query: text.substring(0, 100),
        });
      }

      return result;
    } catch (error: any) {
      this.stats.failedQueries++;
      this.logger.error('Query execution error:', {
        error: error.message,
        query: text.substring(0, 100),
        params,
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transaction management
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a batch of queries efficiently
   */
  async batchQuery<T = any>(
    queries: Array<{ text: string; params?: any[] }>
  ): Promise<QueryResult<T>[]> {
    const client = await this.getClient();
    
    try {
      const results: QueryResult<T>[] = [];
      
      for (const query of queries) {
        const result = await client.query<T>(query.text, query.params);
        results.push(result);
      }
      
      return results;
    } finally {
      client.release();
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const avgQueryTime = this.stats.totalQueries > 0
      ? this.stats.totalQueryTime / this.stats.totalQueries
      : 0;

    return {
      pool: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      },
      queries: {
        total: this.stats.totalQueries,
        successful: this.stats.successfulQueries,
        failed: this.stats.failedQueries,
        slow: this.stats.slowQueries,
        avgTime: Math.round(avgQueryTime),
      },
    };
  }

  /**
   * Log pool statistics
   */
  private logPoolStats() {
    const stats = this.getStats();
    this.logger.info('Database pool statistics', stats);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Close the pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Database connection pool closed');
  }
}

/**
 * Query builder helper for common patterns
 */
export class QueryBuilder {
  private conditions: string[] = [];
  private params: any[] = [];
  private paramCounter = 1;

  /**
   * Add a WHERE condition
   */
  where(field: string, operator: string, value: any): this {
    this.conditions.push(`${field} ${operator} $${this.paramCounter}`);
    this.params.push(value);
    this.paramCounter++;
    return this;
  }

  /**
   * Add an IN condition
   */
  whereIn(field: string, values: any[]): this {
    if (values.length === 0) {
      return this;
    }

    const placeholders = values.map(() => `$${this.paramCounter++}`).join(', ');
    this.conditions.push(`${field} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  /**
   * Add a LIKE condition
   */
  whereLike(field: string, pattern: string): this {
    this.conditions.push(`${field} LIKE $${this.paramCounter}`);
    this.params.push(pattern);
    this.paramCounter++;
    return this;
  }

  /**
   * Build the WHERE clause
   */
  build(): { where: string; params: any[] } {
    return {
      where: this.conditions.length > 0 ? `WHERE ${this.conditions.join(' AND ')}` : '',
      params: this.params,
    };
  }
}

export default DatabaseConnectionPool;
