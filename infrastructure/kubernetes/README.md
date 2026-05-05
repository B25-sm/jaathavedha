# Sai Mahendra Platform - Kubernetes Deployment

This directory contains all Kubernetes manifests and Helm charts for deploying the Sai Mahendra Educational Platform.

## Directory Structure

```
infrastructure/kubernetes/
├── deployments/              # Service deployment manifests
│   ├── user-management.yaml
│   ├── course-management.yaml
│   ├── payment.yaml
│   ├── contact.yaml
│   ├── content-management.yaml
│   ├── analytics.yaml
│   ├── notification.yaml
│   ├── admin-panel.yaml
│   ├── api-gateway.yaml
│   ├── pwa.yaml
│   ├── video-conferencing.yaml
│   └── calendar-integration.yaml
├── autoscaling/              # Horizontal Pod Autoscaler configs
│   └── hpa-all-services.yaml
├── ingress/                  # Ingress controller and rules
│   ├── nginx-ingress-controller.yaml
│   └── platform-ingress.yaml
├── service-mesh/             # Istio service mesh configuration
│   ├── istio-installation.yaml
│   ├── istio-gateway.yaml
│   ├── virtual-services.yaml
│   ├── destination-rules.yaml
│   └── circuit-breaker.yaml
├── secrets/                  # Secret templates
│   └── secrets-template.yaml
├── resource-management/      # Resource quotas and limits
│   └── resource-quotas.yaml
├── monitoring/               # Monitoring stack (Prometheus, Grafana, etc.)
│   └── [monitoring files]
└── DEPLOYMENT_GUIDE.md       # Comprehensive deployment guide
```

## Services Overview

### Core Services

1. **API Gateway** (Port 3000)
   - Main entry point for all API requests
   - Load balancing and routing
   - Rate limiting and authentication

2. **User Management** (Port 3001)
   - User authentication and authorization
   - JWT token management
   - Role-based access control

3. **Course Management** (Port 3002)
   - Program and course catalog
   - Enrollment management
   - Progress tracking

4. **Payment Service** (Port 3003)
   - Payment gateway integration (Razorpay, Stripe)
   - Subscription management
   - Invoice generation

5. **Contact Service** (Port 3004)
   - Contact form handling
   - WhatsApp integration
   - Inquiry management

6. **Content Management** (Port 3005)
   - Dynamic content management
   - Media file handling
   - Content versioning

7. **Analytics Service** (Port 3006)
   - Event tracking
   - Business metrics
   - Reporting

8. **Notification Service** (Port 3007)
   - Email notifications
   - Push notifications
   - Notification preferences

9. **Admin Panel** (Port 3008)
   - Administrative interface
   - User management
   - System monitoring

10. **PWA Service** (Port 3009)
    - Progressive Web App support
    - Offline functionality
    - Service worker management

11. **Video Conferencing** (Port 3010)
    - Zoom/Google Meet integration
    - Session management
    - Recording handling

12. **Calendar Integration** (Port 3011)
    - Google Calendar integration
    - Outlook integration
    - Event synchronization

## Resource Requirements

### Minimum Cluster Requirements

- **Nodes**: 3 worker nodes
- **CPU**: 10 cores (requests), 20 cores (limits)
- **Memory**: 20GB (requests), 40GB (limits)
- **Storage**: 100GB for persistent volumes
- **Kubernetes Version**: 1.24+

### Per-Service Resources

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas (Min/Max) |
|---------|-------------|-----------|----------------|--------------|-------------------|
| API Gateway | 250m | 500m | 256Mi | 512Mi | 3/15 |
| User Management | 250m | 500m | 256Mi | 512Mi | 2/10 |
| Course Management | 250m | 500m | 256Mi | 512Mi | 2/10 |
| Payment | 250m | 500m | 256Mi | 512Mi | 2/8 |
| Contact | 100m | 250m | 128Mi | 256Mi | 2/6 |
| Content Management | 200m | 400m | 256Mi | 512Mi | 2/8 |
| Analytics | 200m | 500m | 256Mi | 512Mi | 2/8 |
| Notification | 100m | 250m | 128Mi | 256Mi | 2/6 |
| Admin Panel | 100m | 250m | 128Mi | 256Mi | 2/5 |
| PWA | 100m | 250m | 128Mi | 256Mi | 2/6 |
| Video Conferencing | 100m | 250m | 128Mi | 256Mi | 2/6 |
| Calendar Integration | 100m | 250m | 128Mi | 256Mi | 2/6 |

## Quick Start

### 1. Prerequisites

```bash
# Install required tools
kubectl version --client
helm version
istioctl version

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### 2. Create Namespace

```bash
kubectl apply -f ../../k8s/base/namespace.yaml
```

### 3. Configure Secrets

```bash
# Copy template and fill in values
cp secrets/secrets-template.yaml secrets/secrets.yaml
# Edit secrets.yaml with actual base64-encoded values
kubectl apply -f secrets/secrets.yaml
```

### 4. Deploy Services

```bash
# Deploy all services
kubectl apply -f deployments/

# Verify deployments
kubectl get pods -n sai-mahendra-platform
```

### 5. Enable Autoscaling

```bash
kubectl apply -f autoscaling/hpa-all-services.yaml
```

### 6. Setup Ingress

```bash
kubectl apply -f ingress/nginx-ingress-controller.yaml
kubectl apply -f ingress/platform-ingress.yaml
```

### 7. Apply Resource Management

```bash
kubectl apply -f resource-management/resource-quotas.yaml
```

## Helm Deployment

For environment-specific deployments using Helm:

```bash
# Development
helm upgrade --install sai-mahendra-dev \
  ../helm/sai-mahendra-platform \
  -f ../helm/sai-mahendra-platform/values-dev.yaml \
  -n sai-mahendra-platform --create-namespace

