# Alerting and Incident Response - Quick Reference Guide

## 🚨 Emergency Contacts

### Internal
- **On-Call Engineer**: Check PagerDuty rotation
- **Engineering Manager**: manager@sai-mahendra.com
- **DevOps Team**: devops@sai-mahendra.com
- **Security Team**: security@sai-mahendra.com

### External
- **PagerDuty Support**: support@pagerduty.com
- **AWS Support**: AWS Console
- **Razorpay Support**: support@razorpay.com
- **Stripe Support**: support@stripe.com

## 📊 Monitoring Dashboards

### Access URLs
```
Prometheus:    http://prometheus.monitoring.svc.cluster.local:9090
Alertmanager:  http://alertmanager.monitoring.svc.cluster.local:9093
Grafana:       https://grafana.sai-mahendra.com
Kibana:        https://kibana.sai-mahendra.com
Jaeger:        https://jaeger.sai-mahendra.com
```

### Port Forwarding (Local Access)
```bash
# Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Alertmanager
kubectl port-forward -n monitoring svc/alertmanager 9093:9093

# Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80
```

## 🎯 SLA Targets

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| API Availability | 99.9% | < 99.9% |
| API Latency (P95) | < 200ms | > 200ms |
| API Latency (P99) | < 500ms | > 500ms |
| Service Uptime | 99.9% | < 99.9% |
| Database Query Time | < 100ms | > 100ms |
| Cache Hit Rate | > 80% | < 80% |
| Payment Success Rate | > 95% | < 95% |

## 🔔 Alert Severity Levels

### Critical (PagerDuty + Slack)
- **Response Time**: Immediate (< 5 minutes)
- **Examples**: Service down, SLA violation, payment failures
- **Action**: Page on-call engineer, immediate investigation

### Warning (Slack)
- **Response Time**: Within 30 minutes
- **Examples**: High latency, resource usage, slow queries
- **Action**: Investigate during business hours, monitor trends

### Info (Email)
- **Response Time**: Next business day
- **Examples**: Low enrollment rate, informational metrics
- **Action**: Review and analyze trends

## 🛠️ Common Commands

### Check Service Health
```bash
# Check all pods
kubectl get pods -n sai-mahendra

# Check specific service
kubectl get pods -n sai-mahendra -l app=user-management-service

# Check pod logs
kubectl logs <pod-name> -n sai-mahendra --tail=100

# Check pod details
kubectl describe pod <pod-name> -n sai-mahendra
```

### Check Alerts
```bash
# View active alerts in Prometheus
curl http://prometheus:9090/api/v1/alerts | jq

# View Alertmanager status
curl http://alertmanager:9093/api/v1/status | jq

# View active alerts in Alertmanager
curl http://alertmanager:9093/api/v1/alerts | jq
```

### Check Resource Usage
```bash
# Pod resource usage
kubectl top pods -n sai-mahendra

# Node resource usage
kubectl top nodes

# Specific service
kubectl top pods -n sai-mahendra -l app=user-management-service
```

### Check Deployments
```bash
# List deployments
kubectl get deployments -n sai-mahendra

# Check deployment status
kubectl rollout status deployment/<service-name> -n sai-mahendra

# View deployment history
kubectl rollout history deployment/<service-name> -n sai-mahendra
```

### Rollback Deployment
```bash
# Rollback to previous version
kubectl rollout undo deployment/<service-name> -n sai-mahendra

# Rollback to specific revision
kubectl rollout undo deployment/<service-name> --to-revision=<N> -n sai-mahendra
```

### Scale Service
```bash
# Scale up
kubectl scale deployment/<service-name> --replicas=5 -n sai-mahendra

# Scale down
kubectl scale deployment/<service-name> --replicas=2 -n sai-mahendra

# Check HPA status
kubectl get hpa -n sai-mahendra
```

### Database Operations
```bash
# Connect to PostgreSQL
kubectl exec -it postgres-0 -n sai-mahendra -- psql -U postgres

# Check connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

# Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# Kill long-running query
SELECT pg_terminate_backend(<pid>);
```

### Redis Operations
```bash
# Connect to Redis
kubectl exec -it redis-0 -n sai-mahendra -- redis-cli

# Check status
INFO

# Check memory
INFO memory

# Check clients
CLIENT LIST

# Check slow log
SLOWLOG GET 10
```

## 🔥 Quick Incident Response

### 1. Service Down
```bash
# Check pod status
kubectl get pods -n sai-mahendra -l app=<service>

# Check logs
kubectl logs <pod-name> -n sai-mahendra --tail=100

# Check events
kubectl get events -n sai-mahendra --sort-by='.lastTimestamp'

# Restart if needed
kubectl rollout restart deployment/<service> -n sai-mahendra
```

### 2. High Latency
```bash
# Check current latency
curl 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))'

# Check database
kubectl exec -it postgres-0 -n sai-mahendra -- psql -U postgres -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;"

# Check Redis
kubectl exec -it redis-0 -n sai-mahendra -- redis-cli INFO stats

# Scale if needed
kubectl scale deployment/<service> --replicas=5 -n sai-mahendra
```

### 3. High Error Rate
```bash
# Check error logs
kubectl logs -n sai-mahendra -l app=<service> --tail=100 | grep ERROR

# Check error rate
curl 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])/rate(http_requests_total[5m])'

# Rollback if recent deployment
kubectl rollout undo deployment/<service> -n sai-mahendra
```

### 4. Database Issues
```bash
# Check database status
kubectl get pods -n sai-mahendra -l app=postgres

# Check connections
kubectl exec -it postgres-0 -n sai-mahendra -- psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
kubectl exec -it postgres-0 -n sai-mahendra -- psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < now() - interval '10 minutes';"
```

