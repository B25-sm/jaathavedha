# S3 Cross-Region Replication and Recovery Guide

## Overview

This guide provides procedures for managing S3 cross-region replication and recovering from S3 data loss scenarios.

## Replication Architecture

### Primary Region: us-east-1
- **Content Bucket**: `sai-mahendra-content-prod`
- **Backups Bucket**: `sai-mahendra-backups-prod`
- **Encryption**: AWS KMS with automatic key rotation
- **Versioning**: Enabled

### Secondary Region: us-west-2
- **Content Bucket**: `sai-mahendra-content-replica-prod`
- **Backups Bucket**: `sai-mahendra-backups-replica-prod`
- **Encryption**: AWS KMS with automatic key rotation
- **Versioning**: Enabled

### Replication Features
- **Real-time Replication**: 15-minute SLA with Replication Time Control (RTC)
- **Delete Marker Replication**: Enabled
- **Encryption**: Objects encrypted in both regions
- **Metrics**: Replication metrics enabled for monitoring

## Monitoring Replication

### Check Replication Status

```bash
# Check replication metrics for content bucket
aws s3api get-bucket-replication \
  --bucket sai-mahendra-content-prod \
  --region us-east-1

# Check replication status for specific object
aws s3api head-object \
  --bucket sai-mahendra-content-prod \
  --key path/to/object \
  --region us-east-1 \
  | jq '.ReplicationStatus'

# List objects pending replication
aws s3api list-objects-v2 \
  --bucket sai-mahendra-content-prod \
  --region us-east-1 \
  --query 'Contents[?ReplicationStatus==`PENDING`]'
```

### CloudWatch Metrics

Monitor these CloudWatch metrics:
- `ReplicationLatency`: Time to replicate objects
- `BytesPendingReplication`: Data waiting to be replicated
- `OperationsPendingReplication`: Number of operations pending
- `ReplicationErrors`: Failed replication operations

```bash
# Get replication latency metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name ReplicationLatency \
  --dimensions Name=SourceBucket,Value=sai-mahendra-content-prod \
               Name=DestinationBucket,Value=sai-mahendra-content-replica-prod \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region us-east-1
```

## Disaster Recovery Scenarios

### Scenario 1: Primary Region Failure

When the primary region (us-east-1) becomes unavailable:

#### 1. Verify Secondary Region Data
```bash
# Check object count in secondary region
aws s3 ls s3://sai-mahendra-content-replica-prod --recursive --summarize \
  --region us-west-2

# Verify recent objects are replicated
aws s3api list-objects-v2 \
  --bucket sai-mahendra-content-replica-prod \
  --region us-west-2 \
  --query 'sort_by(Contents, &LastModified)[-10:]'
```

#### 2. Update Application Configuration
```bash
# Update Kubernetes ConfigMap to point to secondary region
kubectl patch configmap s3-config -n production \
  -p '{"data":{"S3_REGION":"us-west-2","S3_BUCKET":"sai-mahendra-content-replica-prod"}}'

# Restart affected pods
kubectl rollout restart deployment/content-management -n production
kubectl rollout restart deployment/video-streaming -n production
```

#### 3. Update CloudFront Origin
```bash
# Update CloudFront distribution to use secondary bucket
aws cloudfront update-distribution \
  --id <distribution-id> \
  --distribution-config file://cloudfront-secondary-config.json \
  --if-match <etag>
```

#### 4. Monitor Application
```bash
# Check application logs for S3 errors
kubectl logs -f deployment/content-management -n production | grep -i s3

# Verify file access
curl -I https://cdn.saimahendra.com/path/to/file
```

### Scenario 2: Accidental Deletion

When objects are accidentally deleted from the primary bucket:

#### 1. Check Versioning History
```bash
# List all versions of deleted object
aws s3api list-object-versions \
  --bucket sai-mahendra-content-prod \
  --prefix path/to/deleted/object \
  --region us-east-1
```

#### 2. Restore from Version
```bash
# Restore specific version
aws s3api copy-object \
  --copy-source sai-mahendra-content-prod/path/to/object?versionId=<version-id> \
  --bucket sai-mahendra-content-prod \
  --key path/to/object \
  --region us-east-1
```

#### 3. Restore from Secondary Region
```bash
# If version not available in primary, copy from secondary
aws s3 cp \
  s3://sai-mahendra-content-replica-prod/path/to/object \
  s3://sai-mahendra-content-prod/path/to/object \
  --source-region us-west-2 \
  --region us-east-1
```

### Scenario 3: Data Corruption

When data corruption is detected:

#### 1. Identify Corruption Timeframe
```bash
# List object versions with timestamps
aws s3api list-object-versions \
  --bucket sai-mahendra-content-prod \
  --prefix path/to/corrupted/ \
  --region us-east-1 \
  --query 'Versions[*].[Key,VersionId,LastModified]' \
  --output table
```

#### 2. Restore Clean Version
```bash
# Restore from known good version
aws s3api copy-object \
  --copy-source sai-mahendra-content-prod/path/to/object?versionId=<good-version-id> \
  --bucket sai-mahendra-content-prod \
  --key path/to/object \
  --region us-east-1 \
  --metadata-directive REPLACE
```

