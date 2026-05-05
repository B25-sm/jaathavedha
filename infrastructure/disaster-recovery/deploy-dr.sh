#!/bin/bash
# Disaster Recovery Infrastructure Deployment Script
# This script deploys multi-region disaster recovery infrastructure

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/disaster-recovery/deploy-$(date +%Y%m%d-%H%M%S).log"
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Logging functions
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Banner
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Disaster Recovery Infrastructure Deployment            ║
║   Sai Mahendra Platform                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF

log "========================================="
log "Starting DR Infrastructure Deployment"
log "========================================="
log "Primary Region: $PRIMARY_REGION"
log "Secondary Region: $SECONDARY_REGION"
log "Log File: $LOG_FILE"
log "========================================="

# Check prerequisites
log_info "Checking prerequisites..."

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed"
        return 1
    fi
    log_success "$1 is installed"
    return 0
}

PREREQ_FAILED=0
check_command "aws" || PREREQ_FAILED=1
check_command "terraform" || PREREQ_FAILED=1
check_command "kubectl" || PREREQ_FAILED=1
check_command "jq" || PREREQ_FAILED=1

if [ $PREREQ_FAILED -eq 1 ]; then
    log_error "Prerequisites check failed. Please install missing tools."
    exit 1
fi

# Check AWS credentials
log_info "Verifying AWS credentials..."
if aws sts get-caller-identity &>/dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    log_success "AWS credentials valid (Account: $AWS_ACCOUNT)"
else
    log_error "AWS credentials not configured"
    exit 1
fi

# Check required environment variables
log_info "Checking environment variables..."

check_env_var() {
    if [ -z "${!1:-}" ]; then
        log_error "Environment variable $1 is not set"
        return 1
    fi
    log_success "$1 is set"
    return 0
}

ENV_FAILED=0
check_env_var "DB_USERNAME" || ENV_FAILED=1
check_env_var "DB_PASSWORD" || ENV_FAILED=1
check_env_var "REDIS_AUTH_TOKEN" || ENV_FAILED=1
check_env_var "DOMAIN_NAME" || ENV_FAILED=1
check_env_var "ROUTE53_ZONE_ID" || ENV_FAILED=1

if [ $ENV_FAILED -eq 1 ]; then
    log_error "Required environment variables are missing"
    log_info "Please set: DB_USERNAME, DB_PASSWORD, REDIS_AUTH_TOKEN, DOMAIN_NAME, ROUTE53_ZONE_ID"
    exit 1
fi

# Confirmation prompt
log_warning "This will deploy disaster recovery infrastructure across multiple regions."
log_warning "Estimated cost: ~$50,000/year"
log_warning "Deployment time: 30-45 minutes"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Deployment cancelled by user"
    exit 0
fi

# Step 1: Deploy Terraform Infrastructure
log "========================================="
log "Step 1: Deploying Terraform Infrastructure"
log "========================================="

cd "$SCRIPT_DIR/terraform"

log_info "Initializing Terraform..."
if terraform init; then
    log_success "Terraform initialized"
else
    log_error "Terraform initialization failed"
    exit 1
fi

log_info "Validating Terraform configuration..."
if terraform validate; then
    log_success "Terraform configuration is valid"
else
    log_error "Terraform validation failed"
    exit 1
fi

log_info "Planning Terraform deployment..."
if terraform plan -out=tfplan; then
    log_success "Terraform plan created"
else
    log_error "Terraform planning failed"
    exit 1
fi

log_info "Applying Terraform configuration..."
log_warning "This will take 30-45 minutes..."
if terraform apply tfplan; then
    log_success "Terraform infrastructure deployed"
else
    log_error "Terraform apply failed"
    exit 1
fi

log_info "Saving Terraform outputs..."
terraform output -json > "$SCRIPT_DIR/terraform-outputs.json"
log_success "Terraform outputs saved"

# Step 2: Configure Kubernetes Contexts
log "========================================="
log "Step 2: Configuring Kubernetes Contexts"
log "========================================="

PRIMARY_CLUSTER=$(terraform output -raw primary_eks_cluster_name)
SECONDARY_CLUSTER=$(terraform output -raw secondary_eks_cluster_name)

log_info "Configuring primary cluster context..."
if aws eks update-kubeconfig \
    --name "$PRIMARY_CLUSTER" \
    --region "$PRIMARY_REGION" \
    --alias primary; then
    log_success "Primary cluster context configured"