### 5. Disk Space Critical
```bash
# Check disk usage
kubectl exec -it <pod-name> -n sai-mahendra -- df -h

# Find large files
kubectl exec -it <pod-name> -n sai-mahendra -- du -sh /* | sort -h

# Clean up logs
kubectl exec -it <pod-name> -n sai-mahendra -- find /var/log -name "*.log" -mtime +7 -delete
```

## 📈 SLA Monitoring

### Check Current SLA Status
```bash
# API Availability (24h)
curl 'http://prometheus:9090/api/v1/query?query=sla:api_availability:ratio_rate24h*100'

# API Latency P95
curl 'http://prometheus:9090/api/v1/query?query=sla:api_latency:p95_5m*1000'

# Error Budget Remaining
curl 'http://prometheus:9090/api/v1/query?query=sla:error_budget:remaining_ratio_30d*100'
```

### View SLA Dashboard
```bash
# Access Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80

# Navigate to: http://localhost:3000
# Dashboard: "SLA Tracking Dashboard"
```

## 🔧 Configuration Updates

### Update Alertmanager Configuration
```bash
# Edit configuration
kubectl edit configmap alertmanager-config -n monitoring

# Reload Alertmanager
kubectl exec -n monitoring <alertmanager-pod> -- killall -HUP alertmanager
```

### Update Prometheus Rules
```bash
# Edit rules
kubectl edit configmap prometheus-sla-rules -n monitoring

# Reload Prometheus
kubectl exec -n monitoring <prometheus-pod> -- curl -X POST http://localhost:9090/-/reload
```

### Update Secrets
```bash
# Update PagerDuty key
kubectl patch secret alertmanager-secrets \
  --patch='{"data":{"pagerduty-key":"BASE64_ENCODED_KEY"}}' \
  -n monitoring

# Update Slack webhook
kubectl patch secret alertmanager-secrets \
  --patch='{"data":{"slack-webhook":"BASE64_ENCODED_URL"}}' \
  -n monitoring

# Restart Alertmanager
kubectl rollout restart deployment/alertmanager -n monitoring
```

## 📚 Documentation Links

- **Full Runbooks**: `INCIDENT_RUNBOOKS.md`
- **Completion Report**: `TASK_17.2_COMPLETION_REPORT.md`
- **Monitoring Setup**: `TASK_17.1_COMPLETION_REPORT.md`
- **Deployment Guide**: `README.md`

## 🎓 Training Resources

### New Team Members
1. Read `INCIDENT_RUNBOOKS.md`
2. Review SLA targets and alert thresholds
3. Practice with test alerts
4. Shadow on-call engineer
5. Participate in incident response drills

### Regular Drills
- **Monthly**: Incident response simulation
- **Quarterly**: Disaster recovery drill
- **Annually**: Full system failover test

## 📞 Escalation Matrix

| Severity | Initial Response | Escalation (30 min) | Escalation (1 hour) |
|----------|-----------------|---------------------|---------------------|
| Critical | On-Call Engineer | Senior Engineer | Engineering Manager |
| Warning | On-Call Engineer | Senior Engineer | - |
| Info | Email to Team | - | - |

## 🔐 Security Incidents

For security-related incidents:
1. **Immediately** notify security@sai-mahendra.com
2. Follow security incident response procedures
3. Do NOT discuss publicly until cleared by security team
4. Document all actions taken

## ✅ Post-Incident Checklist

After resolving an incident:
- [ ] Verify service is fully operational
- [ ] Update status page
- [ ] Notify stakeholders of resolution
- [ ] Document incident timeline
- [ ] Schedule post-mortem meeting (within 48 hours)
- [ ] Update runbooks if needed
- [ ] Implement preventive measures
- [ ] Close incident ticket

## 🎯 Key Metrics to Watch

### Real-Time (Every 5 minutes)
- Active alerts count
- API error rate
- Service availability
- Response time (P95, P99)

### Hourly
- SLA compliance
- Error budget consumption
- Resource utilization
- Payment success rate

### Daily
- Incident count and resolution time
- SLA trends
- Capacity planning metrics
- Alert noise analysis

### Weekly
- SLA compliance report
- Incident review
- Capacity planning review
- Alert tuning

## 💡 Pro Tips

1. **Always check recent deployments first** - Most incidents are caused by recent changes
2. **Use port-forwarding for quick access** - Faster than setting up ingress
3. **Check logs before restarting** - Understand the issue before taking action
4. **Scale horizontally before vertically** - Easier to scale back down
5. **Document everything** - Future you will thank present you
6. **Test in staging first** - Never test fixes in production
7. **Communicate early and often** - Keep stakeholders informed
8. **Follow the runbooks** - They're there for a reason
9. **Ask for help** - Don't hesitate to escalate
10. **Learn from incidents** - Every incident is a learning opportunity

## 🚀 Quick Wins

### Improve Response Time
- Set up mobile notifications
- Create custom dashboards for your services
- Automate common fixes with scripts
- Practice incident response regularly

### Reduce Alert Noise
- Tune alert thresholds based on actual metrics
- Implement alert inhibition rules
- Group related alerts
- Use severity levels appropriately

### Improve Reliability
- Implement circuit breakers
- Add retry logic with exponential backoff
- Use connection pooling
- Implement graceful degradation
- Regular load testing

---

**Remember**: The goal is not to eliminate all incidents, but to detect them quickly, respond effectively, and learn from them to prevent recurrence.

**Stay Calm. Follow the Runbooks. Communicate. Learn.**
