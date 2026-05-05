# Monitoring, Logging, and Observability Setup

This directory contains the complete monitoring and observability infrastructure for the Sai Mahendra Platform.

## Overview

The monitoring stack includes:

1. **Prometheus** - Metrics collection and alerting
2. **Grafana** - Visualization and dashboards
3. **ELK Stack** - Centralized logging (Elasticsearch, Logstash, Kibana)
4. **Jaeger** - Distributed tracing
5. **Exporters** - PostgreSQL, Redis, MongoDB, Node metrics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Services                     │
│  (User Management, Course Management, Payment, etc.)        │
└────────┬──────────────┬──────────────┬─────────────────────┘
         │              │              │
         │ Metrics      │ Logs         │ Traces
         │              │              │
    ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
    │Prometheus│    │Logstash │   │ Jaeger  │
    │         │    │         │   │Collector│
    └────┬────┘    └────┬────┘   └────┬────┘
         │              │              │
         │              │              │
    ┌────▼────┐    ┌────▼────────┐   │
    │ Grafana │    │Elasticsearch│◄──┘
    │         │    │             │
    └─────────┘    └────┬────────┘
                        │
                   ┌────▼────┐
                   │ Kibana  │
                   │         │
                   └─────────┘
```

## Components

### 1. Prometheus

**Purpose**: Metrics collection and alerting

**Features**:
- Automatic service discovery for Kubernetes pods
- Scrapes metrics from all services every 15 seconds
- Stores metrics for 30 days
- Evaluates alerting rules
- Integrates with Alertmanager

**Metrics Collected**:
- HTTP request rate, latency, and errors
- System metrics (CPU, memory, disk, network)
- Database metrics (connections, query performance)
- Cache metrics (hit rate, memory usage)
- Business metrics (enrollments, payments, active users)

**Configuration**: `prometheus-deployment.yaml`

**Access**: 
- Internal: `http://prometheus.monitoring.svc.cluster.local:9090`
- External: Via LoadBalancer or Ingress

### 2. Grafana

**Purpose**: Visualization and dashboards

**Features**:
- Pre-configured dashboards for system and business metrics
- Real-time monitoring with 30-second refresh
- Alerting integration with Prometheus
- Multiple data sources (Prometheus, Elasticsearch, Jaeger)

**Default Credentials**:
- Username: `admin`
- Password: `changeme123!` (Change this immediately!)

**Dashboards Included**:
- Performance Overview (API response times, request rates, error rates)
- System Resources (CPU, memory, pods)
- Database Metrics (connections, query performance)
- Business Metrics (payments, enrollments, active users)

**Configuration**: `grafana-deployment.yaml`

### 3. Elasticsearch

**Purpose**: Log storage and search

**Features**:
- Stores all application logs
- Full-text search capabilities
- 100GB storage with automatic retention policies
- Single-node deployment (can be scaled to cluster)

**Configuration**: `elasticsearch-deployment.yaml`

**Index Pattern**: `logstash-YYYY.MM.DD`

### 4. Logstash

**Purpose**: Log aggregation and processing

**Features**:
- Receives logs from multiple sources (Beats, TCP, HTTP)
- Parses and enriches log data
- Adds Kubernetes metadata
- Extracts structured fields from JSON logs
- Geo-location parsing for IP addresses
- User agent parsing

**Input Ports**:
- 5044: Beats protocol
- 5000: TCP JSON
- 8080: HTTP JSON

**Configuration**: `logstash-deployment.yaml`

### 5. Kibana

**Purpose**: Log visualization and analysis

**Features**:
- Search and filter logs
- Create visualizations and dashboards
- Analyze log patterns
- Set up alerts based on log data

**Configuration**: `kibana-deployment.yaml`

**Access**: Via LoadBalancer or Ingress

### 6. Jaeger

**Purpose**: Distributed tracing

**Features**:
- Traces requests across microservices
- Identifies performance bottlenecks
- Visualizes service dependencies
- Supports OpenTelemetry protocol

**Components**:
- **Collector**: Receives traces from services
- **Query**: UI for viewing traces
- **Agent**: DaemonSet on each node for local trace collection

**Configuration**: `jaeger-deployment.yaml`

**Protocols Supported**:
- OpenTelemetry (OTLP): gRPC (4317), HTTP (4318)
- Jaeger: gRPC (14250), HTTP (14268)
- Zipkin: HTTP (9411)

### 7. Exporters

