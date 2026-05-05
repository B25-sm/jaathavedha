# Automated Backup Systems

This directory contains automated backup configurations and scripts for all data stores in the Sai Mahendra platform.

## Overview

The backup system provides comprehensive data protection for:
- **PostgreSQL**: Point-in-time recovery with automated daily backups
- **MongoDB**: Automated backups with retention policies
- **Redis**: Persistence configuration and backup strategies
- **S3**: Cross-region replication for file storage

## Backup Components

### 1. PostgreSQL Backups
- **Location**: `./postgres/`
- **Strategy**: Continuous archiving with point-in-time recovery (PITR)
- **Retention**: 30 days for full backups, 7 days for WAL archives
- **Schedule**: Full backup daily at 2:00 AM UTC, continuous WAL archiving

### 2. MongoDB Backups
- **Location**: `./mongodb/`
- **Strategy**: mongodump with compression
- **Retention**: 30 days for daily backups, 90 days for monthly backups
- **Schedule**: Daily at 3:00 AM UTC

### 3. Redis Backups
- **Location**: `./redis/`
- **Strategy**: RDB snapshots + AOF persistence
- **Retention**: 7 days for RDB snapshots
- **Schedule**: Automatic snapshots every 6 hours

### 4. S3 Cross-Region Replication
- **Location**: `./s3/`
- **Strategy**: Real-time replication to secondary region
- **Retention**: Versioning enabled with lifecycle policies
- **Regions**: Primary (us-east-1), Secondary (us-west-2)

## Quick Start

### Prerequisites
- AWS CLI configured with appropriate credentials
- kubectl configured for Kubernetes cluster access
- Sufficient storage in backup S3 buckets
- IAM roles with backup permissions

### Deploy Backup Infrastructure

```bash
# Deploy all backup configurations
./deploy-backups.sh

# Deploy specific backup system
./deploy-backups.sh postgres
./deploy-backups.sh mongodb
./deploy-backups.sh redis
./deploy-backups.sh s3
```

### Verify Backups

```bash
# Check backup status
./scripts/check-backup-status.sh

# List recent backups
./scripts/list-backups.sh

# Verify backup integrity
./scripts/verify-backups.sh
```

## Backup Schedules

| Data Store | Backup Type | Frequency | Retention |
|------------|-------------|-----------|-----------|
| PostgreSQL | Full Backup | Daily 2:00 AM UTC | 30 days |
| PostgreSQL | WAL Archive | Continuous | 7 days |
| MongoDB | Full Backup | Daily 3:00 AM UTC | 30 days |
| MongoDB | Monthly Backup | 1st of month | 90 days |
| Redis | RDB Snapshot | Every 6 hours | 7 days |
| Redis | AOF | Continuous | Current only |
| S3 | Replication | Real-time | Indefinite |

## Disaster Recovery

### Recovery Time Objective (RTO)
- **PostgreSQL**: 4 hours
- **MongoDB**: 2 hours
- **Redis**: 1 hour
- **S3**: Immediate (failover to secondary region)

### Recovery Point Objective (RPO)
- **PostgreSQL**: 5 minutes (WAL archiving)
- **MongoDB**: 24 hours (daily backups)
- **Redis**: 6 hours (snapshot interval)
- **S3**: Near-zero (real-time replication)

### Recovery Procedures

See individual backup directories for detailed recovery procedures:
- [PostgreSQL Recovery](./postgres/RECOVERY.md)
- [MongoDB Recovery](./mongodb/RECOVERY.md)
- [Redis Recovery](./redis/RECOVERY.md)
- [S3 Recovery](./s3/RECOVERY.md)

## Monitoring and Alerts

Backup monitoring is integrated with the platform's monitoring stack:
- **Prometheus**: Backup metrics and success/failure rates
- **Grafana**: Backup dashboards and visualizations
- **AlertManager**: Alerts for backup failures

### Key Metrics
- Backup success rate
- Backup duration
- Backup size
- Time since last successful backup
- Storage utilization

### Alerts
- Backup failure (immediate)
- Backup duration exceeds threshold (warning)
- Storage capacity approaching limit (warning)
- No backup in 48 hours (critical)

## Security

### Encryption
- **At Rest**: All backups encrypted using AES-256
- **In Transit**: TLS 1.3 for all backup transfers
- **Key Management**: AWS KMS for encryption keys

### Access Control
- IAM roles with least privilege access
- Backup buckets with restricted access policies
- Audit logging for all backup operations

## Cost Optimization

### Storage Classes
- **Recent backups** (0-7 days): S3 Standard
- **Medium-term** (8-30 days): S3 Standard-IA
- **Long-term** (30+ days): S3 Glacier

### Lifecycle Policies
- Automatic transition to cheaper storage classes
- Automatic deletion after retention period
- Intelligent tiering for variable access patterns

## Compliance

The backup system supports compliance requirements:
- **GDPR**: Data retention and deletion policies
- **SOC 2**: Audit trails and access controls
- **ISO 27001**: Backup and recovery procedures

## Troubleshooting

### Common Issues

**Backup Failure**
```bash
# Check backup logs
kubectl logs -n backup -l app=postgres-backup

# Verify credentials
aws sts get-caller-identity

# Check storage capacity
./scripts/check-storage.sh
```

**Slow Backups**
```bash
# Check network bandwidth
./scripts/check-network.sh

# Verify compression settings
./scripts/check-compression.sh
```

**Recovery Issues**
```bash
# Verify backup integrity
./scripts/verify-backup.sh <backup-id>

# Test recovery in isolated environment
./scripts/test-recovery.sh <backup-id>
```

## Maintenance

### Regular Tasks
- Weekly: Review backup logs and metrics
- Monthly: Test recovery procedures
- Quarterly: Review and update retention policies
- Annually: Disaster recovery drill

### Backup Rotation
Automated cleanup runs daily to remove expired backups according to retention policies.

## Support

For backup-related issues:
1. Check backup logs in CloudWatch
2. Review Grafana backup dashboards
3. Consult recovery documentation
4. Contact platform operations team

## References

- [AWS Backup Best Practices](https://docs.aws.amazon.com/aws-backup/latest/devguide/best-practices.html)
- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [MongoDB Backup Methods](https://docs.mongodb.com/manual/core/backups/)
- [Redis Persistence](https://redis.io/topics/persistence)
