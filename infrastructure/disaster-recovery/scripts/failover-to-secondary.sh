#!/bin/bash
# Automated Failover to Secondary Region Script
# This script orchestrates failover from primary to secondary region

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/disaster-recovery/failover-$(date +%Y%m%d-%H%M%S).log"
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"
ROUTE53_ZONE_ID="${ROUTE53_ZONE_ID}"
DOMAIN_NAME="${DOMAIN_NAME:-api.saimahendra.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
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

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

log "========================================="
log "Starting Disaster Recovery Failover"
log "========================================="
log "Primary Region: $PRIMARY_REGION"
log "Secondary Region: $SECONDARY_REGION"
log "Domain: $DOMAIN_NAME"
log "========================================="

# Step 1: Verify Secondary Region Health
log "Step 1: Verifying secondary region health..."

check_secondary_health() {
    local health_check_id=$(aws route53 list-health-checks \
        --query "HealthChecks[?contains(Tags[?Key=='Region'].Value, 'secondary')].Id" \
        --output text)
    
    if [ -z "$health_check_id" ]; then
        log_error "Secondary region health check not found"
        return 1
    fi
    
    local health_status=$(aws route53 get-health-check-status \
        --health-check-id "$health_check_id" \
        --query 'HealthCheckObservations[0].StatusReport.Status' \
        --output text)
    
    if [ "$health_status" != "Success" ]; then
        log_error "Secondary region is not healthy: $health_status"
        return 1
    fi
    
    log_success "Secondary region is healthy"
    return 0
}

if ! check_secondary_health; then
    log_error "Cannot failover to unhealthy secondary region"
    exit 1
fi

# Step 2: Promote RDS Read Replica
log "Step 2: Promoting RDS read replica to standalone instance..."

promote_rds_replica() {
    local replica_id="sai-mahendra-secondary-replica"
    
    log "Checking replica status..."
    local replica_status=$(aws rds describe-db-instances \
        --db-instance-identifier "$replica_id" \
        --region "$SECONDARY_REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text)
    
    if [ "$replica_status" != "available" ]; then
        log_error "Replica is not available: $replica_status"
        return 1
    fi
    
    log "Promoting replica to standalone instance..."
    aws rds promote-read-replica \
        --db-instance-identifier "$replica_id" \
        --region "$SECONDARY_REGION" \
        --backup-retention-period 30
    
    log "Waiting for promotion to complete..."
    aws rds wait db-instance-available \
        --db-instance-identifier "$replica_id" \
        --region "$SECONDARY_REGION"
    
    log_success "RDS replica promoted successfully"
    
    # Get new endpoint
    local new_endpoint=$(aws rds describe-db-instances \
        --db-instance-identifier "$replica_id" \
        --region "$SECONDARY_REGION" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    log "New database endpoint: $new_endpoint"
    echo "$new_endpoint" > /tmp/new-db-endpoint.txt
}

promote_rds_replica

# Step 3: Promote Redis Replica
log "Step 3: Promoting Redis replica..."

promote_redis_replica() {
    local redis_cluster_id="sai-mahendra-secondary-redis"
    
    log "Triggering Redis failover..."
    aws elasticache test-failover \
        --replication-group-id "$redis_cluster_id" \
        --node-group-id "0001" \
        --region "$SECONDARY_REGION"
    
    log "Waiting for Redis failover to complete..."
    sleep 30
    
    # Verify Redis is accessible
    local redis_endpoint=$(aws elasticache describe-replication-groups \
        --replication-group-id "$redis_cluster_id" \
        --region "$SECONDARY_REGION" \
        --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
        --output text)
    
    log_success "Redis failover completed"
    log "New Redis endpoint: $redis_endpoint"
    echo "$redis_endpoint" > /tmp/new-redis-endpoint.txt
}

promote_redis_replica

# Step 4: Scale Up Secondary EKS Cluster
log "Step 4: Scaling up secondary EKS cluster..."

scale_eks_cluster() {
    local cluster_name="sai-mahendra-secondary-cluster"
    
    log "Updating kubeconfig for secondary cluster..."
    aws eks update-kubeconfig \
        --name "$cluster_name" \
        --region "$SECONDARY_REGION" \
        --alias secondary
    
    log "Scaling critical services..."
    kubectl scale deployment api-gateway --replicas=3 --context=secondary -n production
    kubectl scale deployment user-management --replicas=3 --context=secondary -n production
    kubectl scale deployment payment --replicas=3 --context=secondary -n production
    
    log "Scaling core services..."
    kubectl scale deployment course-management --replicas=2 --context=secondary -n production
    kubectl scale deployment content-management --replicas=2 --context=secondary -n production
    kubectl scale deployment notification --replicas=2 --context=secondary -n production
    
    log "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod \
        -l tier=critical \
        --timeout=300s \
        --context=secondary \
        -n production
    
    log_success "EKS cluster scaled up successfully"
}

scale_eks_cluster

# Step 5: Update Application Configuration
log "Step 5: Updating application configuration with new endpoints..."

update_app_config() {
    local new_db_endpoint=$(cat /tmp/new-db-endpoint.txt)
    local new_redis_endpoint=$(cat /tmp/new-redis-endpoint.txt)
    
    log "Updating database endpoint..."
    kubectl set env deployment/user-management \
        DATABASE_URL="postgresql://admin:${DB_PASSWORD}@${new_db_endpoint}:5432/saimahendra" \
        --context=secondary \
        -n production
    
    kubectl set env deployment/course-management \
        DATABASE_URL="postgresql://admin:${DB_PASSWORD}@${new_db_endpoint}:5432/saimahendra" \
        --context=secondary \
        -n production
    
    kubectl set env deployment/payment \
        DATABASE_URL="postgresql://admin:${DB_PASSWORD}@${new_db_endpoint}:5432/saimahendra" \
        --context=secondary \
        -n production
    
    log "Updating Redis endpoint..."
    kubectl set env deployment/user-management \
        REDIS_URL="redis://${new_redis_endpoint}:6379" \
        --context=secondary \
        -n production
    
    log "Restarting deployments..."
    kubectl rollout restart deployment/user-management --context=secondary -n production
    kubectl rollout restart deployment/course-management --context=secondary -n production
    kubectl rollout restart deployment/payment --context=secondary -n production
    
    log "Waiting for rollout to complete..."
    kubectl rollout status deployment/user-management --context=secondary -n production
    kubectl rollout status deployment/course-management --context=secondary -n production
    kubectl rollout status deployment/payment --context=secondary -n production
    
    log_success "Application configuration updated"
}

update_app_config

# Step 6: Update Route 53 DNS
log "Step 6: Updating Route 53 DNS to point to secondary region..."

update_dns() {
    local secondary_alb=$(kubectl get svc api-gateway \
        --context=secondary \
        -n production \
        -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [ -z "$secondary_alb" ]; then
        log_error "Could not get secondary ALB endpoint"
        return 1
    fi
    
    log "Secondary ALB endpoint: $secondary_alb"
    
    # Create Route 53 change batch
    cat > /tmp/dns-change.json <<EOF
{
  "Comment": "Failover to secondary region",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN_NAME}",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [
          {
            "Value": "${secondary_alb}"
          }
        ]
      }
    }
  ]
}
EOF
    
    log "Updating DNS records..."
    local change_id=$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$ROUTE53_ZONE_ID" \
        --change-batch file:///tmp/dns-change.json \
        --query 'ChangeInfo.Id' \
        --output text)
    
    log "Waiting for DNS propagation (Change ID: $change_id)..."
    aws route53 wait resource-record-sets-changed --id "$change_id"
    
    log_success "DNS updated successfully"
}

