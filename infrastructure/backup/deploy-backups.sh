#!/bin/bash
set -e

# Automated Backup System Deployment Script
# This script deploys all backup configurations to Kubernetes

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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    # Check Terraform (for S3 replication)
    if ! command -v terraform &> /dev/null; then
        log_warn "Terraform not found. S3 replication will be skipped."
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster."
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

create_namespace() {
    log_info "Creating backup namespace..."
    
    kubectl create namespace backup --dry-run=client -o yaml | kubectl apply -f -
    
    log_info "Namespace created"
}

create_service_account() {
    log_info "Creating backup service account and RBAC..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backup-service-account
  namespace: backup
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: backup-role
  namespace: backup
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: backup-role-binding
  namespace: backup
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: backup-role
subjects:
- kind: ServiceAccount
  name: backup-service-account
  namespace: backup
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backup-cluster-role
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
- apiGroups: ["apps"]
  resources: ["statefulsets", "deployments"]
  verbs: ["get", "list", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backup-cluster-role-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: backup-cluster-role
subjects:
- kind: ServiceAccount
  name: backup-service-account
  namespace: backup
EOF
    
    log_info "Service account and RBAC created"
}

deploy_postgres_backup() {
    log_info "Deploying PostgreSQL backup configuration..."
    
    kubectl apply -f postgres/backup-config.yaml
    
    log_info "PostgreSQL backup deployed"
}

deploy_mongodb_backup() {
    log_info "Deploying MongoDB backup configuration..."
    
    kubectl apply -f mongodb/backup-config.yaml
    
    log_info "MongoDB backup deployed"
}

deploy_redis_backup() {
    log_info "Deploying Redis backup configuration..."
    
    kubectl apply -f redis/backup-config.yaml
    
    log_info "Redis backup deployed"
}

deploy_s3_replication() {
    log_info "Deploying S3 cross-region replication..."
    
    if ! command -v terraform &> /dev/null; then
        log_warn "Terraform not found. Skipping S3 replication deployment."
        log_warn "Please install Terraform and run: cd s3 && terraform init && terraform apply"
        return
    fi
    
    cd s3
    
    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init
    
    # Plan
    log_info "Planning Terraform changes..."
    terraform plan -out=tfplan
    
    # Ask for confirmation
    read -p "Apply Terraform changes? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        terraform apply tfplan
        log_info "S3 replication deployed"
    else
        log_warn "S3 replication deployment skipped"
    fi
    
    cd ..
}

create_s3_buckets() {
    log_info "Creating S3 backup buckets..."
    
    # Create backup bucket in primary region
    aws s3 mb s3://sai-mahendra-backups --region us-east-1 2>/dev/null || log_warn "Bucket already exists"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket sai-mahendra-backups \
        --versioning-configuration Status=Enabled \
        --region us-east-1
    
    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket sai-mahendra-backups \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }' \
        --region us-east-1
    
    # Create WAL archive bucket
    aws s3 mb s3://sai-mahendra-wal-archives --region us-east-1 2>/dev/null || log_warn "WAL bucket already exists"
    
    log_info "S3 buckets created and configured"
}

verify_deployment() {
    log_info "Verifying backup deployment..."
    
    # Check CronJobs
    log_info "Checking CronJobs..."
    kubectl get cronjobs -n backup
    
    # Check ConfigMaps
    log_info "Checking ConfigMaps..."
    kubectl get configmaps -n backup
    
    # Check Secrets
    log_info "Checking Secrets..."
    kubectl get secrets -n backup
    
    # Check Service Account
    log_info "Checking Service Account..."
    kubectl get serviceaccount backup-service-account -n backup
    
    log_info "Deployment verification complete"
}

print_next_steps() {
    echo ""
    log_info "========================================="
    log_info "Backup System Deployment Complete!"
    log_info "========================================="
    echo ""
    log_warn "IMPORTANT: Update the following secrets with production credentials:"
    echo ""
    echo "  1. PostgreSQL backup credentials:"
    echo "     kubectl edit secret postgres-backup-credentials -n backup"
    echo ""
    echo "  2. MongoDB backup credentials:"
    echo "     kubectl edit secret mongodb-backup-credentials -n backup"
    echo ""
    echo "  3. Redis backup credentials:"
    echo "     kubectl edit secret redis-backup-credentials -n backup"
    echo ""
    log_info "Next steps:"
    echo ""
    echo "  1. Verify backup schedules:"
    echo "     kubectl get cronjobs -n backup"
    echo ""
    echo "  2. Trigger manual backup test:"
    echo "     kubectl create job --from=cronjob/postgres-backup postgres-backup-test -n backup"
    echo ""
    echo "  3. Monitor backup jobs:"
    echo "     kubectl get jobs -n backup -w"
    echo ""
    echo "  4. Check backup logs:"
    echo "     kubectl logs -n backup -l app=postgres-backup"
    echo ""
    echo "  5. Verify backups in S3:"
    echo "     aws s3 ls s3://sai-mahendra-backups/ --recursive"
    echo ""
    log_info "For recovery procedures, see:"
    echo "  - postgres/RECOVERY.md"
    echo "  - mongodb/RECOVERY.md"
    echo "  - redis/RECOVERY.md"
    echo "  - s3/RECOVERY.md"
    echo ""
}

# Main execution
main() {
    log_info "Starting backup system deployment..."
    
    # Parse arguments
    COMPONENT=${1:-all}
    
    check_prerequisites
    
    if [ "$COMPONENT" = "all" ] || [ "$COMPONENT" = "setup" ]; then
        create_namespace
        create_service_account
        create_s3_buckets
    fi
    
    if [ "$COMPONENT" = "all" ] || [ "$COMPONENT" = "postgres" ]; then
        deploy_postgres_backup
    fi
    
    if [ "$COMPONENT" = "all" ] || [ "$COMPONENT" = "mongodb" ]; then
        deploy_mongodb_backup
    fi
    
    if [ "$COMPONENT" = "all" ] || [ "$COMPONENT" = "redis" ]; then
        deploy_redis_backup
    fi
    
    if [ "$COMPONENT" = "all" ] || [ "$COMPONENT" = "s3" ]; then
        deploy_s3_replication
    fi
    
    if [ "$COMPONENT" = "all" ]; then
        verify_deployment
        print_next_steps
    fi
    
    log_info "Deployment complete!"
}

# Show usage
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 [component]"
    echo ""
    echo "Components:"
    echo "  all       - Deploy all backup systems (default)"
    echo "  setup     - Create namespace, RBAC, and S3 buckets only"
    echo "  postgres  - Deploy PostgreSQL backup only"
    echo "  mongodb   - Deploy MongoDB backup only"
    echo "  redis     - Deploy Redis backup only"
    echo "  s3        - Deploy S3 replication only"
    echo ""
    echo "Examples:"
    echo "  $0              # Deploy everything"
    echo "  $0 postgres     # Deploy PostgreSQL backup only"
    echo "  $0 setup        # Setup infrastructure only"
    exit 0
fi

# Run main
main "$@"
