# Business Metrics Monitoring - Quick Start Guide

## Overview

This guide provides a quick start for deploying and using the business metrics monitoring system for the Sai Mahendra Platform.

## What's Included

### 📊 Dashboards
1. **Business Metrics - Enrollment & Revenue**
   - Daily/Weekly/Monthly enrollment tracking
   - Revenue metrics (MRR, ARR, AOV)
   - Program performance analysis
   - Payment success rates

2. **User Engagement & Retention**
   - DAU, WAU, MAU tracking
   - User stickiness metrics
   - Session analytics
   - Retention cohorts
   - Churn rate monitoring

3. **Conversion Funnel & Monitoring**
   - Visitor → Signup → Enrollment → Payment funnel
   - Conversion rates at each stage
   - Drop-off analysis
   - Real-time alerts

### 🔔 Alerts
- Low enrollment rate
- Revenue drop
- High payment failure rate
- Low user engagement
- High churn rate
- Low conversion rate
- Funnel drop-offs
- MRR decline

### 📧 Automated Reports
- Daily business summaries (8 AM)
- Weekly performance reports (Monday 8 AM)
- Monthly executive dashboards (1st of month, 8 AM)
- Custom scheduled reports

## Quick Deployment

### 1. Deploy Business Metrics

```bash
cd infrastructure/kubernetes/monitoring
./deploy-business-metrics.sh
```

### 2. Access Grafana

**Local Development**:
```bash
kubectl port-forward -n monitoring svc/grafana 3000:80
```
Then visit: http://localhost:3000

**Production**:
Visit: https://grafana.sai-mahendra.com

### 3. View Dashboards

In Grafana:
1. Click "Dashboards" → "Browse"
2. Look for:
   - Business Metrics - Enrollment & Revenue
   - User Engagement & Retention
   - Conversion Funnel & Monitoring

## Integrate Metrics in Your Services

### 1. Install Prometheus Client

```bash
npm install prom-client
```

### 2. Add Metrics to Your Service

```typescript
import { Counter, Gauge, Histogram, register } from 'prom-client';

// Enrollment metrics
const enrollmentsCounter = new Counter({
  name: 'course_enrollments_total',
  help: 'Total course enrollments',
  labelNames: ['program_id', 'program_name']
});

// Revenue metrics
const paymentAmountCounter = new Counter({
  name: 'payment_amount_total',
  help: 'Total payment amount',
  labelNames: ['gateway', 'status', 'program_id']
});

// MRR gauge
const mrrGauge = new Gauge({
  name: 'subscription_mrr_gauge',
  help: 'Monthly Recurring Revenue'
});

// User activity
const userActivityCounter = new Counter({
  name: 'user_activity_total',
  help: 'User activity events',
  labelNames: ['user_id', 'activity_type']
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 3. Increment Metrics in Your Code

```typescript
// When user enrolls
enrollmentsCounter.inc({
  program_id: enrollment.programId,
  program_name: enrollment.programName
});

// When payment completes
paymentAmountCounter.inc({
  gateway: 'razorpay',
  status: 'completed',
  program_id: payment.programId
}, payment.amount);

// Update MRR
mrrGauge.set(calculateMRR());

// Track user activity
userActivityCounter.inc({
  user_id: user.id,
  activity_type: 'page_view'
});
```

### 4. Add Prometheus Annotations to Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: your-service
spec:
  template:
    metadata:
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
```

## Set Up Automated Reporting

### 1. Configure Email Settings

Set environment variables in your Analytics Service:

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
REPORT_FROM_EMAIL=reports@sai-mahendra.com
```

### 2. Schedule Reports

```typescript
import { AutomatedReportingService } from './services/AutomatedReportingService';
import { ReportType, ReportFrequency, ExportFormat } from './types';

const reportingService = new AutomatedReportingService(
  mongoDb,
  redisClient,
  metricsService,
  reportService
);

// Daily business summary
await reportingService.scheduleReport(
  'Daily Business Summary',
  ReportType.USER_ENGAGEMENT,
  ReportFrequency.DAILY,
  [
    { email: 'admin@sai-mahendra.com', name: 'Admin', role: 'admin' },
    { email: 'ceo@sai-mahendra.com', name: 'CEO', role: 'executive' }
  ],
  ExportFormat.PDF
);