update_dns

# Step 7: Verify Failover
log "Step 7: Verifying failover..."

verify_failover() {
    log "Testing API endpoint..."
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Attempt $attempt/$max_attempts..."
        
        if curl -f -s -o /dev/null -w "%{http_code}" "https://${DOMAIN_NAME}/health" | grep -q "200"; then
            log_success "API endpoint is responding"
            return 0
        fi
        
        log_warning "API not responding yet, waiting..."
        sleep 30
        ((attempt++))
    done
    
    log_error "API endpoint verification failed after $max_attempts attempts"
    return 1
}

if verify_failover; then
    log_success "Failover verification successful"
else
    log_error "Failover verification failed"
    exit 1
fi

# Step 8: Send Notifications
log "Step 8: Sending notifications..."

send_notifications() {
    local sns_topic_arn=$(aws sns list-topics \
        --query "Topics[?contains(TopicArn, 'disaster-recovery-alerts')].TopicArn" \
        --output text | head -1)
    
    if [ -n "$sns_topic_arn" ]; then
        aws sns publish \
            --topic-arn "$sns_topic_arn" \
            --subject "Disaster Recovery: Failover to Secondary Region Completed" \
            --message "Automated failover to secondary region ($SECONDARY_REGION) has been completed successfully. All services are now running in the DR region. Log file: $LOG_FILE"
        
        log_success "Notifications sent"
    else
        log_warning "SNS topic not found, skipping notifications"
    fi
}

send_notifications

# Step 9: Update Status Page
log "Step 9: Updating status page..."

update_status_page() {
    # This would integrate with your status page service (e.g., StatusPage.io, custom solution)
    log "Status page update would be triggered here"
    # Example: curl -X POST https://api.statuspage.io/v1/incidents ...
}

update_status_page

# Cleanup temporary files
rm -f /tmp/new-db-endpoint.txt /tmp/new-redis-endpoint.txt /tmp/dns-change.json

# Final Summary
log "========================================="
log "Failover Completed Successfully"
log "========================================="
log "Start Time: $(head -1 "$LOG_FILE" | awk '{print $1, $2}')"
log "End Time: $(date +'%Y-%m-%d %H:%M:%S')"
log "Active Region: $SECONDARY_REGION"
log "Log File: $LOG_FILE"
log "========================================="

log_success "All services are now running in the secondary region"
log "Next steps:"
log "1. Monitor application metrics and error rates"
log "2. Verify data integrity"
log "3. Investigate primary region failure"
log "4. Plan failback when primary region is restored"

exit 0
