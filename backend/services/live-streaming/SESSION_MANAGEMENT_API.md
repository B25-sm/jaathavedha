# Live Session Management and Analytics API Reference

## Overview

This document describes the API endpoints for live session management, attendance tracking, analytics, notifications, and calendar integration.

**Base URL**: `/api/live-streaming/sessions`

## Table of Contents

1. [Session Management](#session-management)
2. [Attendance Tracking](#attendance-tracking)
3. [Analytics](#analytics)
4. [Dashboard](#dashboard)
5. [Feedback](#feedback)
6. [Notifications](#notifications)
7. [Calendar Integration](#calendar-integration)

---

## Session Management

### Create Session

Creates a new live session with scheduling and notification setup.

**Endpoint**: `POST /create`

**Request Body**:
```json
{
  "courseId": "uuid",
  "programId": "uuid",
  "instructorId": "uuid",
  "title": "Introduction to AI",
  "description": "Learn the basics of artificial intelligence",
  "scheduledStart": "2024-12-01T10:00:00Z",
  "scheduledEnd": "2024-12-01T11:00:00Z",
  "timezone": "Asia/Kolkata",
  "maxParticipants": 100
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "courseId": "uuid",
    "instructorId": "uuid",
    "title": "Introduction to AI",
    "scheduledStart": "2024-12-01T10:00:00Z",
    "scheduledEnd": "2024-12-01T11:00:00Z",
    "status": "scheduled",
    "createdAt": "2024-11-15T10:00:00Z"
  }
}
```

### Update Session

Updates an existing session's details.

**Endpoint**: `PUT /:sessionId`

**Request Body**:
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "scheduledStart": "2024-12-01T11:00:00Z",
  "scheduledEnd": "2024-12-01T12:00:00Z"
}
```

### Get Session

Retrieves details of a specific session.

**Endpoint**: `GET /:sessionId`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Introduction to AI",
    "status": "scheduled",
    "scheduledStart": "2024-12-01T10:00:00Z",
    "scheduledEnd": "2024-12-01T11:00:00Z",
    "maxParticipants": 100
  }
}
```

### List Sessions

Lists sessions with filtering options.

**Endpoint**: `GET /`

**Query Parameters**:
- `instructorId` (optional): Filter by instructor
- `courseId` (optional): Filter by course
- `programId` (optional): Filter by program
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 20)

**Response**:
```json
{
  "success": true,
  "data": {
    "sessions": [...],
    "total": 50
  }
}
```

### Cancel Session

Cancels a session and all associated notifications.

**Endpoint**: `DELETE /:sessionId`

---

## Attendance Tracking

### Join Session

Records a participant joining the session.

**Endpoint**: `POST /:sessionId/join`

**Request Body**:
```json
{
  "userId": "uuid",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "deviceType": "desktop",
  "browser": "Chrome",
  "ipAddress": "192.168.1.1",
  "locationCountry": "India",
  "locationCity": "Mumbai"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sessionId": "uuid",
    "userId": "uuid",
    "joinedAt": "2024-12-01T10:05:00Z",
    "isPresent": true
  }
}
```

### Leave Session

Records a participant leaving the session.

**Endpoint**: `POST /:sessionId/leave`

**Request Body**:
```json
{
  "userId": "uuid"
}
```

### Get Session Attendance

Retrieves all attendance records for a session.

**Endpoint**: `GET /:sessionId/attendance`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userName": "John Doe",
      "joinedAt": "2024-12-01T10:05:00Z",
      "leftAt": "2024-12-01T10:55:00Z",
      "durationSeconds": 3000,
      "engagementScore": 85.5,
      "chatMessagesSent": 5,
      "qaQuestionsAsked": 2
    }
  ]
}
```

### Get Attendance Summary

Retrieves aggregated attendance statistics.

**Endpoint**: `GET /:sessionId/attendance/summary`

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "totalRegistered": 100,
    "totalAttended": 85,
    "attendanceRate": 85.0,
    "peakConcurrentViewers": 78,
    "averageDurationSeconds": 3200,
    "onTimeArrivals": 70,
    "lateArrivals": 15,
    "earlyLeavers": 10,
    "deviceBreakdown": {
      "desktop": 50,
      "mobile": 30,
      "tablet": 5
    },
    "geographicDistribution": [
      { "country": "India", "count": 50, "percentage": 58.8 },
      { "country": "USA", "count": 20, "percentage": 23.5 }
    ]
  }
}
```

### Update Engagement Metrics

Updates engagement metrics for a participant.

**Endpoint**: `POST /:sessionId/attendance/:attendanceId/engagement`

**Request Body**:
```json
{
  "chatMessagesSent": 1,
  "qaQuestionsAsked": 1,
  "pollsParticipated": 1,
  "engagementScore": 88.5
}
```

---

## Analytics

### Get Session Analytics

Retrieves comprehensive analytics for a session.

**Endpoint**: `GET /:sessionId/analytics`

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "totalParticipants": 85,
    "peakConcurrentViewers": 78,
    "averageWatchTime": 3200,
    "totalWatchTime": 272000,
    "chatMessages": 150,
    "qaQuestions": 25,
    "qaAnswered": 20,
    "pollsCreated": 5,
    "pollResponses": 320,
    "handRaises": 12,
    "engagementRate": 82.5,
    "attendanceRate": 85.0,
    "dropOffRate": 11.8,
    "qualityRating": 4.5,
    "totalRatings": 45
  }
}
```

### Get Engagement Timeline

Retrieves time-series engagement data.

**Endpoint**: `GET /:sessionId/analytics/timeline`

**Query Parameters**:
- `interval` (optional): Interval in minutes (default: 5)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-12-01T10:00:00Z",
      "concurrentViewers": 45,
      "chatActivity": 12,
      "qaActivity": 3,
      "pollActivity": 0,
      "averageAttentionScore": 85.0
    },
    {
      "timestamp": "2024-12-01T10:05:00Z",
      "concurrentViewers": 78,
      "chatActivity": 25,
      "qaActivity": 5,
      "pollActivity": 15,
      "averageAttentionScore": 88.5
    }
  ]
}
```

