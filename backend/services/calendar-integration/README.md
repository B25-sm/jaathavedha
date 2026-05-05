# Calendar Integration Service

The Calendar Integration Service provides seamless integration with Google Calendar and Outlook Calendar, allowing students to automatically sync their live session schedules with their preferred calendar applications.

## Features

- **Google Calendar Integration**: OAuth 2.0 authentication and full calendar management
- **Outlook Calendar Integration**: Microsoft Graph API integration for Outlook/Office 365
- **Automatic Session Sync**: Automatically create calendar events when students enroll in programs
- **Event Management**: Create, update, and cancel calendar events across all connected calendars
- **Token Management**: Secure token storage with encryption and automatic refresh
- **Sync Preferences**: Customizable synchronization settings per user
- **Event Reminders**: Configurable reminders (15 min, 1 hour before sessions)
- **Bulk Operations**: Sync all sessions for an enrollment at once
- **Statistics**: Track calendar usage and event statistics

## Architecture

### Services

1. **GoogleCalendarService**: Handles Google Calendar API operations
2. **OutlookCalendarService**: Handles Microsoft Graph API operations
3. **CalendarConnectionService**: Manages calendar connections and tokens
4. **CalendarEventService**: Manages calendar event records in database
5. **CalendarSyncService**: Orchestrates synchronization across calendars

### Database Schema

- `calendar_connections`: Stores OAuth tokens and connection details
- `calendar_events`: Stores calendar event records
- `calendar_sync_logs`: Tracks synchronization operations
- `calendar_sync_preferences`: User sync preferences
- `calendar_webhook_subscriptions`: Webhook subscriptions for real-time updates
- `live_sessions`: Live session schedule information

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Google Cloud Console project with Calendar API enabled
- Microsoft Azure AD app registration

### Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3016/api/calendar/google/callback` (development)
   - `https://your-domain.com/api/calendar/google/callback` (production)
6. Copy Client ID and Client Secret

### Microsoft Outlook Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations
3. Create a new registration
4. Add redirect URIs:
   - `http://localhost:3016/api/calendar/outlook/callback` (development)
   - `https://your-domain.com/api/calendar/outlook/callback` (production)
5. Add API permissions: `Calendars.ReadWrite`, `offline_access`
6. Create a client secret
7. Copy Application (client) ID, Directory (tenant) ID, and client secret

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
NODE_ENV=development
PORT=3016

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/sai_mahendra

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Google Calendar API Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3016/api/calendar/google/callback

# Microsoft Graph API Configuration
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3016/api/calendar/outlook/callback

# Encryption Configuration (IMPORTANT: Change in production!)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Calendar Sync Configuration
SYNC_INTERVAL_MINUTES=15
AUTO_SYNC_ENABLED=true

