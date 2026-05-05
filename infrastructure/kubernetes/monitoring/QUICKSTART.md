# Monitoring Stack Quick Start Guide

## For Developers

### Local Development Setup (5 minutes)

1. **Start monitoring stack**:
   ```bash
   cd infrastructure
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **Access dashboards**:
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000 (admin/admin)
   - Kibana: http://localhost:5601
   - Jaeger: http://localhost:16686

3. **Add to your service**:

   **Install dependencies**:
   ```bash
   npm install winston winston-elasticsearch @opentelemetry/api @opentelemetry/sdk-trace-node
   ```

   **Add logging**:
   ```typescript
   import { createLogger } from '../shared/logging/StructuredLogger';
   
   const logger = createLogger('my-service');
   
   // Use throughout your code
   logger.info('User logged in', { userId: user.id });
   logger.error('Database error', error, { query });
   ```

   **Add tracing**:
   ```typescript
   import { createTracingService } from '../shared/tracing/TracingService';
   
   const tracing = createTracingService({
     serviceName: 'my-service',
   });
   
   // Add middleware
   app.use(tracing.middleware());
   
   // Trace operations
   await tracing.traceOperation('createUser', async () => {
     // Your code
   });
   ```

4. **Add metrics endpoint**:
   ```typescript
   import { register } from 'prom-client';
   
   app.get('/metrics', async (req, res) => {
     res.set('Content-Type', register.contentType);
     res.end(await register.metrics());
   });
   ```

5. **Test it works**:
   - Generate some traffic to your service
   - Check Grafana for metrics
   - Check Kibana for logs
   - Check Jaeger for traces

### Production Deployment (10 minutes)

1. **Deploy monitoring stack**:
   ```bash
   cd infrastructure/kubernetes/monitoring
   ./deploy-monitoring.sh
   ```

2. **Update database credentials**:
   Edit `exporters-deployment.yaml` and update connection strings.

3. **Add annotations to your service**:
   ```yaml
   metadata:
     annotations:
       prometheus.io/scrape: "true"
       prometheus.io/port: "3000"
       prometheus.io/path: "/metrics"
   ```

4. **Set environment variables**:
   ```yaml
   env:
     - name: ELASTICSEARCH_URL
       value: "http://logstash.monitoring.svc.cluster.local:8080"
     - name: JAEGER_ENDPOINT
       value: "http://jaeger-collector.monitoring.svc.cluster.local:14268/api/traces"
     - name: LOG_LEVEL
       value: "info"
   ```

5. **Deploy and verify**:
   ```bash
   kubectl apply -f your-service.yaml
   kubectl port-forward -n monitoring svc/grafana 3000:80
   ```

## Common Tasks

### View Service Metrics
1. Open Grafana: http://localhost:3000
2. Go to Dashboards → Performance Overview
3. Select your service from dropdown

### Search Logs
1. Open Kibana: http://localhost:5601
2. Create index pattern: `logstash-*`
3. Search: `service:"my-service" AND level:"ERROR"`

### View Traces
1. Open Jaeger: http://localhost:16686
2. Select your service
3. Click "Find Traces"

### Check Alerts
1. Open Prometheus: http://localhost:9090
2. Go to Alerts tab
3. View active alerts

## Troubleshooting

**Metrics not showing up?**
- Check `/metrics` endpoint returns data
- Verify pod annotations are correct
- Check Prometheus targets page

**Logs not appearing?**
- Verify ELASTICSEARCH_URL is set
- Check Logstash is receiving logs: `docker logs logstash`
- Ensure logs are JSON formatted

**Traces missing?**
- Verify JAEGER_ENDPOINT is set
- Check Jaeger collector logs
- Ensure tracing middleware is added

## Need Help?

- Full documentation: [README.md](README.md)
- Completion report: [TASK_17.1_COMPLETION_REPORT.md](TASK_17.1_COMPLETION_REPORT.md)
- Contact: devops@sai-mahendra.com
