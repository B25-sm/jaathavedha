# Incident Response Runbooks

## Table of Contents

1. [Service Down](#service-down)
2. [High API Response Time](#high-api-response-time)
3. [High Error Rate](#high-error-rate)
4. [Database Connection Issues](#database-connection-issues)
5. [Redis Connection Issues](#redis-connection-issues)
6. [High Memory Usage](#high-memory-usage)
7. [High CPU Usage](#high-cpu-usage)
8. [Payment Failure Spike](#payment-failure-spike)
9. [Disk Space Critical](#disk-space-critical)
10. [SLA Violation](#sla-violation)

---

## Service Down

### Alert Details
- **Severity**: Critical
- **Component**: Availability
- **SLA Impact**: Yes - affects 99.9% uptime target

### Symptoms
- Service health check failing
- No response from service endpoints
- Users unable to access service functionality

### Investigation Steps

1. **Check Pod Status**
   ```bash
   kubectl get pods -n sai-mahendra -l app=<service-name>
   kubectl describe pod <pod-name> -n sai-mahendra
   ```

2. **Check Pod Logs**
   ```bash
   kubectl logs <pod-name> -n sai-mahendra --tail=100
   kubectl logs <pod-name> -n sai-mahendra --previous  # If pod restarted
   ```

3. **Check Recent Deployments**
   ```bash
   kubectl rollout history deployment/<service-name> -n sai-mahendra
   kubectl rollout status deployment/<service-name> -n sai-mahendra
   ```

4. **Check Resource Usage**
   ```bash
   kubectl top pods -n sai-mahendra -l app=<service-name>
   kubectl top nodes
   ```

5. **Check Events**
   ```bash
   kubectl get events -n sai-mahendra --sort-by='.lastTimestamp' | grep <service-name>
   ```

### Resolution Steps

**If Pod is CrashLooping:**
```bash
# Check logs for errors
kubectl logs <pod-name> -n sai-mahendra --previous

# If configuration issue, update ConfigMap/Secret
kubectl edit configmap <config-name> -n sai-mahendra

# Restart deployment
kubectl rollout restart deployment/<service-name> -n sai-mahendra
```

**If Resource Limits Exceeded:**
```bash
# Increase resource limits
kubectl edit deployment/<service-name> -n sai-mahendra

# Or scale horizontally
kubectl scale deployment/<service-name> --replicas=5 -n sai-mahendra
```

**If Recent Deployment Caused Issue:**
```bash
# Rollback to previous version
kubectl rollout undo deployment/<service-name> -n sai-mahendra

# Or rollback to specific revision
kubectl rollout undo deployment/<service-name> --to-revision=<revision> -n sai-mahendra
```

**If Node Issues:**
```bash
# Check node status
kubectl get nodes
kubectl describe node <node-name>

# Drain node if unhealthy
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Pods will be rescheduled to healthy nodes
```

### Prevention
- Implement proper health checks (liveness, readiness, startup probes)
- Set appropriate resource requests and limits
- Use Pod Disruption Budgets
- Test deployments in staging environment
- Implement gradual rollouts with canary deployments

---

## High API Response Time

### Alert Details
- **Severity**: Warning (>200ms) / Critical (>1s)
- **Component**: API Performance
- **SLA Impact**: Yes - affects response time SLA

### Symptoms
- API requests taking longer than expected
- User complaints about slow page loads
- Increased timeout errors

### Investigation Steps

1. **Check Current Latency**
   ```bash
   # Query Prometheus
   curl -G 'http://prometheus:9090/api/v1/query' \
     --data-urlencode 'query=histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'
   ```

2. **Identify Slow Endpoints**
   ```bash
   # Check Grafana dashboard or query Prometheus
   # Look for endpoints with high latency
   ```

3. **Check Database Performance**
   ```bash
   # Connect to PostgreSQL
   kubectl exec -it postgres-0 -n sai-mahendra -- psql -U postgres

   # Check slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;

   # Check active connections
   SELECT count(*) FROM pg_stat_activity;
   ```

4. **Check Redis Performance**
   ```bash
   kubectl exec -it redis-0 -n sai-mahendra -- redis-cli

   # Check latency
   redis-cli --latency

   # Check memory usage
   INFO memory

   # Check slow log
   SLOWLOG GET 10
   ```

5. **Check Resource Usage**
   ```bash
   kubectl top pods -n sai-mahendra
   kubectl top nodes
   ```

### Resolution Steps

**If Database is Slow:**
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Analyze tables
ANALYZE users;

-- Vacuum if needed
VACUUM ANALYZE users;
```

**If Cache Hit Rate is Low:**
```bash
# Check cache hit rate
redis-cli INFO stats | grep keyspace

# Warm up cache
# Run cache warming script or increase TTL
```

**If Resource Constrained:**
```bash
# Scale up pods
kubectl scale deployment/<service-name> --replicas=5 -n sai-mahendra

# Or increase resource limits
kubectl edit deployment/<service-name> -n sai-mahendra
```

**If External Service is Slow:**
```bash
# Check external service status
curl -w "@curl-format.txt" -o /dev/null -s <external-url>

# Implement circuit breaker if not already present
# Increase timeout or implement retry logic
```

### Prevention
- Implement database query optimization and indexing
- Use caching effectively (Redis)
- Implement connection pooling
- Use CDN for static assets
- Implement rate limiting to prevent overload
- Monitor and optimize slow queries regularly

---

## High Error Rate

### Alert Details
- **Severity**: Warning (>5%) / Critical (>10%)
- **Component**: API Reliability
- **SLA Impact**: Yes - affects availability SLA

### Symptoms
- Increased 5xx errors
- User reports of errors
- Failed transactions

### Investigation Steps

1. **Check Error Rate by Service**
   ```bash
   # Query Prometheus
   curl -G 'http://prometheus:9090/api/v1/query' \
     --data-urlencode 'query=rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])'
   ```

2. **Check Error Logs**
   ```bash
   # Check application logs
   kubectl logs -n sai-mahendra -l app=<service-name> --tail=100 | grep ERROR

   # Check in Kibana
   # Filter by log level: ERROR or FATAL
   ```

3. **Check Recent Changes**
   ```bash
   # Check recent deployments
   kubectl rollout history deployment/<service-name> -n sai-mahendra

   # Check recent configuration changes
   kubectl get configmap <config-name> -n sai-mahendra -o yaml
   ```

4. **Check Dependencies**
   ```bash
   # Check database connectivity
   kubectl exec -it <pod-name> -n sai-mahendra -- nc -zv postgres 5432

   # Check Redis connectivity
   kubectl exec -it <pod-name> -n sai-mahendra -- nc -zv redis 6379

   # Check external services
   kubectl exec -it <pod-name> -n sai-mahendra -- curl -I <external-url>
   ```

### Resolution Steps

**If Application Error:**
```bash
# Check error details in logs
kubectl logs <pod-name> -n sai-mahendra | grep -A 10 "ERROR"

# If code issue, rollback deployment
kubectl rollout undo deployment/<service-name> -n sai-mahendra

# If configuration issue, fix and restart
kubectl edit configmap <config-name> -n sai-mahendra
kubectl rollout restart deployment/<service-name> -n sai-mahendra
```

**If Database Connection Error:**
```bash
# Check database status
kubectl get pods -n sai-mahendra -l app=postgres

# Check connection pool
# Increase max_connections if needed
kubectl exec -it postgres-0 -n sai-mahendra -- psql -U postgres -c "SHOW max_connections;"

# Restart database if necessary (last resort)
kubectl rollout restart statefulset/postgres -n sai-mahendra
```

**If External Service Error:**
```bash
# Check external service status
curl -I <external-url>

# Implement circuit breaker to prevent cascading failures
# Switch to backup service if available
# Contact external service provider
```

### Prevention
- Implement comprehensive error handling
- Use circuit breakers for external services
- Implement retry logic with exponential backoff
- Monitor error rates and set up alerts
- Implement graceful degradation
- Regular code reviews and testing

---

## Database Connection Issues

### Alert Details
- **Severity**: Critical
- **Component**: Database
- **SLA Impact**: Yes - affects all services

### Symptoms
- Connection timeout errors
- "Too many connections" errors
- Slow query performance
- Service unable to connect to database

### Investigation Steps

1. **Check Database Status**
   ```bash
   kubectl get pods -n sai-mahendra -l app=postgres
   kubectl logs postgres-0 -n sai-mahendra --tail=100
   ```

2. **Check Connection Count**
   ```sql
   -- Connect to database
   kubectl exec -it postgres-0 -n sai-mahendra -- psql -U postgres

   -- Check active connections
   SELECT count(*), state
   FROM pg_stat_activity
   GROUP BY state;

   -- Check max connections
   SHOW max_connections;

   -- Check connection by application
   SELECT application_name, count(*)
   FROM pg_stat_activity
   GROUP BY application_name;
   ```

3. **Check for Long-Running Queries**
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY duration DESC;
   ```

4. **Check Database Locks**
   ```sql
   SELECT blocked_locks.pid AS blocked_pid,
          blocked_activity.usename AS blocked_user,
          blocking_locks.pid AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocked_activity.query AS blocked_statement,
          blocking_activity.query AS blocking_statement
   FROM pg_catalog.pg_locks blocked_locks
   JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
   JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
   JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
   WHERE NOT blocked_locks.granted;
   ```

### Resolution Steps

**If Too Many Connections:**
```sql
-- Increase max_connections (requires restart)
ALTER SYSTEM SET max_connections = 200;

-- Restart PostgreSQL
kubectl rollout restart statefulset/postgres -n sai-mahendra

-- Or kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < now() - interval '10 minutes';
```

**If Connection Pool Exhausted:**
```bash
# Check application connection pool settings
# Increase pool size or decrease pool timeout

# Restart application to reset connections
kubectl rollout restart deployment/<service-name> -n sai-mahendra
```

**If Long-Running Queries:**
```sql
-- Kill long-running query
SELECT pg_terminate_backend(<pid>);

-- Optimize query or add index
CREATE INDEX CONCURRENTLY idx_name ON table_name(column_name);
```

**If Database is Down:**
```bash
# Check pod status
kubectl describe pod postgres-0 -n sai-mahendra

# Check persistent volume
kubectl get pvc -n sai-mahendra

# Restart database
kubectl delete pod postgres-0 -n sai-mahendra
# StatefulSet will recreate the pod
```

### Prevention
- Set appropriate max_connections
- Implement connection pooling in applications
- Monitor connection usage
- Set connection timeouts
- Implement query optimization
- Regular database maintenance (VACUUM, ANALYZE)

---

## Redis Connection Issues

### Alert Details
- **Severity**: Critical
- **Component**: Cache
- **SLA Impact**: Yes - affects performance

### Symptoms
- Cache connection errors
- Increased database load
- Slow response times
- Session management issues

### Investigation Steps

1. **Check Redis Status**
   ```bash
   kubectl get pods -n sai-mahendra -l app=redis
   kubectl logs redis-0 -n sai-mahendra --tail=100
   ```

2. **Check Redis Connectivity**
   ```bash
   kubectl exec -it redis-0 -n sai-mahendra -- redis-cli ping
   ```

3. **Check Redis Info**
   ```bash
   kubectl exec -it redis-0 -n sai-mahendra -- redis-cli INFO

   # Check specific sections
   redis-cli INFO stats
   redis-cli INFO memory
   redis-cli INFO clients
   ```

4. **Check Memory Usage**
   ```bash
   redis-cli INFO memory | grep used_memory_human
   redis-cli INFO memory | grep maxmemory_human
   ```

### Resolution Steps

**If Redis is Down:**
```bash
# Check pod status
kubectl describe pod redis-0 -n sai-mahendra

# Restart Redis
kubectl delete pod redis-0 -n sai-mahendra
```

**If Memory Full:**
```bash
# Check eviction policy
redis-cli CONFIG GET maxmemory-policy

# Set eviction policy if needed
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Increase memory limit
kubectl edit statefulset/redis -n sai-mahendra

# Or flush unnecessary keys
redis-cli FLUSHDB  # Use with caution!
```

**If Too Many Connections:**
```bash
# Check connected clients
redis-cli CLIENT LIST

# Kill idle clients
redis-cli CLIENT KILL TYPE normal SKIPME yes

# Increase max clients
redis-cli CONFIG SET maxclients 10000
```

### Prevention
- Set appropriate maxmemory and eviction policy
- Monitor memory usage
- Implement connection pooling
- Set connection timeouts
- Regular monitoring and alerting

---

## High Memory Usage

### Alert Details
- **Severity**: Warning (>85%)
- **Component**: Infrastructure
- **SLA Impact**: Potential - may lead to OOM kills

### Symptoms
- Pods being OOM killed
- Slow performance
- Increased swap usage

### Investigation Steps

1. **Check Pod Memory Usage**
   ```bash
   kubectl top pods -n sai-mahendra --sort-by=memory
   kubectl describe pod <pod-name> -n sai-mahendra
   ```

2. **Check Node Memory Usage**
   ```bash
   kubectl top nodes
   kubectl describe node <node-name>
   ```

3. **Check for Memory Leaks**
   ```bash
   # Check pod restart count
   kubectl get pods -n sai-mahendra

   # Check memory trends in Grafana
   # Look for continuously increasing memory usage
   ```

### Resolution Steps

**If Pod Exceeds Limits:**
```bash
# Increase memory limits
kubectl edit deployment/<service-name> -n sai-mahendra

# Or scale horizontally
kubectl scale deployment/<service-name> --replicas=5 -n sai-mahendra
```

**If Memory Leak Suspected:**
```bash
# Restart affected pods
kubectl rollout restart deployment/<service-name> -n sai-mahendra

# Investigate application code for memory leaks
# Use profiling tools to identify leak source
```

**If Node Memory Full:**
```bash
# Add more nodes to cluster
# Or upgrade node instance types

# Drain and remove problematic node
kubectl drain <node-name> --ignore-daemonsets
kubectl delete node <node-name>
```

### Prevention
- Set appropriate memory requests and limits
- Implement memory profiling in development
- Regular code reviews for memory leaks
- Monitor memory trends
- Implement horizontal pod autoscaling

---

## High CPU Usage

### Alert Details
- **Severity**: Warning (>80%)
- **Component**: Infrastructure
- **SLA Impact**: Potential - may lead to throttling

### Symptoms
- Slow response times
- CPU throttling
- High load average

### Investigation Steps

1. **Check Pod CPU Usage**
   ```bash
   kubectl top pods -n sai-mahendra --sort-by=cpu
   kubectl describe pod <pod-name> -n sai-mahendra
   ```

2. **Check Node CPU Usage**
   ```bash
   kubectl top nodes
   kubectl describe node <node-name>
   ```

3. **Check for CPU Throttling**
   ```bash
   # Query Prometheus
   rate(container_cpu_cfs_throttled_seconds_total[5m])
   ```

### Resolution Steps

**If Pod CPU High:**
```bash
# Increase CPU limits
kubectl edit deployment/<service-name> -n sai-mahendra

# Or scale horizontally
kubectl scale deployment/<service-name> --replicas=5 -n sai-mahendra
```

**If Inefficient Code:**
```bash
# Profile application to find CPU hotspots
# Optimize code or queries
# Implement caching to reduce computation
```

**If Node CPU Full:**
```bash
# Add more nodes to cluster
# Or upgrade node instance types
```

### Prevention
- Set appropriate CPU requests and limits
- Implement CPU profiling in development
- Optimize algorithms and queries
- Implement caching
- Use horizontal pod autoscaling

---

## Payment Failure Spike

### Alert Details
- **Severity**: Critical
- **Component**: Business
- **SLA Impact**: Yes - affects revenue

### Symptoms
- Increased payment failure rate
- User complaints about payment issues
- Revenue drop

### Investigation Steps

1. **Check Payment Failure Rate**
   ```bash
   # Query Prometheus
   rate(payment_transactions_total{status="failed"}[10m]) / rate(payment_transactions_total[10m])
   ```

2. **Check Payment Gateway Status**
   ```bash
   # Check Razorpay status
   curl -I https://api.razorpay.com/v1/

   # Check Stripe status
   curl -I https://api.stripe.com/v1/
   ```

3. **Check Payment Service Logs**
   ```bash
   kubectl logs -n sai-mahendra -l app=payment-service --tail=100 | grep -i error
   ```

4. **Check Error Types**
   ```bash
   # Group errors by type in logs
   # Check for patterns (specific card types, amounts, etc.)
   ```

### Resolution Steps

**If Payment Gateway Issue:**
```bash
# Check gateway status page
# Contact gateway support
# Switch to backup gateway if available
```

**If Configuration Issue:**
```bash
# Check API keys and credentials
kubectl get secret payment-gateway-credentials -n sai-mahendra -o yaml

# Update if needed
kubectl edit secret payment-gateway-credentials -n sai-mahendra
kubectl rollout restart deployment/payment-service -n sai-mahendra
```

**If Network Issue:**
```bash
# Check network connectivity
kubectl exec -it <payment-pod> -n sai-mahendra -- curl -I https://api.razorpay.com

# Check network policies
kubectl get networkpolicy -n sai-mahendra
```

### Prevention
- Monitor payment gateway status
- Implement retry logic
- Use multiple payment gateways
- Set up alerts for payment failures
- Regular testing of payment flows

---

## Disk Space Critical

### Alert Details
- **Severity**: Critical
- **Component**: Infrastructure
- **SLA Impact**: Yes - may cause service failure

### Symptoms
- Disk space warnings
- Unable to write logs
- Database write failures

### Investigation Steps

1. **Check Disk Usage**
   ```bash
   kubectl exec -it <pod-name> -n sai-mahendra -- df -h
   ```

2. **Find Large Files**
   ```bash
   kubectl exec -it <pod-name> -n sai-mahendra -- du -sh /* | sort -h
   ```

3. **Check Persistent Volumes**
   ```bash
   kubectl get pvc -n sai-mahendra
   kubectl describe pvc <pvc-name> -n sai-mahendra
   ```

### Resolution Steps

**If Log Files Large:**
```bash
# Clean up old logs
kubectl exec -it <pod-name> -n sai-mahendra -- find /var/log -name "*.log" -mtime +7 -delete

# Implement log rotation
# Configure log retention policies
```

**If Database Files Large:**
```bash
# Run VACUUM on PostgreSQL
kubectl exec -it postgres-0 -n sai-mahendra -- psql -U postgres -c "VACUUM FULL;"

# Clean up old data
# Archive old records
```

**If Persistent Volume Full:**
```bash
# Expand PVC (if storage class supports it)
kubectl edit pvc <pvc-name> -n sai-mahendra

# Or create new larger PVC and migrate data
```

### Prevention
- Implement log rotation
- Set up automated cleanup jobs
- Monitor disk usage
- Set appropriate retention policies
- Use log aggregation (ELK stack)

---

## SLA Violation

### Alert Details
- **Severity**: Critical
- **Component**: SLA
- **SLA Impact**: Yes - contractual obligation

### Symptoms
- Availability below 99.9%
- Response time above targets
- Error budget exhausted

### Investigation Steps

1. **Check SLA Metrics**
   ```bash
   # Check Grafana SLA dashboard
   # Review error budget
   # Identify root cause of violations
   ```

2. **Review Recent Incidents**
   ```bash
   # Check Alertmanager history
   # Review incident timeline
   # Identify patterns
   ```

3. **Calculate Impact**
   ```bash
   # Calculate downtime
   # Estimate affected users
   # Assess business impact
   ```

### Resolution Steps

**Immediate Actions:**
```bash
# Resolve ongoing incidents
# Restore service to healthy state
# Communicate with stakeholders
```

**Post-Incident:**
```bash
# Conduct post-mortem
# Document root cause
# Implement preventive measures
# Update runbooks
```

**If Error Budget Exhausted:**
```bash
# Freeze non-critical deployments
# Focus on stability
# Implement additional monitoring
# Review and improve processes
```

### Prevention
- Proactive monitoring
- Regular testing and drills
- Implement chaos engineering
- Continuous improvement
- Regular SLA reviews

---

## General Incident Response Process

### 1. Detection
- Alert received via PagerDuty/Slack
- User report
- Monitoring dashboard

### 2. Triage
- Assess severity and impact
- Determine affected services
- Identify stakeholders

### 3. Investigation
- Follow relevant runbook
- Gather logs and metrics
- Identify root cause

### 4. Resolution
- Implement fix
- Verify resolution
- Monitor for recurrence

### 5. Communication
- Update status page
- Notify stakeholders
- Document timeline

### 6. Post-Mortem
- Conduct blameless post-mortem
- Document lessons learned
- Implement preventive measures
- Update runbooks

---

## Escalation Paths

### Level 1: On-Call Engineer
- Initial response
- Follow runbooks
- Resolve common issues

### Level 2: Senior Engineer
- Complex issues
- Architecture decisions
- Escalation from Level 1

### Level 3: Engineering Manager
- Business impact decisions
- External communication
- Resource allocation

### Level 4: CTO/VP Engineering
- Major incidents
- Customer escalations
- Strategic decisions

---

## Contact Information

### Internal Contacts
- **On-Call Engineer**: PagerDuty rotation
- **Engineering Manager**: manager@sai-mahendra.com
- **DevOps Team**: devops@sai-mahendra.com
- **Security Team**: security@sai-mahendra.com

### External Contacts
- **AWS Support**: AWS Console
- **PagerDuty Support**: support@pagerduty.com
- **Razorpay Support**: support@razorpay.com
- **Stripe Support**: support@stripe.com

---

## Tools and Resources

### Monitoring
- **Prometheus**: http://prometheus.monitoring.svc.cluster.local:9090
- **Grafana**: https://grafana.sai-mahendra.com
- **Alertmanager**: https://alertmanager.sai-mahendra.com

### Logging
- **Kibana**: https://kibana.sai-mahendra.com
- **Elasticsearch**: http://elasticsearch.monitoring.svc.cluster.local:9200

### Tracing
- **Jaeger**: https://jaeger.sai-mahendra.com

### Incident Management
- **PagerDuty**: https://sai-mahendra.pagerduty.com
- **Status Page**: https://status.sai-mahendra.com

### Documentation
- **Runbooks**: This document
- **Architecture Docs**: /docs/architecture
- **API Docs**: https://api.sai-mahendra.com/docs
