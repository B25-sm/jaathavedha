# Disaster Recovery Testing Plan

## Overview

This document outlines comprehensive testing procedures for disaster recovery capabilities, including database recovery, service failover, and complete system restoration.

## Testing Schedule

### Monthly Tests
- Database backup restoration (non-production)
- Service failover simulation
- DNS failover testing
- Monitoring and alerting validation

### Quarterly Tests
- Full disaster recovery drill
- Multi-region failover test
- Data integrity verification
- RTO/RPO validation

### Annual Tests
- Complete regional failure simulation
- Third-party DR audit
- Business continuity exercise
- Disaster recovery plan review

## Test Procedures

### Test 1: Database Backup and Restore

**Objective:** Verify database backups can be restored successfully

**Frequency:** Monthly

**Duration:** 2-3 hours

**Prerequisites:**
- Access to AWS RDS console
- Database credentials
- Test environment available

**Procedure:**

1. **Identify Latest Backup**
   ```bash
   # List available snapshots
   aws rds describe-db-snapshots \
     --db-instance-identifier sai-mahendra-prod \
     --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
     --output table
   
   # Select most recent snapshot
   SNAPSHOT_ID=$(aws rds describe-db-snapshots \
     --db-instance-identifier sai-mahendra-prod \
     --query 'DBSnapshots | sort_by(@, &SnapshotCreateTime)[-1].DBSnapshotIdentifier' \
     --output text)
   
   echo "Testing with snapshot: $SNAPSHOT_ID"
   ```

2. **Restore to Test Instance**
   ```bash
   # Restore snapshot
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier test-restore-$(date +%Y%m%d) \
     --db-snapshot-identifier $SNAPSHOT_ID \
     --db-instance-class db.t3.medium \
     --publicly-accessible false
   
   # Wait for restoration
   aws rds wait db-instance-available \
     --db-instance-identifier test-restore-$(date +%Y%m%d)
   ```

3. **Verify Data Integrity**
   ```bash
   # Get endpoint
   TEST_ENDPOINT=$(aws rds describe-db-instances \
     --db-instance-identifier test-restore-$(date +%Y%m%d) \
     --query 'DBInstances[0].Endpoint.Address' \
     --output text)
   
   # Connect and verify
   psql -h $TEST_ENDPOINT -U admin -d saimahendra <<EOF
   -- Check table counts
   SELECT 'users' as table_name, COUNT(*) as count FROM users
   UNION ALL
   SELECT 'enrollments', COUNT(*) FROM enrollments
   UNION ALL
   SELECT 'payments', COUNT(*) FROM payments
   UNION ALL
   SELECT 'programs', COUNT(*) FROM programs;
   
   -- Verify referential integrity
   SELECT COUNT(*) as orphaned_enrollments 
   FROM enrollments e 
   LEFT JOIN users u ON e.user_id = u.id 
   WHERE u.id IS NULL;
   
   -- Check recent data
   SELECT COUNT(*) as recent_users 
   FROM users 
   WHERE created_at > NOW() - INTERVAL '7 days';
   EOF
   ```

4. **Test Application Connectivity**
   ```bash
   # Deploy test application
   kubectl create namespace dr-test
   
   kubectl create secret generic db-credentials \
     --from-literal=url="postgresql://admin:${DB_PASSWORD}@${TEST_ENDPOINT}:5432/saimahendra" \
     -n dr-test
   
   # Deploy test pod
   kubectl run test-db-connection \
     --image=postgres:15 \
     --env="DATABASE_URL=postgresql://admin:${DB_PASSWORD}@${TEST_ENDPOINT}:5432/saimahendra" \
     -n dr-test \
     -- sleep 3600
   
   # Test connection
   kubectl exec -n dr-test test-db-connection -- \
     psql $DATABASE_URL -c "SELECT version();"
   ```

5. **Cleanup**
   ```bash
   # Delete test instance
   aws rds delete-db-instance \
     --db-instance-identifier test-restore-$(date +%Y%m%d) \
     --skip-final-snapshot
   
   # Cleanup Kubernetes resources
   kubectl delete namespace dr-test
   ```

**Success Criteria:**
- ✓ Snapshot restored successfully
- ✓ All tables present with expected row counts
- ✓ No referential integrity violations
- ✓ Application can connect and query database
- ✓ Restoration completed within 30 minutes

**Documentation:**
- Record snapshot ID tested
- Document any data discrepancies
- Note restoration time
- Update runbook if issues found

---

### Test 2: Point-in-Time Recovery (PITR)

**Objective:** Verify ability to recover database to specific timestamp

**Frequency:** Quarterly

**Duration:** 2-3 hours

**Procedure:**

