# CI/CD Pipeline Setup Guide

## Overview

This guide provides comprehensive instructions for setting up and using the CI/CD pipeline for the Sai Mahendra platform backend services.

## Architecture

The CI/CD pipeline implements:
- **Multi-environment deployment** (dev, staging, production)
- **Automated security scanning** (SAST, dependency scanning, container scanning)
- **Blue-green deployments** with canary releases
- **Automated rollback mechanisms**
- **Infrastructure as Code** validation and deployment

## Prerequisites

### Required Tools
- GitHub account with repository access
- AWS account with appropriate permissions
- kubectl (v1.28+)
- AWS CLI (v2.x)
- Terraform (v1.6+)
- Docker (v24+)

### Required Secrets

Configure the following secrets in GitHub repository settings:

#### AWS Credentials
```
AWS_ACCESS_KEY_ID_DEV
AWS_SECRET_ACCESS_KEY_DEV
AWS_ACCESS_KEY_ID_STAGING
AWS_SECRET_ACCESS_KEY_STAGING
AWS_ACCESS_KEY_ID_PROD
AWS_SECRET_ACCESS_KEY_PROD
```

#### Container Registry
```
GITHUB_TOKEN (automatically provided)
```

#### External Services
```
SNYK_TOKEN
SLACK_WEBHOOK
COSIGN_PRIVATE_KEY (optional, for image signing)
```

#### Kubernetes
```
KUBE_CONFIG (base64 encoded kubeconfig)
KUBE_CONFIG_PROD (base64 encoded kubeconfig for production)
```

## Workflows

### 1. Main CI/CD Pipeline (`ci-cd-pipeline.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

**Stages:**

#### Continuous Integration
1. **Code Quality & Linting**
   - ESLint checks
   - TypeScript type checking
   - Code formatting validation

2. **Unit Tests**
   - Runs tests for all microservices
   - Generates coverage reports
   - Uploads to Codecov

3. **Integration Tests**
   - Tests with real databases (PostgreSQL, Redis, MongoDB)
   - Service-to-service communication tests
   - API endpoint validation

#### Security Scanning
1. **SAST (Static Application Security Testing)**
   - CodeQL analysis
   - Semgrep security rules

2. **Dependency Scanning**
   - npm audit
   - Snyk vulnerability scanning

3. **Container Security**
   - Trivy image scanning
   - Grype vulnerability detection
   - Dockle best practices check

4. **Secret Scanning**
   - Gitleaks
   - TruffleHog

#### Build & Push
- Builds Docker images for all services
- Pushes to GitHub Container Registry
- Tags with multiple strategies (branch, SHA, semver)
- Caches layers for faster builds

#### Deployment

**Development Environment:**
- Automatic deployment on push to `develop`
- Single replica per service
- Debug logging enabled

**Staging Environment:**
- Automatic deployment on push to `main`
- Blue-green deployment strategy
- Integration tests before traffic switch
- 2-5 replicas with auto-scaling

**Production Environment:**
- Requires staging success
- Blue-green deployment with canary
- 10% canary traffic for 5 minutes
- Full cutover after metrics validation
- 3-10 replicas with auto-scaling
- 1-hour rollback window

### 2. Infrastructure Deployment (`infrastructure-deploy.yml`)

**Purpose:** Manage Terraform infrastructure

**Triggers:**
- Push to `main` (Terraform files)
- Pull requests (plan only)
- Manual workflow dispatch

**Actions:**
- `plan`: Generate Terraform plan
- `apply`: Apply infrastructure changes
- `destroy`: Destroy infrastructure (manual only)

**Usage:**
```bash
# Trigger manual deployment
gh workflow run infrastructure-deploy.yml \
  -f environment=staging \
  -f action=apply
```

### 3. Security Scanning (`security-scan.yml`)

**Purpose:** Comprehensive security scanning

**Triggers:**
- Daily at 2 AM UTC (scheduled)
- Push to `main` or `develop`
- Pull requests
- Manual workflow dispatch

**Scans:**
- Dependency vulnerabilities
- Container image security
- Infrastructure security (Terraform, Kubernetes)
- Secret leaks
- Compliance checks (PCI DSS, GDPR, OWASP)

**Outputs:**
- SARIF reports uploaded to GitHub Security
- Consolidated security report artifact
- GitHub issues for critical vulnerabilities

### 4. Emergency Rollback (`rollback.yml`)

**Purpose:** Quick rollback to previous version

**Trigger:** Manual workflow dispatch only

**Parameters:**
- `environment`: Target environment
- `rollback_to`: Commit SHA or tag
- `reason`: Reason for rollback

**Process:**
1. Validates rollback target
2. Creates backup of current state
3. Scales down current deployment
4. Deploys rollback version
5. Verifies health checks
6. Creates incident report
7. Notifies team via Slack
8. Creates post-mortem GitHub issue

**Usage:**
```bash
gh workflow run rollback.yml \
  -f environment=production \
  -f rollback_to=abc123def \
  -f reason="Critical bug in payment service"
```

## Deployment Strategies

### Blue-Green Deployment

**How it works:**
1. Deploy new version (green) alongside current (blue)
2. Run tests on green deployment
3. Switch traffic from blue to green
4. Keep blue for quick rollback
5. Remove blue after stability period

**Benefits:**
- Zero-downtime deployments
- Instant rollback capability
- Full testing before traffic switch

