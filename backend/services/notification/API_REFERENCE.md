# Notification Service API Reference

## Overview

The Notification Service provides a comprehensive multi-channel notification system supporting email, push notifications, SMS, and WhatsApp. It includes automated triggers, user preference management, and delivery tracking.

**Base URL**: `http://localhost:3007`

**Version**: 1.0.0

## Authentication

All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Health Check

#### GET /health

Check service health and dependencies status.

**Response**:
```json
{
  "status": "healthy",
  "service": "notification",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "redis": "connected",
    "sendgrid": "configured",
    "firebase": "configured"
  },
  "queues": {
    "email": {
      "waiting": 5,
      "active": 2,
      "completed": 100,
      "failed": 1
    },
    "push": {
      "waiting": 3,
      "active": 1,
      "completed": 50,
      "failed": 0
    }
  }
}
```

---

### Email Notifications

#### POST /api/notifications/email/send

Send a single email notification.

**Request Body**:
```json
{
  "to": "user@example.com",
  "subject": "Welcome to Sai Mahendra",
  "content": "<h1>Welcome!</h1><p>Thank you for joining.</p>",
  "templateId": "enrollment_confirmation",
  "templateData": {
    "userName": "John Doe",
    "programName": "AI Fundamentals"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "msg_abc123"
}
```

#### POST /api/notifications/email/bulk

Send bulk email notifications.

**Request Body**:
```json
{
  "recipients": [
    {
      "email": "user1@example.com",
      "data": { "name": "User 1" }
    },
    {
      "email": "user2@example.com",
      "data": { "name": "User 2" }
    }
  ],
  "subject": "Course Update",
  "templateId": "course_update",
  "templateData": {
    "courseName": "AI Fundamentals"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Bulk emails sent",
  "successCount": 2,
  "failureCount": 0
}
```

---

### Push Notifications

#### POST /api/notifications/push/send

Send push notification to specific devices or user.

**Request Body**:
```json
{
  "userId": "user_123",
  "title": "New Course Available",
  "body": "Check out our new AI course!",
  "data": {
    "courseId": "course_456",
    "action": "view_course"
  },
  "imageUrl": "https://example.com/image.jpg",
  "clickAction": "https://example.com/courses/456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Push notification sent",
  "successCount": 2,
  "failureCount": 0
}
```

#### POST /api/notifications/push/subscribe

Register device token for push notifications.

**Request Body**:
```json
{
  "userId": "user_123",
  "token": "fcm_token_abc123",
  "platform": "web"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Device token registered successfully"
}
```

#### DELETE /api/notifications/push/unsubscribe

Remove device token from push notifications.

**Request Body**:
```json
{
  "userId": "user_123",
  "token": "fcm_token_abc123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Device token removed successfully"
}
```

#### POST /api/notifications/push/topic

Send push notification to a topic (all subscribed users).

**Request Body**:
```json
{
  "topic": "all_students",
  "title": "Platform Maintenance",
  "body": "The platform will be under maintenance tonight.",
  "data": {
    "type": "maintenance",
    "startTime": "2024-01-15T22:00:00Z"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Push notification sent to topic",
  "messageId": "msg_topic_123"
}
```

---

### User Preferences

#### GET /api/notifications/preferences/:userId

Get user notification preferences.

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "email": {
      "transactional": true,
      "marketing": true,
      "engagement": true
    },
    "push": {
      "enabled": true,
      "quietHours": {
        "start": "22:00",
        "end": "08:00"
      }
    },
    "sms": {
      "enabled": false,
      "emergencyOnly": true
    },
    "whatsapp": {
      "enabled": false
    },
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### PUT /api/notifications/preferences/:userId

Update user notification preferences.

**Request Body**:
```json
{
  "email": {
    "transactional": true,
    "marketing": false,
    "engagement": true
  },
  "push": {
    "enabled": true,
    "quietHours": {
      "start": "23:00",
      "end": "07:00"
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Notification preferences updated successfully"
}
```

---

### Templates

#### GET /api/notifications/templates/:templateId