**Purpose**: Export metrics from databases and systems

**Exporters Included**:
- **PostgreSQL Exporter**: Database metrics
- **Redis Exporter**: Cache metrics
- **MongoDB Exporter**: Document store metrics
- **Node Exporter**: System-level metrics (CPU, memory, disk, network)

**Configuration**: `exporters-deployment.yaml`

## Deployment

### Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- Sufficient cluster resources:
  - CPU: 8+ cores
  - Memory: 16+ GB
  - Storage: 200+ GB

### Quick Start

```bash
# Deploy entire monitoring stack
cd infrastructure/kubernetes/monitoring
./deploy-monitoring.sh
```

### Manual Deployment

```bash
# Create namespace
kubectl create namespace monitoring

# Deploy Prometheus
kubectl apply -f prometheus-deployment.yaml
kubectl apply -f prometheus-rules.yaml

# Deploy Grafana
kubectl apply -f grafana-deployment.yaml

# Deploy ELK Stack
kubectl apply -f elasticsearch-deployment.yaml
kubectl apply -f logstash-deployment.yaml
kubectl apply -f kibana-deployment.yaml

# Deploy Jaeger
kubectl apply -f jaeger-deployment.yaml

# Deploy Exporters
kubectl apply -f exporters-deployment.yaml
```

### Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n monitoring

# Check services
kubectl get svc -n monitoring

# Check persistent volumes
kubectl get pvc -n monitoring
```

## Configuration

### Update Database Credentials

Update the secrets in `exporters-deployment.yaml`:

```yaml
# PostgreSQL
stringData:
  connection-string: "postgresql://user:password@host:5432/database"

# MongoDB
stringData:
  connection-string: "mongodb://host:27017"

# Redis (if password protected)
stringData:
  password: "your-redis-password"
```

### Configure Alerting

Edit `prometheus-rules.yaml` to customize alert thresholds and add new alerts.

### Add Custom Dashboards

1. Create dashboard in Grafana UI
2. Export dashboard JSON
3. Add to `grafana-dashboard-config.json`
4. Redeploy Grafana

## Application Integration

### 1. Metrics (Prometheus)

Add Prometheus client to your service:

```typescript
import { register, Counter, Histogram } from 'prom-client';

// Create metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path'],
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

Add annotations to your Kubernetes deployment:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "3000"
    prometheus.io/path: "/metrics"
```

### 2. Logging (ELK)

Use the structured logger:

```typescript
import { createLogger } from '../shared/logging/StructuredLogger';

const logger = createLogger('user-management-service');

// Log messages
logger.info('User registered', { userId: user.id, email: user.email });
logger.error('Payment failed', error, { userId, amount });
```

Configure environment variables:

```bash
ELASTICSEARCH_URL=http://logstash.monitoring.svc.cluster.local:8080
LOG_LEVEL=info
NODE_ENV=production
```

### 3. Tracing (Jaeger)

Use the tracing service:

```typescript
import { createTracingService } from '../shared/tracing/TracingService';

const tracing = createTracingService({
  serviceName: 'user-management-service',
  serviceVersion: '1.0.0',
});

// Add middleware
app.use(tracing.middleware());

// Trace operations
await tracing.traceOperation('createUser', async () => {
  // Your code here
});
```

Configure environment variables:

```bash
JAEGER_ENDPOINT=http://jaeger-collector.monitoring.svc.cluster.local:14268/api/traces
```

## Access

### Local Development (Port Forwarding)

```bash
# Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access: http://localhost:9090

# Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80
# Access: http://localhost:3000

# Kibana
kubectl port-forward -n monitoring svc/kibana 5601:80
# Access: http://localhost:5601

