# Performance and Load Testing

This directory contains comprehensive performance and load testing infrastructure for the Sai Mahendra platform using k6.

## Overview

The performance test suite validates:
- **API Response Times**: Ensures sub-200ms response times under normal load
- **Concurrent Users**: Tests system behavior with 1000+ concurrent users
- **Auto-Scaling**: Validates Kubernetes HPA behavior under load
- **System Stability**: Verifies stability under stress and sustained load

## Test Types

### 1. Load Test (`k6-load-test.js`)
Progressive load test that ramps up to 1000 concurrent users.

**Stages:**
- Ramp-up to 100 users (2 min)
- Hold at 100 users (5 min)
- Ramp-up to 500 users (2 min)
- Hold at 500 users (5 min)
- Ramp-up to 1000 users (2 min)
- Hold at 1000 users (5 min)
- Ramp-down (3 min)

**Success Criteria:**
- P95 response time < 500ms
- P99 response time < 1000ms
- Error rate < 1%

**Endpoints Tested:**
- `/health` - Health check
- `/api/auth/login` - Authentication
- `/api/programs` - Program listing
- `/api/users/profile` - User profile
- `/api/enrollments` - User enrollments
- `/api/analytics/dashboard` - Analytics
- `/api/content/testimonials` - Content

### 2. Stress Test (`k6-stress-test.js`)
Progressively increases load to find the system breaking point.

**Stages:**
- Warm-up: 100 users (2 min)
- Ramp to 500 users (3 min)
- Ramp to 1000 users (3 min)
- Ramp to 1500 users (3 min)
- Ramp to 2000 users (3 min)
- Hold at 2000 users (5 min)
- Ramp-down (3 min)

**Purpose:**
- Identify system capacity limits
- Validate graceful degradation
- Test error handling under extreme load

### 3. Spike Test (`k6-spike-test.js`)
Sudden traffic surge to test auto-scaling behavior.

**Stages:**
- Normal load: 100 users (1 min)
- Sudden spike: 1500 users (30 sec)
- Hold spike: 1500 users (3 min)
- Drop to normal: 100 users (30 sec)
- Recovery: 100 users (2 min)

**Purpose:**
- Validate auto-scaling triggers
- Test system recovery time
- Verify no service disruption during scaling

### 4. Soak Test (`k6-soak-test.js`)
Sustained load over extended period to detect memory leaks.

**Configuration:**
- Ramp-up: 500 users (5 min)
- Sustained load: 500 users (60 min)
- Ramp-down (5 min)

**Purpose:**
- Detect memory leaks
- Validate long-term stability
- Test resource cleanup

## Prerequisites

### 1. Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
```

**Alternative (all platforms):**
Download from https://k6.io/docs/getting-started/installation/

### 2. Start Services

Ensure all backend services are running:
```bash
cd backend
npm run start:services
```

Verify services are healthy:
```bash
curl http://localhost:3000/health
```

### 3. Create Test Users

The tests use predefined test users. Ensure these users exist in the database:
- test1@example.com (password: Test123!@#)
- test2@example.com (password: Test123!@#)
- test3@example.com (password: Test123!@#)

## Running Tests

### Quick Start

Run all tests using the automated script:
```bash
chmod +x run-load-tests.sh
./run-load-tests.sh
```

### Individual Tests

**Load Test:**
```bash
k6 run k6-load-test.js
```

**Stress Test:**
```bash
k6 run k6-stress-test.js
```

**Spike Test:**
```bash
k6 run k6-spike-test.js
```

**Soak Test (1 hour):**
```bash
k6 run k6-soak-test.js
```

### Custom Configuration

Override base URL:
```bash
BASE_URL=https://staging.saimahendra.com k6 run k6-load-test.js
```

Custom VUs and duration:
```bash
k6 run --vus 500 --duration 10m k6-load-test.js
```

## Interpreting Results

### Key Metrics

**Response Time:**
- **P50 (Median)**: 50% of requests faster than this
- **P95**: 95% of requests faster than this (SLA target)
- **P99**: 99% of requests faster than this
- **Max**: Slowest request

**Success Criteria:**
- Normal load: P95 < 200ms
- Peak load: P95 < 500ms
- Stress test: P95 < 1000ms

**Error Rate:**
- Target: < 1% under normal/peak load
- Acceptable: < 5% under stress test
- Acceptable: < 10% during spike test

**Throughput:**
- Requests per second (RPS)
- Higher is better
- Should scale linearly with users

### Example Output

```
✓ http_req_duration..............: avg=145ms  min=23ms  med=98ms  max=2.1s  p(95)=320ms p(99)=480ms
✓ http_req_failed................: 0.02%
✓ http_reqs......................: 45678 (152.26/s)
✓ successful_requests............: 45669
✓ failed_requests................: 9
✓ errors.........................: 0.02%
```

### Auto-Scaling Validation

Monitor Kubernetes during tests:
```bash
# Watch pod scaling
kubectl get pods -w

