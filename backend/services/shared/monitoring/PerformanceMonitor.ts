import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class PerformanceMonitor {
  private registry: Registry;
  private logger: winston.Logger;

  // Metrics
  private httpRequestDuration: Histogram;
  private httpRequestTotal: Counter;
  private httpRequestSize: Histogram;
  private httpResponseSize: Histogram;
  private activeConnections: Gauge;
  private databaseQueryDuration: Histogram;
  private cacheHitRate: Counter;
  private cacheMissRate: Counter;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.registry = new Registry();

    // HTTP request duration histogram
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // HTTP request counter
    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [this.registry],
    });

    // HTTP request size histogram
    this.httpRequestSize = new Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route', 'service'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    });

    // HTTP response size histogram
    this.httpResponseSize = new Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    });

    // Active connections gauge
    this.activeConnections = new Gauge({
      name: 'http_active_connections',
      help: 'Number of active HTTP connections',
      labelNames: ['service'],
      registers: [this.registry],
    });

    // Database query duration histogram
    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table', 'service'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });

    // Cache hit counter
    this.cacheHitRate = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_key', 'service'],
      registers: [this.registry],
    });

    // Cache miss counter
    this.cacheMissRate = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_key', 'service'],
      registers: [this.registry],
    });

    // Enable default metrics (CPU, memory, etc.)
    this.registry.setDefaultLabels({
      app: 'sai-mahendra',
    });
  }

  /**
   * Express middleware for request monitoring
   */
  middleware(serviceName: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Increment active connections
      this.activeConnections.inc({ service: serviceName });

      // Track request size
      const requestSize = parseInt(req.get('content-length') || '0', 10);
      if (requestSize > 0) {
        this.httpRequestSize.observe(
          {
            method: req.method,
            route: this.normalizeRoute(req.route?.path || req.path),
            service: serviceName,
          },
          requestSize
        );
      }

      // Intercept response to track metrics
      const originalSend = res.send;
      res.send = function (body: any) {
        const duration = (Date.now() - startTime) / 1000;
        const route = this.normalizeRoute(req.route?.path || req.path);

        // Record request duration
        this.httpRequestDuration.observe(
          {
            method: req.method,
            route,
            status_code: res.statusCode.toString(),
            service: serviceName,
          },
          duration
        );

        // Increment request counter
        this.httpRequestTotal.inc({
          method: req.method,
          route,
          status_code: res.statusCode.toString(),
          service: serviceName,
        });

        // Track response size
        const responseSize = Buffer.byteLength(JSON.stringify(body));
        this.httpResponseSize.observe(
          {
            method: req.method,
            route,
            status_code: res.statusCode.toString(),
            service: serviceName,
          },
          responseSize
        );

        // Decrement active connections
        this.activeConnections.dec({ service: serviceName });

        // Log slow requests
        if (duration > 1) {
          this.logger.warn('Slow request detected', {
            method: req.method,
            route,
            duration: `${duration.toFixed(3)}s`,
            statusCode: res.statusCode,
          });
        }

        return originalSend.call(res, body);
      }.bind(this);

      next();
    };
  }

  /**
   * Track database query performance
   */
  trackDatabaseQuery(
    queryType: string,
    table: string,
    serviceName: string,
    duration: number
  ): void {
    this.databaseQueryDuration.observe(
      {
        query_type: queryType,
        table,
        service: serviceName,
      },
      duration / 1000 // Convert to seconds
    );

    // Log slow queries
    if (duration > 1000) {
      this.logger.warn('Slow database query detected', {
        queryType,
        table,
        duration: `${duration}ms`,
      });
    }
  }

  /**
   * Track cache hit
   */
  trackCacheHit(cacheKey: string, serviceName: string): void {
    this.cacheHitRate.inc({
      cache_key: cacheKey,
      service: serviceName,
    });
  }

  /**
   * Track cache miss
   */
  trackCacheMiss(cacheKey: string, serviceName: string): void {
    this.cacheMissRate.inc({
      cache_key: cacheKey,
      service: serviceName,
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<any> {
    const metrics = await this.registry.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Normalize route path for consistent metrics
   */
  private normalizeRoute(path: string): string {
    // Replace dynamic segments with placeholders
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-z0-9]{24}/gi, '/:id');
  }

  /**
   * Health check endpoint data
   */
  async getHealthMetrics(): Promise<{
    status: string;
    uptime: number;
    timestamp: string;
    metrics: {
      requestRate: number;
      errorRate: number;
      avgResponseTime: number;
      activeConnections: number;
    };
  }> {
    const metricsJSON = await this.getMetricsJSON();

    // Calculate metrics from Prometheus data
    const requestRate = this.calculateRate(metricsJSON, 'http_requests_total');
    const errorRate = this.calculateErrorRate(metricsJSON);
    const avgResponseTime = this.calculateAvgResponseTime(metricsJSON);
    const activeConnections = this.getGaugeValue(metricsJSON, 'http_active_connections');

    return {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      metrics: {
        requestRate,
        errorRate,
        avgResponseTime,
        activeConnections,
      },
    };
  }

  /**
   * Calculate request rate from metrics
   */
  private calculateRate(metrics: any[], metricName: string): number {
    const metric = metrics.find((m) => m.name === metricName);
    if (!metric || !metric.values) return 0;

    const total = metric.values.reduce((sum: number, v: any) => sum + v.value, 0);
    return total;
  }

  /**
   * Calculate error rate from metrics
   */
  private calculateErrorRate(metrics: any[]): number {
    const requestMetric = metrics.find((m) => m.name === 'http_requests_total');
    if (!requestMetric || !requestMetric.values) return 0;

    const totalRequests = requestMetric.values.reduce(
      (sum: number, v: any) => sum + v.value,
      0
    );
    const errorRequests = requestMetric.values
      .filter((v: any) => v.labels.status_code >= 500)
      .reduce((sum: number, v: any) => sum + v.value, 0);

    return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
  }

  /**
   * Calculate average response time from metrics
   */
  private calculateAvgResponseTime(metrics: any[]): number {
    const durationMetric = metrics.find((m) => m.name === 'http_request_duration_seconds');
    if (!durationMetric || !durationMetric.values) return 0;

    const sum = durationMetric.values.reduce(
      (total: number, v: any) => total + v.value * v.metricValue,
      0
    );
    const count = durationMetric.values.reduce((total: number, v: any) => total + v.value, 0);

    return count > 0 ? sum / count : 0;
  }

  /**
   * Get gauge value from metrics
   */
  private getGaugeValue(metrics: any[], metricName: string): number {
    const metric = metrics.find((m) => m.name === metricName);
    if (!metric || !metric.values || metric.values.length === 0) return 0;

    return metric.values[0].value;
  }
}

export default PerformanceMonitor;
