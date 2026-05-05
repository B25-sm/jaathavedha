# Calendar Integration Service - API Reference

## Base URL

```
Development: http://localhost:3016
Production: https://api.saimahendra.com
```

## Authentication

All endpoints (except health check) require JWT authentication via Bearer token:

```http
Authorization: Bearer <your_jwt_token>
```

## Response Format

### Success Response

```json
{
  "data": {},
  "message": "Success message"
}
```

### Error Response

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

## Endpoints

### 1. Google Calendar Authentication

#### Get Authorization URL

Initiates the OAuth flow by providing the Google Calendar authorization URL.

**Endpoint:** `GET /api/calendar/google/auth`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

**Usage:**
1. Call this endpoint to get the authorization URL
2. Redirect user to the `authUrl`
3. User grants permissions
4. Google redirects to callback URL with authorization code

---

#### Handle OAuth Callback

Completes the OAuth flow by exchanging the authorization code for access tokens.

**Endpoint:** `GET /api/calendar/google/callback`

**Headers:**
```http
Authorization: Bearer <token>
```

**Query Parameters:**
- `code` (required): Authorization code from Google

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Google Calendar connected successfully"
}
```

**Errors:**
- `400`: Missing or invalid authorization code
- `500`: Failed to connect Google Calendar

---

### 2. Outlook Calendar Authentication

#### Get Authorization URL

Initiates the OAuth flow for Outlook/Office 365 calendar.

**Endpoint:** `GET /api/calendar/outlook/auth`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "authUrl": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?..."
}
```

---

#### Handle OAuth Callback

Completes the OAuth flow for Outlook calendar.

**Endpoint:** `GET /api/calendar/outlook/callback`

**Headers:**
```http
Authorization: Bearer <token>
```

**Query Parameters:**
- `code` (required): Authorization code from Microsoft

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Outlook Calendar connected successfully"
}
```

---

### 3. Calendar Connections

#### Get User Connections

Retrieves all active calendar connections for the authenticated user.

**Endpoint:** `GET /api/calendar/connections`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "connections": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "provider": "google",
      "calendarId": "primary",
      "isActive": true,
      "lastSyncAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-10T08:00:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "provider": "outlook",
      "calendarId": null,
      "isActive": true,
      "lastSyncAt": "2024-01-15T09:00:00Z",
      "createdAt": "2024-01-12T10:00:00Z"
    }
  ]
}
```

**Notes:**
- Access tokens are not included in the response for security
- `calendarId` may be null for Outlook (uses default calendar)

---

#### Disconnect Calendar

Removes a calendar connection and stops synchronization.

**Endpoint:** `DELETE /api/calendar/connections/:provider`

**Headers:**
```http
Authorization: Bearer <token>
```

**Path Parameters:**
- `provider` (required): Calendar provider (`google` or `outlook`)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Calendar disconnected successfully"
}
```

**Errors:**
- `400`: Invalid provider
- `404`: Connection not found
- `500`: Failed to disconnect calendar

---

### 4. Calendar Events

#### Get User Events

Retrieves calendar events for the authenticated user with optional filtering.

**Endpoint:** `GET /api/calendar/events`

**Headers:**
```http
Authorization: Bearer <token>
```

**Query Parameters:**
- `provider` (optional): Filter by provider (`google`, `outlook`)
- `status` (optional): Filter by status (`scheduled`, `cancelled`, `completed`, `rescheduled`)
- `upcoming` (optional): Get only upcoming events (`true`, `false`)

**Response:** `200 OK`
```json
{
  "events": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "userId": "user-123",
      "sessionId": "session-456",
      "enrollmentId": "enrollment-789",
      "provider": "google",
      "providerEventId": "google-event-id-123",
      "title": "AI Fundamentals - Live Session 1",
      "description": "Introduction to AI and Machine Learning",
      "location": "Online",
      "startTime": "2024-01-20T14:00:00Z",
      "endTime": "2024-01-20T16:00:00Z",
      "timezone": "Asia/Kolkata",
      "status": "scheduled",
      "meetingUrl": "https://meet.google.com/abc-defg-hij",
      "attendees": ["student@example.com"],
      "reminders": [
        {
          "type": "email",
          "minutesBefore": 60
        },
        {
          "type": "popup",
          "minutesBefore": 15
        }
      ],
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Examples:**
```http
# Get all events
GET /api/calendar/events

# Get upcoming events only
GET /api/calendar/events?upcoming=true

# Get Google Calendar events
GET /api/calendar/events?provider=google

# Get scheduled events
GET /api/calendar/events?status=scheduled
```

---

#### Get Calendar Statistics

Retrieves calendar usage statistics for the authenticated user.

**Endpoint:** `GET /api/calendar/stats`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "stats": {
    "totalEvents": 25,
    "upcomingEvents": 10,
    "completedEvents": 12,
    "cancelledEvents": 3,
    "lastSyncAt": "2024-01-15T10:30:00Z",
    "nextSyncAt": "2024-01-15T10:45:00Z"
  }
}
```

---

### 5. Calendar Synchronization

#### Sync Enrollment Sessions

Synchronizes all live sessions for a specific enrollment to connected calendars.

**Endpoint:** `POST /api/calendar/sync/enrollment`

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "enrollmentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Enrollment sessions synced successfully",
  "eventsCreated": 5
}
```

