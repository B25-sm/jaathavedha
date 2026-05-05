import { Pool, PoolClient } from 'pg';
import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis client
let redisClient: RedisClientType;

export const initializeDatabase = async (): Promise<void> => {
  try {
    // Test PostgreSQL connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connection established successfully');

    // Initialize Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    await redisClient.connect();
    logger.info('Redis connection established successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

export const getPool = (): Pool => pool;

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query error:', { text, error });
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

export const closeDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    if (redisClient) {
      await redisClient.quit();
    }
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
};

export default {
  initializeDatabase,
  getPool,
  getRedisClient,
  query,
  getClient,
  closeDatabase,
};
