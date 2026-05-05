import { Pool, PoolClient } from 'pg';
import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

let pgPool: Pool;
let redisClient: RedisClientType;

export const initializeDatabase = async (): Promise<void> => {
  try {
    // Initialize PostgreSQL connection pool
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test PostgreSQL connection
    const client = await pgPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connection established');

    // Initialize Redis client
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    await redisClient.connect();
    logger.info('Redis connection established');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  try {
    if (pgPool) {
      await pgPool.end();
      logger.info('PostgreSQL connection pool closed');
    }

    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pgPool) {
    throw new Error('Database pool not initialized');
  }
  return pgPool;
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  try {
    const result = await pgPool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query error:', { text, error });
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  return await pgPool.connect();
};
