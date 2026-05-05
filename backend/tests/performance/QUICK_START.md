# Performance Testing - Quick Start Guide

Get started with performance testing in 5 minutes!

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

Or download from: https://k6.io/docs/getting-started/installation/

### 2. Install Dependencies

```bash
cd backend/tests/performance
npm install
```

## Quick Start

### Step 1: Start Services

```bash
cd backend
npm run start:services
```

Wait for all services to start (check http://localhost:3000/health)

### Step 2: Setup Test Data

```bash
cd backend/tests/performance
node setup-test-data.js
```

This creates test users and sample data.

### Step 3: Run Tests

**Linux/macOS:**
```bash
./run-load-tests.sh
```

**Windows:**
```bash
run-load-tests.bat
```

**Or run individual tests:**
```bash
# Load test (24 minutes)
k6 run k6-load-test.js

# Stress test (22 minutes)
k6 run k6-stress-test.js

# Spike test (8 minutes)
k6 run k6-spike-test.js

# Soak test (70 minutes)
k6 run k6-soak-test.js
```

### Step 4: Analyze Results

```bash
node analyze-results.js
```

## What Gets Tested?

### Load Test
- ✅ 100 → 500 → 1000 concurrent users
- ✅ API response times
- ✅ Error rates
- ✅ Throughput

### Stress Test
- ✅ Progressive load up to 2000 users
- ✅ System breaking point
- ✅ Graceful degradation

### Spike Test
- ✅ Sudden traffic surge
- ✅ Auto-scaling behavior
- ✅ Recovery time

### Soak Test
- ✅ 1 hour sustained load
- ✅ Memory leak detection
- ✅ Long-term stability

## Expected Results

### Normal Load (100 users)
- P95 response time: ~120ms ✅
- Error rate: < 1% ✅
- Throughput: ~80 req/s ✅

### Peak Load (1000 users)
- P95 response time: ~320ms ✅
- Error rate: < 1% ✅
- Throughput: ~350 req/s ✅

## Monitoring

### During Tests

**Watch Kubernetes pods:**
```bash
kubectl get pods -w
```

**Check auto-scaling:**
```bash
kubectl get hpa
```

**View logs:**
```bash
kubectl logs -f deployment/user-management-service
```

### Grafana Dashboards

Access at http://localhost:3001 (or your Grafana URL)

Watch:
- CPU/Memory utilization
- Request latency
- Error rates
- Database performance

## Troubleshooting

### Services Not Running
```bash
cd backend
npm run start:services
```

### Test Users Don't Exist
```bash
node setup-test-data.js
```

### k6 Not Found
Install k6 (see Prerequisites above)

### High Error Rates
- Check service logs
- Verify database connections
- Review rate limiting
- Check resource limits

## Next Steps

1. ✅ Run baseline tests
2. ✅ Review results
3. ✅ Check Grafana dashboards
4. ✅ Verify auto-scaling
5. ✅ Optimize bottlenecks

## Need Help?

- 📖 Full documentation: [README.md](./README.md)
- 📊 Results analysis: `node analyze-results.js`
- 🔍 Troubleshooting: See README.md

## CI/CD Integration

Add to your pipeline:
```yaml
- name: Performance Tests
  run: |
    cd backend/tests/performance
    ./run-load-tests.sh
```

---

**Ready to test?** Run `./run-load-tests.sh` and watch your system perform! 🚀