1. **Record Current State**
   ```bash
   # Take note of current data
   psql -h $PROD_DB_HOST -U admin -d saimahendra <<EOF
   SELECT NOW() as current_time;
   SELECT COUNT(*) as user_count FROM users;
   SELECT MAX(created_at) as latest_user FROM users;
   EOF
   ```

2. **Create Test Data**
   ```bash
   # Insert test record (in test environment)
   psql -h $TEST_DB_HOST -U admin -d saimahendra <<EOF
   INSERT INTO users (email, first_name, last_name, password_hash, role)
   VALUES ('pitr-test@example.com', 'PITR', 'Test', 'hash', 'student');
   
   SELECT NOW() as test_record_time;
   EOF
   ```

3. **Perform PITR**
   ```bash
   # Restore to time before test record
   RESTORE_TIME=$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)
   
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier sai-mahendra-test \
     --target-db-instance-identifier pitr-test-$(date +%Y%m%d) \
     --restore-time $RESTORE_TIME
   
   # Wait for restoration
   aws rds wait db-instance-available \
     --db-instance-identifier pitr-test-$(date +%Y%m%d)
   ```

4. **Verify Recovery**
   ```bash
   # Check test record is not present
   PITR_ENDPOINT=$(aws rds describe-db-instances \
     --db-instance-identifier pitr-test-$(date +%Y%m%d) \
     --query 'DBInstances[0].Endpoint.Address' \
     --output text)
   
   psql -h $PITR_ENDPOINT -U admin -d saimahendra <<EOF
   SELECT COUNT(*) as should_be_zero 
   FROM users 
   WHERE email = 'pitr-test@example.com';
   EOF
   ```

5. **Cleanup**
   ```bash
   aws rds delete-db-instance \
     --db-instance-identifier pitr-test-$(date +%Y%m%d) \
     --skip-final-snapshot
   ```

**Success Criteria:**
- ✓ PITR completed successfully
- ✓ Database restored to exact timestamp
- ✓ Test record not present in restored database
- ✓ All other data intact
- ✓ Recovery completed within RPO target (5 minutes)

---

### Test 3: Regional Failover Simulation

**Objective:** Test complete failover from primary to secondary region

**Frequency:** Quarterly

**Duration:** 4-6 hours

**Prerequisites:**
- Maintenance window scheduled
- Stakeholders notified
- Rollback plan prepared
- Secondary region verified healthy

**Procedure:**

1. **Pre-Failover Checks**
   ```bash
   # Run validation script
   ./infrastructure/disaster-recovery/scripts/validate-services.sh
   
   # Check secondary region health
   aws route53 get-health-check-status \
     --health-check-id $SECONDARY_HEALTH_CHECK_ID
   
   # Verify replication lag
   aws rds describe-db-instances \
     --db-instance-identifier sai-mahendra-secondary-replica \
     --query 'DBInstances[0].StatusInfos'
   ```

2. **Record Baseline Metrics**
   ```bash
   # Capture current metrics
   cat > /tmp/baseline-metrics.txt <<EOF
   Timestamp: $(date)
   Active Users: $(curl -s https://api.saimahendra.com/metrics/active-users)
   Response Time: $(curl -s -w "%{time_total}" https://api.saimahendra.com/health)
   Error Rate: $(curl -s https://api.saimahendra.com/metrics/error-rate)
   EOF
   ```

3. **Initiate Failover**
   ```bash
   # Execute failover script
   ./infrastructure/disaster-recovery/scripts/failover-to-secondary.sh
   ```

4. **Monitor Failover Progress**
   ```bash
   # Watch pod status
   watch -n 5 'kubectl get pods --context=secondary -n production'
   
   # Monitor DNS propagation
   watch -n 10 'dig +short api.saimahendra.com'
   
   # Check application logs
   kubectl logs -f -l tier=critical --context=secondary -n production
   ```

5. **Validate Post-Failover**
   ```bash
   # Run validation script
   ./infrastructure/disaster-recovery/scripts/validate-services.sh
   
   # Test critical workflows
   ./infrastructure/tests/e2e-critical-paths.sh
   
   # Verify data consistency
   ./infrastructure/disaster-recovery/scripts/verify-data-sync.sh
   ```

6. **Measure RTO**
   ```bash
   # Calculate actual RTO
   FAILOVER_START=$(grep "Starting Disaster Recovery Failover" /var/log/disaster-recovery/failover-*.log | tail -1 | awk '{print $1, $2}')
   FAILOVER_END=$(grep "Failover Completed Successfully" /var/log/disaster-recovery/failover-*.log | tail -1 | awk '{print $1, $2}')
   
   # Calculate duration
   echo "Failover Duration: $(( $(date -d "$FAILOVER_END" +%s) - $(date -d "$FAILOVER_START" +%s) )) seconds"
   ```

