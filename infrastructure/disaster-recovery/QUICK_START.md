# Disaster Recovery Quick Start Guide

## Overview

This guide provides quick instructions for deploying and testing disaster recovery infrastructure for the Sai Mahendra platform.

## Prerequisites

### Required Tools
- AWS CLI (v2.x or later)
- Terraform (v1.0 or later)
- kubectl (v1.28 or later)
- eksctl (v0.150 or later)
- psql (PostgreSQL client)
- redis-cli (Redis client)

### Required Access
- AWS account with admin privileges
- Route 53 hosted zone
- Domain name configured
- KMS keys for encryption
- IAM roles and policies

### Environment Variables

```bash
# AWS Configuration
export AWS_REGION="us-east-1"
export AWS_SECONDARY_REGION="us-west-2"
export AWS_ACCOUNT_ID="123456789012"

# Database Credentials
export DB_USERNAME="admin"
export DB_PASSWORD="your-secure-password"
export REDIS_AUTH_TOKEN="your-redis-token"

# Domain Configuration
export DOMAIN_NAME="saimahendra.com"
export ROUTE53_ZONE_ID="Z1234567890ABC"

# Terraform Variables
export TF_VAR_db_username="$DB_USERNAME"
export TF_VAR_db_password="$DB_PASSWORD"
export TF_VAR_redis_auth_token="$REDIS_AUTH_TOKEN"
export TF_VAR_domain_name="$DOMAIN_NAME"
```

## Quick Deployment

### Step 1: Deploy Multi-Region Infrastructure

```bash
# Navigate to disaster recovery terraform directory
cd infrastructure/disaster-recovery/terraform

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the configuration
terraform apply -auto-approve

# Save outputs
terraform output -json > outputs.json
```

**Expected Duration:** 30-45 minutes

### Step 2: Verify Infrastructure

```bash
# Check primary region resources
aws eks describe-cluster --name sai-mahendra-primary-cluster --region us-east-1
aws rds describe-db-instances --db-instance-identifier sai-mahendra-primary-db --region us-east-1

# Check secondary region resources
aws eks describe-cluster --name sai-mahendra-secondary-cluster --region us-west-2
aws rds describe-db-instances --db-instance-identifier sai-mahendra-secondary-replica --region us-west-2

# Verify Route 53 health checks
aws route53 list-health-checks
```

### Step 3: Configure Kubernetes Contexts

```bash
# Configure primary cluster
aws eks update-kubeconfig \
  --name sai-mahendra-primary-cluster \
  --region us-east-1 \
  --alias primary

# Configure secondary cluster
aws eks update-kubeconfig \
  --name sai-mahendra-secondary-cluster \
  --region us-west-2 \
  --alias secondary

# Verify contexts
kubectl config get-contexts
```

### Step 4: Deploy Applications

```bash
# Deploy to primary region
kubectl apply -f ../../kubernetes/deployments/ --context=primary

# Deploy to secondary region (scaled down)
kubectl apply -f ../../kubernetes/deployments/ --context=secondary
kubectl scale deployment --all --replicas=1 --context=secondary -n production

# Verify deployments
kubectl get deployments --context=primary -n production
kubectl get deployments --context=secondary -n production
```

### Step 5: Validate Disaster Recovery Setup

```bash
# Run validation script
./scripts/validate-services.sh

# Check replication status
aws rds describe-db-instances \
  --db-instance-identifier sai-mahendra-secondary-replica \
  --region us-west-2 \
  --query 'DBInstances[0].StatusInfos'

# Verify S3 replication
aws s3api get-bucket-replication \
  --bucket sai-mahendra-primary-production \
  --region us-east-1
```

## Testing Disaster Recovery

### Test 1: Health Check Validation

```bash
# Test primary region health
curl -f https://api.saimahendra.com/health

# Check Route 53 health check status
aws route53 get-health-check-status \
  --health-check-id $(aws route53 list-health-checks \
    --query "HealthChecks[?contains(Tags[?Key=='Region'].Value, 'primary')].Id" \
    --output text)
```

### Test 2: Database Backup and Restore

```bash
# Create test snapshot
aws rds create-db-snapshot \
  --db-instance-identifier sai-mahendra-primary-db \
  --db-snapshot-identifier test-snapshot-$(date +%Y%m%d) \
  --region us-east-1

# Wait for snapshot completion
aws rds wait db-snapshot-available \
  --db-snapshot-identifier test-snapshot-$(date +%Y%m%d) \
  --region us-east-1

# Restore to test instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier test-restore \
  --db-snapshot-identifier test-snapshot-$(date +%Y%m%d) \
  --region us-east-1

# Cleanup
aws rds delete-db-instance \
  --db-instance-identifier test-restore \
  --skip-final-snapshot \
  --region us-east-1
```

### Test 3: Simulated Failover (Non-Production)

```bash
# CAUTION: Only run in test environment!

# Execute failover script
./scripts/failover-to-secondary.sh

# Monitor failover progress
watch -n 5 'kubectl get pods --context=secondary -n production'

# Validate services after failover
./scripts/validate-services.sh

# Failback to primary (when ready)
./scripts/failback-to-primary.sh
```

## Common Operations

### Check Replication Lag

```bash
# PostgreSQL replication lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name ReplicaLag \
  --dimensions Name=DBInstanceIdentifier,Value=sai-mahendra-secondary-replica \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region us-west-2
```

### Manual Database Promotion

```bash
# Promote read replica to standalone
aws rds promote-read-replica \
  --db-instance-identifier sai-mahendra-secondary-replica \
  --region us-west-2

# Wait for promotion
aws rds wait db-instance-available \
  --db-instance-identifier sai-mahendra-secondary-replica \
  --region us-west-2
```

