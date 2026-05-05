#!/bin/bash

# Sai Mahendra Platform Kubernetes Deployment Script
# This script automates the deployment of the platform to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="sai-mahendra-platform"
ENVIRONMENT="${1:-production}"
HELM_RELEASE="sai-mahendra-${ENVIRONMENT}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm not found. Please install helm."
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

create_namespace() {
    log_info "Creating namespace ${NAMESPACE}..."
    
    if kubectl get namespace ${NAMESPACE} &> /dev/null; then
        log_warn "Namespace ${NAMESPACE} already exists."
    else
        kubectl apply -f ../../k8s/base/namespace.yaml
        log_info "Namespace created successfully."
    fi
}

check_secrets() {
    log_info "Checking secrets..."
    
    REQUIRED_SECRETS=(
        "database-credentials"
        "mongodb-credentials"
        "redis-credentials"
        "jwt-secret"
        "aws-credentials"
        "razorpay-credentials"
        "stripe-credentials"
        "sendgrid-credentials"
    )
    
    MISSING_SECRETS=()
    
    for secret in "${REQUIRED_SECRETS[@]}"; do
        if ! kubectl get secret ${secret} -n ${NAMESPACE} &> /dev/null; then
            MISSING_SECRETS+=("${secret}")
        fi
    done
    
    if [ ${#MISSING_SECRETS[@]} -ne 0 ]; then
        log_error "Missing secrets: ${MISSING_SECRETS[*]}"
        log_error "Please create secrets before deploying. See secrets/secrets-template.yaml"
        exit 1
    fi
    
    log_info "All required secrets are present."
}

deploy_with_helm() {
    log_info "Deploying with Helm (environment: ${ENVIRONMENT})..."
    
    VALUES_FILE="../helm/sai-mahendra-platform/values-${ENVIRONMENT}.yaml"
    
    if [ ! -f "${VALUES_FILE}" ]; then
        log_error "Values file not found: ${VALUES_FILE}"
        exit 1
    fi
    
    helm upgrade --install ${HELM_RELEASE} \
        ../helm/sai-mahendra-platform \
        --namespace ${NAMESPACE} \
        --create-namespace \
        --values ${VALUES_FILE} \
        --wait \
        --timeout 10m
    
    log_info "Helm deployment completed."
}

deploy_with_kubectl() {
    log_info "Deploying with kubectl..."
    
    # Deploy services
    log_info "Deploying services..."
    kubectl apply -f deployments/
    
    # Deploy autoscaling
    log_info "Deploying autoscaling configurations..."
    kubectl apply -f autoscaling/hpa-all-services.yaml
    
    # Deploy ingress
    log_info "Deploying ingress..."
    kubectl apply -f ingress/nginx-ingress-controller.yaml
    kubectl apply -f ingress/platform-ingress.yaml
    
    # Deploy resource management
    log_info "Deploying resource management..."
    kubectl apply -f resource-management/resource-quotas.yaml
    
    log_info "kubectl deployment completed."
}

deploy_service_mesh() {
    log_info "Deploying service mesh (Istio)..."
    
    # Check if istioctl is available
    if ! command -v istioctl &> /dev/null; then
        log_warn "istioctl not found. Skipping service mesh deployment."
        return
    fi
    
    # Install Istio
    log_info "Installing Istio..."
    istioctl install -f service-mesh/istio-installation.yaml -y
    
    # Enable sidecar injection
    log_info "Enabling sidecar injection..."
    kubectl label namespace ${NAMESPACE} istio-injection=enabled --overwrite
    
    # Deploy service mesh components
    log_info "Deploying service mesh components..."
    kubectl apply -f service-mesh/istio-gateway.yaml
    kubectl apply -f service-mesh/virtual-services.yaml
    kubectl apply -f service-mesh/destination-rules.yaml
    kubectl apply -f service-mesh/circuit-breaker.yaml
    
    log_info "Service mesh deployment completed."
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s \
        deployment --all -n ${NAMESPACE}
    
    # Check pod status
    log_info "Checking pod status..."
    kubectl get pods -n ${NAMESPACE}
    
    # Check service endpoints
    log_info "Checking service endpoints..."
    kubectl get svc -n ${NAMESPACE}
    
    # Check HPA status
    log_info "Checking HPA status..."
    kubectl get hpa -n ${NAMESPACE}
    
    # Check ingress
    log_info "Checking ingress..."
    kubectl get ingress -n ${NAMESPACE}
    
    log_info "Deployment verification completed."
}

show_access_info() {
    log_info "Deployment completed successfully!"
    echo ""
    echo "Access Information:"
    echo "===================="
    
    # Get ingress IP/hostname
    INGRESS_IP=$(kubectl get svc ingress-nginx -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    INGRESS_HOSTNAME=$(kubectl get svc ingress-nginx -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    
    if [ "${INGRESS_IP}" != "pending" ]; then
        echo "Ingress IP: ${INGRESS_IP}"
    fi
    
    if [ -n "${INGRESS_HOSTNAME}" ]; then
        echo "Ingress Hostname: ${INGRESS_HOSTNAME}"
    fi
    
    echo ""
    echo "API Endpoints:"
    echo "  - API Gateway: https://api.${ENVIRONMENT}.saimahendra.com"
    echo "  - Admin Panel: https://admin.${ENVIRONMENT}.saimahendra.com"
    echo ""
    echo "Monitoring:"
    echo "  - Prometheus: kubectl port-forward -n sai-mahendra-monitoring svc/prometheus 9090:9090"
    echo "  - Grafana: kubectl port-forward -n sai-mahendra-monitoring svc/grafana 3000:3000"
    echo ""
    echo "Useful Commands:"
    echo "  - View pods: kubectl get pods -n ${NAMESPACE}"
    echo "  - View logs: kubectl logs -f deployment/<service-name> -n ${NAMESPACE}"
    echo "  - View HPA: kubectl get hpa -n ${NAMESPACE}"
    echo ""
}

rollback() {
    log_warn "Rolling back deployment..."
    
    if [ "${DEPLOYMENT_METHOD}" == "helm" ]; then
        helm rollback ${HELM_RELEASE} -n ${NAMESPACE}
    else
        log_error "Rollback not supported for kubectl deployments. Please manually revert."
    fi
}

# Main execution
main() {
    log_info "Starting deployment for environment: ${ENVIRONMENT}"
    
    # Check prerequisites
    check_prerequisites
    
    # Create namespace
    create_namespace
    
    # Check secrets
    check_secrets
    
    # Ask for deployment method
    echo ""
    echo "Select deployment method:"
    echo "1) Helm (recommended)"
    echo "2) kubectl"
    read -p "Enter choice [1-2]: " choice
    
    case $choice in
        1)
            DEPLOYMENT_METHOD="helm"
            deploy_with_helm
            ;;
        2)
            DEPLOYMENT_METHOD="kubectl"
            deploy_with_kubectl
            ;;
        *)
            log_error "Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    # Ask about service mesh
    echo ""
    read -p "Deploy service mesh (Istio)? [y/N]: " deploy_mesh
    if [[ $deploy_mesh =~ ^[Yy]$ ]]; then
        deploy_service_mesh
    fi
    
    # Verify deployment
    verify_deployment
    
    # Show access information
    show_access_info
}

# Trap errors and rollback
trap 'log_error "Deployment failed. Check logs above."; exit 1' ERR

# Run main function
main
