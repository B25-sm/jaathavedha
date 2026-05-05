#!/bin/bash

# Deployment Helper Script
# This script provides utilities for deployment operations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v aws >/dev/null 2>&1 || missing_tools+=("aws-cli")
    command -v jq >/dev/null 2>&1 || missing_tools+=("jq")
    command -v envsubst >/dev/null 2>&1 || missing_tools+=("envsubst")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    log_info "All prerequisites met"
}

# Validate environment
validate_environment() {
    local env=$1
    
    if [[ ! "$env" =~ ^(dev|staging|production)$ ]]; then
        log_error "Invalid environment: $env. Must be dev, staging, or production"
        exit 1
    fi
    
    log_info "Environment validated: $env"
}

# Check cluster connectivity
check_cluster() {
    local cluster_name=$1
    
    log_info "Checking cluster connectivity: $cluster_name"
    
    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cannot connect to cluster: $cluster_name"
        exit 1
    fi
    
    log_info "Cluster connectivity verified"
}

# Get current deployment version
get_current_version() {
    local namespace=$1
    local deployment=$2
    
    kubectl get deployment "$deployment" -n "$namespace" \
        -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "none"
}

# Wait for deployment rollout
wait_for_rollout() {
    local namespace=$1
    local deployment=$2
    local timeout=${3:-300}
    
    log_info "Waiting for rollout of $deployment in $namespace (timeout: ${timeout}s)"
    
    if kubectl rollout status deployment/"$deployment" -n "$namespace" --timeout="${timeout}s"; then
        log_info "Rollout successful: $deployment"
        return 0
    else
        log_error "Rollout failed: $deployment"
        return 1
    fi
}

# Health check
health_check() {
    local url=$1
    local max_attempts=${2:-10}
    local attempt=1
    
    log_info "Running health check: $url"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" >/dev/null; then
            log_info "Health check passed"
            return 0
        fi
        
        log_warn "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Backup deployment
backup_deployment() {
    local namespace=$1
    local backup_dir=${2:-./backups}
    local timestamp=$(date +%Y%m%d-%H%M%S)
    
    log_info "Creating deployment backup..."
    
    mkdir -p "$backup_dir"
    
    kubectl get all -n "$namespace" -o yaml > "$backup_dir/backup-$timestamp.yaml"
    
    log_info "Backup created: $backup_dir/backup-$timestamp.yaml"
}

# Rollback deployment
rollback_deployment() {
    local namespace=$1
    local deployment=$2
    
    log_warn "Rolling back deployment: $deployment"
    
    if kubectl rollout undo deployment/"$deployment" -n "$namespace"; then
        log_info "Rollback initiated for $deployment"
        wait_for_rollout "$namespace" "$deployment"
    else
        log_error "Rollback failed for $deployment"
        return 1
    fi
}

# Scale deployment
scale_deployment() {
    local namespace=$1
    local deployment=$2
    local replicas=$3
    
    log_info "Scaling $deployment to $replicas replicas"
    
    kubectl scale deployment/"$deployment" -n "$namespace" --replicas="$replicas"
    
    log_info "Scaled $deployment to $replicas replicas"
}

# Get pod logs
get_pod_logs() {
    local namespace=$1
    local deployment=$2
    local lines=${3:-100}
    
    log_info "Fetching logs for $deployment (last $lines lines)"
    
    local pod=$(kubectl get pods -n "$namespace" -l app="$deployment" \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -n "$pod" ]; then
        kubectl logs "$pod" -n "$namespace" --tail="$lines"
    else
        log_error "No pods found for deployment: $deployment"
        return 1
    fi
}

# Check deployment health
check_deployment_health() {
    local namespace=$1
    local deployment=$2
    
    log_info "Checking health of $deployment"
    
    local ready=$(kubectl get deployment "$deployment" -n "$namespace" \
        -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired=$(kubectl get deployment "$deployment" -n "$namespace" \
        -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    
    if [ "$ready" -eq "$desired" ] && [ "$ready" -gt 0 ]; then
        log_info "$deployment is healthy ($ready/$desired replicas ready)"
        return 0
    else
        log_error "$deployment is unhealthy ($ready/$desired replicas ready)"
        return 1
    fi
}

# Main command dispatcher
main() {
    local command=${1:-help}
    shift || true
    
    case "$command" in
        check-prereqs)
            check_prerequisites
            ;;
        validate-env)
            validate_environment "$@"
            ;;
        check-cluster)
            check_cluster "$@"
            ;;
        get-version)
            get_current_version "$@"
            ;;
        wait-rollout)
            wait_for_rollout "$@"
            ;;
        health-check)
            health_check "$@"
            ;;
        backup)
            backup_deployment "$@"
            ;;
        rollback)
            rollback_deployment "$@"
            ;;
        scale)
            scale_deployment "$@"
            ;;
        logs)
            get_pod_logs "$@"
            ;;
        check-health)
            check_deployment_health "$@"
            ;;
        help|*)
            cat << EOF
Deployment Helper Script

Usage: $0 <command> [arguments]

Commands:
  check-prereqs              Check if required tools are installed
  validate-env <env>         Validate environment name
  check-cluster <name>       Check cluster connectivity
  get-version <ns> <deploy>  Get current deployment version
  wait-rollout <ns> <deploy> [timeout]  Wait for deployment rollout
  health-check <url> [attempts]  Run health check
  backup <ns> [dir]          Backup deployment state
  rollback <ns> <deploy>     Rollback deployment
  scale <ns> <deploy> <replicas>  Scale deployment
  logs <ns> <deploy> [lines]  Get pod logs
  check-health <ns> <deploy>  Check deployment health
  help                       Show this help message

Examples:
  $0 check-prereqs
  $0 validate-env staging
  $0 wait-rollout staging api-gateway 300
  $0 health-check https://staging.saimahendra.com/health
  $0 backup staging ./backups
  $0 rollback staging api-gateway

EOF
            ;;
    esac
}

# Run main function
main "$@"