### Canary Deployment (Production Only)

**How it works:**
1. Deploy new version
2. Route 10% traffic to new version
3. Monitor metrics for 5 minutes
4. If metrics are good, route 100% traffic
5. If metrics are bad, rollback automatically

**Metrics Monitored:**
- Error rate (< 1%)
- Response time
- Request success rate

## Environment Configuration

### Development
- **Purpose:** Feature development and testing
- **Replicas:** 1-3
- **Resources:** Minimal (100m CPU, 128Mi RAM)
- **Logging:** Debug level
- **External Services:** Test/sandbox mode

### Staging
- **Purpose:** Pre-production validation
- **Replicas:** 2-5
- **Resources:** Medium (250m CPU, 256Mi RAM)
- **Logging:** Info level
- **External Services:** Test mode with production-like data

### Production
- **Purpose:** Live user traffic
- **Replicas:** 3-10
- **Resources:** High (500m CPU, 512Mi RAM)
- **Logging:** Warn level
- **External Services:** Live mode
- **High Availability:** Multi-AZ, auto-scaling, circuit breakers

## Monitoring and Alerts

### Deployment Monitoring
- Rollout status tracking
- Health check validation
- Resource utilization
- Error rate monitoring

### Alerts
- Slack notifications for all deployments
- GitHub issues for security vulnerabilities
- Post-mortem issues for rollbacks
- PagerDuty integration (production)

## Rollback Procedures

### Automatic Rollback
Triggered when:
- Health checks fail
- Integration tests fail
- Canary metrics exceed thresholds

### Manual Rollback
Use the rollback workflow:
```bash
gh workflow run rollback.yml \
  -f environment=production \
  -f rollback_to=<commit-sha> \
  -f reason="<reason>"
```

### Database Rollback
**⚠️ Manual process to prevent data loss**

1. List available snapshots:
```bash
aws rds describe-db-snapshots \
  --db-instance-identifier sai-mahendra-prod
```

2. Restore from snapshot:
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier sai-mahendra-prod-rollback \
  --db-snapshot-identifier <snapshot-id>
```

3. Update connection strings
4. Verify data integrity
5. Switch DNS/endpoint

## Troubleshooting

### Deployment Failures

**Check deployment status:**
```bash
kubectl get deployments -n <namespace>
kubectl describe deployment <deployment-name> -n <namespace>
```

**Check pod logs:**
```bash
kubectl logs -l app=<service-name> -n <namespace> --tail=100
```

**Check events:**
```bash
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

### Failed Health Checks

1. Check service endpoints:
```bash
kubectl get svc -n <namespace>
```

2. Test internal connectivity:
```bash
kubectl run test-pod --image=curlimages/curl --rm -i --restart=Never -n <namespace> -- \
  curl -v http://<service-name>:3000/health
```

3. Check ingress configuration:
```bash
kubectl get ingress -n <namespace>
kubectl describe ingress <ingress-name> -n <namespace>
```

### Security Scan Failures

1. Review SARIF reports in GitHub Security tab
2. Check artifact uploads for detailed reports
3. Review created GitHub issues
4. Fix vulnerabilities and re-run pipeline

## Best Practices

### Development Workflow
1. Create feature branch from `develop`
2. Make changes and commit
3. Push to GitHub (triggers CI)
4. Create PR to `develop`
5. Review CI results and security scans
6. Merge to `develop` (deploys to dev)
7. Test in dev environment
8. Create PR to `main`
9. Merge to `main` (deploys to staging, then production)

### Deployment Checklist
- [ ] All tests passing
- [ ] Security scans clean
- [ ] Code review approved
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Monitoring dashboards ready
- [ ] Off-hours deployment (production)

### Security Checklist
- [ ] No secrets in code
- [ ] Dependencies up to date
- [ ] Container images scanned
- [ ] Infrastructure validated
- [ ] Compliance checks passed
- [ ] Access controls reviewed

## Maintenance

### Regular Tasks
- **Weekly:** Review security scan reports
- **Monthly:** Update dependencies
- **Quarterly:** Review and update workflows
- **Annually:** Disaster recovery drill

### Cleanup
Old deployments are automatically cleaned up:
- Blue deployments: 1 hour after successful green deployment
- Failed pods: Immediately after successful deployment
- Old container images: 30 days retention

## Support

### Documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Kubernetes Docs](https://kubernetes.io/docs/)
- [Terraform Docs](https://www.terraform.io/docs/)

### Contacts
- **DevOps Team:** devops@saimahendra.com
- **Security Team:** security@saimahendra.com
- **On-Call:** Use PagerDuty for production issues

## Appendix

### Useful Commands

**View workflow runs:**
```bash
gh run list --workflow=ci-cd-pipeline.yml
```

**View workflow logs:**
```bash
gh run view <run-id> --log
```

**Trigger manual deployment:**
```bash
gh workflow run ci-cd-pipeline.yml \
  -f environment=staging
```

**Check cluster status:**
```bash
./.github/scripts/deploy-helper.sh check-cluster sai-mahendra-staging
```

**Backup deployment:**
```bash
./.github/scripts/deploy-helper.sh backup staging ./backups
```

### Environment Variables Reference

See environment-specific configuration files:
- `.github/environments/dev.env`
- `.github/environments/staging.env`
- `.github/environments/production.env`