else
    log_error "Failed to configure primary cluster context"
    exit 1
fi

log_info "Configuring secondary cluster context..."
if aws eks update-kubeconfig \
    --name "$SECONDARY_CLUSTER" \
    --region "$SECONDARY_REGION" \
    --alias secondary; then
    log_success "Secondary cluster context configured"
else
    log_error "Failed to configure secondary cluster context"
    exit 1
fi

# Step 3: Deploy Kubernetes Resources
log "========================================="
log "Step 3: Deploying Kubernetes Resources"
log "========================================="

log_info "Creating namespaces..."
kubectl create namespace production --context=primary --dry-run=client -o yaml | kubectl apply -f - --context=primary
kubectl create namespace production --context=secondary --dry-run=client -o yaml | kubectl apply -f - --context=secondary
log_success "Namespaces created"

log_info "Creating secrets..."
kubectl create secret generic db-credentials \
    --from-literal=username="$DB_USERNAME" \
    --from-literal=password="$DB_PASSWORD" \
    --namespace=production \
    --context=primary \
    --dry-run=client -o yaml | kubectl apply -f - --context=primary

kubectl create secret generic db-credentials \
    --from-literal=username="$DB_USERNAME" \
    --from-literal=password="$DB_PASSWORD" \
    --namespace=production \
    --context=secondary \
    --dry-run=client -o yaml | kubectl apply -f - --context=secondary

kubectl create secret generic redis-credentials \
    --from-literal=auth-token="$REDIS_AUTH_TOKEN" \
    --namespace=production \
    --context=primary \
    --dry-run=client -o yaml | kubectl apply -f - --context=primary

kubectl create secret generic redis-credentials \
    --from-literal=auth-token="$REDIS_AUTH_TOKEN" \
    --namespace=production \
    --context=secondary \
    --dry-run=client -o yaml | kubectl apply -f - --context=secondary

log_success "Secrets created"

log_info "Deploying applications to primary region..."
if kubectl apply -f "$SCRIPT_DIR/../kubernetes/deployments/" --context=primary -n production; then
    log_success "Applications deployed to primary region"
else
    log_warning "Some deployments may have failed in primary region"
fi

log_info "Deploying applications to secondary region (scaled down)..."
if kubectl apply -f "$SCRIPT_DIR/../kubernetes/deployments/" --context=secondary -n production; then
    log_success "Applications deployed to secondary region"
    
    log_info "Scaling down secondary region for warm standby..."
    kubectl scale deployment --all --replicas=1 --context=secondary -n production
    log_success "Secondary region scaled down"
else
    log_warning "Some deployments may have failed in secondary region"
fi

# Step 4: Configure Monitoring
log "========================================="
log "Step 4: Configuring Monitoring and Alerts"
log "========================================="

log_info "Deploying monitoring stack..."
if kubectl apply -f "$SCRIPT_DIR/../kubernetes/monitoring/" --context=primary -n monitoring; then
    log_success "Monitoring stack deployed to primary region"
else
    log_warning "Monitoring deployment may have issues"
fi

log_info "Creating CloudWatch alarms..."
# Alarms are created by Terraform, just verify
PRIMARY_HEALTH_ALARM=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "primary-region-health" \
    --region "$PRIMARY_REGION" \
    --query 'MetricAlarms[0].AlarmName' \
    --output text)

if [ "$PRIMARY_HEALTH_ALARM" != "None" ]; then
    log_success "CloudWatch alarms configured"
else
    log_warning "CloudWatch alarms may not be configured"
fi

# Step 5: Verify Deployment
log "========================================="
log "Step 5: Verifying Deployment"
log "========================================="

log_info "Checking primary region health..."
kubectl get nodes --context=primary
kubectl get pods -n production --context=primary

log_info "Checking secondary region health..."
kubectl get nodes --context=secondary
kubectl get pods -n production --context=secondary

log_info "Verifying database replication..."
REPLICA_STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier "$(terraform output -raw secondary_rds_identifier)" \
    --region "$SECONDARY_REGION" \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text)

if [ "$REPLICA_STATUS" == "available" ]; then
    log_success "Database replica is available"
else
    log_warning "Database replica status: $REPLICA_STATUS"
fi

