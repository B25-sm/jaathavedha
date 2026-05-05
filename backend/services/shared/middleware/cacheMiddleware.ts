import { Request, Response, NextFunction } from 'express';
import { CacheManager } from '../cache/CacheManager';
import crypto from 'crypto';

export interface CacheMiddlewareOptions {
  ttl?: number;
  tags?: string[];
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  varyBy?: string[]; // Headers to vary cache by (e.g., ['authorization', 'accept-language'])
}

/**
 * Create a cache middleware for Express routes
 */
export function createCacheMiddleware(
  cacheManager: CacheManager,
  options: CacheMiddlewareOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = options.keyGenerator
      ? options.keyGenerator(req)
      : generateCacheKey(req, options.varyBy);

    try {
      // Try to get from cache
      const cached = await cacheManager.get<{
        status: number;
        headers: Record<string, string>;
        body: any;
      }>(cacheKey);

      if (cached) {
        // Set cached headers
        Object.entries(cached.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Add cache hit header
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);

        // Send cached response
        return res.status(cached.status).json(cached.body);
      }

      // Cache miss - intercept response
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function (body: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = {
            status: res.statusCode,
            headers: extractCacheableHeaders(res),
            body,
          };

          // Cache asynchronously (don't wait)
          cacheManager.set(cacheKey, cacheData, {
            ttl: options.ttl,
            tags: options.tags,
          }).catch((error) => {
            console.error('Failed to cache response:', error);
          });
        }

        // Call original json method
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Generate a cache key based on request
 */
function generateCacheKey(req: Request, varyBy?: string[]): string {
  const parts: string[] = [
    req.method,
    req.path,
    JSON.stringify(req.query),
  ];

  // Add vary headers to cache key
  if (varyBy && varyBy.length > 0) {
    const varyHeaders: Record<string, string> = {};
    varyBy.forEach((header) => {
      const value = req.get(header);
      if (value) {
        varyHeaders[header.toLowerCase()] = value;
      }
    });
    parts.push(JSON.stringify(varyHeaders));
  }

  // Create hash of all parts
  const keyString = parts.join('|');
  return `api:${crypto.createHash('md5').update(keyString).digest('hex')}`;
}

/**
 * Extract cacheable headers from response
 */
function extractCacheableHeaders(res: Response): Record<string, string> {
  const cacheableHeaders: Record<string, string> = {};
  const headers = res.getHeaders();

  // List of headers to cache
  const allowedHeaders = [
    'content-type',
    'content-language',
    'cache-control',
    'etag',
    'last-modified',
  ];

  allowedHeaders.forEach((header) => {
    const value = headers[header];
    if (value) {
      cacheableHeaders[header] = String(value);
    }
  });

  return cacheableHeaders;
}

/**
 * Middleware to invalidate cache by tag
 */
export function createCacheInvalidationMiddleware(
  cacheManager: CacheManager,
  tags: string[]
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to invalidate cache after successful response
    res.json = function (body: any) {
      // Only invalidate on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Invalidate asynchronously
        Promise.all(tags.map(tag => cacheManager.invalidateTag(tag)))
          .catch((error) => {
            console.error('Failed to invalidate cache:', error);
          });
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Middleware to set cache control headers
 */
export function setCacheControl(maxAge: number, options: {
  public?: boolean;
  private?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
} = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const directives: string[] = [];

    if (options.public) directives.push('public');
    if (options.private) directives.push('private');
    if (options.noCache) directives.push('no-cache');
    if (options.noStore) directives.push('no-store');
    if (options.mustRevalidate) directives.push('must-revalidate');
    
    if (maxAge > 0) {
      directives.push(`max-age=${maxAge}`);
    }

    if (directives.length > 0) {
      res.setHeader('Cache-Control', directives.join(', '));
    }

    next();
  };
}

export default createCacheMiddleware;
