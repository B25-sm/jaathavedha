# Analytics Service API Reference

## Base URL
```
http://localhost:3006
```

## Authentication
Currently, the analytics service does not require authentication for event tracking (to allow anonymous tracking). Admin endpoints should be protected by the API Gateway.

---

## Event Tracking Endpoints

### Track Single Event
Track a single analytics event.

**Endpoint:** `POST /api/analytics/events`

**Request Body:**
```json
{
  "eventType": "user_registered",
  "userId": "user-123",
  "sessionId": "session-456",
  "properties": {
    "email": "user@example.com",
    "source": "web"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event tracked successfully",
  "eventId": "507f1f77bcf86cd799439011"
}
```

**Event Types:**
- `user_registered`, `user_login`, `user_logout`
- `course_viewed`, `enrollment_started`, `enrollment_completed`
- `payment_initiated`, `payment_completed`, `payment_failed`
- `page_view`, `video_started`, `video_completed`
- `contact_form_submitted`, `newsletter_subscribed`
- `custom` (for custom events)

---

### Track Page View
Track a page view event.

**Endpoint:** `POST /api/analytics/page-view`

**Request Body:**
```json
{
  "page": "/courses",
  "userId": "user-123",
  "sessionId": "session-456",
  "referrer": "https://google.com",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Page view tracked successfully"
}
```

---

### Track Batch Events
Track multiple events in a single request.

**Endpoint:** `POST /api/analytics/events/batch`

**Request Body:**
```json
{
  "events": [
    {
      "eventType": "course_viewed",
      "userId": "user-123",
      "sessionId": "session-456",
      "properties": { "courseId": "course-1" }
    },
    {
      "eventType": "enrollment_started",
      "userId": "user-123",
      "sessionId": "session-456",
      "properties": { "programId": "program-1" }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "2 events tracked successfully",
  "count": 2
}
```

---

### Track User Action
Track a custom user action.

**Endpoint:** `POST /api/analytics/user-action`

**Request Body:**
```json
{
  "action": "button_click",
  "userId": "user-123",
  "sessionId": "session-456",
  "metadata": {
    "buttonId": "enroll-now",
    "page": "/programs"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User action tracked successfully"
}
```

---

## Dashboard and Reporting Endpoints

### Get Dashboard Data
Get comprehensive dashboard data with real-time metrics.

**Endpoint:** `GET /api/analytics/dashboard`

**Response:**
```json
{
  "success": true,
  "data": {
    "realTime": {
      "activeUsers": 42,
      "todayPageViews": 1250,
      "todayEvents": 3420,
      "todayRevenue": 25000,
      "todayEnrollments": 15
    },
    "trends": {
      "pageViews": {
        "today": 1250,
        "week": 8500,
        "month": 35000
      },
      "events": {
        "today": 3420,
        "week": 24000,
        "month": 98000
      },
      "revenue": {
        "today": 25000,
        "week": 175000,
        "month": 720000
      },
      "enrollments": {
        "today": 15,
        "week": 105,
        "month": 450
      }
    },
    "topPages": [
      {
        "page": "/courses",
        "views": 2500,
        "uniqueVisitors": 1800
      }
    ],
    "alerts": []
  }
}
```

---

### Get Enrollment Report
Get enrollment metrics for a date range.

**Endpoint:** `GET /api/analytics/reports/enrollment`

**Query Parameters:**
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)
- `programId` (optional): Filter by program ID

**Example:**
```
GET /api/analytics/reports/enrollment?startDate=2024-01-01&endDate=2024-12-31&programId=program-1
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "programId": "program-1",
      "programName": "AI Starter Program",
      "totalEnrollments": 150,
      "activeEnrollments": 120,
      "completedEnrollments": 30,
      "averageCompletionTime": 45.5,
      "completionRate": 20,
      "period": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-12-31T23:59:59Z"
      }
    }
  ]
}
```

---

### Get Revenue Report
Get revenue metrics for a date range.

