# CI/CD Pipeline Documentation

## Quick Start

This directory contains the complete CI/CD pipeline configuration for the Sai Mahendra platform.

### 📁 Directory Structure

```
.github/
├── workflows/              # GitHub Actions workflows
│   ├── ci-cd-pipeline.yml         # Main CI/CD pipeline
│   ├── infrastructure-deploy.yml  # Terraform deployment
│   ├── security-scan.yml          # Security scanning
│   └── rollback.yml               # Emergency rollback
├── environments/           # Environment configurations
│   ├── dev.env
│   ├── staging.env
│   └── production.env
├── scripts/               # Helper scripts
│   └── deploy-helper.sh   # Deployment utilities
├── CICD_SETUP_GUIDE.md   # Comprehensive setup guide
└── README.md             # This file
```

## 🚀 Features

### Automated Testing
- ✅ Unit tests for all microservices
- ✅ Integration tests with real databases
- ✅ End-to-end tests for critical workflows
- ✅ Code coverage reporting

### Security Scanning
- 🔒 SAST (CodeQL, Semgrep)
- 🔒 Dependency scanning (npm audit, Snyk)
- 🔒 Container scanning (Trivy, Grype)
- 🔒 Secret scanning (Gitleaks, TruffleHog)
- 🔒 Infrastructure scanning (tfsec, Checkov)

### Deployment Strategies
- 🔄 Blue-green deployments
- 🐤 Canary releases (production)
- ⚡ Zero-downtime deployments
- 🔙 Automated rollback on failure

### Multi-Environment Support
- 🧪 **Dev:** Feature development and testing
- 🎭 **Staging:** Pre-production validation
- 🚀 **Production:** Live user traffic

## 📋 Quick Reference

### Trigger Deployment

**To Development:**
```bash
git push origin develop
```

**To Staging:**
```bash
git push origin main
```

**To Production:**
Automatically deploys after staging success

### Manual Rollback

```bash
gh workflow run rollback.yml \
  -f environment=production \
  -f rollback_to=abc123 \
  -f reason="Critical bug fix"
```

### View Pipeline Status

```bash
# List recent runs
gh run list --workflow=ci-cd-pipeline.yml

# View specific run
gh run view <run-id> --log

# Watch current run
gh run watch
```

### Check Deployment Status

```bash
# Using helper script
./.github/scripts/deploy-helper.sh check-health staging api-gateway

# Using kubectl directly
kubectl get deployments -n staging
kubectl get pods -n staging
```

## 🔧 Setup Instructions

### 1. Configure Secrets

Add these secrets in GitHub repository settings:

**AWS Credentials:**
- `AWS_ACCESS_KEY_ID_DEV`
- `AWS_SECRET_ACCESS_KEY_DEV`
- `AWS_ACCESS_KEY_ID_STAGING`
- `AWS_SECRET_ACCESS_KEY_STAGING`
- `AWS_ACCESS_KEY_ID_PROD`
- `AWS_SECRET_ACCESS_KEY_PROD`

**External Services:**
- `SNYK_TOKEN`
- `SLACK_WEBHOOK`

### 2. Configure Environments

GitHub environments are automatically created. Configure protection rules:

**Staging:**
- Required reviewers: 1
- Wait timer: 0 minutes

**Production:**
- Required reviewers: 2
- Wait timer: 5 minutes

### 3. Initialize Infrastructure

```bash
# Plan infrastructure
gh workflow run infrastructure-deploy.yml \
  -f environment=dev \
  -f action=plan

# Apply infrastructure
gh workflow run infrastructure-deploy.yml \
  -f environment=dev \
  -f action=apply
```

## 📊 Monitoring

### Deployment Metrics
- Build duration
- Test coverage
- Deployment frequency
- Change failure rate
- Mean time to recovery (MTTR)

### Access Dashboards
- **GitHub Actions:** Repository → Actions tab
- **Security:** Repository → Security tab
- **Grafana:** https://grafana.saimahendra.com
- **Prometheus:** https://prometheus.saimahendra.com

## 🆘 Troubleshooting

### Common Issues

