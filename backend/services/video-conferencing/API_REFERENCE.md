# Video Conferencing Service API Reference

## Overview

The Video Conferencing Service provides comprehensive integration with Zoom and Google Meet platforms, enabling live virtual classroom sessions with recording, attendance tracking, and playback functionality.

**Base URL:** `/api/video-conferencing`

**Version:** 1.0.0

## Authentication

All endpoints require JWT authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Meetings API

### Create Meeting

Create a new video conferencing meeting with Zoom or Google Meet.

**Endpoint:** `POST /meetings`

**Authorization:** Instructor, Admin

**Request Body:**
```json
{
  "provider": "zoom",
  "session_id": "uuid",
  "instructor_id": "uuid",
  "title": "Introduction to AI",
  "description": "First session covering AI fundamentals",
  "start_time": "2024-02-01T10:00:00Z",
  "duration_minutes": 60,
  "timezone": "Asia/Kolkata",
  "settings": {
    "waiting_room": true,
    "auto_recording": true,
    "mute_upon_entry": true,
    "allow_screen_sharing": true,
    "allow_chat": true,
    "host_video": true,
    "participant_video": true
  },
  "attendee_emails": ["student1@example.com", "student2@example.com"]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "provider": "zoom",
    "provider_meeting_id": "123456789",
    "session_id": "uuid",
    "instructor_id": "uuid",
    "title": "Introduction to AI",
    "description": "First session covering AI fundamentals",
    "start_time": "2024-02-01T10:00:00Z",
    "duration_minutes": 60,
    "timezone": "Asia/Kolkata",
    "join_url": "https://zoom.us/j/123456789",
    "start_url": "https://zoom.us/s/123456789",
    "password": "abc123",
    "status": "scheduled",
    "settings": { ... },
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

### Get Meeting by ID

Retrieve meeting details by meeting ID.

**Endpoint:** `GET /meetings/:id`

**Authorization:** Authenticated users

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "provider": "zoom",
    "title": "Introduction to AI",
    "join_url": "https://zoom.us/j/123456789",
    "start_time": "2024-02-01T10:00:00Z",
    "duration_minutes": 60,
    "status": "scheduled"
  }
}
```

### Get Meetings by Session

Retrieve all meetings for a specific course session.

**Endpoint:** `GET /meetings/session/:sessionId`

**Authorization:** Authenticated users

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Session 1",
      "start_time": "2024-02-01T10:00:00Z",
      "status": "scheduled"
    }
  ],
  "count": 1
}
```

### Get Meetings by Instructor

Retrieve all meetings created by a specific instructor.

**Endpoint:** `GET /meetings/instructor/:instructorId`

**Authorization:** Instructor, Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Introduction to AI",
      "start_time": "2024-02-01T10:00:00Z",
      "status": "scheduled"
    }
  ],
  "count": 1
}
```

### Get Upcoming Meetings

Retrieve upcoming scheduled meetings.

**Endpoint:** `GET /meetings/upcoming/list`

**Authorization:** Authenticated users

**Query Parameters:**
- `limit` (optional): Number of meetings to return (default: 10)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Introduction to AI",
      "start_time": "2024-02-01T10:00:00Z",
      "duration_minutes": 60,
      "join_url": "https://zoom.us/j/123456789"
    }
  ],
  "count": 1
}
```

### Update Meeting Status

Update the status of a meeting.

**Endpoint:** `PATCH /meetings/:id/status`

**Authorization:** Instructor, Admin

**Request Body:**
```json
{
  "status": "in_progress"
}
```

**Valid Status Values:**
- `scheduled`
- `in_progress`
- `completed`
- `cancelled`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Meeting status updated successfully"
}
```

### Delete Meeting

Delete a meeting from both the platform and the provider (Zoom/Google Meet).

**Endpoint:** `DELETE /meetings/:id`