#### 3. Bulk Restore Script
```bash
#!/bin/bash
# restore-clean-versions.sh

BUCKET="sai-mahendra-content-prod"
PREFIX="path/to/corrupted/"
GOOD_DATE="2024-01-15T00:00:00"

aws s3api list-object-versions \
  --bucket ${BUCKET} \
  --prefix ${PREFIX} \
  --query "Versions[?LastModified<'${GOOD_DATE}'] | [0].[Key,VersionId]" \
  --output text | \
while read key version; do
  echo "Restoring ${key} from version ${version}"
  aws s3api copy-object \
    --copy-source ${BUCKET}/${key}?versionId=${version} \
    --bucket ${BUCKET} \
    --key ${key}
done
```

## Failover Procedures

### Promote Secondary Region to Primary

#### 1. Stop Replication
```bash
# Disable replication on primary bucket
aws s3api delete-bucket-replication \
  --bucket sai-mahendra-content-prod \
  --region us-east-1
```

#### 2. Configure Reverse Replication
```bash
# Apply reverse replication configuration
terraform apply \
  -var="primary_region=us-west-2" \
  -var="secondary_region=us-east-1" \
  -target=aws_s3_bucket_replication_configuration.content
```

#### 3. Update DNS and CDN
```bash
# Update Route53 to point to secondary region
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch file://dns-failover.json

# Update CloudFront origin
aws cloudfront update-distribution \
  --id <distribution-id> \
  --distribution-config file://cloudfront-failover-config.json
```

#### 4. Verify Failover
```bash
# Test file access from new primary
aws s3 ls s3://sai-mahendra-content-replica-prod --region us-west-2

# Verify application connectivity
curl -I https://cdn.saimahendra.com/test-file.jpg
```

## Backup Restoration

### Restore from Backup Bucket

```bash
# List available backups
aws s3 ls s3://sai-mahendra-backups-prod/postgres/ --region us-east-1

# Restore specific backup
aws s3 cp \
  s3://sai-mahendra-backups-prod/postgres/20240115_020000/postgres_backup.sql.gz \
  /tmp/restore/ \
  --region us-east-1

# If primary region unavailable, use secondary
aws s3 cp \
  s3://sai-mahendra-backups-replica-prod/postgres/20240115_020000/postgres_backup.sql.gz \
  /tmp/restore/ \
  --region us-west-2
```

## Verification and Testing

### Test Replication

```bash
# Upload test file to primary
echo "test-$(date +%s)" > /tmp/test-replication.txt
aws s3 cp /tmp/test-replication.txt \
  s3://sai-mahendra-content-prod/test/ \
  --region us-east-1

# Wait for replication (max 15 minutes)
sleep 60

# Verify in secondary region
aws s3 ls s3://sai-mahendra-content-replica-prod/test/ \
  --region us-west-2

# Check replication status
aws s3api head-object \
  --bucket sai-mahendra-content-prod \
  --key test/test-replication.txt \
  --region us-east-1 \
  | jq '.ReplicationStatus'
```

### Verify Data Consistency

```bash
# Compare object counts
PRIMARY_COUNT=$(aws s3 ls s3://sai-mahendra-content-prod --recursive --summarize --region us-east-1 | grep "Total Objects" | awk '{print $3}')
SECONDARY_COUNT=$(aws s3 ls s3://sai-mahendra-content-replica-prod --recursive --summarize --region us-west-2 | grep "Total Objects" | awk '{print $3}')

echo "Primary: ${PRIMARY_COUNT} objects"
echo "Secondary: ${SECONDARY_COUNT} objects"

if [ "$PRIMARY_COUNT" -eq "$SECONDARY_COUNT" ]; then
  echo "✓ Object counts match"
else
  echo "⚠ Object count mismatch: $((PRIMARY_COUNT - SECONDARY_COUNT)) difference"
fi
```

## Troubleshooting

### Replication Not Working

**Check IAM Role Permissions**
```bash
aws iam get-role-policy \
  --role-name sai-mahendra-s3-replication-role-prod \
  --policy-name sai-mahendra-s3-replication-policy-prod
```

**Check Bucket Versioning**
```bash
aws s3api get-bucket-versioning \
  --bucket sai-mahendra-content-prod \
  --region us-east-1
```

**Check Replication Configuration**
```bash
aws s3api get-bucket-replication \
  --bucket sai-mahendra-content-prod \
  --region us-east-1
```

### High Replication Latency

**Check Pending Operations**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name OperationsPendingReplication \
  --dimensions Name=SourceBucket,Value=sai-mahendra-content-prod \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

**Enable Replication Time Control**
```bash
# Verify RTC is enabled
aws s3api get-bucket-replication \
  --bucket sai-mahendra-content-prod \
  --region us-east-1 \
  | jq '.ReplicationConfiguration.Rules[].Destination.ReplicationTime'
```

## Best Practices

1. **Regular Testing**: Test failover procedures quarterly
2. **Monitor Metrics**: Set up CloudWatch alarms for replication issues
3. **Version Management**: Regularly review and clean up old versions
4. **Cost Optimization**: Use lifecycle policies to transition old data
5. **Documentation**: Keep runbooks updated with actual procedures

## Emergency Contacts

- **Storage Team**: storage-team@saimahendra.com
- **DevOps Team**: devops@saimahendra.com
- **AWS Support**: Enterprise Support Case

## References

- [S3 Replication Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html)
- [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
- [S3 Disaster Recovery](https://docs.aws.amazon.com/AmazonS3/latest/userguide/disaster-recovery-resiliency.html)