**Endpoint:** `GET /api/analytics/reports/revenue`

**Query Parameters:**
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 720000,
    "transactionCount": 450,
    "averageOrderValue": 1600,
    "revenueByProgram": [
      {
        "programId": "program-1",
        "programName": "AI Starter Program",
        "revenue": 450000,
        "enrollments": 300
      }
    ],
    "revenueByGateway": [
      {
        "gateway": "razorpay",
        "revenue": 500000,
        "transactionCount": 350,
        "successRate": 95.5
      }
    ],
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    }
  }
}
```

---

### Get User Engagement Report
Get user engagement metrics.

**Endpoint:** `GET /api/analytics/reports/user-engagement`

**Query Parameters:**
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "dailyActiveUsers": 42,
    "weeklyActiveUsers": 250,
    "monthlyActiveUsers": 1200,
    "averageSessionDuration": 450.5,
    "averagePageViewsPerSession": 5.2,
    "bounceRate": 35.5,
    "topPages": [
      {
        "page": "/courses",
        "views": 2500,
        "uniqueVisitors": 1800,
        "averageTimeOnPage": 120
      }
    ],
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    }
  }
}
```

---

### Get Retention Report
Get cohort retention metrics.

**Endpoint:** `GET /api/analytics/reports/retention`

**Query Parameters:**
- `cohortDate` (optional): Cohort date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "cohortDate": "2024-01-15T00:00:00Z",
    "totalUsers": 100,
    "retentionByDay": [
      {
        "period": 1,
        "activeUsers": 85,
        "retentionRate": 85
      },
      {
        "period": 7,
        "activeUsers": 65,
        "retentionRate": 65
      }
    ],
    "retentionByWeek": [
      {
        "period": 1,
        "activeUsers": 75,
        "retentionRate": 75
      }
    ],
    "retentionByMonth": [
      {
        "period": 1,
        "activeUsers": 60,
        "retentionRate": 60
      }
    ]
  }
}
```

---

### Get Conversion Funnel
Get conversion funnel analysis.

**Endpoint:** `GET /api/analytics/reports/conversion-funnel`

**Query Parameters:**
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "visitors": 10000,
    "signups": 2000,
    "enrollmentStarts": 1500,
    "paymentInitiated": 1200,
    "paymentCompleted": 1000,
    "conversionRates": {
      "visitorToSignup": 20,
      "signupToEnrollment": 75,
      "enrollmentToPayment": 80,
      "paymentSuccess": 83.33,
      "overallConversion": 10
    },
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    }
  }
}
```

---

## Data Export Endpoints

### Export Report
Export report data in various formats.

**Endpoint:** `POST /api/analytics/export`

**Request Body:**
```json
{
  "reportType": "revenue",
  "format": "csv",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "filters": {
    "programId": "program-1"
  }
}
```

**Report Types:**
- `enrollment` - Enrollment metrics
- `revenue` - Revenue metrics
- `user_engagement` - Engagement metrics
- `retention` - Retention metrics
- `conversion_funnel` - Funnel analysis

**Export Formats:**
- `json` - JSON format
- `csv` - CSV format
- `excel` - Excel format (returns CSV for now)

**Response:**
- Content-Type: `application/json` or `text/csv`
- Content-Disposition: `attachment; filename="revenue_2024-01-15.csv"`
- Body: Exported data in requested format

---

## Alert Management Endpoints

### Get Active Alerts
Get list of active alerts.

**Endpoint:** `GET /api/analytics/alerts`