Get notification template by ID.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "enrollment_confirmation",
    "name": "Enrollment Confirmation",
    "channel": "email",
    "type": "transactional",
    "subject": "Welcome to {{programName}}!",
    "content": "<h1>Welcome!</h1><p>Hi {{userName}}, ...</p>",
    "variables": ["userName", "programName", "startDate"],
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### POST /api/notifications/templates

Create new notification template.

**Request Body**:
```json
{
  "name": "Course Completion",
  "channel": "email",
  "type": "engagement",
  "subject": "Congratulations on completing {{courseName}}!",
  "content": "<h1>Congratulations!</h1><p>You completed {{courseName}}.</p>",
  "variables": ["userName", "courseName", "completionDate"],
  "isActive": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Template created successfully"
}
```

#### PUT /api/notifications/templates/:templateId

Update existing notification template.

**Request Body**: Same as POST

**Response**:
```json
{
  "success": true,
  "message": "Template updated successfully"
}
```

---

### Automated Triggers

#### POST /api/notifications/triggers/enrollment

Trigger enrollment confirmation notification.

**Request Body**:
```json
{
  "userId": "user_123",
  "enrollmentData": {
    "programName": "AI Fundamentals",
    "startDate": "2024-02-01",
    "duration": "12 weeks"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Enrollment confirmation triggered"
}
```

#### POST /api/notifications/triggers/payment

Trigger payment receipt notification.

**Request Body**:
```json
{
  "userId": "user_123",
  "paymentData": {
    "transactionId": "txn_abc123",
    "amount": 999,
    "currency": "INR",
    "programName": "AI Fundamentals",
    "paymentDate": "2024-01-15"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payment receipt triggered"
}
```

#### POST /api/notifications/triggers/reminder

Trigger course reminder notification.

**Request Body**:
```json
{
  "userId": "user_123",
  "courseData": {
    "courseName": "AI Fundamentals",
    "nextLesson": "Neural Networks Basics",
    "dueDate": "2024-01-20"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Course reminder triggered"
}
```

---

### Event Publishing

#### POST /api/notifications/events/publish

Publish custom notification event.

**Request Body**:
```json
{
  "eventType": "custom.event",
  "userId": "user_123",
  "data": {
    "key": "value",
    "customField": "customValue"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Event published successfully"
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "type": "ERROR_TYPE",
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Invalid request parameters
- `EMAIL_ERROR`: Email sending failed
- `PUSH_ERROR`: Push notification failed
- `DATABASE_ERROR`: Database operation failed
- `TEMPLATE_NOT_FOUND`: Template does not exist
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

## Notification Types

- `transactional`: Critical notifications (receipts, confirmations)
- `marketing`: Promotional content
- `engagement`: Course reminders, updates
- `system`: System announcements

## Notification Channels

- `email`: Email notifications via SendGrid
- `push`: Push notifications via Firebase FCM
- `sms`: SMS notifications (future)
- `whatsapp`: WhatsApp messages (future)

## Template Variables

Templates support variable substitution using `{{variableName}}` syntax:

```html
<p>Hello {{userName}}, welcome to {{programName}}!</p>
```

Conditional blocks:
```html
{{#if premium}}
  <p>You are a premium member!</p>
{{/if}}
```

Loops:
```html
{{#each courses}}
  <li>{{name}}</li>
{{/each}}
```

---

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Bulk operations count as single request
- Rate limit headers included in responses

---

## Webhooks

### SendGrid Webhook

Configure SendGrid to send events to:
```
POST /api/notifications/webhooks/sendgrid
```

Handles: delivered, bounced, opened, clicked events

### Firebase Webhook

Configure Firebase to send events to:
```
POST /api/notifications/webhooks/firebase
```

Handles: delivery status, token refresh

---

## Best Practices

1. **Use Templates**: Create reusable templates for common notifications
2. **Respect Preferences**: Always check user preferences before sending
3. **Handle Failures**: Implement retry logic for failed notifications
4. **Track Delivery**: Monitor delivery rates and bounce rates
5. **Test Thoroughly**: Use sandbox mode for testing
6. **Batch Operations**: Use bulk endpoints for multiple recipients
7. **Schedule Wisely**: Respect quiet hours for push notifications

---

## Support

For issues or questions, contact: support@saimahendra.com