7. **User Impact Assessment**
   ```bash
   # Check error rates during failover
   kubectl logs -l app=api-gateway --context=secondary -n production --since=1h | \
     grep -i "error" | wc -l
   
   # Check failed requests
   curl -s https://api.saimahendra.com/metrics/failed-requests?since=1h
   ```

8. **Failback to Primary** (if test successful)
   ```bash
   # Wait for primary region recovery
   # Sync data from secondary to primary
   # Execute failback script
   ./infrastructure/disaster-recovery/scripts/failback-to-primary.sh
   ```

**Success Criteria:**
- ✓ Failover completed within RTO target (30 minutes)
- ✓ All services healthy in secondary region
- ✓ No data loss (RPO met)
- ✓ DNS updated successfully
- ✓ Application accessible via public domain
- ✓ Error rate < 1% during failover
- ✓ Successful failback to primary region

**Metrics to Capture:**
- Time to detect failure
- Time to initiate failover
- Time to complete failover
- Number of failed requests
- Data loss (if any)
- User impact duration

---

### Test 4: Data Corruption Recovery

**Objective:** Test recovery from data corruption scenario

**Frequency:** Annually

**Duration:** 3-4 hours

**Procedure:**

1. **Simulate Corruption** (in test environment)
   ```bash
   # Create test corruption
   psql -h $TEST_DB_HOST -U admin -d saimahendra <<EOF
   -- Corrupt some test data
   UPDATE users SET email = 'corrupted' WHERE id IN (
     SELECT id FROM users WHERE email LIKE '%test%' LIMIT 10
   );
   
   -- Record corruption time
   SELECT NOW() as corruption_time;
   EOF
   ```

2. **Detect Corruption**
   ```bash
   # Run data integrity checks
   psql -h $TEST_DB_HOST -U admin -d saimahendra <<EOF
   -- Find invalid emails
   SELECT COUNT(*) as invalid_emails 
   FROM users 
   WHERE email NOT LIKE '%@%';
   
   -- Find orphaned records
   SELECT COUNT(*) as orphaned_enrollments 
   FROM enrollments e 
   LEFT JOIN users u ON e.user_id = u.id 
   WHERE u.id IS NULL;
   EOF
   ```

3. **Identify Last Good State**
   ```bash
   # Find backup before corruption
   aws rds describe-db-snapshots \
     --db-instance-identifier sai-mahendra-test \
     --query "DBSnapshots[?SnapshotCreateTime<'$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)'] | sort_by(@, &SnapshotCreateTime)[-1]"
   ```

4. **Restore Clean Data**
   ```bash
   # Restore from backup
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier corruption-recovery-test \
     --db-snapshot-identifier $CLEAN_SNAPSHOT_ID
   
   # Wait for restoration
   aws rds wait db-instance-available \
     --db-instance-identifier corruption-recovery-test
   ```

5. **Verify Recovery**
   ```bash
   # Check data integrity
   RECOVERY_ENDPOINT=$(aws rds describe-db-instances \
     --db-instance-identifier corruption-recovery-test \
     --query 'DBInstances[0].Endpoint.Address' \
     --output text)
   
   psql -h $RECOVERY_ENDPOINT -U admin -d saimahendra <<EOF
   -- Verify no corrupted data
   SELECT COUNT(*) as should_be_zero 
   FROM users 
   WHERE email = 'corrupted';
   
   -- Verify data integrity
   SELECT COUNT(*) as valid_emails 
   FROM users 
   WHERE email LIKE '%@%';
   EOF
   ```

6. **Cleanup**
   ```bash
   aws rds delete-db-instance \
     --db-instance-identifier corruption-recovery-test \
     --skip-final-snapshot
   ```

**Success Criteria:**
- ✓ Corruption detected quickly
- ✓ Last good backup identified
- ✓ Data restored successfully
- ✓ No corrupted data in restored database
- ✓ All integrity constraints satisfied
- ✓ Recovery completed within 2 hours

---

### Test 5: Complete System Recovery

**Objective:** Test full system rebuild from backups

**Frequency:** Annually

**Duration:** 8-12 hours

**Prerequisites:**
- Dedicated test environment
- All backup access verified
- Infrastructure as Code up to date
- Team availability for extended test

**Procedure:**

1. **Prepare Clean Environment**
   ```bash
   # Create new VPC and infrastructure
   cd infrastructure/terraform
   terraform workspace new dr-test-$(date +%Y%m%d)
   terraform init
   terraform plan -var-file=dr-test.tfvars
   terraform apply -var-file=dr-test.tfvars
   ```

