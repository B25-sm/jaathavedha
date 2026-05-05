# PostgreSQL Backup and Recovery Guide

## Overview

This guide provides detailed procedures for backing up and recovering PostgreSQL databases in the Sai Mahendra platform.

## Backup Strategy

### Full Backups
- **Method**: pg_basebackup + pg_dump
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days
- **Storage**: S3 Standard (0-7 days), S3 Standard-IA (8-30 days)

### WAL Archiving
- **Method**: Continuous WAL archiving to S3
- **Frequency**: Real-time as WAL segments are created
- **Retention**: 7 days
- **Purpose**: Point-in-time recovery (PITR)

## Point-in-Time Recovery (PITR)

### Prerequisites
- Access to S3 backup bucket
- AWS CLI configured
- PostgreSQL 15 or higher
- Sufficient disk space for restoration

### Recovery Steps

#### 1. Stop PostgreSQL Service
```bash
# On Kubernetes
kubectl scale deployment postgres-primary --replicas=0 -n database

# On standalone server
sudo systemctl stop postgresql
```

#### 2. Backup Current Data Directory
```bash
# Create backup of current state
sudo mv /var/lib/postgresql/15/main /var/lib/postgresql/15/main.old
sudo mkdir /var/lib/postgresql/15/main
sudo chown postgres:postgres /var/lib/postgresql/15/main
```

#### 3. Download Base Backup
```bash
# List available backups
aws s3 ls s3://sai-mahendra-backups/postgres/

# Download specific backup
BACKUP_DATE="20240115_020000"
aws s3 cp s3://sai-mahendra-backups/postgres/${BACKUP_DATE}/base.tar.gz /tmp/

# Extract base backup
sudo -u postgres tar -xzf /tmp/base.tar.gz -C /var/lib/postgresql/15/main/
```

#### 4. Configure Recovery
```bash
# Create recovery.conf (PostgreSQL 12+: recovery.signal)
sudo -u postgres cat > /var/lib/postgresql/15/main/recovery.signal << EOF
# Recovery configuration
EOF

# Update postgresql.conf
sudo -u postgres cat >> /var/lib/postgresql/15/main/postgresql.conf << EOF
restore_command = 'aws s3 cp s3://sai-mahendra-wal-archives/postgres-wal/%f /var/lib/postgresql/15/main/pg_wal/%f'
recovery_target_time = '2024-01-15 14:30:00'  # Optional: specify recovery point
recovery_target_action = 'promote'
EOF
```

#### 5. Start PostgreSQL and Monitor Recovery
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Monitor recovery progress
sudo -u postgres tail -f /var/lib/postgresql/15/main/log/postgresql-*.log

# Check recovery status
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"
```

#### 6. Verify Recovery
```bash
# Connect to database
sudo -u postgres psql -d sai_mahendra_prod

# Verify data integrity
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM enrollments;
SELECT COUNT(*) FROM payments;

# Check latest transactions
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

#### 7. Resume Normal Operations
```bash
# On Kubernetes
kubectl scale deployment postgres-primary --replicas=1 -n database

# Verify application connectivity
kubectl exec -it <app-pod> -- psql -h postgres-primary -U postgres -d sai_mahendra_prod -c "SELECT 1;"
```

## Full Database Restore

### When to Use
- Complete database corruption
- Disaster recovery scenario
- Migration to new infrastructure

### Restore from pg_dump Backup

#### 1. Download Backup
```bash
# List available backups
aws s3 ls s3://sai-mahendra-backups/postgres/

# Download backup
BACKUP_DATE="20240115_020000"
aws s3 cp s3://sai-mahendra-backups/postgres/${BACKUP_DATE}/postgres_backup_${BACKUP_DATE}.sql.gz /tmp/

# Verify checksum
aws s3 cp s3://sai-mahendra-backups/postgres/${BACKUP_DATE}/postgres_backup_${BACKUP_DATE}.sql.gz.sha256 /tmp/
cd /tmp && sha256sum -c postgres_backup_${BACKUP_DATE}.sql.gz.sha256
```

