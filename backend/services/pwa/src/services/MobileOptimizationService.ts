import { Logger } from 'winston';
import { RedisClientType } from 'redis';
import {
  MobileOptimizationConfig,
  MobileAPIResponse,
  ResponseMetadata,
  NetworkStatus
} from '../types';

/**
 * Mobile Optimization Service
 * Handles mobile-specific optimizations for API responses and content delivery
 */
export class MobileOptimizationService {
  private redis: RedisClientType;
  private logger: Logger;
  private config: MobileOptimizationConfig;

  constructor(redis: RedisClientType, logger: Logger) {
    this.redis = redis;
    this.logger = logger;

    this.config = {
      imageQuality: parseInt(process.env.MOBILE_IMAGE_QUALITY || '75'),
      maxPayloadSize: parseInt(process.env.MOBILE_MAX_PAYLOAD_SIZE || '512000'), // 500KB
      cacheTTL: parseInt(process.env.MOBILE_CACHE_TTL || '3600'), // 1 hour
      compressionEnabled: true,
      lazyLoadingEnabled: true
    };
  }

  /**
   * Optimize API response for mobile devices
   */
  async optimizeResponse<T = any>(
    data: T,
    compressionEnabled: boolean = true
  ): Promise<MobileAPIResponse<T>> {
    try {
      const startTime = Date.now();
      let optimizedData = data;
      let compressionRatio: number | undefined;

      // Calculate original payload size
      const originalSize = this.calculatePayloadSize(data);

      // Apply optimizations if payload is too large
      if (originalSize > this.config.maxPayloadSize) {
        optimizedData = this.reducePayloadSize(data);
      }

      // Calculate optimized size
      const optimizedSize = this.calculatePayloadSize(optimizedData);

      if (compressionEnabled && originalSize > 0) {
        compressionRatio = optimizedSize / originalSize;
      }

      const processingTime = Date.now() - startTime;

      const response: MobileAPIResponse<T> = {
        success: true,
        data: optimizedData,
        metadata: {
          timestamp: new Date(),
          version: '1.0',
          cached: false,
          payloadSize: optimizedSize,
          compressionRatio
        }
      };

      this.logger.info('Response optimized for mobile', {
        originalSize,
        optimizedSize,
        compressionRatio,
        processingTime: `${processingTime}ms`
      });

      return response;
    } catch (error: any) {
      this.logger.error('Error optimizing mobile response', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate payload size in bytes
   */
  private calculatePayloadSize(data: any): number {
    try {
      const jsonString = JSON.stringify(data);
      return Buffer.byteLength(jsonString, 'utf8');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Reduce payload size by removing unnecessary data
   */
  private reducePayloadSize<T>(data: T): T {
    if (Array.isArray(data)) {
      // For arrays, apply optimization to each item
      return data.map(item => this.optimizeObject(item)) as any;
    } else if (typeof data === 'object' && data !== null) {
      return this.optimizeObject(data);
    }

    return data;
  }

  /**
   * Optimize individual object by removing large fields
   */
  private optimizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const optimized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip large text fields for mobile
      if (typeof value === 'string' && value.length > 1000) {
        optimized[key] = value.substring(0, 200) + '...';
        optimized[`${key}_truncated`] = true;
      }
      // Skip base64 encoded images
      else if (typeof value === 'string' && value.startsWith('data:image')) {
        optimized[key] = null;
        optimized[`${key}_removed`] = true;
      }
      // Recursively optimize nested objects
      else if (typeof value === 'object' && value !== null) {
        optimized[key] = this.optimizeObject(value);
      }
      // Keep other values as-is
      else {
        optimized[key] = value;
      }
    }

    return optimized;
  }

  /**
   * Get mobile optimization configuration
   */
  async getMobileConfig(): Promise<MobileOptimizationConfig> {
    return this.config;
  }

  /**
   * Optimize image URL for mobile devices
   */
  async optimizeImage(
    imageUrl: string,
    quality?: number,
    maxWidth?: number,
    maxHeight?: number
  ): Promise<string> {
    try {
      // If using a CDN with image optimization support (like CloudFront with Lambda@Edge)
      // we can append query parameters for on-the-fly optimization
      const url = new URL(imageUrl);
      const params = new URLSearchParams(url.search);

      // Add optimization parameters
      if (quality !== undefined) {
        params.set('quality', quality.toString());
      } else {
        params.set('quality', this.config.imageQuality.toString());
      }

      if (maxWidth) {
        params.set('width', maxWidth.toString());
      }

      if (maxHeight) {
        params.set('height', maxHeight.toString());
      }

      // Add format parameter for modern formats
      params.set('format', 'webp');

      url.search = params.toString();

      const optimizedUrl = url.toString();

      this.logger.info('Image URL optimized for mobile', {
        originalUrl: imageUrl,
        optimizedUrl,
        quality: quality || this.config.imageQuality,
        maxWidth,
        maxHeight
      });

      return optimizedUrl;
    } catch (error: any) {
      this.logger.error('Error optimizing image URL', {
        error: error.message,
        imageUrl
      });
      // Return original URL if optimization fails
      return imageUrl;
    }
  }

  /**
   * Detect network capabilities from user agent
   */
  detectNetworkCapabilities(userAgent: string): NetworkStatus {
    // Basic network detection based on user agent
    // In production, this would be enhanced with actual network information from the client
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
    const isSlowDevice = /Android [1-4]\.|iPhone OS [1-9]_/i.test(userAgent);

    let effectiveType: '2g' | '3g' | '4g' | 'slow-2g' = '4g';

    if (isSlowDevice) {
      effectiveType = '3g';
    }

    return {
      online: true,
      effectiveType,
      downlink: effectiveType === '4g' ? 10 : effectiveType === '3g' ? 1.5 : 0.4,
      rtt: effectiveType === '4g' ? 50 : effectiveType === '3g' ? 200 : 500,
      saveData: false
    };
  }

  /**
   * Cache mobile-optimized response
   */
  async cacheResponse(key: string, data: any, ttl?: number): Promise<void> {
    try {
      const cacheKey = `mobile:cache:${key}`;
      const cacheTTL = ttl || this.config.cacheTTL;

      await this.redis.setEx(
        cacheKey,
        cacheTTL,
        JSON.stringify({
          data,
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + cacheTTL * 1000).toISOString()
        })
      );

      this.logger.info('Mobile response cached', { key, ttl: cacheTTL });
    } catch (error: any) {
      this.logger.error('Error caching mobile response', {
        error: error.message,
        key
      });
    }
  }

  /**
   * Get cached mobile response
   */
  async getCachedResponse(key: string): Promise<any | null> {
    try {
      const cacheKey = `mobile:cache:${key}`;
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      const parsedCache = JSON.parse(cached);

      this.logger.info('Mobile response retrieved from cache', { key });

      return parsedCache.data;
    } catch (error: any) {
      this.logger.error('Error getting cached mobile response', {
        error: error.message,
        key
      });
      return null;
    }
  }

  /**
   * Clear mobile cache
   */
  async clearCache(pattern?: string): Promise<number> {
    try {
      const searchPattern = pattern
        ? `mobile:cache:${pattern}*`
        : 'mobile:cache:*';

      const keys = await this.redis.keys(searchPattern);

      if (keys.length === 0) {
        return 0;
      }

      await this.redis.del(keys);

      this.logger.info('Mobile cache cleared', {
        pattern: searchPattern,
        keysDeleted: keys.length
      });

      return keys.length;
    } catch (error: any) {
      this.logger.error('Error clearing mobile cache', {
        error: error.message,
        pattern
      });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const keys = await this.redis.keys('mobile:cache:*');
      const totalKeys = keys.length;

      let totalSize = 0;
      for (const key of keys.slice(0, 100)) {
        // Sample first 100 keys
        const value = await this.redis.get(key);
        if (value) {
          totalSize += Buffer.byteLength(value, 'utf8');
        }
      }

      // Estimate total size based on sample
      const estimatedTotalSize = keys.length > 0
        ? Math.round((totalSize / Math.min(keys.length, 100)) * keys.length)
        : 0;

      return {
        totalKeys,
        estimatedSize: estimatedTotalSize,
        estimatedSizeMB: (estimatedTotalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error: any) {
      this.logger.error('Error getting cache stats', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Optimize video metadata for mobile
   */
  optimizeVideoMetadata(videoData: any): any {
    return {
      id: videoData.id,
      title: videoData.title,
      description: videoData.description?.substring(0, 200) + '...',
      duration: videoData.duration,
      thumbnail: videoData.thumbnail,
      // Provide multiple quality options for adaptive streaming
      sources: [
        {
          quality: '360p',
          url: videoData.url_360p,
          size: videoData.size_360p
        },
        {
          quality: '480p',
          url: videoData.url_480p,
          size: videoData.size_480p
        },
        {
          quality: '720p',
          url: videoData.url_720p,
          size: videoData.size_720p
        }
      ].filter(source => source.url), // Only include available qualities
      // Exclude high-resolution sources for mobile
      subtitles: videoData.subtitles,
      progress: videoData.progress
    };
  }

  /**
   * Optimize course data for mobile
   */
  optimizeCourseData(courseData: any): any {
    return {
      id: courseData.id,
      title: courseData.title,
      description: courseData.description?.substring(0, 300) + '...',
      thumbnail: courseData.thumbnail,
      instructor: {
        id: courseData.instructor?.id,
        name: courseData.instructor?.name,
        avatar: courseData.instructor?.avatar
      },
      progress: courseData.progress,
      totalModules: courseData.totalModules,
      completedModules: courseData.completedModules,
      duration: courseData.duration,
      // Exclude detailed module content - load on demand
      hasModules: courseData.modules && courseData.modules.length > 0,
      nextModule: courseData.nextModule
        ? {
            id: courseData.nextModule.id,
            title: courseData.nextModule.title,
            duration: courseData.nextModule.duration
          }
        : null
    };
  }

  /**
   * Create paginated response for mobile
   */
  createPaginatedResponse<T>(
    items: T[],
    page: number,
    pageSize: number,
    totalCount: number
  ): any {
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasMore = page < totalPages;

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasMore,
        nextPage: hasMore ? page + 1 : null
      }
    };
  }
}