log_info "Verifying S3 replication..."
PRIMARY_BUCKET=$(terraform output -raw primary_s3_bucket)
REPLICATION_STATUS=$(aws s3api get-bucket-replication \
    --bucket "$PRIMARY_BUCKET" \
    --region "$PRIMARY_REGION" \
    --query 'ReplicationConfiguration.Rules[0].Status' \
    --output text 2>/dev/null || echo "NotConfigured")

if [ "$REPLICATION_STATUS" == "Enabled" ]; then
    log_success "S3 replication is enabled"
else
    log_warning "S3 replication status: $REPLICATION_STATUS"
fi

# Step 6: Run Validation Tests
log "========================================="
log "Step 6: Running Validation Tests"
log "========================================="

log_info "Running service validation..."
if [ -f "$SCRIPT_DIR/scripts/validate-services.sh" ]; then
    if bash "$SCRIPT_DIR/scripts/validate-services.sh"; then
        log_success "Service validation passed"
    else
        log_warning "Service validation had some failures"
    fi
else
    log_warning "Validation script not found"
fi

# Step 7: Generate Documentation
log "========================================="
log "Step 7: Generating Documentation"
log "========================================="

log_info "Creating deployment summary..."
cat > "$SCRIPT_DIR/DEPLOYMENT_SUMMARY.md" <<EOF
# Disaster Recovery Deployment Summary

**Deployment Date:** $(date)  
**Deployed By:** $(whoami)  
**AWS Account:** $AWS_ACCOUNT

## Infrastructure Details

### Primary Region ($PRIMARY_REGION)
- **EKS Cluster:** $PRIMARY_CLUSTER
- **RDS Instance:** $(terraform output -raw primary_rds_endpoint)
- **Redis Cluster:** $(terraform output -raw primary_redis_endpoint)
- **S3 Bucket:** $(terraform output -raw primary_s3_bucket)

### Secondary Region ($SECONDARY_REGION)
- **EKS Cluster:** $SECONDARY_CLUSTER
- **RDS Replica:** $(terraform output -raw secondary_rds_endpoint)
- **Redis Cluster:** $(terraform output -raw secondary_redis_endpoint)
- **S3 Bucket:** $(terraform output -raw secondary_s3_bucket)

### DNS Configuration
- **Domain:** $DOMAIN_NAME
- **Route 53 Zone:** $ROUTE53_ZONE_ID
- **Primary Health Check:** $(terraform output -raw primary_health_check_id)
- **Secondary Health Check:** $(terraform output -raw secondary_health_check_id)

## Next Steps

1. **Test Disaster Recovery**
   - Run monthly backup restoration tests
   - Conduct quarterly failover drills
   - Perform annual full system recovery test

2. **Configure Monitoring**
   - Set up CloudWatch dashboards
   - Configure alert notifications
   - Enable audit logging

3. **Train Team**
   - Review runbooks and procedures
   - Conduct DR training sessions
   - Practice incident response

4. **Documentation**
   - Review [README.md](./README.md)
   - Study [RTO-RPO-OBJECTIVES.md](./RTO-RPO-OBJECTIVES.md)
   - Read [QUICK_START.md](./QUICK_START.md)

## Support

- **Documentation:** See README.md and related docs
- **Scripts:** Located in scripts/ directory
- **Logs:** $LOG_FILE

---

**Deployment Log:** $LOG_FILE
EOF

log_success "Deployment summary created"

# Final Summary
log "========================================="
log "Deployment Complete!"
log "========================================="
log_success "Multi-region disaster recovery infrastructure deployed successfully"
log ""
log "Summary:"
log "  - Primary Region: $PRIMARY_REGION"
log "  - Secondary Region: $SECONDARY_REGION"
log "  - Deployment Time: $(( $(date +%s) - $(stat -f %B "$LOG_FILE" 2>/dev/null || stat -c %Y "$LOG_FILE") )) seconds"
log "  - Log File: $LOG_FILE"
log "  - Summary: $SCRIPT_DIR/DEPLOYMENT_SUMMARY.md"
log ""
log "Next Steps:"
log "  1. Review deployment summary: cat $SCRIPT_DIR/DEPLOYMENT_SUMMARY.md"
log "  2. Run validation tests: ./scripts/validate-services.sh"
log "  3. Configure monitoring and alerts"
log "  4. Schedule regular DR tests"
log "  5. Train team on DR procedures"
log ""
log_success "Disaster Recovery infrastructure is ready!"
log "========================================="

exit 0