# Jaeger
kubectl port-forward -n monitoring svc/jaeger-query 16686:80
# Access: http://localhost:16686
```

### Production (Ingress)

The deployment includes Ingress resources for:
- `grafana.sai-mahendra.com`
- `kibana.sai-mahendra.com`
- `jaeger.sai-mahendra.com`

Update DNS records to point to your Ingress controller's IP.

## Alerting

### Alert Rules

Alerts are defined in `prometheus-rules.yaml`:

**Performance Alerts**:
- High API response time (>200ms for 5 minutes)
- Very high API response time (>1s for 2 minutes)
- High error rate (>5% for 5 minutes)
- Critical error rate (>10% for 2 minutes)

**Resource Alerts**:
- High CPU usage (>80% for 10 minutes)
- High memory usage (>85% for 10 minutes)
- High pod restart rate

**Availability Alerts**:
- Service down (for 2 minutes)
- Low replica count
- No replicas available

**Database Alerts**:
- High database connections (>80%)
- Slow database queries (>1s average)
- Database replication lag

**Cache Alerts**:
- Low cache hit rate (<70%)
- High Redis memory usage (>85%)

**Business Alerts**:
- High payment failure rate (>10%)
- Low enrollment rate

### Configure Alertmanager

To receive alerts, deploy Alertmanager:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      resolve_timeout: 5m
    
    route:
      group_by: ['alertname', 'cluster']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'default'
    
    receivers:
      - name: 'default'
        email_configs:
          - to: 'alerts@sai-mahendra.com'
            from: 'prometheus@sai-mahendra.com'
            smarthost: 'smtp.gmail.com:587'
            auth_username: 'prometheus@sai-mahendra.com'
            auth_password: 'your-password'
```

## Maintenance

### Log Retention

Elasticsearch indices are created daily (`logstash-YYYY.MM.DD`). Set up index lifecycle management:

```bash
# Delete indices older than 30 days
curl -X DELETE "http://elasticsearch:9200/logstash-$(date -d '30 days ago' +%Y.%m.%d)"
```

### Metrics Retention

Prometheus retains metrics for 30 days by default. Adjust in `prometheus-deployment.yaml`:

```yaml
args:
  - '--storage.tsdb.retention.time=30d'
```

### Backup

**Prometheus**:
```bash
kubectl exec -n monitoring prometheus-0 -- tar czf /tmp/prometheus-backup.tar.gz /prometheus
kubectl cp monitoring/prometheus-0:/tmp/prometheus-backup.tar.gz ./prometheus-backup.tar.gz
```

**Elasticsearch**:
```bash
# Use Elasticsearch snapshot API
curl -X PUT "http://elasticsearch:9200/_snapshot/backup" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": {
    "location": "/backup"
  }
}'
```

### Scaling

**Prometheus**: Increase replicas or use Thanos for long-term storage

**Elasticsearch**: Convert to multi-node cluster:
```yaml
spec:
  replicas: 3
  env:
    - name: discovery.type
      value: zen
```

**Logstash**: Increase replicas for higher throughput

## Troubleshooting

### Prometheus Not Scraping Metrics

1. Check pod annotations:
   ```bash
   kubectl get pod <pod-name> -o yaml | grep prometheus.io
   ```

2. Check Prometheus targets:
   - Access Prometheus UI
   - Go to Status → Targets
   - Look for errors

3. Check network policies allow scraping

### Logs Not Appearing in Kibana

1. Check Logstash is receiving logs:
   ```bash
   kubectl logs -n monitoring -l app=logstash
   ```

2. Check Elasticsearch indices:
   ```bash
   curl http://elasticsearch:9200/_cat/indices
   ```

3. Verify application is sending logs to Logstash

### Traces Not Appearing in Jaeger

1. Check Jaeger collector logs:
   ```bash
   kubectl logs -n monitoring -l app=jaeger,component=collector
   ```

2. Verify application tracing configuration

3. Check network connectivity to Jaeger collector

### High Resource Usage

1. Reduce Prometheus scrape interval
2. Decrease log retention period
3. Adjust Elasticsearch heap size
4. Implement sampling for traces

## Security

### Change Default Passwords

```bash
# Grafana
kubectl create secret generic grafana-credentials \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=<new-password> \
  -n monitoring --dry-run=client -o yaml | kubectl apply -f -
```

### Enable Authentication

- **Prometheus**: Use OAuth2 proxy or basic auth
- **Grafana**: Configure LDAP/OAuth
- **Kibana**: Enable X-Pack security
- **Jaeger**: Use OAuth2 proxy

### Network Policies

Restrict access to monitoring services:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: monitoring
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: sai-mahendra
```

## Performance Tuning

### Prometheus

- Adjust scrape interval based on needs
- Use recording rules for expensive queries
- Enable remote write for long-term storage

### Elasticsearch

- Increase heap size for better performance
- Use SSD storage for indices
- Configure index sharding appropriately

### Logstash

- Increase worker threads
- Tune batch size and delay
- Use persistent queues for reliability

## Support

For issues or questions:
- Check logs: `kubectl logs -n monitoring <pod-name>`
- Review documentation: This README
- Contact: devops@sai-mahendra.com

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
