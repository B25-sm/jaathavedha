# Kubernetes Deployment Guide

This guide provides comprehensive instructions for deploying the Sai Mahendra Platform to Kubernetes.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Deployment Steps](#deployment-steps)
4. [Environment-Specific Deployments](#environment-specific-deployments)
5. [Service Mesh Setup](#service-mesh-setup)
6. [Monitoring Setup](#monitoring-setup)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **kubectl** (v1.24+): Kubernetes command-line tool
- **helm** (v3.10+): Kubernetes package manager
- **istioctl** (v1.18+): Istio service mesh CLI (optional)
- **cert-manager** (v1.12+): Certificate management for TLS

### Cluster Requirements

- Kubernetes cluster (v1.24+)
- Minimum 3 worker nodes
- 20 CPU cores and 40GB RAM available
- Storage class for persistent volumes
- Load balancer support (for cloud providers)

### Access Requirements

- Cluster admin access
- Docker registry access for pulling images
- DNS configuration access for domain setup

## Quick Start

### 1. Create Namespace

```bash
kubectl apply -f k8s/base/namespace.yaml
```

### 2. Create Secrets

```bash
# Copy the secrets template
cp infrastructure/kubernetes/secrets/secrets-template.yaml infrastructure/kubernetes/secrets/secrets.yaml

# Edit secrets.yaml and replace all <BASE64_ENCODED_VALUE> with actual base64 encoded values
# Example: echo -n "your-secret-value" | base64

# Apply secrets
kubectl apply -f infrastructure/kubernetes/secrets/secrets.yaml
```

### 3. Deploy Services

```bash
# Deploy all services
kubectl apply -f infrastructure/kubernetes/deployments/

# Verify deployments
kubectl get deployments -n sai-mahendra-platform
kubectl get pods -n sai-mahendra-platform
```

### 4. Deploy Autoscaling

```bash
kubectl apply -f infrastructure/kubernetes/autoscaling/hpa-all-services.yaml
```

### 5. Deploy Ingress Controller

```bash
# Deploy NGINX Ingress Controller
kubectl apply -f infrastructure/kubernetes/ingress/nginx-ingress-controller.yaml

# Deploy platform ingress rules
kubectl apply -f infrastructure/kubernetes/ingress/platform-ingress.yaml
```

### 6. Apply Resource Management

```bash
kubectl apply -f infrastructure/kubernetes/resource-management/resource-quotas.yaml
```

## Deployment Steps

### Step 1: Prepare Secrets

All sensitive configuration must be stored as Kubernetes secrets:

```bash
# Database credentials
kubectl create secret generic database-credentials \
  --from-literal=postgres-url="postgresql://user:password@postgres:5432/saimahendra" \
  -n sai-mahendra-platform

# Redis credentials
kubectl create secret generic redis-credentials \
  --from-literal=url="redis://:password@redis:6379" \
  -n sai-mahendra-platform

# JWT secrets
kubectl create secret generic jwt-secret \
  --from-literal=secret="your-jwt-secret" \
  --from-literal=refresh-secret="your-refresh-secret" \
  -n sai-mahendra-platform

# AWS credentials
kubectl create secret generic aws-credentials \
  --from-literal=access-key-id="your-access-key" \
  --from-literal=secret-access-key="your-secret-key" \
  -n sai-mahendra-platform

# Payment gateway credentials
kubectl create secret generic razorpay-credentials \
  --from-literal=key-id="your-razorpay-key" \
  --from-literal=key-secret="your-razorpay-secret" \
  -n sai-mahendra-platform

kubectl create secret generic stripe-credentials \
  --from-literal=secret-key="your-stripe-key" \
  --from-literal=webhook-secret="your-webhook-secret" \
  -n sai-mahendra-platform
```

### Step 2: Deploy Core Services

Deploy services in order of dependency:

```bash
# 1. Deploy API Gateway
kubectl apply -f infrastructure/kubernetes/deployments/api-gateway.yaml

# 2. Deploy User Management
kubectl apply -f infrastructure/kubernetes/deployments/user-management.yaml

# 3. Deploy Course Management
kubectl apply -f infrastructure/kubernetes/deployments/course-management.yaml

# 4. Deploy Payment Service
kubectl apply -f infrastructure/kubernetes/deployments/payment.yaml

# 5. Deploy remaining services
kubectl apply -f infrastructure/kubernetes/deployments/contact.yaml
kubectl apply -f infrastructure/kubernetes/deployments/content-management.yaml
kubectl apply -f infrastructure/kubernetes/deployments/analytics.yaml
kubectl apply -f infrastructure/kubernetes/deployments/notification.yaml
kubectl apply -f infrastructure/kubernetes/deployments/admin-panel.yaml
kubectl apply -f infrastructure/kubernetes/deployments/pwa.yaml
kubectl apply -f infrastructure/kubernetes/deployments/video-conferencing.yaml
kubectl apply -f infrastructure/kubernetes/deployments/calendar-integration.yaml
```

### Step 3: Verify Deployments

```bash
# Check pod status
kubectl get pods -n sai-mahendra-platform

# Check service endpoints
kubectl get svc -n sai-mahendra-platform

# Check logs for any service
kubectl logs -f deployment/user-management -n sai-mahendra-platform

# Check resource usage
kubectl top pods -n sai-mahendra-platform
```

### Step 4: Configure Autoscaling

```bash
# Apply HPA configurations
kubectl apply -f infrastructure/kubernetes/autoscaling/hpa-all-services.yaml

# Verify HPA status
kubectl get hpa -n sai-mahendra-platform
```

### Step 5: Setup Ingress and TLS

```bash
# Install cert-manager (if not already installed)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Deploy NGINX Ingress Controller
kubectl apply -f infrastructure/kubernetes/ingress/nginx-ingress-controller.yaml

# Deploy platform ingress
kubectl apply -f infrastructure/kubernetes/ingress/platform-ingress.yaml

# Verify ingress
kubectl get ingress -n sai-mahendra-platform

# Check certificate status
kubectl get certificate -n sai-mahendra-platform
```

## Environment-Specific Deployments

### Using Helm for Environment Management

#### Development Environment

```bash
# Install/upgrade development environment
helm upgrade --install sai-mahendra-dev \
  ./infrastructure/helm/sai-mahendra-platform \
  --namespace sai-mahendra-platform \
  --create-namespace \
  --values ./infrastructure/helm/sai-mahendra-platform/values-dev.yaml
```

#### Staging Environment

```bash
# Install/upgrade staging environment
helm upgrade --install sai-mahendra-staging \
  ./infrastructure/helm/sai-mahendra-platform \
  --namespace sai-mahendra-platform \
  --create-namespace \
  --values ./infrastructure/helm/sai-mahendra-platform/values-staging.yaml
```

#### Production Environment

```bash
# Install/upgrade production environment
helm upgrade --install sai-mahendra-prod \
  ./infrastructure/helm/sai-mahendra-platform \
  --namespace sai-mahendra-platform \
  --create-namespace \
  --values ./infrastructure/helm/sai-mahendra-platform/values-prod.yaml
```

### Helm Commands

```bash
# List releases
helm list -n sai-mahendra-platform

# Get release status
helm status sai-mahendra-prod -n sai-mahendra-platform

# Rollback to previous version
helm rollback sai-mahendra-prod -n sai-mahendra-platform

# Uninstall release
helm uninstall sai-mahendra-prod -n sai-mahendra-platform
```

## Service Mesh Setup

### Install Istio

```bash
# Download Istio
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# Install Istio with custom configuration
istioctl install -f infrastructure/kubernetes/service-mesh/istio-installation.yaml

# Verify installation
kubectl get pods -n istio-system
```

### Deploy Service Mesh Components

```bash
# Apply Istio gateway
kubectl apply -f infrastructure/kubernetes/service-mesh/istio-gateway.yaml

# Apply virtual services
kubectl apply -f infrastructure/kubernetes/service-mesh/virtual-services.yaml

# Apply destination rules
kubectl apply -f infrastructure/kubernetes/service-mesh/destination-rules.yaml

# Apply circuit breaker
kubectl apply -f infrastructure/kubernetes/service-mesh/circuit-breaker.yaml
```

### Enable Sidecar Injection

```bash
# Label namespace for automatic sidecar injection
kubectl label namespace sai-mahendra-platform istio-injection=enabled

# Restart pods to inject sidecars
kubectl rollout restart deployment -n sai-mahendra-platform
```

### Verify Service Mesh

```bash
# Check sidecar injection
kubectl get pods -n sai-mahendra-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].name}{"\n"}{end}'

# Access Kiali dashboard
istioctl dashboard kiali

# Access Jaeger tracing
istioctl dashboard jaeger
```

## Monitoring Setup

Monitoring infrastructure is deployed separately. See `infrastructure/kubernetes/monitoring/` for details.

```bash
# Deploy monitoring stack
kubectl apply -f infrastructure/kubernetes/monitoring/prometheus-deployment.yaml
kubectl apply -f infrastructure/kubernetes/monitoring/grafana-deployment.yaml
kubectl apply -f infrastructure/kubernetes/monitoring/alertmanager-deployment.yaml

# Access Grafana dashboard
kubectl port-forward -n sai-mahendra-monitoring svc/grafana 3000:3000

# Access Prometheus
kubectl port-forward -n sai-mahendra-monitoring svc/prometheus 9090:9090
```

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n sai-mahendra-platform

# Check logs
kubectl logs <pod-name> -n sai-mahendra-platform

# Check resource constraints
kubectl get resourcequota -n sai-mahendra-platform
kubectl get limitrange -n sai-mahendra-platform
```

#### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints <service-name> -n sai-mahendra-platform

# Check ingress
kubectl describe ingress -n sai-mahendra-platform

# Test service connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://<service-name>:port
```

#### Certificate Issues

```bash
# Check certificate status
kubectl get certificate -n sai-mahendra-platform
kubectl describe certificate <cert-name> -n sai-mahendra-platform

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

#### High Resource Usage

```bash
# Check resource usage
kubectl top pods -n sai-mahendra-platform
kubectl top nodes

# Check HPA status
kubectl get hpa -n sai-mahendra-platform
kubectl describe hpa <hpa-name> -n sai-mahendra-platform
```

### Debug Commands

```bash
# Get all resources in namespace
kubectl get all -n sai-mahendra-platform

# Check events
kubectl get events -n sai-mahendra-platform --sort-by='.lastTimestamp'

# Execute command in pod
kubectl exec -it <pod-name> -n sai-mahendra-platform -- /bin/sh

# Port forward for local testing
kubectl port-forward -n sai-mahendra-platform svc/<service-name> 8080:3000
```

## Scaling

### Manual Scaling

```bash
# Scale deployment
kubectl scale deployment user-management --replicas=5 -n sai-mahendra-platform

# Check scaling status
kubectl get deployment user-management -n sai-mahendra-platform
```

### Autoscaling Configuration

HPA automatically scales based on CPU/memory metrics. To adjust:

```bash
# Edit HPA
kubectl edit hpa user-management-hpa -n sai-mahendra-platform

# View HPA metrics
kubectl get hpa -n sai-mahendra-platform --watch
```

## Backup and Recovery

### Backup Kubernetes Resources

```bash
# Backup all resources
kubectl get all -n sai-mahendra-platform -o yaml > backup-$(date +%Y%m%d).yaml

# Backup secrets (encrypted)
kubectl get secrets -n sai-mahendra-platform -o yaml > secrets-backup-$(date +%Y%m%d).yaml
```

### Disaster Recovery

```bash
# Restore from backup
kubectl apply -f backup-20240101.yaml

# Verify restoration
kubectl get all -n sai-mahendra-platform
```

## Maintenance

### Rolling Updates

```bash
# Update image
kubectl set image deployment/user-management user-management=saimahendra/user-management:v2.0.0 -n sai-mahendra-platform

# Check rollout status
kubectl rollout status deployment/user-management -n sai-mahendra-platform

# Rollback if needed
kubectl rollout undo deployment/user-management -n sai-mahendra-platform
```

### Cluster Maintenance

```bash
# Drain node for maintenance
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Uncordon node after maintenance
kubectl uncordon <node-name>
```

## Security Best Practices

1. **Always use secrets** for sensitive data
2. **Enable RBAC** and follow principle of least privilege
3. **Use network policies** to restrict traffic
4. **Enable Pod Security Policies** or Pod Security Standards
5. **Regularly update** images and dependencies
6. **Enable audit logging** for compliance
7. **Use service mesh mTLS** for service-to-service communication
8. **Implement resource quotas** to prevent resource exhaustion

## Support

For issues or questions:
- Check logs: `kubectl logs -f deployment/<service-name> -n sai-mahendra-platform`
- Review events: `kubectl get events -n sai-mahendra-platform`
- Contact: admin@saimahendra.com
