# CI/CD Pipeline Quick Reference Card

## 🚀 Common Commands

### Deploy to Environments

```bash
# Deploy to Dev (automatic on push)
git push origin develop

# Deploy to Staging (automatic on push)
git push origin main

# Deploy to Production (automatic after staging)
# No action needed - automatic after staging success

# Manual deployment trigger
gh workflow run ci-cd-pipeline.yml -f environment=staging
```

### Rollback

```bash
# Emergency rollback
gh workflow run rollback.yml \
  -f environment=production \
  -f rollback_to=abc123def \
  -f reason="Critical bug in payment service"
```

### Check Status

```bash
# View recent workflow runs
gh run list --workflow=ci-cd-pipeline.yml --limit 10

# Watch current run
gh run watch

# View specific run logs
gh run view <run-id> --log

# Check deployment status
kubectl get deployments -n production
kubectl get pods -n production
```

### Troubleshooting

```bash
# Check pod logs
kubectl logs -l app=api-gateway -n production --tail=100

# Check pod status
kubectl describe pod <pod-name> -n production

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'

# Test service health
kubectl run test --image=curlimages/curl --rm -i --restart=Never -n production -- \
  curl -v http://api-gateway:3000/health
```

## 📊 Workflow Status

| Workflow | Trigger | Duration | Purpose |
|----------|---------|----------|---------|
| CI/CD Pipeline | Push, PR | ~15-20 min | Main deployment pipeline |
| Security Scan | Daily, Push | ~10-15 min | Security vulnerability scanning |
| Infrastructure | Manual | ~5-10 min | Terraform infrastructure deployment |
| Rollback | Manual | ~5 min | Emergency rollback |

## 🌍 Environments

| Environment | Branch | URL | Replicas | Auto-Deploy |
|-------------|--------|-----|----------|-------------|
| Dev | `develop` | https://dev.saimahendra.com | 1-3 | ✅ Yes |
| Staging | `main` | https://staging.saimahendra.com | 2-5 | ✅ Yes |
| Production | `main` | https://api.saimahendra.com | 3-10 | ✅ Yes (after staging) |

## 🔒 Security Scans

| Scan Type | Tool | Frequency | Severity Threshold |
|-----------|------|-----------|-------------------|
| SAST | CodeQL, Semgrep | Every push | Medium |
| Dependencies | npm audit, Snyk | Every push | High |
| Containers | Trivy, Grype | Every push | High |
| Secrets | Gitleaks, TruffleHog | Every push | Any |
| Infrastructure | tfsec, Checkov | Every push | High |

## 🔄 Deployment Strategies

### Blue-Green (Staging & Production)
1. Deploy new version (green)
2. Run tests on green
3. Switch traffic to green
4. Keep blue for rollback
5. Cleanup after 1 hour

### Canary (Production Only)
1. Deploy new version
2. Route 10% traffic
3. Monitor for 5 minutes
4. Full cutover or rollback

## 📈 Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Deployment Frequency | Multiple/day | ✅ |
| Lead Time | < 1 hour | ✅ |
| Change Failure Rate | < 15% | ✅ |
| MTTR | < 1 hour | ✅ |
| Test Coverage | > 80% | ✅ |

## 🆘 Emergency Contacts

| Issue | Contact | Channel |
|-------|---------|---------|
| Production Down | On-Call Engineer | PagerDuty |
| Deployment Issues | DevOps Team | #deployments |
| Security Issues | Security Team | #security |
| General Questions | DevOps Team | devops@saimahendra.com |

## 📝 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Security scans clean
- [ ] Code review approved
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Monitoring ready

## 🔧 Helper Scripts

```bash
# Check prerequisites
./.github/scripts/deploy-helper.sh check-prereqs

# Validate environment
./.github/scripts/deploy-helper.sh validate-env staging

# Check deployment health
./.github/scripts/deploy-helper.sh check-health staging api-gateway

# Backup deployment
./.github/scripts/deploy-helper.sh backup staging ./backups

# Get pod logs
./.github/scripts/deploy-helper.sh logs staging api-gateway 100
```

## 🔗 Important Links

- **GitHub Actions:** [Repository Actions Tab](../../actions)
- **Security Reports:** [Repository Security Tab](../../security)
- **Documentation:** [CICD_SETUP_GUIDE.md](./CICD_SETUP_GUIDE.md)
- **Grafana:** https://grafana.saimahendra.com
- **Prometheus:** https://prometheus.saimahendra.com
- **Slack:** #deployments channel

## 💡 Tips

1. **Always test in dev first** before pushing to staging
2. **Monitor Slack notifications** during deployments
3. **Check security scan results** before merging PRs
4. **Use rollback workflow** for quick recovery
5. **Document incidents** in post-mortem issues
6. **Review metrics** regularly to improve process

## 🚨 Common Issues & Solutions

### Issue: Deployment Stuck
```bash
# Check rollout status
kubectl rollout status deployment/api-gateway -n staging

# Force restart
kubectl rollout restart deployment/api-gateway -n staging
```

### Issue: Health Check Failing
```bash
# Check service
kubectl get svc -n staging

# Test internally
kubectl run test --image=curlimages/curl --rm -i --restart=Never -n staging -- \
  curl -v http://api-gateway:3000/health
```

### Issue: Image Pull Error
```bash
# Check secrets
kubectl get secrets -n staging

# Verify image exists
docker pull ghcr.io/sai-mahendra/platform-api-gateway:latest
```

### Issue: High Error Rate
```bash
# Check logs
kubectl logs -l app=api-gateway -n production --tail=100

# Check metrics
# Visit Grafana dashboard

# Rollback if needed
gh workflow run rollback.yml -f environment=production -f rollback_to=<previous-sha> -f reason="High error rate"
```

---

**Keep this card handy for quick reference during deployments!**

**Last Updated:** 2024  
**Version:** 1.0.0