2. **Restore Databases**
   ```bash
   # Restore PostgreSQL
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier dr-test-postgres \
     --db-snapshot-identifier $LATEST_SNAPSHOT
   
   # Restore MongoDB
   ./infrastructure/backup/mongodb/restore.sh latest
   
   # Restore Redis
   ./infrastructure/backup/redis/restore.sh latest
   ```

3. **Deploy Kubernetes Cluster**
   ```bash
   # Create EKS cluster
   eksctl create cluster -f infrastructure/kubernetes/dr-test-cluster.yaml
   
   # Configure kubectl
   aws eks update-kubeconfig --name dr-test-cluster
   ```

4. **Deploy Applications**
   ```bash
   # Deploy all services
   kubectl apply -f infrastructure/kubernetes/deployments/
   
   # Wait for deployments
   kubectl wait --for=condition=available --timeout=600s \
     deployment --all -n production
   ```

5. **Restore File Storage**
   ```bash
   # Sync S3 data
   aws s3 sync s3://sai-mahendra-primary-backup s3://dr-test-storage
   
   # Update CloudFront distribution
   aws cloudfront update-distribution \
     --id $DR_TEST_DISTRIBUTION_ID \
     --distribution-config file://cloudfront-config.json
   ```

6. **Comprehensive Validation**
   ```bash
   # Run all validation tests
   ./infrastructure/disaster-recovery/scripts/validate-services.sh
   
   # Run integration tests
   npm run test:integration
   
   # Run E2E tests
   npm run test:e2e
   
   # Load testing
   ./infrastructure/tests/load-test.sh
   ```

7. **Measure Recovery Metrics**
   ```bash
   # Calculate total recovery time
   echo "Infrastructure deployment: X minutes"
   echo "Database restoration: Y minutes"
   echo "Application deployment: Z minutes"
   echo "Total RTO: $(( X + Y + Z )) minutes"
   ```

8. **Cleanup**
   ```bash
   # Destroy test environment
   terraform destroy -var-file=dr-test.tfvars
   terraform workspace select default
   terraform workspace delete dr-test-$(date +%Y%m%d)
   ```

**Success Criteria:**
- ✓ Complete infrastructure deployed successfully
- ✓ All databases restored with data integrity
- ✓ All applications deployed and healthy
- ✓ File storage accessible
- ✓ All tests passing
- ✓ Total recovery time within RTO target
- ✓ No data loss beyond RPO target

---

## Test Documentation Template

After each test, complete the following documentation:

### Test Execution Report

**Test Name:** [Test Name]  
**Test Date:** [Date]  
**Test Duration:** [Duration]  
**Executed By:** [Name]  
**Test Environment:** [Environment]

**Objectives:**
- [List objectives]

**Results:**
- [ ] Objective 1: Pass/Fail
- [ ] Objective 2: Pass/Fail
- [ ] Objective 3: Pass/Fail

**Metrics:**
- RTO Achieved: [Time]
- RPO Achieved: [Time]
- Data Loss: [Amount]
- Error Rate: [Percentage]

**Issues Encountered:**
1. [Issue description]
   - Impact: [High/Medium/Low]
   - Resolution: [How resolved]

**Lessons Learned:**
- [Lesson 1]
- [Lesson 2]

**Action Items:**
- [ ] [Action item 1] - Owner: [Name] - Due: [Date]
- [ ] [Action item 2] - Owner: [Name] - Due: [Date]

**Recommendations:**
- [Recommendation 1]
- [Recommendation 2]

**Sign-off:**
- Tester: _________________ Date: _______
- Reviewer: _________________ Date: _______
- Approver: _________________ Date: _______

---

## Continuous Improvement

### Post-Test Actions

1. **Update Documentation**
   - Update runbooks based on findings
   - Document any new procedures
   - Update contact information

2. **Fix Issues**
   - Create tickets for identified issues
   - Prioritize based on impact
   - Track to completion

3. **Update Automation**
   - Improve scripts based on learnings
   - Add new validation checks
   - Enhance monitoring

4. **Train Team**
   - Share lessons learned
   - Update training materials
   - Conduct knowledge transfer

### Metrics Tracking

Track the following metrics over time:
- RTO trend
- RPO trend
- Test success rate
- Issues found per test
- Time to resolve issues
- Team readiness score

### Annual Review

Conduct annual review of:
- DR strategy effectiveness
- RTO/RPO targets appropriateness
- Technology updates needed
- Process improvements
- Training effectiveness
- Budget allocation

---

**Document Version:** 1.0  
**Last Updated:** 2024-01-15  
**Next Review:** 2024-04-15  
**Owner:** Platform Operations Team
