import { trace, context, SpanStatusCode, Span, Tracer } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  jaegerEndpoint?: string;
  environment?: string;
}

export class TracingService {
  private tracer: Tracer;
  private provider: NodeTracerProvider;

  constructor(config: TracingConfig) {
    const {
      serviceName,
      serviceVersion = '1.0.0',
      jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://jaeger-collector:14268/api/traces',
      environment = process.env.NODE_ENV || 'development',
    } = config;

    // Create resource with service information
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
      })
    );

    // Create tracer provider
    this.provider = new NodeTracerProvider({
      resource,
    });

    // Configure Jaeger exporter
    const jaegerExporter = new JaegerExporter({
      endpoint: jaegerEndpoint,
    });

    // Add span processor
    this.provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));

    // Register the provider
    this.provider.register();

    // Register automatic instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          requestHook: (span, request) => {
            span.setAttribute('http.request.headers', JSON.stringify(request.headers));
          },
        }),
        new ExpressInstrumentation(),
        new PgInstrumentation(),
        new RedisInstrumentation(),
        new MongoDBInstrumentation(),
      ],
    });

    // Get tracer instance
    this.tracer = trace.getTracer(serviceName, serviceVersion);
  }

  /**
   * Create a new span
   */
  startSpan(name: string, attributes?: Record<string, any>): Span {
    return this.tracer.startSpan(name, {
      attributes,
    });
  }

  /**
   * Execute function within a span
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.startSpan(name, attributes);

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Trace database query
   */
  async traceQuery<T>(
    operation: string,
    query: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `db.${operation}`,
      async (span) => {
        span.setAttribute('db.statement', query);
        span.setAttribute('db.system', 'postgresql');
        return await fn();
      }
    );
  }

  /**
   * Trace external HTTP call
   */
  async traceHttpCall<T>(
    method: string,
    url: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `http.${method.toLowerCase()}`,
      async (span) => {
        span.setAttribute('http.method', method);
        span.setAttribute('http.url', url);
        const result = await fn();
        span.setAttribute('http.status_code', 200);
        return result;
      }
    );
  }

  /**
   * Trace business operation
   */
  async traceOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.withSpan(operation, fn, metadata);
  }

  /**
   * Get current trace context
   */
  getCurrentTraceContext(): { traceId: string; spanId: string } | null {
    const span = trace.getSpan(context.active());
    if (!span) return null;

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };
  }

  /**
   * Express middleware for tracing
   */
  middleware() {
    return (req: any, res: any, next: any) => {
      const span = this.startSpan(`${req.method} ${req.path}`, {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.get('host'),
        'http.user_agent': req.get('user-agent'),
      });

      // Add trace context to request
      const traceContext = this.getCurrentTraceContext();
      if (traceContext) {
        req.traceId = traceContext.traceId;
        req.spanId = traceContext.spanId;
        res.setHeader('X-Trace-ID', traceContext.traceId);
      }

      // End span when response finishes
      res.on('finish', () => {
        span.setAttribute('http.status_code', res.statusCode);
        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        span.end();
      });

      next();
    };
  }

  /**
   * Shutdown tracing
   */
  async shutdown(): Promise<void> {
    await this.provider.shutdown();
  }
}

/**
 * Create tracing service instance
 */
export function createTracingService(config: TracingConfig): TracingService {
  return new TracingService(config);
}
