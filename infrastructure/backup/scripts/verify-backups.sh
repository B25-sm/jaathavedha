#!/bin/bash

# Backup Verification Script
# This script verifies the integrity of backups

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TEMP_DIR="/tmp/backup-verification-$$"
mkdir -p $TEMP_DIR

cleanup() {
    rm -rf $TEMP_DIR
}

trap cleanup EXIT

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Backup Integrity Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verify PostgreSQL backup
verify_postgres_backup() {
    echo -e "${GREEN}[1] Verifying PostgreSQL Backup${NC}"
    echo "-----------------------------------"
    
    # Get latest backup
    LATEST_BACKUP=$(aws s3 ls s3://sai-mahendra-backups/postgres/ --recursive | sort | tail -1 | awk '{print $4}')
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo -e "${RED}✗ No PostgreSQL backup found${NC}"
        return 1
    fi
    
    echo "Latest backup: $LATEST_BACKUP"
    
    # Download checksum
    BACKUP_DIR=$(dirname $LATEST_BACKUP)
    BACKUP_FILE=$(basename $LATEST_BACKUP)
    
    aws s3 cp s3://sai-mahendra-backups/$LATEST_BACKUP $TEMP_DIR/ 2>/dev/null
    aws s3 cp s3://sai-mahendra-backups/${BACKUP_DIR}/${BACKUP_FILE}.sha256 $TEMP_DIR/ 2>/dev/null
    
    # Verify checksum
    cd $TEMP_DIR
    if sha256sum -c ${BACKUP_FILE}.sha256 2>/dev/null; then
        echo -e "${GREEN}✓ PostgreSQL backup integrity verified${NC}"
        
        # Get backup size
        BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
        echo "  Backup size: $BACKUP_SIZE"
        
        return 0
    else
        echo -e "${RED}✗ PostgreSQL backup checksum verification failed${NC}"
        return 1
    fi
}

# Verify MongoDB backup
verify_mongodb_backup() {
    echo ""
    echo -e "${GREEN}[2] Verifying MongoDB Backup${NC}"
    echo "-----------------------------------"
    
    # Get latest backup
    LATEST_BACKUP=$(aws s3 ls s3://sai-mahendra-backups/mongodb/daily/ --recursive | grep "\.tar\.gz$" | sort | tail -1 | awk '{print $4}')
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo -e "${RED}✗ No MongoDB backup found${NC}"
        return 1
    fi
    
    echo "Latest backup: $LATEST_BACKUP"
    
    # Download checksum
    BACKUP_DIR=$(dirname $LATEST_BACKUP)
    BACKUP_FILE=$(basename $LATEST_BACKUP)
    
    aws s3 cp s3://sai-mahendra-backups/$LATEST_BACKUP $TEMP_DIR/ 2>/dev/null
    aws s3 cp s3://sai-mahendra-backups/${BACKUP_DIR}/${BACKUP_FILE}.sha256 $TEMP_DIR/ 2>/dev/null
    
    # Verify checksum
    cd $TEMP_DIR
    if sha256sum -c ${BACKUP_FILE}.sha256 2>/dev/null; then
        echo -e "${GREEN}✓ MongoDB backup integrity verified${NC}"
        
        # Get backup size
        BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
        echo "  Backup size: $BACKUP_SIZE"
        
        # Verify archive can be extracted
        if tar -tzf $BACKUP_FILE > /dev/null 2>&1; then
            echo -e "${GREEN}✓ MongoDB backup archive is valid${NC}"
        else
            echo -e "${RED}✗ MongoDB backup archive is corrupted${NC}"
            return 1
        fi
        
        return 0
    else
        echo -e "${RED}✗ MongoDB backup checksum verification failed${NC}"
        return 1
    fi
}

# Verify Redis backup
verify_redis_backup() {
    echo ""
    echo -e "${GREEN}[3] Verifying Redis Backup${NC}"
    echo "-----------------------------------"
    
    # Get latest backup
    LATEST_BACKUP=$(aws s3 ls s3://sai-mahendra-backups/redis/ --recursive | grep "\.tar\.gz$" | sort | tail -1 | awk '{print $4}')
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo -e "${RED}✗ No Redis backup found${NC}"
        return 1
    fi
    
    echo "Latest backup: $LATEST_BACKUP"
    
    # Download checksum
    BACKUP_DIR=$(dirname $LATEST_BACKUP)
    BACKUP_FILE=$(basename $LATEST_BACKUP)
    
    aws s3 cp s3://sai-mahendra-backups/$LATEST_BACKUP $TEMP_DIR/ 2>/dev/null
    aws s3 cp s3://sai-mahendra-backups/${BACKUP_DIR}/${BACKUP_FILE}.sha256 $TEMP_DIR/ 2>/dev/null
    
    # Verify checksum
    cd $TEMP_DIR
    if sha256sum -c ${BACKUP_FILE}.sha256 2>/dev/null; then
        echo -e "${GREEN}✓ Redis backup integrity verified${NC}"
        
        # Get backup size
        BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
        echo "  Backup size: $BACKUP_SIZE"
        
        # Verify archive can be extracted
        if tar -tzf $BACKUP_FILE > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Redis backup archive is valid${NC}"
        else
            echo -e "${RED}✗ Redis backup archive is corrupted${NC}"
            return 1
        fi
        
        return 0
    else
        echo -e "${RED}✗ Redis backup checksum verification failed${NC}"
        return 1
    fi
}

# Verify S3 replication
verify_s3_replication() {
    echo ""
    echo -e "${GREEN}[4] Verifying S3 Replication${NC}"
    echo "-----------------------------------"
    
    # Check if replication is configured
    if ! aws s3api get-bucket-replication --bucket sai-mahendra-content-prod --region us-east-1 > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ S3 replication not configured${NC}"
        return 0
    fi
    
    # Upload test file
    TEST_FILE="replication-test-$(date +%s).txt"
    echo "Test file for replication verification" > $TEMP_DIR/$TEST_FILE
    
    echo "Uploading test file to primary bucket..."
    aws s3 cp $TEMP_DIR/$TEST_FILE s3://sai-mahendra-content-prod/test/$TEST_FILE --region us-east-1
    
    # Wait for replication (max 2 minutes)
    echo "Waiting for replication (max 2 minutes)..."
    REPLICATED=false
    for i in {1..24}; do
        if aws s3 ls s3://sai-mahendra-content-replica-prod/test/$TEST_FILE --region us-west-2 > /dev/null 2>&1; then
            REPLICATED=true
            break
        fi
        sleep 5
    done
    
    # Cleanup test file
    aws s3 rm s3://sai-mahendra-content-prod/test/$TEST_FILE --region us-east-1 2>/dev/null
    aws s3 rm s3://sai-mahendra-content-replica-prod/test/$TEST_FILE --region us-west-2 2>/dev/null
    
    if [ "$REPLICATED" = true ]; then
        echo -e "${GREEN}✓ S3 replication is working${NC}"
        return 0
    else
        echo -e "${RED}✗ S3 replication failed or is too slow${NC}"
        return 1
    fi
}

# Run verifications
POSTGRES_OK=0
MONGODB_OK=0
REDIS_OK=0
S3_OK=0

verify_postgres_backup && POSTGRES_OK=1 || true
verify_mongodb_backup && MONGODB_OK=1 || true
verify_redis_backup && REDIS_OK=1 || true
verify_s3_replication && S3_OK=1 || true

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"

TOTAL_CHECKS=4
PASSED_CHECKS=$((POSTGRES_OK + MONGODB_OK + REDIS_OK + S3_OK))

echo "PostgreSQL: $([ $POSTGRES_OK -eq 1 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "MongoDB:    $([ $MONGODB_OK -eq 1 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "Redis:      $([ $REDIS_OK -eq 1 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "S3 Repl:    $([ $S3_OK -eq 1 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"

echo ""
echo "Result: $PASSED_CHECKS/$TOTAL_CHECKS checks passed"

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✓ All backup verifications passed${NC}"
    exit 0
else
    echo -e "${RED}✗ Some backup verifications failed${NC}"
    exit 1
fi
