/**
 * PostgreSQL Database Connection and Query Utilities
 * Provides connection pooling, query helpers, and transaction management
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '@sai-mahendra/utils';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface QueryOptions {
  timeout?: number;
  logQuery?: boolean;
}

export class PostgresDatabase {
  private pool: Pool;
  private isConnected = false;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      logger.debug('New PostgreSQL client connected');
    });

    this.pool.on('error', (err) => {
      logger.error('PostgreSQL pool error:', err);
    });

    this.pool.on('remove', () => {
      logger.debug('PostgreSQL client removed from pool');
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('PostgreSQL database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('PostgreSQL database disconnected');
    } catch (error) {
      logger.error('Error disconnecting from PostgreSQL:', error);
      throw error;
    }
  }

  async query<T = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      if (options.logQuery) {
        logger.debug('Executing query:', { text, params });
      }

      const result = await this.pool.query<T>(text, params);
      
      const duration = Date.now() - startTime;
      logger.debug(`Query executed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query failed:', {
        text,
        params,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  async queryOne<T = any>(
    text: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<T | null> {
    const result = await this.query<T>(text, params, options);
    return result.rows[0] || null;
  }

  async queryMany<T = any>(
    text: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<T[]> {
    const result = await this.query<T>(text, params, options);
    return result.rows;
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async exists(table: string, conditions: Record<string, any>): Promise<boolean> {
    const whereClause = Object.keys(conditions)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(' AND ');
    
    const query = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${whereClause})`;
    const values = Object.values(conditions);
    
    const result = await this.queryOne<{ exists: boolean }>(query, values);
    return result?.exists || false;
  }

  async count(table: string, conditions?: Record<string, any>): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    let values: any[] = [];
    
    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      values = Object.values(conditions);
    }
    
    const result = await this.queryOne<{ count: string }>(query, values);
    return parseInt(result?.count || '0', 10);
  }

  async insert<T = any>(
    table: string,
    data: Record<string, any>,
    returning = '*'
  ): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING ${returning}
    `;
    
    const result = await this.queryOne<T>(query, values);
    if (!result) {
      throw new Error(`Failed to insert into ${table}`);
    }
    
    return result;
  }

  async update<T = any>(
    table: string,
    data: Record<string, any>,
    conditions: Record<string, any>,
    returning = '*'
  ): Promise<T | null> {
    const setClause = Object.keys(data)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const whereClause = Object.keys(conditions)
      .map((key, index) => `${key} = $${Object.keys(data).length + index + 1}`)
      .join(' AND ');
    
    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING ${returning}
    `;
    
    const values = [...Object.values(data), ...Object.values(conditions)];
    return this.queryOne<T>(query, values);
  }

  async delete(
    table: string,
    conditions: Record<string, any>
  ): Promise<number> {
    const whereClause = Object.keys(conditions)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(' AND ');
    
    const query = `DELETE FROM ${table} WHERE ${whereClause}`;
    const values = Object.values(conditions);
    
    const result = await this.query(query, values);
    return result.rowCount || 0;
  }

  getPool(): Pool {
    return this.pool;
  }

  isHealthy(): boolean {
    return this.isConnected && this.pool.totalCount > 0;
  }

  getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected
    };
  }
}

// Singleton instance
let dbInstance: PostgresDatabase | null = null;

export function createDatabase(config: DatabaseConfig): PostgresDatabase {
  if (!dbInstance) {
    dbInstance = new PostgresDatabase(config);
  }
  return dbInstance;
}

export function getDatabase(): PostgresDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call createDatabase() first.');
  }
  return dbInstance;
}