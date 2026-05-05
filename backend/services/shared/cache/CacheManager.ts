import { createClient, RedisClientType } from 'redis';
import winston from 'winston';

export interface CacheConfig {
  redisUrl: string;
  defaultTTL: number;
  keyPrefix: string;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

export class CacheManager {
  private client: RedisClientType;
  private logger: winston.Logger;
  private config: CacheConfig;
  private isConnected: boolean = false;

  constructor(config: CacheConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    this.client = createClient({
      url: config.redisUrl,
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis Cache Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.logger.info('Redis Cache Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      this.logger.warn('Redis Cache Disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  private getKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getKey(key);
      const value = await this.client.get(fullKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error: any) {
      this.logger.error('Cache get error:', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      const ttl = options?.ttl || this.config.defaultTTL;
      const serialized = JSON.stringify(value);

      await this.client.setEx(fullKey, ttl, serialized);

      // Store tags for invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.addTags(key, options.tags);
      }

      return true;
    } catch (error: any) {
      this.logger.error('Cache set error:', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      await this.client.del(fullKey);
      return true;
    } catch (error: any) {
      this.logger.error('Cache delete error:', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getKey(pattern);
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(keys);
      return keys.length;
    } catch (error: any) {
      this.logger.error('Cache delete pattern error:', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error: any) {
      this.logger.error('Cache exists error:', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get or set a value in cache (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetchFn();

    // Store in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Add tags to a cache key for group invalidation
   */
  private async addTags(key: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = this.getKey(`tag:${tag}`);
        await this.client.sAdd(tagKey, key);
      }
    } catch (error: any) {
      this.logger.error('Cache add tags error:', { key, tags, error: error.message });
    }
  }

  /**
   * Invalidate all cache entries with a specific tag
   */
  async invalidateTag(tag: string): Promise<number> {
    try {
      const tagKey = this.getKey(`tag:${tag}`);
      const keys = await this.client.sMembers(tagKey);
      
      if (keys.length === 0) {
        return 0;
      }

      // Delete all keys with this tag
      const fullKeys = keys.map(k => this.getKey(k));
      await this.client.del(fullKeys);

      // Delete the tag set itself
      await this.client.del(tagKey);

      return keys.length;
    } catch (error: any) {
      this.logger.error('Cache invalidate tag error:', { tag, error: error.message });
      return 0;
    }
  }

  /**
   * Increment a counter in cache
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      return await this.client.incrBy(fullKey, amount);
    } catch (error: any) {
      this.logger.error('Cache increment error:', { key, error: error.message });
      return 0;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      return await this.client.expire(fullKey, seconds);
    } catch (error: any) {
      this.logger.error('Cache expire error:', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      
      // Parse Redis INFO output
      const stats = {
        keys: 0,
        memory: '0',
        hits: 0,
        misses: 0,
      };

      // Extract stats from INFO output
      const statsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const memoryMatch = memory.match(/used_memory_human:([^\r\n]+)/);

      if (statsMatch) stats.hits = parseInt(statsMatch[1]);
      if (missesMatch) stats.misses = parseInt(missesMatch[1]);
      if (memoryMatch) stats.memory = memoryMatch[1].trim();

      // Count keys with our prefix
      const keys = await this.client.keys(this.getKey('*'));
      stats.keys = keys.length;

      return stats;
    } catch (error: any) {
      this.logger.error('Cache stats error:', error.message);
      return {
        keys: 0,
        memory: '0',
        hits: 0,
        misses: 0,
      };
    }
  }

  /**
   * Flush all cache entries with our prefix
   */
  async flush(): Promise<boolean> {
    try {
      const keys = await this.client.keys(this.getKey('*'));
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error: any) {
      this.logger.error('Cache flush error:', error.message);
      return false;
    }
  }
}

export default CacheManager;