**Authorization:** Instructor, Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Meeting deleted successfully"
}
```

## Recordings API

### Get Recording by ID

Retrieve recording details by recording ID.

**Endpoint:** `GET /recordings/:id`

**Authorization:** Authenticated users

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "meeting_id": "uuid",
    "provider_recording_id": "abc123",
    "file_name": "recording_123.mp4",
    "file_size_bytes": 104857600,
    "duration_minutes": 60,
    "recording_type": "shared_screen_with_speaker_view",
    "s3_url": "https://s3.amazonaws.com/...",
    "status": "downloaded",
    "recorded_at": "2024-02-01T10:00:00Z",
    "created_at": "2024-02-01T11:00:00Z"
  }
}
```

### Get Recordings by Meeting

Retrieve all recordings for a specific meeting.

**Endpoint:** `GET /recordings/meeting/:meetingId`

**Authorization:** Authenticated users

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "file_name": "recording_123.mp4",
      "duration_minutes": 60,
      "status": "downloaded",
      "recorded_at": "2024-02-01T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Generate Playback URL

Generate a presigned URL for recording playback.

**Endpoint:** `GET /recordings/:id/playback-url`

**Authorization:** Authenticated users

**Query Parameters:**
- `expiresIn` (optional): URL expiration time in seconds (default: 3600)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "playback_url": "https://s3.amazonaws.com/...?signature=...",
    "expires_in": 3600
  }
}
```

**Note:** This endpoint automatically tracks the recording view for analytics.

### Delete Recording

Delete a recording from the platform.

**Endpoint:** `DELETE /recordings/:id`

**Authorization:** Instructor, Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Recording deleted successfully"
}
```

## Attendance API

### Record Participant Join

Record when a participant joins a meeting.

**Endpoint:** `POST /attendance/join`

**Authorization:** Authenticated users

**Request Body:**
```json
{
  "meeting_id": "uuid",
  "user_id": "uuid",
  "join_time": "2024-02-01T10:05:00Z"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "meeting_id": "uuid",
    "user_id": "uuid",
    "join_time": "2024-02-01T10:05:00Z",
    "duration_minutes": 0,
    "status": "present"
  }
}
```

### Record Participant Leave

Record when a participant leaves a meeting.

**Endpoint:** `POST /attendance/leave`

**Authorization:** Authenticated users

**Request Body:**
```json
{
  "meeting_id": "uuid",
  "user_id": "uuid",
  "leave_time": "2024-02-01T11:00:00Z"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Leave time recorded successfully"
}
```

### Get Attendance by Meeting

Retrieve attendance records for a specific meeting.

**Endpoint:** `GET /attendance/meeting/:meetingId`

**Authorization:** Instructor, Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "join_time": "2024-02-01T10:05:00Z",
      "leave_time": "2024-02-01T11:00:00Z",
      "duration_minutes": 55,
      "status": "present"
    }
  ],
  "count": 1
}
```

### Get Attendance by User

Retrieve attendance records for a specific user.

**Endpoint:** `GET /attendance/user/:userId`

**Authorization:** Authenticated users (own records), Instructor, Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "meeting_id": "uuid",
      "join_time": "2024-02-01T10:05:00Z",
      "leave_time": "2024-02-01T11:00:00Z",
      "duration_minutes": 55,
      "status": "present"
    }
  ],
  "count": 1
}
```

### Generate Attendance Report

Generate a comprehensive attendance report for a meeting.

**Endpoint:** `GET /attendance/meeting/:meetingId/report`