**Query Parameters:**
- `limit` (optional): Maximum number of alerts (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-123",
      "type": "metric_threshold",
      "severity": "warning",
      "message": "daily_active_users has fallen below threshold: 8 (threshold: 10)",
      "metric": "daily_active_users",
      "threshold": 10,
      "currentValue": 8,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### Get Alert Thresholds
Get configured alert thresholds.

**Endpoint:** `GET /api/analytics/alerts/thresholds`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "metric": "daily_active_users",
      "condition": "below",
      "threshold": 10,
      "severity": "warning",
      "enabled": true
    },
    {
      "metric": "payment_failure_rate",
      "condition": "above",
      "threshold": 10,
      "severity": "critical",
      "enabled": true
    }
  ]
}
```

---

### Create Alert Threshold
Create a new alert threshold.

**Endpoint:** `POST /api/analytics/alerts/thresholds`

**Request Body:**
```json
{
  "metric": "daily_enrollments",
  "condition": "below",
  "threshold": 5,
  "severity": "warning",
  "enabled": true
}
```

**Conditions:**
- `above` - Alert when value exceeds threshold
- `below` - Alert when value falls below threshold

**Severity Levels:**
- `info` - Informational alert
- `warning` - Warning alert
- `critical` - Critical alert

**Response:**
```json
{
  "success": true,
  "message": "Alert threshold created successfully"
}
```

---

## Health Check

### Service Health
Check service health and dependencies.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "service": "analytics",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "mongodb": "connected",
    "redis": "connected"
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "code": "MISSING_REQUIRED_FIELDS",
    "message": "eventType and sessionId are required",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Common Error Codes:**
- `MISSING_REQUIRED_FIELDS` - Required fields missing
- `VALIDATION_ERROR` - Invalid input data
- `DATABASE_ERROR` - Database operation failed
- `EXPORT_ERROR` - Export operation failed
- `ENDPOINT_NOT_FOUND` - Endpoint does not exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_SERVER_ERROR` - Unexpected error

---

## Rate Limiting

The service implements rate limiting:
- **Limit:** 1000 requests per 15 minutes per IP
- **Response:** 429 Too Many Requests

---

## Integration Examples

### JavaScript/TypeScript
```typescript
// Track an event
async function trackEvent(eventType: string, userId: string, properties: any) {
  const response = await fetch('http://localhost:3006/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType,
      userId,
      sessionId: getSessionId(),
      properties
    })
  });
  return response.json();
}

// Get dashboard data
async function getDashboard() {
  const response = await fetch('http://localhost:3006/api/analytics/dashboard');
  return response.json();
}
```

### Python
```python
import requests

# Track an event
def track_event(event_type, user_id, properties):
    response = requests.post(
        'http://localhost:3006/api/analytics/events',
        json={
            'eventType': event_type,
            'userId': user_id,
            'sessionId': get_session_id(),
            'properties': properties
        }
    )
    return response.json()

# Get dashboard data
def get_dashboard():
    response = requests.get('http://localhost:3006/api/analytics/dashboard')
    return response.json()
```

### cURL
```bash
# Track an event
curl -X POST http://localhost:3006/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "enrollment_completed",
    "userId": "user-123",
    "sessionId": "session-456",
    "properties": {"programId": "program-1"}
  }'

# Get dashboard
curl http://localhost:3006/api/analytics/dashboard

# Export report
curl -X POST http://localhost:3006/api/analytics/export \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "revenue",
    "format": "csv",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }' \
  --output revenue_report.csv
```

---

## Best Practices

1. **Session Management**
   - Generate unique session IDs for each user session
   - Include session ID in all events for accurate tracking

2. **Event Properties**
   - Include relevant context in event properties
   - Use consistent property names across events

3. **Batch Processing**
   - Use batch endpoint for multiple events
   - Reduces network overhead and improves performance

4. **Error Handling**
   - Always check the `success` field in responses
   - Implement retry logic for failed requests

5. **Date Ranges**
   - Use ISO 8601 format for dates
   - Be mindful of timezone considerations

6. **Performance**
   - Cache dashboard data on the client side
   - Use appropriate date ranges for reports

---

## Support

For issues or questions:
- Check the logs: `docker logs sai-mahendra-analytics-service`
- Review the health endpoint: `GET /health`
- Contact: admin@saimahendra.com
