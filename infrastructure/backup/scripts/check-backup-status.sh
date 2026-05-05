#!/bin/bash

# Backup Status Check Script
# This script checks the status of all backup systems

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Backup System Status Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Kubernetes CronJobs
echo -e "${GREEN}[1] Kubernetes CronJob Status${NC}"
echo "-----------------------------------"
kubectl get cronjobs -n backup -o custom-columns=\
NAME:.metadata.name,\
SCHEDULE:.spec.schedule,\
SUSPEND:.spec.suspend,\
ACTIVE:.status.active,\
LAST_SCHEDULE:.status.lastScheduleTime

echo ""

# Check recent backup jobs
echo -e "${GREEN}[2] Recent Backup Jobs${NC}"
echo "-----------------------------------"
kubectl get jobs -n backup --sort-by=.status.startTime | tail -10

echo ""

# Check failed jobs
echo -e "${GREEN}[3] Failed Backup Jobs${NC}"
echo "-----------------------------------"
FAILED_JOBS=$(kubectl get jobs -n backup -o json | jq -r '.items[] | select(.status.failed > 0) | .metadata.name')
if [ -z "$FAILED_JOBS" ]; then
    echo -e "${GREEN}✓ No failed jobs${NC}"
else
    echo -e "${RED}✗ Failed jobs found:${NC}"
    echo "$FAILED_JOBS"
fi

echo ""

# Check PostgreSQL backups in S3
echo -e "${GREEN}[4] PostgreSQL Backups in S3${NC}"
echo "-----------------------------------"
POSTGRES_BACKUPS=$(aws s3 ls s3://sai-mahendra-backups/postgres/ 2>/dev/null | wc -l)
if [ $POSTGRES_BACKUPS -gt 0 ]; then
    echo -e "${GREEN}✓ Found $POSTGRES_BACKUPS PostgreSQL backup(s)${NC}"
    echo "Latest backups:"
    aws s3 ls s3://sai-mahendra-backups/postgres/ --recursive | sort | tail -5
else
    echo -e "${RED}✗ No PostgreSQL backups found${NC}"
fi

echo ""

# Check MongoDB backups in S3
echo -e "${GREEN}[5] MongoDB Backups in S3${NC}"
echo "-----------------------------------"
MONGODB_BACKUPS=$(aws s3 ls s3://sai-mahendra-backups/mongodb/ 2>/dev/null | wc -l)
if [ $MONGODB_BACKUPS -gt 0 ]; then
    echo -e "${GREEN}✓ Found $MONGODB_BACKUPS MongoDB backup(s)${NC}"
    echo "Latest backups:"
    aws s3 ls s3://sai-mahendra-backups/mongodb/daily/ --recursive | sort | tail -5
else
    echo -e "${RED}✗ No MongoDB backups found${NC}"
fi

echo ""

# Check Redis backups in S3
echo -e "${GREEN}[6] Redis Backups in S3${NC}"
echo "-----------------------------------"
REDIS_BACKUPS=$(aws s3 ls s3://sai-mahendra-backups/redis/ 2>/dev/null | wc -l)
if [ $REDIS_BACKUPS -gt 0 ]; then
    echo -e "${GREEN}✓ Found $REDIS_BACKUPS Redis backup(s)${NC}"
    echo "Latest backups:"
    aws s3 ls s3://sai-mahendra-backups/redis/ --recursive | sort | tail -5
else
    echo -e "${RED}✗ No Redis backups found${NC}"
fi

echo ""

# Check S3 replication status
echo -e "${GREEN}[7] S3 Replication Status${NC}"
echo "-----------------------------------"
REPLICATION_STATUS=$(aws s3api get-bucket-replication --bucket sai-mahendra-content-prod --region us-east-1 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ S3 replication is configured${NC}"
    echo "$REPLICATION_STATUS" | jq -r '.ReplicationConfiguration.Rules[] | "Rule: \(.Id) - Status: \(.Status)"'
else
    echo -e "${YELLOW}⚠ S3 replication not configured or not accessible${NC}"
fi

echo ""

# Check backup storage usage
echo -e "${GREEN}[8] Backup Storage Usage${NC}"
echo "-----------------------------------"
BACKUP_SIZE=$(aws s3 ls s3://sai-mahendra-backups/ --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}')
if [ -n "$BACKUP_SIZE" ]; then
    BACKUP_SIZE_GB=$(echo "scale=2; $BACKUP_SIZE / 1024 / 1024 / 1024" | bc)
    echo -e "${GREEN}Total backup storage: ${BACKUP_SIZE_GB} GB${NC}"
else
    echo -e "${YELLOW}⚠ Unable to calculate backup storage${NC}"
fi

echo ""

# Check time since last successful backup
echo -e "${GREEN}[9] Time Since Last Successful Backup${NC}"
echo "-----------------------------------"

check_last_backup() {
    local backup_type=$1
    local s3_prefix=$2
    
    LAST_BACKUP=$(aws s3 ls s3://sai-mahendra-backups/${s3_prefix}/ --recursive 2>/dev/null | sort | tail -1 | awk '{print $1, $2}')
    if [ -n "$LAST_BACKUP" ]; then
        LAST_BACKUP_EPOCH=$(date -d "$LAST_BACKUP" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$LAST_BACKUP" +%s 2>/dev/null)
        CURRENT_EPOCH=$(date +%s)
        HOURS_AGO=$(( ($CURRENT_EPOCH - $LAST_BACKUP_EPOCH) / 3600 ))
        
        if [ $HOURS_AGO -lt 24 ]; then
            echo -e "${GREEN}✓ ${backup_type}: ${HOURS_AGO} hours ago${NC}"
        elif [ $HOURS_AGO -lt 48 ]; then
            echo -e "${YELLOW}⚠ ${backup_type}: ${HOURS_AGO} hours ago (>24h)${NC}"
        else
            echo -e "${RED}✗ ${backup_type}: ${HOURS_AGO} hours ago (>48h)${NC}"
        fi
    else
        echo -e "${RED}✗ ${backup_type}: No backups found${NC}"
    fi
}

check_last_backup "PostgreSQL" "postgres"
check_last_backup "MongoDB" "mongodb/daily"
check_last_backup "Redis" "redis"

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"

TOTAL_ISSUES=0

# Count issues
if [ -n "$FAILED_JOBS" ]; then
    ((TOTAL_ISSUES++))
fi

if [ $POSTGRES_BACKUPS -eq 0 ]; then
    ((TOTAL_ISSUES++))
fi

if [ $MONGODB_BACKUPS -eq 0 ]; then
    ((TOTAL_ISSUES++))
fi

if [ $REDIS_BACKUPS -eq 0 ]; then
    ((TOTAL_ISSUES++))
fi

if [ $TOTAL_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ All backup systems are operational${NC}"
    exit 0
else
    echo -e "${RED}✗ Found $TOTAL_ISSUES issue(s) with backup systems${NC}"
    echo -e "${YELLOW}Please review the details above and take corrective action${NC}"
    exit 1
fi