# Check HPA status
kubectl get hpa

# View HPA events
kubectl describe hpa user-management-hpa
```

**Expected Behavior:**
- HPA triggers at 70% CPU utilization
- Scale-up time: < 2 minutes
- Scale-down cooldown: 5 minutes
- Min replicas: 2, Max replicas: 10

## Monitoring During Tests

### Grafana Dashboards

Access Grafana at http://localhost:3001 (or your Grafana URL)

**Key Dashboards:**
- System Overview
- API Performance
- Database Performance
- Resource Utilization

**Metrics to Watch:**
- CPU utilization per service
- Memory usage trends
- Database connection pool
- Cache hit ratio
- Request latency distribution

### Application Logs

Monitor logs during tests:
```bash
# All services
kubectl logs -f -l app=sai-mahendra

# Specific service
kubectl logs -f deployment/user-management-service
```

### Database Performance

Monitor database during tests:
```bash
# PostgreSQL connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Slow queries
psql -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

## Troubleshooting

### High Error Rates

**Symptoms:** Error rate > 5%

**Possible Causes:**
- Database connection pool exhausted
- Rate limiting triggered
- Service timeout
- Memory exhaustion

**Solutions:**
1. Check service logs for errors
2. Increase database connection pool
3. Adjust rate limiting thresholds
4. Scale up resources

### Slow Response Times

**Symptoms:** P95 > 500ms under normal load

**Possible Causes:**
- Unoptimized database queries
- Missing indexes
- Cache misses
- Network latency

**Solutions:**
1. Review slow query logs
2. Add database indexes
3. Increase cache TTL
4. Enable query caching

### Auto-Scaling Not Triggering

**Symptoms:** Pods not scaling despite high load

**Possible Causes:**
- HPA not configured
- Metrics server not running
- Resource requests not set
- Insufficient cluster capacity

**Solutions:**
1. Verify HPA configuration: `kubectl get hpa`
2. Check metrics server: `kubectl top nodes`
3. Review pod resource requests
4. Check cluster node capacity

## Performance Targets

### Requirements Validation

**Requirement 12.1:** API response times
- ✅ P95 < 200ms under normal load (100 users)
- ✅ P95 < 500ms under peak load (1000 users)

**Requirement 12.2:** Concurrent users
- ✅ Support 1000+ concurrent users
- ✅ No performance degradation

**Requirement 15.6:** Load testing
- ✅ Comprehensive load test suite
- ✅ Stress, spike, and soak tests
- ✅ Auto-scaling validation

## Results Storage

Test results are saved in JSON format:
- `results/load-test_TIMESTAMP.json`
- `results/stress-test_TIMESTAMP.json`
- `results/spike-test_TIMESTAMP.json`
- `results/soak-test_TIMESTAMP.json`

## CI/CD Integration

Add to GitHub Actions workflow:
```yaml
- name: Run Performance Tests
  run: |
    cd backend/tests/performance
    chmod +x run-load-tests.sh
    ./run-load-tests.sh
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
```

## Best Practices

1. **Run tests in staging environment** before production
2. **Monitor system metrics** during tests
3. **Cool-down period** between tests (30 seconds)
4. **Baseline tests** before major changes
5. **Document results** for comparison
6. **Alert on regressions** in CI/CD

## Support

For issues or questions:
1. Check service logs
2. Review Grafana dashboards
3. Consult troubleshooting section
4. Contact DevOps team

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Kubernetes HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