# Staging
helm upgrade --install sai-mahendra-staging \
  ../helm/sai-mahendra-platform \
  -f ../helm/sai-mahendra-platform/values-staging.yaml \
  -n sai-mahendra-platform --create-namespace

# Production
helm upgrade --install sai-mahendra-prod \
  ../helm/sai-mahendra-platform \
  -f ../helm/sai-mahendra-platform/values-prod.yaml \
  -n sai-mahendra-platform --create-namespace
```

## Service Mesh (Istio)

### Install Istio

```bash
# Install Istio
istioctl install -f service-mesh/istio-installation.yaml

# Enable sidecar injection
kubectl label namespace sai-mahendra-platform istio-injection=enabled

# Deploy service mesh components
kubectl apply -f service-mesh/istio-gateway.yaml
kubectl apply -f service-mesh/virtual-services.yaml
kubectl apply -f service-mesh/destination-rules.yaml
kubectl apply -f service-mesh/circuit-breaker.yaml
```

### Service Mesh Features

- **mTLS**: Automatic mutual TLS between services
- **Traffic Management**: Intelligent routing and load balancing
- **Circuit Breaking**: Automatic failure detection and recovery
- **Observability**: Distributed tracing with Jaeger
- **Security**: Authorization policies and network segmentation

## Autoscaling

### Horizontal Pod Autoscaler (HPA)

All services are configured with HPA based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)

HPA automatically scales pods between min and max replicas based on load.

### Scaling Behavior

- **Scale Up**: Fast (30 seconds stabilization)
- **Scale Down**: Gradual (300 seconds stabilization)
- **Max Scale Rate**: 100% increase or 4 pods per 30 seconds

## Monitoring

### Prometheus Metrics

All services expose metrics at `/metrics` endpoint:
- HTTP request rates and latencies
- Error rates
- Resource utilization
- Custom business metrics

### Grafana Dashboards

Pre-configured dashboards available:
- Service overview
- Resource utilization
- Business metrics
- SLA tracking

### Alerting

Alertmanager configured for:
- High error rates
- Resource exhaustion
- Service unavailability
- Performance degradation

## Security

### Network Policies

- Default deny all traffic
- Allow same-namespace communication
- Allow ingress from ingress controller
- Allow monitoring from monitoring namespace
- Allow DNS resolution
- Allow external API calls

### Pod Security

- Run as non-root user (UID 1000)
- Read-only root filesystem
- Drop all capabilities
- No privilege escalation

### Secrets Management

All sensitive data stored as Kubernetes secrets:
- Database credentials
- API keys
- JWT secrets
- Payment gateway credentials

## High Availability

### Pod Distribution

- Anti-affinity rules spread pods across nodes
- Pod Disruption Budgets ensure minimum availability
- Multiple replicas for all critical services

### Health Checks

All services implement:
- **Liveness Probe**: Detects if container is alive
- **Readiness Probe**: Detects if container can serve traffic
- **Startup Probe**: Handles slow-starting containers

### Failure Recovery

- Automatic pod restart on failure
- Circuit breakers prevent cascade failures
- Retry policies for transient errors
- Graceful degradation

## Troubleshooting

### Check Service Status

```bash
# Get all resources
kubectl get all -n sai-mahendra-platform

# Check pod logs
kubectl logs -f deployment/user-management -n sai-mahendra-platform

# Describe pod for events
kubectl describe pod <pod-name> -n sai-mahendra-platform

# Check resource usage
kubectl top pods -n sai-mahendra-platform
```

### Common Issues

1. **ImagePullBackOff**: Check image name and registry credentials
2. **CrashLoopBackOff**: Check logs for application errors
3. **Pending Pods**: Check resource availability and quotas
4. **Service Unavailable**: Check endpoints and network policies

## Maintenance

### Rolling Updates

```bash
# Update image
kubectl set image deployment/user-management \
  user-management=saimahendra/user-management:v2.0.0 \
  -n sai-mahendra-platform

# Check rollout status
kubectl rollout status deployment/user-management -n sai-mahendra-platform

# Rollback if needed
kubectl rollout undo deployment/user-management -n sai-mahendra-platform
```

### Backup

```bash
# Backup all resources
kubectl get all -n sai-mahendra-platform -o yaml > backup.yaml

# Backup secrets (store securely)
kubectl get secrets -n sai-mahendra-platform -o yaml > secrets-backup.yaml
```

## Performance Tuning

### Resource Optimization

1. Monitor actual resource usage
2. Adjust requests/limits based on metrics
3. Tune HPA thresholds for optimal scaling
4. Optimize connection pools and timeouts

### Database Optimization

1. Use connection pooling
2. Implement caching strategies
3. Optimize queries and indexes
4. Use read replicas for read-heavy workloads

## Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Comprehensive deployment instructions
- [Monitoring Guide](./monitoring/README.md) - Monitoring setup and usage
- [Service Mesh Guide](./service-mesh/README.md) - Istio configuration and usage

## Support

For issues or questions:
- Email: admin@saimahendra.com
- Documentation: https://docs.saimahendra.com
- GitHub Issues: https://github.com/saimahendra/platform/issues
