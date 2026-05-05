# Backup System Quick Start Guide

## Prerequisites

- Kubernetes cluster access (kubectl configured)
- AWS CLI configured with credentials
- Terraform installed (optional, for S3 replication)
- Bash shell (Linux/macOS/WSL)

## Quick Deployment

### 1. Deploy All Backup Systems

```bash
cd infrastructure/backup
chmod +x deploy-backups.sh scripts/*.sh
./deploy-backups.sh
```

### 2. Update Credentials (CRITICAL!)

```bash
# PostgreSQL credentials
kubectl edit secret postgres-backup-credentials -n backup

# MongoDB credentials
kubectl edit secret mongodb-backup-credentials -n backup

# Redis credentials
kubectl edit secret redis-backup-credentials -n backup
```

Update the following fields:
- `PGUSER` and `PGPASSWORD` for PostgreSQL
- `MONGO_USER` and `MONGO_PASSWORD` for MongoDB
- `REDIS_PASSWORD` for Redis
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for all

### 3. Verify Deployment

```bash
# Check backup status
./scripts/check-backup-status.sh

# Verify backup integrity
./scripts/verify-backups.sh
```

### 4. Test Manual Backup

```bash
# Trigger PostgreSQL backup
kubectl create job --from=cronjob/postgres-backup postgres-backup-test -n backup

# Monitor backup job
kubectl logs -f job/postgres-backup-test -n backup

# Check if backup appears in S3
aws s3 ls s3://sai-mahendra-backups/postgres/ --recursive
```

## Component-Specific Deployment

```bash
# Deploy only PostgreSQL backup
./deploy-backups.sh postgres

# Deploy only MongoDB backup
./deploy-backups.sh mongodb

# Deploy only Redis backup
./deploy-backups.sh redis

# Deploy only S3 replication
./deploy-backups.sh s3
```

## Monitoring

### Check Backup Status

```bash
# Overall status
./scripts/check-backup-status.sh

# Check CronJobs
kubectl get cronjobs -n backup

# Check recent jobs
kubectl get jobs -n backup --sort-by=.status.startTime

# Check logs
kubectl logs -n backup -l app=postgres-backup
```

### View Backups in S3

```bash
# List PostgreSQL backups
aws s3 ls s3://sai-mahendra-backups/postgres/ --recursive

# List MongoDB backups
aws s3 ls s3://sai-mahendra-backups/mongodb/daily/ --recursive

# List Redis backups
aws s3 ls s3://sai-mahendra-backups/redis/ --recursive
```

## Recovery

### PostgreSQL Recovery

```bash
# See detailed procedures
cat postgres/RECOVERY.md

# Quick restore from latest backup
kubectl exec -it postgres-backup-pod -n backup -- /scripts/restore.sh <backup-timestamp>
```

### MongoDB Recovery

```bash
# See detailed procedures
cat mongodb/RECOVERY.md

# Quick restore from latest backup
kubectl exec -it mongodb-backup-pod -n backup -- /scripts/restore.sh <backup-timestamp>
```

### Redis Recovery

```bash
# See detailed procedures
cat redis/RECOVERY.md

# Quick restore from latest backup
kubectl exec -it redis-backup-pod -n backup -- /scripts/restore.sh <backup-timestamp>
```

### S3 Failover

```bash
# See detailed procedures
cat s3/RECOVERY.md

# Update application to use secondary region
kubectl patch configmap s3-config -n production \
  -p '{"data":{"S3_REGION":"us-west-2","S3_BUCKET":"sai-mahendra-content-replica-prod"}}'
```

## Troubleshooting

### Backup Job Failed

```bash
# Check job logs
kubectl logs -n backup job/<job-name>

# Check CronJob status
kubectl describe cronjob/<cronjob-name> -n backup

# Check secrets
kubectl get secrets -n backup
```

### S3 Upload Failed

```bash
# Verify AWS credentials
kubectl exec -it <backup-pod> -n backup -- aws sts get-caller-identity

# Check S3 bucket permissions
aws s3api get-bucket-policy --bucket sai-mahendra-backups
```

### Replication Not Working

```bash
# Check replication configuration
aws s3api get-bucket-replication --bucket sai-mahendra-content-prod --region us-east-1

# Check replication metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name ReplicationLatency \
  --dimensions Name=SourceBucket,Value=sai-mahendra-content-prod \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region us-east-1
```

## Backup Schedules

| Data Store | Backup Type | Schedule | Retention |
|------------|-------------|----------|-----------|
| PostgreSQL | Full Backup | Daily 2:00 AM UTC | 30 days |
| PostgreSQL | WAL Archive | Continuous | 7 days |
| MongoDB | Daily Backup | Daily 3:00 AM UTC | 30 days |
| MongoDB | Monthly Backup | 1st of month 3:00 AM | 90 days |
| Redis | RDB Snapshot | Every 6 hours | 7 days |
| S3 | Replication | Real-time | Indefinite |

## Important Notes

1. **Update Credentials**: Always update backup credentials after deployment
2. **Test Recovery**: Test recovery procedures in isolated environment before production
3. **Monitor Regularly**: Check backup status daily
4. **Verify Integrity**: Run integrity verification weekly
5. **Review Costs**: Monitor S3 storage costs monthly

## Support

For issues or questions:
- Check logs: `kubectl logs -n backup -l app=<backup-type>`
- Review documentation: `README.md` and recovery guides
- Contact: devops@saimahendra.com

## Next Steps

1. ✅ Deploy backup systems
2. ✅ Update credentials
3. ⚠️ Configure monitoring alerts
4. ⚠️ Test recovery procedures
5. ⚠️ Schedule disaster recovery drill
6. ⚠️ Document actual RTO/RPO
7. ⚠️ Train operations team

## References

- [Main Documentation](README.md)
- [PostgreSQL Recovery](postgres/RECOVERY.md)
- [S3 Recovery](s3/RECOVERY.md)
- [Completion Report](TASK_19.1_COMPLETION_REPORT.md)
