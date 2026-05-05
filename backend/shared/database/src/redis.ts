/**
 * Redis Connection and Caching Utilities
 * Provides connection management, caching, pub/sub, and session storage
 */

import { createClient, RedisClientType, RedisModules, RedisFunctions, RedisScripts } from 'redis';
import { logger } from '@sai-mahendra/utils';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean;
}

type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

export class RedisCache {
  private client: RedisClient;
  private subscriber: RedisClient;
  private publisher: RedisClient;
  private isConnected = false;
  private keyPrefix: string;

  constructor(config: RedisConfig) {
    this.keyPrefix = config.keyPrefix || 'sai:';
    
    const clientConfig = {
      socket: {
        host: config.host,
        port: config.port,
      },
      password: config.password,
      database: config.database || 0,
    };

    this.client = createClient(clientConfig);
    this.subscriber = createClient(clientConfig);
    this.publisher = createClient(clientConfig);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    this.client.on('connect', () => {
      logger.debug('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);
      
      // Test connection
      await this.client.ping();
      logger.info('Redis cache connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect()
      ]);
      logger.info('Redis cache disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(this.getKey(key));
      if (!value) return null;
      
      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis GET error:', { key, error });
      return null;
    }
  }

  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      const redisKey = this.getKey(key);
      
      if (options.ttl) {
        await this.client.setEx(redisKey, options.ttl, serializedValue);
      } else {
        await this.client.set(redisKey, serializedValue);
      }
      
      return true;
    } catch (error) {
      logger.error('Redis SET error:', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(this.getKey(key));
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error:', { key, error });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.getKey(key));
      return result > 0;
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error });
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(this.getKey(key), seconds);
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE error:', { key, seconds, error });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(this.getKey(key));
    } catch (error) {
      logger.error('Redis TTL error:', { key, error });
      return -1;
    }
  }

  async increment(key: string, by = 1): Promise<number> {
    try {
      return await this.client.incrBy(this.getKey(key), by);
    } catch (error) {
      logger.error('Redis INCREMENT error:', { key, by, error });
      throw error;
    }
  }

  async decrement(key: string, by = 1): Promise<number> {
    try {
      return await this.client.decrBy(this.getKey(key), by);
    } catch (error) {
      logger.error('Redis DECREMENT error:', { key, by, error });
      throw error;
    }
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hGet(this.getKey(key), field);
    } catch (error) {
      logger.error('Redis HGET error:', { key, field, error });
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      const result = await this.client.hSet(this.getKey(key), field, value);
      return result > 0;
    } catch (error) {
      logger.error('Redis HSET error:', { key, field, error });
      return false;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(this.getKey(key));
    } catch (error) {
      logger.error('Redis HGETALL error:', { key, error });
      return {};
    }
  }

  async hdel(key: string, field: string): Promise<boolean> {
    try {
      const result = await this.client.hDel(this.getKey(key), field);
      return result > 0;
    } catch (error) {
      logger.error('Redis HDEL error:', { key, field, error });
      return false;
    }
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lPush(this.getKey(key), values);
    } catch (error) {
      logger.error('Redis LPUSH error:', { key, values, error });
      throw error;
    }
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.rPush(this.getKey(key), values);
    } catch (error) {
      logger.error('Redis RPUSH error:', { key, values, error });
      throw error;
    }
  }

  async lpop(key: string): Promise<string | null> {
    try {
      return await this.client.lPop(this.getKey(key));
    } catch (error) {
      logger.error('Redis LPOP error:', { key, error });
      return null;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rPop(this.getKey(key));
    } catch (error) {
      logger.error('Redis RPOP error:', { key, error });
      return null;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lRange(this.getKey(key), start, stop);
    } catch (error) {
      logger.error('Redis LRANGE error:', { key, start, stop, error });
      return [];
    }
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<number> {
    try {
      const serializedMessage = JSON.stringify(message);
      return await this.publisher.publish(this.getKey(channel), serializedMessage);
    } catch (error) {
      logger.error('Redis PUBLISH error:', { channel, error });
      return 0;
    }
  }

  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    try {
      await this.subscriber.subscribe(this.getKey(channel), (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          logger.error('Error parsing pub/sub message:', { channel, message, error });
        }
      });
    } catch (error) {
      logger.error('Redis SUBSCRIBE error:', { channel, error });
      throw error;
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(this.getKey(channel));
    } catch (error) {
      logger.error('Redis UNSUBSCRIBE error:', { channel, error });
      throw error;
    }
  }

  // Session management
  async setSession(sessionId: string, data: any, ttl = 3600): Promise<boolean> {
    return this.set(`session:${sessionId}`, data, { ttl });
  }

  async getSession<T = any>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.del(`session:${sessionId}`);
  }

  async refreshSession(sessionId: string, ttl = 3600): Promise<boolean> {
    return this.expire(`session:${sessionId}`, ttl);
  }

  // Rate limiting
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const window = Math.floor(now / (windowSeconds * 1000));
    const rateLimitKey = `rate_limit:${key}:${window}`;
    
    try {
      const current = await this.increment(rateLimitKey);
      
      if (current === 1) {
        await this.expire(rateLimitKey, windowSeconds);
      }
      
      const remaining = Math.max(0, limit - current);
      const resetTime = (window + 1) * windowSeconds * 1000;
      
      return {
        allowed: current <= limit,
        remaining,
        resetTime
      };
    } catch (error) {
      logger.error('Rate limit check error:', { key, error });
      return { allowed: true, remaining: limit, resetTime: now + windowSeconds * 1000 };
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping error:', error);
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getClient(): RedisClient {
    return this.client;
  }
}

// Singleton instance
let cacheInstance: RedisCache | null = null;

export function createCache(config: RedisConfig): RedisCache {
  if (!cacheInstance) {
    cacheInstance = new RedisCache(config);
  }
  return cacheInstance;
}

export function getCache(): RedisCache {
  if (!cacheInstance) {
    throw new Error('Cache not initialized. Call createCache() first.');
  }
  return cacheInstance;
}