# Timezone Configuration
DEFAULT_TIMEZONE=Asia/Kolkata
```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
cd ../../database
npm run migrate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Authentication & Connection

#### Get Google Calendar Authorization URL
```http
GET /api/calendar/google/auth
Authorization: Bearer <token>
```

Response:
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### Handle Google Calendar OAuth Callback
```http
GET /api/calendar/google/callback?code=<auth_code>
Authorization: Bearer <token>
```

#### Get Outlook Calendar Authorization URL
```http
GET /api/calendar/outlook/auth
Authorization: Bearer <token>
```

#### Handle Outlook Calendar OAuth Callback
```http
GET /api/calendar/outlook/callback?code=<auth_code>
Authorization: Bearer <token>
```

#### Get User's Calendar Connections
```http
GET /api/calendar/connections
Authorization: Bearer <token>
```

Response:
```json
{
  "connections": [
    {
      "id": "uuid",
      "provider": "google",
      "calendarId": "primary",
      "isActive": true,
      "lastSyncAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ]
}
```

#### Disconnect Calendar
```http
DELETE /api/calendar/connections/:provider
Authorization: Bearer <token>
```

### Events

#### Get User's Calendar Events
```http
GET /api/calendar/events?provider=google&status=scheduled&upcoming=true
Authorization: Bearer <token>
```

Query Parameters:
- `provider` (optional): Filter by provider (google, outlook)
- `status` (optional): Filter by status (scheduled, cancelled, completed)
- `upcoming` (optional): Get only upcoming events (true/false)

#### Get Calendar Statistics
```http
GET /api/calendar/stats
Authorization: Bearer <token>
```

Response:
```json
{
  "stats": {
    "totalEvents": 25,
    "upcomingEvents": 10,
    "completedEvents": 12,
    "cancelledEvents": 3,
    "lastSyncAt": "2024-01-15T10:30:00Z"
  }
}
```

### Synchronization

#### Sync Enrollment Sessions
```http
POST /api/calendar/sync/enrollment
Authorization: Bearer <token>
Content-Type: application/json

{
  "enrollmentId": "uuid"
}
```

Response:
```json
{
  "success": true,
  "message": "Enrollment sessions synced successfully",
  "eventsCreated": 5
}
```

### Preferences

#### Get Sync Preferences
```http
GET /api/calendar/preferences
Authorization: Bearer <token>
```

#### Update Sync Preferences
```http
PUT /api/calendar/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "autoSyncEnabled": true,
  "syncInterval": 15,
  "providers": ["google", "outlook"],
  "syncPastEvents": false,
  "syncFutureEvents": true,
  "daysInPast": 0,
  "daysInFuture": 90
}
```

### Health Check

```http
GET /api/calendar/health
```

## Usage Examples

### Frontend Integration

```typescript
// Connect Google Calendar
const connectGoogleCalendar = async () => {
  const response = await fetch('/api/calendar/google/auth', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  const { authUrl } = await response.json();
  
  // Redirect user to authorization URL
  window.location.href = authUrl;
};

// Sync enrollment sessions
const syncEnrollment = async (enrollmentId: string) => {
  const response = await fetch('/api/calendar/sync/enrollment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ enrollmentId })
  });
  
  const result = await response.json();
  console.log(`Synced ${result.eventsCreated} events`);
};

// Get upcoming events
const getUpcomingEvents = async () => {
  const response = await fetch('/api/calendar/events?upcoming=true', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  const { events } = await response.json();
  return events;
};
```

## Security

### Token Storage

- OAuth tokens are encrypted using AES-256-GCM before storage
- Encryption key must be set in environment variables
- Tokens are automatically refreshed before expiration

### Authentication

- All endpoints require JWT authentication
- User ID is extracted from JWT token
- Rate limiting prevents abuse

### Best Practices

1. **Never commit** `.env` file or credentials
2. **Rotate encryption keys** regularly in production
3. **Use HTTPS** in production
4. **Implement proper CORS** policies
5. **Monitor token refresh** failures

## Error Handling

The service uses standardized error responses:

```json
{
  "error": {
    "type": "ERROR_TYPE",
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Error Types:
- `VALIDATION_ERROR`: Invalid input data
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `EXTERNAL_SERVICE_ERROR`: Calendar API error
- `SYSTEM_ERROR`: Internal server error

## Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Monitoring

### Scheduled Tasks

- **Mark Past Events Completed**: Runs hourly to update event statuses

### Logs

Logs are stored in:
- `logs/error.log`: Error-level logs
- `logs/combined.log`: All logs

### Metrics to Monitor

- Token refresh success rate
- Calendar API response times
- Sync operation success rate
- Event creation/update failures
- Database connection pool usage

## Troubleshooting

### Common Issues

**Token Refresh Failures**
- Check if refresh token is still valid
- Verify OAuth credentials are correct
- Ensure user hasn't revoked access

**Calendar API Errors**
- Check API quotas in Google/Microsoft console
- Verify API permissions are granted
- Check network connectivity

**Database Connection Issues**
- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Verify database migrations are applied

## Development

### Project Structure

```
src/
├── database/          # Database connection and queries
├── middleware/        # Express middleware (auth, validation)
├── routes/           # API route handlers
├── services/         # Business logic services
├── types/            # TypeScript type definitions
├── utils/            # Utility functions (logger, encryption)
└── index.ts          # Application entry point
```

### Adding New Features

1. Define types in `src/types/index.ts`
2. Create service in `src/services/`
3. Add routes in `src/routes/`
4. Add validation schemas in `src/middleware/validation.ts`
5. Update database schema if needed
6. Write tests
7. Update documentation

## License

Copyright © 2024 Sai Mahendra Platform. All rights reserved.
