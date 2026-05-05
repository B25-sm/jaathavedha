#!/bin/bash

# Deploy Alerting and Incident Response Infrastructure
# This script deploys Alertmanager, SLA tracking, and automated recovery mechanisms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists kubectl; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

if ! command_exists helm; then
    print_warning "helm is not installed. Some features may not be available."
fi

print_success "Prerequisites check passed"

# Check if monitoring namespace exists
print_info "Checking monitoring namespace..."
if ! kubectl get namespace monitoring >/dev/null 2>&1; then
    print_info "Creating monitoring namespace..."
    kubectl create namespace monitoring
    print_success "Monitoring namespace created"
else
    print_success "Monitoring namespace already exists"
fi

# Deploy Alertmanager
print_info "Deploying Alertmanager..."
kubectl apply -f alertmanager-deployment.yaml
print_success "Alertmanager deployed"

# Wait for Alertmanager to be ready
print_info "Waiting for Alertmanager to be ready..."
kubectl wait --for=condition=ready pod -l app=alertmanager -n monitoring --timeout=300s
print_success "Alertmanager is ready"

# Update Prometheus configuration to include Alertmanager
print_info "Updating Prometheus configuration..."
kubectl apply -f prometheus-deployment.yaml
print_success "Prometheus configuration updated"

# Deploy SLA tracking rules
print_info "Deploying SLA tracking rules..."
kubectl apply -f sla-tracking-rules.yaml
print_success "SLA tracking rules deployed"

# Reload Prometheus configuration
print_info "Reloading Prometheus configuration..."
PROMETHEUS_POD=$(kubectl get pod -n monitoring -l app=prometheus -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n monitoring $PROMETHEUS_POD -- curl -X POST http://localhost:9090/-/reload
print_success "Prometheus configuration reloaded"

# Deploy automated recovery mechanisms
print_info "Deploying automated recovery mechanisms..."
if kubectl get namespace sai-mahendra >/dev/null 2>&1; then
    kubectl apply -f automated-recovery.yaml
    print_success "Automated recovery mechanisms deployed"
else
    print_warning "sai-mahendra namespace not found. Skipping automated recovery deployment."
    print_warning "Run this script again after creating the application namespace."
fi

# Import SLA dashboard to Grafana
print_info "Importing SLA dashboard to Grafana..."
GRAFANA_POD=$(kubectl get pod -n monitoring -l app=grafana -o jsonpath='{.items[0].metadata.name}')
if [ -n "$GRAFANA_POD" ]; then
    kubectl cp grafana-sla-dashboard.json monitoring/$GRAFANA_POD:/tmp/sla-dashboard.json
    print_success "SLA dashboard imported to Grafana"
else
    print_warning "Grafana pod not found. Please import the dashboard manually."
fi

# Display service endpoints
print_info "Retrieving service endpoints..."
echo ""
print_success "=== Alerting Infrastructure Deployed ==="
echo ""

# Alertmanager
ALERTMANAGER_IP=$(kubectl get svc alertmanager -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
if [ "$ALERTMANAGER_IP" = "Pending" ] || [ -z "$ALERTMANAGER_IP" ]; then
    ALERTMANAGER_IP=$(kubectl get svc alertmanager -n monitoring -o jsonpath='{.spec.clusterIP}')
fi
echo -e "${GREEN}Alertmanager:${NC}"
echo "  Internal: http://alertmanager.monitoring.svc.cluster.local:9093"
echo "  External: http://$ALERTMANAGER_IP:9093"
echo "  Ingress: https://alertmanager.sai-mahendra.com (if configured)"
echo ""

# Prometheus
PROMETHEUS_IP=$(kubectl get svc prometheus -n monitoring -o jsonpath='{.spec.clusterIP}')
echo -e "${GREEN}Prometheus:${NC}"
echo "  Internal: http://prometheus.monitoring.svc.cluster.local:9090"
echo "  External: http://$PROMETHEUS_IP:9090"
echo ""

# Grafana
GRAFANA_IP=$(kubectl get svc grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
if [ "$GRAFANA_IP" = "Pending" ] || [ -z "$GRAFANA_IP" ]; then
    GRAFANA_IP=$(kubectl get svc grafana -n monitoring -o jsonpath='{.spec.clusterIP}')
fi
echo -e "${GREEN}Grafana:${NC}"
echo "  Internal: http://grafana.monitoring.svc.cluster.local:80"
echo "  External: http://$GRAFANA_IP:80"
echo "  Ingress: https://grafana.sai-mahendra.com (if configured)"
echo ""

# Port forwarding instructions
echo -e "${YELLOW}=== Port Forwarding Instructions ===${NC}"
echo ""
echo "To access services locally, run:"
echo ""
echo "  # Alertmanager"
echo "  kubectl port-forward -n monitoring svc/alertmanager 9093:9093"
echo "  # Then visit: http://localhost:9093"
echo ""
echo "  # Prometheus"
echo "  kubectl port-forward -n monitoring svc/prometheus 9090:9090"
echo "  # Then visit: http://localhost:9090"
echo ""
echo "  # Grafana"
echo "  kubectl port-forward -n monitoring svc/grafana 3000:80"
echo "  # Then visit: http://localhost:3000"
echo ""

# Configuration instructions
echo -e "${YELLOW}=== Configuration Required ===${NC}"
echo ""
print_warning "Please configure the following secrets:"
echo ""
echo "1. PagerDuty Integration:"
echo "   kubectl create secret generic alertmanager-secrets \\"
echo "     --from-literal=pagerduty-key=YOUR_PAGERDUTY_SERVICE_KEY \\"
echo "     -n monitoring"
echo ""
echo "2. Slack Webhook:"
echo "   kubectl patch secret alertmanager-secrets \\"
echo "     --patch='{\"data\":{\"slack-webhook\":\"BASE64_ENCODED_WEBHOOK_URL\"}}' \\"
echo "     -n monitoring"
echo ""
echo "3. SendGrid API Key:"
echo "   kubectl patch secret alertmanager-secrets \\"
echo "     --patch='{\"data\":{\"sendgrid-key\":\"BASE64_ENCODED_API_KEY\"}}' \\"
echo "     -n monitoring"
echo ""
echo "After updating secrets, restart Alertmanager:"
echo "   kubectl rollout restart deployment/alertmanager -n monitoring"
echo ""

# Health check
print_info "Performing health check..."
echo ""

# Check Alertmanager
if kubectl get pod -n monitoring -l app=alertmanager | grep -q "Running"; then
    print_success "✓ Alertmanager is running"
else
    print_error "✗ Alertmanager is not running"
fi

# Check Prometheus
if kubectl get pod -n monitoring -l app=prometheus | grep -q "Running"; then
    print_success "✓ Prometheus is running"
else
    print_error "✗ Prometheus is not running"
fi

# Check Grafana
if kubectl get pod -n monitoring -l app=grafana | grep -q "Running"; then
    print_success "✓ Grafana is running"
else
    print_error "✗ Grafana is not running"
fi

echo ""
print_success "=== Deployment Complete ==="
echo ""
print_info "Next steps:"
echo "  1. Configure PagerDuty, Slack, and email secrets"
echo "  2. Access Grafana and review SLA dashboard"
echo "  3. Test alerting by triggering a test alert"
echo "  4. Review incident runbooks in INCIDENT_RUNBOOKS.md"
echo "  5. Configure DNS for ingress endpoints"
echo ""
print_info "For detailed documentation, see:"
echo "  - INCIDENT_RUNBOOKS.md - Incident response procedures"
echo "  - TASK_17.2_COMPLETION_REPORT.md - Implementation details"
echo ""