### Update DNS for Failover

```bash
# Get secondary ALB endpoint
SECONDARY_ALB=$(kubectl get svc api-gateway \
  --context=secondary \
  -n production \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Create DNS change batch
cat > dns-change.json <<EOF
{
  "Comment": "Manual failover to secondary region",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.${DOMAIN_NAME}",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [{"Value": "${SECONDARY_ALB}"}]
      }
    }
  ]
}
EOF

# Apply DNS change
aws route53 change-resource-record-sets \
  --hosted-zone-id $ROUTE53_ZONE_ID \
  --change-batch file://dns-change.json
```

### Scale Secondary Region

```bash
# Scale up for failover
kubectl scale deployment api-gateway --replicas=3 --context=secondary -n production
kubectl scale deployment user-management --replicas=3 --context=secondary -n production
kubectl scale deployment payment --replicas=3 --context=secondary -n production

# Scale down for cost savings
kubectl scale deployment --all --replicas=1 --context=secondary -n production
```

## Monitoring and Alerts

### View CloudWatch Alarms

```bash
# List all DR-related alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix "disaster-recovery" \
  --region us-east-1

# Check alarm state
aws cloudwatch describe-alarm-history \
  --alarm-name "primary-region-health-check-failed" \
  --max-records 10 \
  --region us-east-1
```

### Check Backup Status

```bash
# List recent RDS snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier sai-mahendra-primary-db \
  --max-records 10 \
  --region us-east-1

# Check S3 replication metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name ReplicationLatency \
  --dimensions Name=SourceBucket,Value=sai-mahendra-primary-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region us-east-1
```

## Troubleshooting

### Issue: Health Check Failing

```bash
# Check service status
kubectl get pods --context=primary -n production
kubectl logs -l tier=critical --context=primary -n production --tail=50

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --names sai-mahendra-primary-tg \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text \
    --region us-east-1) \
  --region us-east-1
```

### Issue: High Replication Lag

```bash
# Check replication status
aws rds describe-db-instances \
  --db-instance-identifier sai-mahendra-secondary-replica \
  --region us-west-2 \
  --query 'DBInstances[0].StatusInfos'

# Check for blocking queries
psql -h $PRIMARY_DB_HOST -U admin -d saimahendra <<EOF
SELECT pid, usename, application_name, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
EOF
```

### Issue: Failover Script Fails

```bash
# Check script logs
tail -f /var/log/disaster-recovery/failover-*.log

# Verify prerequisites
./scripts/validate-services.sh

# Check AWS credentials
aws sts get-caller-identity

# Verify kubectl access
kubectl cluster-info --context=secondary
```

## Cost Optimization

### Reduce Secondary Region Costs

```bash
# Scale down non-critical services
kubectl scale deployment analytics --replicas=0 --context=secondary -n production
kubectl scale deployment admin-panel --replicas=0 --context=secondary -n production

# Use smaller instance types for standby
# (Modify in terraform variables)
export TF_VAR_secondary_instance_type="t3.small"
terraform apply
```

### Optimize Backup Retention

```bash
# Adjust RDS backup retention
aws rds modify-db-instance \
  --db-instance-identifier sai-mahendra-primary-db \
  --backup-retention-period 7 \
  --region us-east-1

# Configure S3 lifecycle policies
aws s3api put-bucket-lifecycle-configuration \
  --bucket sai-mahendra-backups \
  --lifecycle-configuration file://lifecycle-policy.json
```

## Security Best Practices

### Encrypt Sensitive Data

```bash
# Rotate KMS keys
aws kms enable-key-rotation \
  --key-id $(terraform output -raw primary_rds_kms_key_id)

# Update secrets
kubectl create secret generic db-credentials \
  --from-literal=username=$DB_USERNAME \
  --from-literal=password=$DB_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f - --context=primary -n production
```

### Audit Access

```bash
# Enable CloudTrail logging
aws cloudtrail create-trail \
  --name disaster-recovery-audit \
  --s3-bucket-name sai-mahendra-audit-logs

# Review recent API calls
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::RDS::DBInstance \
  --max-results 50
```

## Next Steps

1. **Review Documentation**
   - Read [README.md](./README.md) for comprehensive overview
   - Study [RTO-RPO-OBJECTIVES.md](./RTO-RPO-OBJECTIVES.md) for recovery targets
   - Review [testing/recovery-test-plan.md](./testing/recovery-test-plan.md) for test procedures

2. **Schedule Regular Tests**
   - Monthly: Database backup restoration
   - Quarterly: Full failover drill
   - Annual: Complete system recovery test

3. **Configure Monitoring**
   - Set up CloudWatch dashboards
   - Configure PagerDuty/Opsgenie alerts
   - Enable SNS notifications

4. **Train Team**
   - Conduct DR training sessions
   - Practice runbook procedures
   - Perform tabletop exercises

## Support

### Documentation
- [Main README](./README.md)
- [RTO/RPO Objectives](./RTO-RPO-OBJECTIVES.md)
- [Recovery Test Plan](./testing/recovery-test-plan.md)
- [Backup Documentation](../backup/README.md)

### Scripts
- `scripts/failover-to-secondary.sh` - Automated failover
- `scripts/failback-to-primary.sh` - Automated failback
- `scripts/validate-services.sh` - Service validation
- `scripts/verify-data-sync.sh` - Data synchronization check

### Contact
- On-Call Engineer: [PagerDuty]
- Operations Lead: ops-lead@saimahendra.com
- Engineering Director: eng-director@saimahendra.com

---

**Document Version:** 1.0  
**Last Updated:** 2024-01-15  
**Owner:** Platform Operations Team