### Record Engagement Timeline

Records a snapshot of engagement metrics.

**Endpoint**: `POST /:sessionId/analytics/timeline`

**Request Body**:
```json
{
  "concurrentViewers": 78,
  "chatActivity": 25,
  "qaActivity": 5,
  "pollActivity": 15,
  "handRaiseActivity": 2,
  "averageAttentionScore": 88.5
}
```

### Get Quality Metrics

Retrieves technical quality metrics.

**Endpoint**: `GET /:sessionId/analytics/quality`

**Response**:
```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "userId": "uuid",
        "videoQuality": "1080p",
        "audioQuality": "excellent",
        "connectionQuality": "good",
        "bufferingEvents": 2,
        "disconnections": 0,
        "averageBitrate": 2500,
        "packetLossPercentage": 0.5,
        "latencyMs": 45
      }
    ],
    "aggregated": {
      "averageVideoQuality": "1080p",
      "averageAudioQuality": "excellent",
      "averageConnectionQuality": "good",
      "totalBufferingEvents": 15,
      "totalDisconnections": 3,
      "averageBitrate": 2300,
      "averagePacketLoss": 0.8,
      "averageLatency": 52
    }
  }
}
```

### Record Quality Metrics

Records quality metrics for a participant.

**Endpoint**: `POST /:sessionId/analytics/quality`

**Request Body**:
```json
{
  "userId": "uuid",
  "videoQuality": "1080p",
  "audioQuality": "excellent",
  "connectionQuality": "good",
  "bufferingEvents": 2,
  "disconnections": 0,
  "averageBitrate": 2500,
  "packetLossPercentage": 0.5,
  "latencyMs": 45
}
```

---

## Dashboard

### Get Session Dashboard

Retrieves comprehensive dashboard data for a session.

**Endpoint**: `GET /:sessionId/dashboard`