// Weekly performance report
await reportingService.scheduleReport(
  'Weekly Performance Report',
  ReportType.REVENUE,
  ReportFrequency.WEEKLY,
  [
    { email: 'manager@sai-mahendra.com', name: 'Manager', role: 'manager' }
  ],
  ExportFormat.PDF
);
```

### 3. Set Up Cron Job for Report Processing

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: process-scheduled-reports
  namespace: sai-mahendra
spec:
  schedule: "0 * * * *"  # Every hour
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: report-processor
            image: sai-mahendra/analytics-service:latest
            command: ["node", "dist/scripts/process-reports.js"]
            env:
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: analytics-secrets
                  key: mongodb-uri
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: analytics-secrets
                  key: redis-url
          restartPolicy: OnFailure
```

## Required Metrics

Your services should expose these metrics for the dashboards to work:

### Enrollment Metrics
- `course_enrollments_total` (counter) - labels: program_id, program_name
- `course_completions_total` (counter) - labels: program_id, program_name
- `active_enrollments_gauge` (gauge) - labels: program_id, program_name
- `course_completion_time_days` (histogram) - labels: program_id
- `enrollment_starts_total` (counter)
- `course_starts_total` (counter)

### Revenue Metrics
- `payment_amount_total` (counter) - labels: gateway, status, program_id
- `payment_transactions_total` (counter) - labels: gateway, status
- `subscription_mrr_gauge` (gauge)
- `subscription_cancellations_total` (counter)
- `active_subscriptions_gauge` (gauge)

### User Engagement Metrics
- `user_activity_total` (counter) - labels: user_id, activity_type
- `user_sessions_total` (counter)
- `page_views_total` (counter) - labels: page
- `session_duration_seconds` (histogram)
- `bounced_sessions_total` (counter)
- `feature_usage_total` (counter) - labels: feature_name

### Conversion Funnel Metrics
- `user_registrations_total` (counter)
- `payment_initiated_total` (counter)

### Retention Metrics
- `customer_lifetime_days` (histogram)

## Verify Deployment

### 1. Check Prometheus Rules

```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
```

Visit http://localhost:9090/rules and verify business metrics rules are loaded.

### 2. Check Grafana Dashboards

```bash
kubectl port-forward -n monitoring svc/grafana 3000:80
```

Visit http://localhost:3000 and verify all three dashboards are present.

### 3. Test Metrics Collection

```bash
# Check if your service is exposing metrics
kubectl port-forward -n sai-mahendra <your-service-pod> 3000:3000
curl http://localhost:3000/metrics
```

### 4. Query Metrics in Prometheus

Visit http://localhost:9090 and run queries:

```promql
# Check enrollment rate
business:enrollment_rate:daily

# Check revenue
business:revenue:daily

# Check active users
business:daily_active_users:current

# Check conversion rate
business:conversion_overall:1h
```

## Common Issues

### Metrics Not Showing in Dashboards

**Problem**: Dashboards show "No data"

**Solution**:
1. Verify services are exposing metrics: `curl http://<service>:3000/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify Prometheus is scraping: Check for `prometheus.io/scrape: "true"` annotation
4. Check metric names match exactly

### Alerts Not Firing

**Problem**: Alerts not triggering when they should

**Solution**:
1. Check Prometheus rules: http://localhost:9090/rules
2. Verify alert expressions are correct
3. Check Alertmanager: http://localhost:9093
4. Verify notification channels are configured

### Reports Not Being Sent

**Problem**: Scheduled reports not arriving via email

**Solution**:
1. Check SMTP configuration in environment variables
2. Verify SendGrid API key is valid
3. Check Analytics Service logs: `kubectl logs -n sai-mahendra -l app=analytics-service`
4. Verify scheduled reports in MongoDB: `db.scheduled_reports.find()`

## Next Steps

1. ✅ Deploy business metrics monitoring
2. ✅ Integrate metrics in your services
3. ✅ Set up automated reporting
4. ✅ Configure alert notification channels
5. ✅ Customize dashboard thresholds
6. ✅ Train team on dashboard usage
7. ✅ Set up regular review meetings

## Support

For issues or questions:
- Check the full documentation: `TASK_17.3_COMPLETION_REPORT.md`
- Review Prometheus documentation: https://prometheus.io/docs/
- Review Grafana documentation: https://grafana.com/docs/

## Resources

- **Prometheus Rules**: `business-metrics-rules.yaml`
- **Dashboards**: `grafana-*-dashboard.json`
- **Reporting Service**: `backend/services/analytics/src/services/AutomatedReportingService.ts`
- **Deployment Script**: `deploy-business-metrics.sh`
- **Full Documentation**: `TASK_17.3_COMPLETION_REPORT.md`
