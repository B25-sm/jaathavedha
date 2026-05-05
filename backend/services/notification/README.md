# Notification Service

Comprehensive multi-channel notification system for the Sai Mahendra educational platform.

## Features

- **Multi-Channel Support**: Email, Push, SMS (future), WhatsApp (future)
- **Email Notifications**: SendGrid integration with dynamic templates
- **Push Notifications**: Firebase Cloud Messaging for web and mobile
- **User Preferences**: Granular control over notification channels
- **Automated Triggers**: Event-driven notifications for key actions
- **Template System**: Dynamic templates with variable substitution
- **Delivery Tracking**: Comprehensive tracking and analytics
- **Queue Management**: Reliable delivery with Bull queue
- **Scheduling**: Schedule notifications for future delivery

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Redis
- SendGrid API key
- Firebase project credentials

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=3007
REDIS_URL=redis://localhost:6379
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@saimahendra.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## API Documentation

See [API_REFERENCE.md](./API_REFERENCE.md) for complete API documentation.

### Quick Examples

#### Send Email

```bash
curl -X POST http://localhost:3007/api/notifications/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Welcome!",
    "content": "<h1>Welcome to Sai Mahendra!</h1>"
  }'
```

#### Send Push Notification

```bash
curl -X POST http://localhost:3007/api/notifications/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "title": "New Course Available",
    "body": "Check out our new AI course!"
  }'
```

#### Update User Preferences

```bash
curl -X PUT http://localhost:3007/api/notifications/preferences/user_123 \
  -H "Content-Type: application/json" \
  -d '{
    "email": {
      "marketing": false
    },
    "push": {
      "enabled": true,
      "quietHours": {
        "start": "22:00",
        "end": "08:00"
      }
    }
  }'
```

## Architecture

```
notification/
├── src/
│   ├── types/              # TypeScript interfaces
│   ├── services/           # Core services
│   │   ├── EmailService.ts
│   │   ├── PushService.ts
│   │   ├── NotificationRouter.ts
│   │   └── TriggerService.ts
│   ├── __tests__/          # Test files
│   └── index.ts            # Main entry point
├── .env.example
├── jest.config.js
├── package.json
└── tsconfig.json
```

## Services

### EmailService

Handles email notifications via SendGrid:
- Dynamic template processing
- Variable substitution
- Bulk email sending
- Bounce handling
- Delivery tracking

### PushService

Manages push notifications via Firebase FCM:
- Multi-platform support (web, iOS, Android)
- Device token management
- Topic-based notifications
- Scheduled notifications
- Delivery tracking

### NotificationRouter

Routes notifications to appropriate channels:
- User preference checking
- Quiet hours management
- Channel selection logic
- Delivery tracking

### TriggerService

Automated notification triggers:
- Event-driven architecture
- Rule-based routing
- Enrollment confirmations
- Payment receipts
- Course reminders
- Deadline notifications

## Templates

Templates support variable substitution and conditional rendering:

```html
<h1>Welcome {{userName}}!</h1>
<p>You enrolled in {{programName}}.</p>

{{#if premium}}
  <p>You are a premium member!</p>
{{/if}}

{{#each courses}}
  <li>{{name}}</li>
{{/each}}
```

## Event System

Publish events to trigger automated notifications:

```typescript
await triggerService.publishEvent({
  eventType: 'enrollment.completed',
  userId: 'user_123',
  data: {
    programName: 'AI Fundamentals',
    startDate: '2024-02-01'
  },
  timestamp: new Date()
});
```

## User Preferences

Users can control notifications per channel:

```typescript
{
  email: {
    transactional: true,  // Always enabled
    marketing: false,     // Opt-out
    engagement: true      // Enabled
  },
  push: {
    enabled: true,
    quietHours: {
      start: '22:00',
      end: '08:00'
    }
  }
}
```

## Queue Management

Uses Bull for reliable message delivery:
- Automatic retries on failure
- Job status tracking
- Priority queues
- Scheduled jobs

## Monitoring

Health check endpoint provides:
- Service status
- Dependency status (Redis, SendGrid, Firebase)
- Queue metrics (waiting, active, completed, failed)
- Uptime information

```bash
curl http://localhost:3007/health
```

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "type": "ERROR_TYPE",
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Security

- Rate limiting: 100 requests per 15 minutes
- Input validation on all endpoints
- Secure token storage
- Data encryption at rest
- Automatic data expiry

## Performance

- Template caching for fast rendering
- Bulk operations for efficiency
- Asynchronous processing
- Redis optimization
- Connection pooling

## Integration

### With Other Services

- **User Management**: Registration confirmations
- **Course Management**: Enrollment notifications
- **Payment Service**: Payment receipts
- **Analytics Service**: Delivery tracking

### External Services

- **SendGrid**: Email delivery
- **Firebase FCM**: Push notifications
- **Redis**: Caching and queues

## Deployment

### Docker

```bash
docker build -f Dockerfile.dev -t notification-service .
docker run -p 3007:3007 --env-file .env notification-service
```

### Docker Compose

```bash
docker-compose up notification
```

## Troubleshooting

### Email not sending

1. Check SendGrid API key is configured
2. Verify FROM_EMAIL is authorized in SendGrid
3. Check Redis connection
4. Review logs for errors

### Push notifications not working

1. Verify Firebase credentials are correct
2. Check device tokens are registered
3. Ensure FCM is enabled in Firebase console
4. Review Firebase logs

### Queue not processing

1. Check Redis connection
2. Verify queue workers are running
3. Check for failed jobs in Bull dashboard
4. Review error logs

## Contributing

1. Follow TypeScript best practices
2. Write tests for new features
3. Update documentation
4. Follow existing code style
5. Run linter before committing

## License

MIT

## Support

For issues or questions:
- Email: support@saimahendra.com
- Documentation: [API_REFERENCE.md](./API_REFERENCE.md)
- Completion Report: [TASK_10_COMPLETION_REPORT.md](./TASK_10_COMPLETION_REPORT.md)