**Partial Success Response:** `400 Bad Request`
```json
{
  "success": false,
  "message": "Failed to sync some events",
  "eventsCreated": 3,
  "errors": [
    "Failed to create event for session session-123",
    "Failed to sync with outlook: Token expired"
  ]
}
```

**Errors:**
- `400`: Invalid enrollment ID or no active connections
- `404`: Enrollment not found
- `500`: Sync operation failed

**Notes:**
- Creates events in all connected calendars (Google, Outlook)
- Only syncs future sessions
- Skips sessions that are already synced
- Returns partial success if some calendars fail

---

### 6. Sync Preferences

#### Get Sync Preferences

Retrieves calendar synchronization preferences for the authenticated user.

**Endpoint:** `GET /api/calendar/preferences`

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "preferences": {
    "userId": "user-123",
    "autoSyncEnabled": true,
    "syncInterval": 15,
    "providers": ["google", "outlook"],
    "syncPastEvents": false,
    "syncFutureEvents": true,
    "daysInPast": 0,
    "daysInFuture": 90,
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

**Field Descriptions:**
- `autoSyncEnabled`: Automatically sync new enrollments
- `syncInterval`: Minutes between sync operations
- `providers`: Enabled calendar providers
- `syncPastEvents`: Include past events in sync
- `syncFutureEvents`: Include future events in sync
- `daysInPast`: How many days in the past to sync
- `daysInFuture`: How many days in the future to sync

---

#### Update Sync Preferences

Updates calendar synchronization preferences.

**Endpoint:** `PUT /api/calendar/preferences`

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "autoSyncEnabled": true,
  "syncInterval": 30,
  "providers": ["google"],
  "syncPastEvents": false,
  "syncFutureEvents": true,
  "daysInPast": 0,
  "daysInFuture": 180
}
```

**Validation Rules:**
- `syncInterval`: 5-1440 minutes
- `daysInPast`: 0-365 days
- `daysInFuture`: 0-365 days
- `providers`: Array of valid providers

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Sync preferences updated successfully"
}
```

**Errors:**
- `400`: Validation failed
- `500`: Update failed

---

### 7. Health Check

#### Service Health

Checks if the service is running and healthy.

**Endpoint:** `GET /api/calendar/health`

**Headers:** None required

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "service": "calendar-integration",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Error Codes

### Authentication Errors (401)

| Code | Description |
|------|-------------|
| `MISSING_TOKEN` | Authorization token not provided |
| `INVALID_TOKEN` | Token is invalid or malformed |
| `AUTH_FAILED` | Authentication failed |
| `TOKEN_EXPIRED` | Token has expired |

### Authorization Errors (403)

| Code | Description |
|------|-------------|
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |

### Validation Errors (400)

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Request validation failed |
| `MISSING_CODE` | OAuth authorization code missing |
| `INVALID_PROVIDER` | Invalid calendar provider |

### External Service Errors (500)

| Code | Description |
|------|-------------|
| `GOOGLE_AUTH_FAILED` | Google Calendar authentication failed |
| `OUTLOOK_AUTH_FAILED` | Outlook Calendar authentication failed |
| `CALENDAR_API_ERROR` | Calendar API request failed |

### System Errors (500)

| Code | Description |
|------|-------------|
| `INTERNAL_ERROR` | Unexpected server error |
| `DATABASE_ERROR` | Database operation failed |
| `SYNC_FAILED` | Synchronization operation failed |

---

## Rate Limiting

- **Window**: 15 minutes (900,000 ms)
- **Max Requests**: 100 per window per IP
- **Response**: 429 Too Many Requests

```json
{
  "error": {
    "type": "RATE_LIMIT_ERROR",
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests, please try again later"
  }
}
```

---

## Webhooks (Future Enhancement)

Calendar change notifications via webhooks will be supported in a future release.

---

## SDK Examples

### JavaScript/TypeScript

```typescript
class CalendarClient {
  constructor(private baseUrl: string, private token: string) {}

  async connectGoogle(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/calendar/google/auth`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    const { authUrl } = await response.json();
    return authUrl;
  }

  async syncEnrollment(enrollmentId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/calendar/sync/enrollment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enrollmentId })
    });
  }

  async getUpcomingEvents(): Promise<Event[]> {
    const response = await fetch(
      `${this.baseUrl}/api/calendar/events?upcoming=true`,
      {
        headers: { 'Authorization': `Bearer ${this.token}` }
      }
    );
    const { events } = await response.json();
    return events;
  }
}
```

---

## Support

For API support, contact: api-support@saimahendra.com

For documentation issues: docs@saimahendra.com