#### 2. Decrypt Backup (if encrypted)
```bash
# Decrypt using AWS KMS
aws kms decrypt \
  --ciphertext-blob fileb:///tmp/postgres_backup_${BACKUP_DATE}.sql.gz \
  --output text --query Plaintext \
  | base64 -d > /tmp/postgres_backup_${BACKUP_DATE}.sql.gz.decrypted

mv /tmp/postgres_backup_${BACKUP_DATE}.sql.gz.decrypted /tmp/postgres_backup_${BACKUP_DATE}.sql.gz
```

#### 3. Create New Database
```bash
# Drop existing database (CAUTION!)
sudo -u postgres psql -c "DROP DATABASE IF EXISTS sai_mahendra_prod;"

# Create new database
sudo -u postgres psql -c "CREATE DATABASE sai_mahendra_prod;"
```

#### 4. Restore Database
```bash
# Restore from custom format dump
sudo -u postgres pg_restore \
  -d sai_mahendra_prod \
  -v \
  --no-owner \
  --no-acl \
  /tmp/postgres_backup_${BACKUP_DATE}.sql.gz

# Or restore from plain SQL dump
gunzip -c /tmp/postgres_backup_${BACKUP_DATE}.sql.gz | \
  sudo -u postgres psql -d sai_mahendra_prod
```

#### 5. Verify Restoration
```bash
# Check database size
sudo -u postgres psql -d sai_mahendra_prod -c "\l+"

# Verify table counts
sudo -u postgres psql -d sai_mahendra_prod << EOF
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
EOF
```

## Backup Verification

### Automated Verification
The backup system automatically verifies:
- Backup file integrity (checksums)
- S3 upload success
- Backup file accessibility

### Manual Verification
```bash
# Test restore in isolated environment
./scripts/test-restore.sh <backup-date>

# Verify backup contents
aws s3 cp s3://sai-mahendra-backups/postgres/<backup-date>/postgres_backup_<timestamp>.sql.gz - | \
  gunzip | head -n 100
```

## Recovery Time Estimates

| Scenario | Database Size | Estimated RTO |
|----------|--------------|---------------|
| PITR (last 24h) | 10 GB | 30 minutes |
| PITR (last 24h) | 100 GB | 2 hours |
| Full Restore | 10 GB | 1 hour |
| Full Restore | 100 GB | 4 hours |

## Troubleshooting

### Backup Failures

**Issue**: Backup job fails with connection timeout
```bash
# Check PostgreSQL connectivity
kubectl exec -it postgres-backup-<pod> -- psql -h postgres-primary -U postgres -c "SELECT 1;"

# Check network policies
kubectl get networkpolicies -n backup
```

**Issue**: S3 upload fails
```bash
# Verify AWS credentials
kubectl exec -it postgres-backup-<pod> -- aws sts get-caller-identity

# Check S3 bucket permissions
aws s3api get-bucket-policy --bucket sai-mahendra-backups
```

### Recovery Failures

**Issue**: WAL files not found during recovery
```bash
# Check WAL archive availability
aws s3 ls s3://sai-mahendra-wal-archives/postgres-wal/

# Verify restore_command in postgresql.conf
sudo -u postgres cat /var/lib/postgresql/15/main/postgresql.conf | grep restore_command
```

**Issue**: Recovery stops at wrong point in time
```bash
# Check recovery target settings
sudo -u postgres cat /var/lib/postgresql/15/main/postgresql.conf | grep recovery_target

# Review recovery logs
sudo -u postgres tail -f /var/lib/postgresql/15/main/log/postgresql-*.log
```

## Best Practices

### Before Recovery
1. Document current database state
2. Notify all stakeholders
3. Ensure sufficient disk space
4. Have rollback plan ready

### During Recovery
1. Monitor recovery progress continuously
2. Keep detailed logs of all actions
3. Verify each step before proceeding
4. Test connectivity before promoting

### After Recovery
1. Verify data integrity thoroughly
2. Check application functionality
3. Monitor performance metrics
4. Update documentation

## Emergency Contacts

- **Database Team**: db-team@saimahendra.com
- **DevOps Team**: devops@saimahendra.com
- **On-Call Engineer**: +1-XXX-XXX-XXXX

## References

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [PostgreSQL PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [AWS RDS Backup Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html)
