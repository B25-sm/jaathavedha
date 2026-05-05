# Performance Testing Integration Guide

## Overview

This guide explains how to integrate performance testing into your development workflow, CI/CD pipeline, and monitoring systems.

## Development Workflow

### Before Deployment

1. **Run Baseline Tests**
   ```bash
   cd backend/tests/performance
   ./run-load-tests.sh
   ```

2. **Review Results**
   ```bash
   node analyze-results.js
   ```

3. **Check Metrics**
   - Response times within targets
   - Error rates acceptable
   - No performance regressions

### After Code Changes

1. **Run Relevant Tests**
   ```bash
   # For API changes
   k6 run k6-load-test.js
   
   # For scaling changes
   k6 run k6-spike-test.js
   ```

2. **Compare Results**
   - Compare with baseline metrics
   - Look for regressions
   - Document improvements

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/performance-tests.yml`:

```yaml
name: Performance Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  performance-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Start Services
        run: |
          cd backend
          docker-compose up -d
          sleep 30  # Wait for services to be ready
      
      - name: Setup Test Data
        run: |
          cd backend/tests/performance
          npm install
          node setup-test-data.js
        env:
          BASE_URL: http://localhost:3000
      
      - name: Run Load Test
        run: |
          cd backend/tests/performance
          k6 run --out json=results/load-test.json k6-load-test.js
        env:
          BASE_URL: http://localhost:3000
      
      - name: Run Spike Test
        run: |
          cd backend/tests/performance
          k6 run --out json=results/spike-test.json k6-spike-test.js
        env:
          BASE_URL: http://localhost:3000
      
      - name: Analyze Results
        run: |
          cd backend/tests/performance
          node analyze-results.js
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: performance-test-results
          path: backend/tests/performance/results/
      
      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('backend/tests/performance/results/load-test.json'));
            const p95 = results.metrics.http_req_duration.values['p(95)'].toFixed(2);
            const errorRate = (results.metrics.http_req_failed.values.rate * 100).toFixed(2);
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Performance Test Results\n\n- P95 Response Time: ${p95}ms\n- Error Rate: ${errorRate}%\n\n${p95 < 500 ? '✅' : '❌'} Performance targets met`
            });
```

### GitLab CI

Add to `.gitlab-ci.yml`:

```yaml
performance-tests:
  stage: test
  image: loadimpact/k6:latest
  services:
    - postgres:15
    - redis:7
  script:
    - cd backend/tests/performance
    - npm install
    - node setup-test-data.js
    - k6 run --out json=results/load-test.json k6-load-test.js
    - node analyze-results.js
  artifacts:
    paths:
      - backend/tests/performance/results/
    expire_in: 30 days
  only:
    - main
    - develop
```

### Jenkins

Add to `Jenkinsfile`:

```groovy
pipeline {
    agent any
    
    stages {
        stage('Performance Tests') {
            steps {
                script {
                    docker.image('loadimpact/k6:latest').inside {
                        sh '''
                            cd backend/tests/performance
                            npm install
                            node setup-test-data.js
                            k6 run --out json=results/load-test.json k6-load-test.js
                            node analyze-results.js
                        '''
                    }
                }
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'backend/tests/performance/results/**', fingerprint: true
        }
    }
}
```

## Monitoring Integration

### Grafana Dashboard

Import the k6 dashboard:

1. Install k6 Grafana plugin
2. Configure Prometheus data source
3. Import dashboard ID: 2587
4. Customize for your metrics

### Prometheus Metrics

k6 can export metrics to Prometheus:

```bash
k6 run --out experimental-prometheus-rw k6-load-test.js
```

Configure in `config.js`:

```javascript
export const options = {
  ext: {
    loadimpact: {
      projectID: 'YOUR_PROJECT_ID',
      name: 'Load Test'
    }
  }
};
```

### Alerting

Set up alerts for performance regressions:

**Prometheus Alert Rules:**

```yaml
groups:
  - name: performance
    rules:
      - alert: HighResponseTime
        expr: http_req_duration_p95 > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API response time"
          description: "P95 response time is {{ $value }}ms"
      
      - alert: HighErrorRate
        expr: http_req_failed_rate > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate"
          description: "Error rate is {{ $value }}%"
```