**1. Deployment Stuck**
```bash
# Check rollout status
kubectl rollout status deployment/api-gateway -n staging

# Check pod events
kubectl describe pod <pod-name> -n staging
```

**2. Health Check Failing**
```bash
# Test service internally
kubectl run test --image=curlimages/curl --rm -i --restart=Never -n staging -- \
  curl -v http://api-gateway:3000/health
```

**3. Image Pull Errors**
```bash
# Check image exists
docker pull ghcr.io/sai-mahendra/platform-api-gateway:latest

# Check image pull secrets
kubectl get secrets -n staging
```

### Get Help

1. Check [CICD_SETUP_GUIDE.md](./CICD_SETUP_GUIDE.md) for detailed documentation
2. Review workflow logs in GitHub Actions
3. Check Slack #deployments channel
4. Contact DevOps team: devops@saimahendra.com

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

## 🔄 Workflow Diagrams

### Main CI/CD Pipeline Flow

```
┌─────────────┐
│   Push to   │
│   Branch    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Code Quality & Linting             │
│  - ESLint                            │
│  - TypeScript type checking          │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Unit Tests                          │
│  - All microservices                 │
│  - Coverage reporting                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Integration Tests                   │
│  - Database integration              │
│  - Service communication             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Security Scanning                   │
│  - SAST, Dependencies, Containers    │
│  - Secret scanning                   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Build & Push Docker Images          │
│  - Multi-service build               │
│  - Push to GHCR                      │
└──────┬──────────────────────────────┘
       │
       ├─────────────────┬─────────────────┐
       ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Deploy    │  │   Deploy    │  │   Deploy    │
│     Dev     │  │   Staging   │  │ Production  │
│             │  │             │  │             │
│  • Direct   │  │  • Blue-    │  │  • Blue-    │
│    deploy   │  │    Green    │  │    Green    │
│             │  │  • E2E      │  │  • Canary   │
│             │  │    tests    │  │  • Metrics  │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Blue-Green Deployment Flow

```
┌──────────────┐
│   Current    │
│ (Blue) v1.0  │  ◄─── 100% Traffic
└──────────────┘

       │ Deploy new version
       ▼

┌──────────────┐     ┌──────────────┐
│   Current    │     │     New      │
│ (Blue) v1.0  │     │ (Green) v2.0 │
└──────────────┘     └──────────────┘
       │                     │
       │                     │ Run tests
       │                     ▼
       │              ┌──────────────┐
       │              │ Tests Pass?  │
       │              └──────┬───────┘
       │                     │ Yes
       │                     ▼
       │              Switch traffic
       ▼                     ▼

┌──────────────┐     ┌──────────────┐
│   Previous   │     │   Current    │
│ (Blue) v1.0  │     │ (Green) v2.0 │  ◄─── 100% Traffic
└──────────────┘     └──────────────┘
       │                     │
       │ Wait 1 hour         │
       ▼                     │
   Cleanup                   │
                             ▼
                      ┌──────────────┐
                      │   Current    │
                      │ (Blue) v2.0  │  ◄─── 100% Traffic
                      └──────────────┘
```

## 🎯 Success Metrics

### DORA Metrics
- **Deployment Frequency:** Multiple times per day
- **Lead Time for Changes:** < 1 hour
- **Change Failure Rate:** < 15%
- **Time to Restore Service:** < 1 hour

### Quality Metrics
- **Test Coverage:** > 80%
- **Security Vulnerabilities:** 0 critical, < 5 high
- **Build Success Rate:** > 95%
- **Deployment Success Rate:** > 98%

## 📝 Change Log

### Version 1.0.0 (Current)
- ✅ Multi-environment CI/CD pipeline
- ✅ Comprehensive security scanning
- ✅ Blue-green deployments
- ✅ Automated rollback
- ✅ Infrastructure as Code
- ✅ Monitoring and alerting

### Planned Enhancements
- [ ] Progressive delivery with feature flags
- [ ] Automated performance testing
- [ ] Chaos engineering integration
- [ ] Multi-region deployment
- [ ] Advanced canary analysis

---

**Last Updated:** 2024
**Maintained By:** DevOps Team
**Version:** 1.0.0
