/**
 * Mobile Optimization Middleware
 * Handles response compression, field filtering, and mobile-specific optimizations
 */

import { Request, Response, NextFunction } from 'express';
import compression from 'compression';

/**
 * Field selection middleware - allows clients to specify which fields to return
 * Usage: ?fields=id,name,description
 */
export const fieldSelection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);

  res.json = function (data: any): Response {
    const fieldsParam = req.query.fields as string;

    if (fieldsParam && data && typeof data === 'object') {
      const fields = fieldsParam.split(',').map((f) => f.trim());
      const filteredData = filterFields(data, fields);
      return originalJson(filteredData);
    }

    return originalJson(data);
  };

  next();
};

/**
 * Filter object fields based on requested fields
 */
function filterFields(data: any, fields: string[]): any {
  if (Array.isArray(data)) {
    return data.map((item) => filterFields(item, fields));
  }

  if (data && typeof data === 'object') {
    // Handle response wrapper
    if (data.data !== undefined) {
      return {
        ...data,
        data: filterFields(data.data, fields),
      };
    }

    // Filter object fields
    const filtered: any = {};
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields (e.g., "user.name")
        const [parent, ...rest] = field.split('.');
        if (data[parent] !== undefined) {
          if (!filtered[parent]) {
            filtered[parent] = {};
          }
          const nestedValue = getNestedValue(data[parent], rest.join('.'));
          setNestedValue(filtered[parent], rest.join('.'), nestedValue);
        }
      } else if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    }
    return filtered;
  }

  return data;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Response size tracking middleware
 */
export const trackResponseSize = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);

  res.json = function (data: any): Response {
    const size = Buffer.byteLength(JSON.stringify(data));
    res.setHeader('X-Response-Size', size.toString());

    // Warn if response is too large for mobile
    const maxSize = parseInt(process.env.MAX_RESPONSE_SIZE || '102400'); // 100KB default
    if (size > maxSize) {
      console.warn(`Large response detected: ${size} bytes for ${req.path}`);
    }

    return originalJson(data);
  };

  next();
};

/**
 * Conditional compression based on connection type
 */
export const smartCompression = compression({
  filter: (req, res) => {
    // Always compress for slow connections
    const connectionType = req.headers['x-connection-type'] as string;
    if (connectionType && ['2g', '3g', 'slow-2g'].includes(connectionType.toLowerCase())) {
      return true;
    }

    // Use default compression filter
    return compression.filter(req, res);
  },
  level: parseInt(process.env.COMPRESSION_LEVEL || '6'),
});

/**
 * Add mobile-specific headers
 */
export const mobileHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add cache control for mobile
  res.setHeader('Cache-Control', 'private, max-age=300');

  // Add mobile API version
  res.setHeader('X-Mobile-API-Version', '1.0');

  // Add server timestamp for sync
  res.setHeader('X-Server-Timestamp', new Date().toISOString());

  next();
};

/**
 * Lightweight response wrapper
 */
export const lightweightResponse = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);

  res.json = function (data: any): Response {
    // Check if client wants lightweight response
    const lightweight = req.query.lightweight === 'true';

    if (lightweight && data && typeof data === 'object') {
      // Remove metadata and extra fields for lightweight mode
      const { metadata, ...essentialData } = data;
      return originalJson(essentialData);
    }

    return originalJson(data);
  };

  next();
};

/**
 * Batch request support
 */
export const batchRequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.path !== '/api/batch' || req.method !== 'POST') {
    next();
    return;
  }

  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_BATCH_REQUEST',
          message: 'Batch request must contain an array of requests',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (requests.length > 10) {
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          code: 'BATCH_SIZE_EXCEEDED',
          message: 'Maximum 10 requests allowed in a batch',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Process batch requests
    const responses = await Promise.all(
      requests.map(async (batchReq: any) => {
        try {
          // This would need to be implemented with actual request processing
          // For now, return a placeholder
          return {
            id: batchReq.id,
            status: 200,
            body: { message: 'Batch request processing not fully implemented' },
          };
        } catch (error) {
          return {
            id: batchReq.id,
            status: 500,
            body: { error: 'Request failed' },
          };
        }
      })
    );

    res.json({
      success: true,
      responses,
    });
  } catch (error) {
    next(error);
  }
};