## Kubernetes Integration

### Auto-Scaling Validation

Monitor HPA during tests:

```bash
# Watch HPA in real-time
kubectl get hpa -w

# Check HPA events
kubectl describe hpa user-management-hpa

# View pod scaling
kubectl get pods -l app=user-management -w
```

### Resource Monitoring

```bash
# CPU and memory usage
kubectl top pods

# Node resources
kubectl top nodes

# Detailed pod metrics
kubectl describe pod <pod-name>
```

## Scheduled Testing

### Cron Job (Linux/macOS)

Add to crontab:

```bash
# Run performance tests daily at 2 AM
0 2 * * * cd /path/to/backend/tests/performance && ./run-load-tests.sh >> /var/log/performance-tests.log 2>&1
```

### Windows Task Scheduler

Create scheduled task:

```powershell
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c cd C:\path\to\backend\tests\performance && run-load-tests.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Performance Tests" -Description "Daily performance testing"
```

## Results Storage

### Long-term Storage

Store results in S3/Cloud Storage:

```bash
# Upload to S3
aws s3 cp results/ s3://your-bucket/performance-tests/$(date +%Y%m%d)/ --recursive

# Upload to Google Cloud Storage
gsutil -m cp -r results/ gs://your-bucket/performance-tests/$(date +%Y%m%d)/
```

### Database Storage

Store metrics in database for trending:

```javascript
// Example: Store in PostgreSQL
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function storeResults(testName, metrics) {
  await pool.query(
    'INSERT INTO performance_results (test_name, p95_response_time, error_rate, throughput, timestamp) VALUES ($1, $2, $3, $4, NOW())',
    [testName, metrics.p95, metrics.errorRate, metrics.throughput]
  );
}
```

## Reporting

### Automated Reports

Generate HTML reports:

```bash
# Install k6 HTML reporter
npm install -g k6-reporter

# Generate report
k6 run --out json=results.json k6-load-test.js
k6-reporter results.json
```

### Email Notifications

Send results via email:

```javascript
const nodemailer = require('nodemailer');

async function sendResults(results) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: 'performance@saimahendra.com',
    to: 'team@saimahendra.com',
    subject: 'Performance Test Results',
    html: generateResultsHTML(results)
  });
}
```

### Slack Notifications

Post results to Slack:

```bash
# Add to run-load-tests.sh
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Performance tests completed. P95: 320ms, Error rate: 0.02%"}' \
  $SLACK_WEBHOOK_URL
```

## Best Practices

### 1. Test Environment

- Use dedicated test environment
- Match production configuration
- Isolate from development

### 2. Test Frequency

- **Daily**: Smoke tests (quick validation)
- **Weekly**: Full load tests
- **Before Release**: Comprehensive suite
- **After Incidents**: Regression tests

### 3. Baseline Management

- Establish baseline metrics
- Update after infrastructure changes
- Document expected performance
- Track trends over time

### 4. Result Analysis

- Compare with previous runs
- Look for trends and patterns
- Investigate anomalies
- Document findings

### 5. Continuous Improvement

- Set performance budgets
- Monitor for regressions
- Optimize bottlenecks
- Update tests as system evolves

## Troubleshooting Integration

### CI/CD Failures

**Issue**: Tests fail in CI but pass locally

**Solutions**:
- Check resource limits in CI
- Verify network connectivity
- Review timeout settings
- Check service startup time

### Monitoring Gaps

**Issue**: Metrics not appearing in Grafana

**Solutions**:
- Verify Prometheus scraping
- Check metric names
- Review data source configuration
- Validate time ranges

### Alert Fatigue

**Issue**: Too many false positive alerts

**Solutions**:
- Adjust thresholds
- Add alert conditions
- Implement alert grouping
- Use alert silencing

## Support

For integration issues:
1. Check service logs
2. Review CI/CD logs
3. Verify configuration
4. Consult documentation
5. Contact DevOps team

## References

- [k6 Documentation](https://k6.io/docs/)
- [Grafana k6 Integration](https://k6.io/docs/results-visualization/grafana/)
- [Prometheus Integration](https://k6.io/docs/results-visualization/prometheus/)
- [CI/CD Examples](https://k6.io/docs/integrations/)
