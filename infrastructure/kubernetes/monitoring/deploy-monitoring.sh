#!/bin/bash

# Deploy Monitoring Stack for Sai Mahendra Platform
# This script deploys Prometheus, Grafana, ELK Stack, and Jaeger

set -e

echo "========================================="
echo "Deploying Monitoring Stack"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
    exit 1
fi

print_status "Connected to Kubernetes cluster"

# Create monitoring namespace
print_status "Creating monitoring namespace..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Deploy Prometheus
print_status "Deploying Prometheus..."
kubectl apply -f prometheus-deployment.yaml
kubectl apply -f prometheus-rules.yaml

# Wait for Prometheus to be ready
print_status "Waiting for Prometheus to be ready..."
kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=300s

# Deploy Grafana
print_status "Deploying Grafana..."
kubectl apply -f grafana-deployment.yaml

# Wait for Grafana to be ready
print_status "Waiting for Grafana to be ready..."
kubectl wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=300s

# Deploy Elasticsearch
print_status "Deploying Elasticsearch..."
kubectl apply -f elasticsearch-deployment.yaml

# Wait for Elasticsearch to be ready
print_status "Waiting for Elasticsearch to be ready (this may take a few minutes)..."
kubectl wait --for=condition=ready pod -l app=elasticsearch -n monitoring --timeout=600s

# Deploy Logstash
print_status "Deploying Logstash..."
kubectl apply -f logstash-deployment.yaml

# Wait for Logstash to be ready
print_status "Waiting for Logstash to be ready..."
kubectl wait --for=condition=ready pod -l app=logstash -n monitoring --timeout=300s

# Deploy Kibana
print_status "Deploying Kibana..."
kubectl apply -f kibana-deployment.yaml

# Wait for Kibana to be ready
print_status "Waiting for Kibana to be ready..."
kubectl wait --for=condition=ready pod -l app=kibana -n monitoring --timeout=300s

# Deploy Jaeger
print_status "Deploying Jaeger..."
kubectl apply -f jaeger-deployment.yaml

# Wait for Jaeger to be ready
print_status "Waiting for Jaeger to be ready..."
kubectl wait --for=condition=ready pod -l app=jaeger,component=collector -n monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=jaeger,component=query -n monitoring --timeout=300s

# Deploy Exporters
print_status "Deploying metric exporters..."
kubectl apply -f exporters-deployment.yaml

# Wait for exporters to be ready
print_status "Waiting for exporters to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres-exporter -n monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis-exporter -n monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=mongodb-exporter -n monitoring --timeout=300s

echo ""
echo "========================================="
echo "Monitoring Stack Deployment Complete!"
echo "========================================="
echo ""

# Get service endpoints
print_status "Service Endpoints:"
echo ""

# Prometheus
PROMETHEUS_IP=$(kubectl get svc prometheus -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
echo "Prometheus:     http://${PROMETHEUS_IP}:9090"

# Grafana
GRAFANA_IP=$(kubectl get svc grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
echo "Grafana:        http://${GRAFANA_IP}"
echo "  Username:     admin"
echo "  Password:     changeme123!"

# Kibana
KIBANA_IP=$(kubectl get svc kibana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
echo "Kibana:         http://${KIBANA_IP}"

# Jaeger
JAEGER_IP=$(kubectl get svc jaeger-query -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
echo "Jaeger:         http://${JAEGER_IP}"

echo ""
print_warning "Note: LoadBalancer IPs may take a few minutes to be assigned."
print_warning "Use 'kubectl get svc -n monitoring' to check the status."
echo ""

# Port forwarding instructions
echo "========================================="
echo "Port Forwarding (for local access):"
echo "========================================="
echo ""
echo "Prometheus:  kubectl port-forward -n monitoring svc/prometheus 9090:9090"
echo "Grafana:     kubectl port-forward -n monitoring svc/grafana 3000:80"
echo "Kibana:      kubectl port-forward -n monitoring svc/kibana 5601:80"
echo "Jaeger:      kubectl port-forward -n monitoring svc/jaeger-query 16686:80"
echo ""

# Verification
echo "========================================="
echo "Verification Commands:"
echo "========================================="
echo ""
echo "Check all pods:        kubectl get pods -n monitoring"
echo "Check all services:    kubectl get svc -n monitoring"
echo "Check Prometheus:      kubectl logs -n monitoring -l app=prometheus"
echo "Check Grafana:         kubectl logs -n monitoring -l app=grafana"
echo "Check Elasticsearch:   kubectl logs -n monitoring -l app=elasticsearch"
echo "Check Logstash:        kubectl logs -n monitoring -l app=logstash"
echo "Check Kibana:          kubectl logs -n monitoring -l app=kibana"
echo "Check Jaeger:          kubectl logs -n monitoring -l app=jaeger,component=collector"
echo ""

print_status "Monitoring stack deployment completed successfully!"