**Response**:
```json
{
  "success": true,
  "data": {
    "session": { ... },
    "analytics": { ... },
    "attendanceSummary": { ... },
    "engagementTimeline": [ ... ],
    "qualityMetrics": [ ... ],
    "recentFeedback": [ ... ],
    "topParticipants": [ ... ]
  }
}
```

### Get Instructor Dashboard

Retrieves dashboard data for an instructor.

**Endpoint**: `GET /instructor/:instructorId/dashboard`

**Response**:
```json
{
  "success": true,
  "data": {
    "upcomingSessions": [ ... ],
    "liveSessions": [ ... ],
    "recentSessions": [ ... ],
    "overallStats": {
      "totalSessions": 25,
      "totalParticipants": 1250,
      "averageAttendanceRate": 85.5,
      "averageRating": 4.5,
      "totalWatchTime": 450000
    }
  }
}
```

---

## Feedback

### Submit Feedback

Submits post-session feedback.

**Endpoint**: `POST /:sessionId/feedback`

**Request Body**:
```json
{
  "userId": "uuid",
  "overallRating": 5,
  "contentQuality": 5,
  "instructorRating": 5,
  "technicalQuality": 4,
  "engagementRating": 5,
  "wouldRecommend": true,
  "feedbackText": "Excellent session!",
  "improvementsSuggested": "More interactive polls",
  "favoriteAspects": "Clear explanations",
  "technicalIssues": "Minor audio lag at start"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sessionId": "uuid",
    "userId": "uuid",
    "overallRating": 5,
    "wouldRecommend": true,
    "createdAt": "2024-12-01T11:05:00Z"
  }
}
```

### Get Session Feedback

Retrieves all feedback for a session.

**Endpoint**: `GET /:sessionId/feedback`

---

## Notifications

### Schedule Notifications

Schedules automated notifications for a session.

**Endpoint**: `POST /:sessionId/notifications/schedule`

**Request Body**:
```json
{
  "instructorId": "uuid"
}
```

### Send Immediate Notification

Sends an immediate notification to a user.

**Endpoint**: `POST /:sessionId/notifications/send`

**Request Body**:
```json
{
  "userId": "uuid",
  "title": "Session Starting",
  "message": "Your session is starting in 5 minutes",
  "channel": "email"
}
```

### Broadcast to Session

Broadcasts a notification to all session participants.

**Endpoint**: `POST /:sessionId/notifications/broadcast`

**Request Body**:
```json
{
  "title": "Important Announcement",
  "message": "Session extended by 15 minutes",
  "channel": "push"
}
```

---

## Calendar Integration

### Add to Google Calendar

Adds session to user's Google Calendar.

**Endpoint**: `POST /:sessionId/calendar/google`

**Request Body**:
```json
{
  "userId": "uuid",
  "accessToken": "google_access_token"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "eventId": "google_event_id"
  }
}
```

### Add to Outlook Calendar

Adds session to user's Outlook Calendar.

**Endpoint**: `POST /:sessionId/calendar/outlook`

**Request Body**:
```json
{
  "userId": "uuid",
  "accessToken": "outlook_access_token"
}
```

### Download iCal File

Downloads an iCal file for the session.

**Endpoint**: `GET /:sessionId/calendar/ical`

**Response**: iCal file download

### Sync to Multiple Calendars

Syncs session to multiple users' calendars.

**Endpoint**: `POST /:sessionId/calendar/sync`

**Request Body**:
```json
{
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "provider": "google"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "success": ["uuid1", "uuid2"],
    "failed": ["uuid3"]
  }
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

---

## Notification Types

- `session_reminder_24h`: 24-hour reminder
- `session_reminder_1h`: 1-hour reminder
- `session_reminder_15m`: 15-minute reminder
- `session_starting`: Session is starting now
- `session_started`: Session has started
- `session_ended`: Session has ended
- `recording_available`: Recording is available

## Notification Channels

- `email`: Email notification
- `push`: Push notification
- `sms`: SMS notification
- `whatsapp`: WhatsApp notification

## Calendar Providers

- `google`: Google Calendar
- `outlook`: Outlook/Microsoft Calendar
- `apple`: Apple Calendar (iCal)
