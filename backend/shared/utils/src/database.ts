import { Pool, PoolClient } from 'pg';
import { DatabaseConfig } from '@sai-mahendra/types';
import { Logger } from './logger';

export class DatabaseUtils {
  private static pool: Pool;

  /**
   * Initialize database connection pool
   */
  static initialize(config: DatabaseConfig): void {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    this.pool.on('error', (err) => {
      Logger.error('Unexpected error on idle client', err);
    });

    Logger.info('Database connection pool initialized');
  }

  /**
   * Get a client from the pool
   */
  static async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool.connect();
  }

  /**
   * Execute a query with automatic client management
   */
  static async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  static async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
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
   * Close all connections in the pool
   */
  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      Logger.info('Database connection pool closed');
    }
  }

  /**
   * Check database connection health
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rows.length === 1;
    } catch (error) {
      Logger.error('Database health check failed', error as Error);
      return false;
    }
  }

  /**
   * Build WHERE clause from filters
   */
  static buildWhereClause(filters: Record<string, any>): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...value);
        } else {
          conditions.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  /**
   * Build pagination clause
   */
  static buildPaginationClause(page: number, limit: number): { clause: string; params: any[] } {
    const offset = (page - 1) * limit;
    return {
      clause: `LIMIT $${1} OFFSET $${2}`,
      params: [limit, offset]
    };
  }
}