**Authorization:** Instructor, Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "meeting_id": "uuid",
    "meeting_title": "Introduction to AI",
    "start_time": "2024-02-01T10:00:00Z",
    "duration_minutes": 60,
    "total_attendees": 25,
    "present_count": 23,
    "absent_count": 1,
    "late_count": 1,
    "attendance_percentage": 92.0,
    "attendees": [
      {
        "user_id": "uuid",
        "status": "present",
        "join_time": "2024-02-01T10:05:00Z",
        "leave_time": "2024-02-01T11:00:00Z",
        "duration_minutes": 55
      }
    ]
  }
}
```

### Get User Attendance Statistics

Retrieve attendance statistics for a specific user.

**Endpoint:** `GET /attendance/user/:userId/stats`

**Authorization:** Authenticated users (own stats), Instructor, Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "total_sessions": 10,
    "present_count": 9,
    "absent_count": 0,
    "late_count": 1,
    "attendance_rate": 90.0,
    "avg_duration_minutes": 55.5
  }
}
```

## Webhooks API

### Zoom Webhook

Receive webhook events from Zoom for meeting and recording updates.

**Endpoint:** `POST /webhooks/zoom`

**Authorization:** Webhook signature verification

**Supported Events:**
- `meeting.started` - Meeting has started
- `meeting.ended` - Meeting has ended
- `meeting.participant_joined` - Participant joined the meeting
- `meeting.participant_left` - Participant left the meeting
- `recording.completed` - Recording is ready for download

**Request Headers:**
```
x-zm-signature: <zoom_signature>
x-zm-request-timestamp: <timestamp>
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "type": "ERROR_TYPE",
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

### Error Types

- `AUTHENTICATION_ERROR` - Authentication failed (401)
- `AUTHORIZATION_ERROR` - Insufficient permissions (403)
- `VALIDATION_ERROR` - Invalid request data (400)
- `NOT_FOUND` - Resource not found (404)
- `SYSTEM_ERROR` - Internal server error (500)

### Common Error Codes

- `MISSING_TOKEN` - No authentication token provided
- `TOKEN_EXPIRED` - Authentication token has expired
- `INVALID_TOKEN` - Invalid authentication token
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `INVALID_REQUEST_DATA` - Request validation failed
- `MEETING_NOT_FOUND` - Meeting does not exist
- `RECORDING_NOT_FOUND` - Recording does not exist

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Window:** 15 minutes
- **Max Requests:** 100 per window per IP address

When rate limit is exceeded, the API returns:

```json
{
  "error": {
    "type": "RATE_LIMIT_ERROR",
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests, please try again later"
  }
}
```

## Attendance Status Calculation

Attendance status is automatically calculated based on:

1. **Minimum Duration:** 5 minutes (configurable)
2. **Attendance Threshold:** 75% of meeting duration (configurable)

**Status Rules:**
- `present` - Duration ≥ 75% of meeting duration
- `late` - Duration between 50% and 75% of meeting duration
- `absent` - Duration < 50% of meeting duration OR < 5 minutes

## Recording Processing Flow

1. Meeting ends and Zoom sends `recording.completed` webhook
2. Service receives webhook and creates recording metadata
3. Recording is downloaded from Zoom asynchronously
4. Recording is uploaded to AWS S3 for long-term storage
5. Status updates: `processing` → `downloading` → `downloaded`
6. Presigned URLs are generated on-demand for playback

## Provider-Specific Notes

### Zoom Integration

- Uses Server-to-Server OAuth for authentication
- Supports automatic cloud recording
- Provides detailed participant tracking
- Webhook signature verification required
- Recording files expire after 30 days on Zoom cloud

### Google Meet Integration

- Uses OAuth 2.0 with user consent
- Meetings created via Google Calendar API
- Recordings stored in Google Drive (separate API required)
- No built-in attendance tracking (manual implementation needed)
- Requires per-user OAuth tokens

## Best Practices

1. **Meeting Creation:** Create meetings at least 15 minutes before start time
2. **Recording Access:** Generate playback URLs with appropriate expiration times
3. **Attendance Tracking:** Use webhooks for automatic tracking when possible
4. **Error Handling:** Implement retry logic for transient failures
5. **Security:** Never expose start URLs to non-instructors
6. **Cleanup:** Delete old recordings to manage storage costs

## Support

For issues or questions about the Video Conferencing Service API, contact the development team or refer to the main platform documentation.
