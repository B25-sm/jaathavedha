# Mobile API Service - API Reference

## Overview

The Mobile API Service provides mobile-optimized endpoints for the Sai Mahendra Learning Platform. It includes features for offline content synchronization, video downloads, push notifications, and mobile-optimized content delivery.

**Base URL**: `http://localhost:3012` (development)

**Requirements**: 20.1, 20.2, 20.3, 20.9

---

## Authentication

All API endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

---

## Content Delivery API

### Get Mobile-Optimized Courses

Get a list of courses with mobile-optimized responses, field selection, and pagination.

**Endpoint**: `GET /api/content/courses`

**Query Parameters**:
- `userId` (required): User ID
- `fields` (optional): Comma-separated list of fields to include (e.g., `id,title,progress,thumbnail`)
- `limit` (optional): Number of items per page (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `includeRelations` (optional): Comma-separated relations to include (e.g., `lessons,instructor`)
- `compress` (optional): Enable response compression (true/false)

**Example Request**:
```bash
GET /api/content/courses?userId=user-123&fields=id,title,progress&limit=10
```

**Example Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "course-1",
      "title": "Introduction to AI",
      "progress": 45
    }
  ],
  "metadata": {
    "fields": ["id", "title", "progress"],
    "compressed": false,
    "size": 1024,
    "timestamp": "2024-01-15T10:00:00Z"
  },
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 25,
    "hasMore": true
  }
}
```

### Get Lesson Content

Get mobile-optimized lesson content with optional relations.

**Endpoint**: `GET /api/content/lessons/:lessonId`

**Query Parameters**:
- `userId` (required): User ID
- `fields` (optional): Comma-separated list of fields
- `includeRelations` (optional): Include `resources`, `notes`, etc.

**Example Request**:
```bash
GET /api/content/lessons/lesson-123?userId=user-123&includeRelations=resources,notes
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": "lesson-123",
    "title": "Neural Networks Basics",
    "duration": 1800,
    "progress": 75,
    "lastPosition": 1350,
    "resources": [
      {
        "id": "res-1",
        "title": "Lecture Slides",
        "type": "pdf",
        "url": "https://cdn.example.com/slides.pdf"
      }
    ],
    "notes": [
      {
        "id": "note-1",
        "content": "Important concept",
        "timestamp": 450
      }
    ]
  },
  "metadata": {
    "fields": ["id", "title", "duration", "progress"],
    "compressed": false,
    "size": 2048,
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

### Get Progress Summary

Get user's overall learning progress summary.

**Endpoint**: `GET /api/content/progress/summary`

**Query Parameters**:
- `userId` (required): User ID

**Example Response**:
```json
{
  "success": true,
  "data": {
    "enrolled_courses": 5,
    "completed_lessons": 42,
    "total_lessons": 120,
    "average_progress": 35,
    "total_watch_time": 86400,
    "lessons_this_week": 8
  }
}
```

### Get Upcoming Sessions

Get upcoming live sessions for enrolled courses.

**Endpoint**: `GET /api/content/sessions/upcoming`

**Query Parameters**:
- `userId` (required): User ID
- `limit` (optional): Number of sessions (default: 10)
- `offset` (optional): Pagination offset

**Example Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "session-1",
      "title": "Live Q&A Session",
      "scheduled_at": "2024-01-20T15:00:00Z",
      "duration": 3600,
      "course_title": "AI Fundamentals",
      "instructor_name": "Dr. Smith",
      "registration_status": "registered"
    }
  ]
}
```

---

## Offline Sync API

### Sync Progress

Sync learning progress from mobile device to server.

**Endpoint**: `POST /api/sync/progress`

**Request Body**:
```json
{
  "userId": "user-123",
  "deviceId": "device-456",
  "data": [
    {
      "lessonId": "lesson-1",
      "progress": 75,
      "lastPosition": 1350,
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "synced": 1,
    "conflicts": 0,
    "timestamp": "2024-01-15T10:05:00Z",
    "syncedItems": ["lesson-1"]
  }
}
```

### Sync Notes

Sync user notes from mobile device.

**Endpoint**: `POST /api/sync/notes`

**Request Body**:
```json
{
  "userId": "user-123",
  "deviceId": "device-456",
  "notes": [
    {
      "id": "note-1",
      "lessonId": "lesson-1",
      "content": "Important concept about neural networks",
      "timestamp": 450,
      "deleted": false
    }
  ]
}
```

### Sync Bookmarks

Sync video bookmarks from mobile device.

**Endpoint**: `POST /api/sync/bookmarks`

**Request Body**:
```json
{
  "userId": "user-123",
  "deviceId": "device-456",
  "bookmarks": [
    {
      "id": "bookmark-1",
      "lessonId": "lesson-1",
      "timestamp": 1200,
      "title": "Key Formula",
      "deleted": false
    }
  ]
}
```

### Get Sync Status

Get synchronization status for a device.

**Endpoint**: `GET /api/sync/:userId/:deviceId/status`

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "deviceId": "device-456",
    "lastSync": "2024-01-15T10:00:00Z",
    "pendingItems": 0,
    "conflicts": 0,
    "status": "synced"
  }
}
```

### Full Sync

Perform a full synchronization operation.

**Endpoint**: `POST /api/sync/full`

**Request Body**:
```json
{
  "userId": "user-123",
  "syncRequest": {
    "deviceId": "device-456",
    "lastSyncTimestamp": "2024-01-15T09:00:00Z",
    "operations": [
      {
        "operationType": "update",
        "entityType": "progress",
        "entityId": "lesson-1",
        "data": { "progress": 75 },
        "timestamp": "2024-01-15T10:00:00Z"
      }
    ]
  }
}
```

---

## Download Management API

### Request Download

Request a video or document download for offline access.

**Endpoint**: `POST /api/downloads/request`

**Request Body**:
```json
{
  "userId": "user-123",
  "deviceId": "device-456",
  "contentType": "video",
  "contentId": "video-789",
  "courseId": "course-1",
  "quality": "720p",
  "wifiOnly": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "download-1",
    "userId": "user-123",
    "deviceId": "device-456",
    "contentType": "video",
    "contentId": "video-789",
    "courseId": "course-1",
    "quality": "720p",
    "status": "queued",
    "progress": 0,
    "fileSize": 524288000,
    "downloadUrl": "https://cdn.example.com/video-789/720p/download",
    "wifiOnly": true,
    "expiresAt": "2024-02-15T10:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Get Downloads

Get list of downloads for a device.

**Endpoint**: `GET /api/downloads/:userId/:deviceId/list`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "download-1",
      "contentType": "video",
      "contentTitle": "Introduction to Neural Networks",
      "courseTitle": "AI Fundamentals",
      "status": "downloading",
      "progress": 45,
      "fileSize": 524288000,
      "downloadedBytes": 235929600
    }
  ]
}
```

### Update Download Progress

Update download progress (called by mobile client during download).

**Endpoint**: `PUT /api/downloads/:downloadId/progress`

**Request Body**:
```json
{
  "progress": 75,
  "downloadedBytes": 393216000
}
```

### Pause Download

Pause an active download.

**Endpoint**: `PUT /api/downloads/:downloadId/pause`

### Resume Download

Resume a paused download.

**Endpoint**: `PUT /api/downloads/:downloadId/resume`

### Delete Download

Delete a download and free up storage.

**Endpoint**: `DELETE /api/downloads/:downloadId`

### Get Offline Content

Get list of downloaded content available offline.

**Endpoint**: `GET /api/downloads/:userId/:deviceId/offline`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "offline-1",
      "contentType": "video",
      "contentTitle": "Neural Networks Basics",
      "courseTitle": "AI Fundamentals",
      "fileSize": 524288000,
      "quality": "720p",
      "downloadedAt": "2024-01-15T10:00:00Z",
      "expiresAt": "2024-02-15T10:00:00Z"
    }
  ]
}
```

### Get Storage Info

Get device storage information.

**Endpoint**: `GET /api/downloads/:userId/:deviceId/storage`

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "deviceId": "device-456",
    "totalSize": 10737418240,
    "usedSize": 2147483648,
    "availableSize": 8589934592,
    "downloads": [
      {
        "contentId": "video-1",
        "contentType": "video",
        "size": 524288000,
        "downloadedAt": "2024-01-15T10:00:00Z",
        "expiresAt": "2024-02-15T10:00:00Z"
      }
    ]
  }
}
```

---

## Push Notifications API

### Register Device

Register a device for push notifications.

**Endpoint**: `POST /api/notifications/register`

**Request Body**:
```json
{
  "userId": "user-123",
  "deviceId": "device-456",
  "deviceToken": "fcm-token-xyz",
  "platform": "android",
  "deviceInfo": {
    "deviceName": "Samsung Galaxy S21",
    "osVersion": "Android 13",
    "appVersion": "1.2.0"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "deviceId": "device-456",
    "deviceToken": "fcm-token-xyz",
    "platform": "android",
    "registeredAt": "2024-01-15T10:00:00Z",
    "success": true
  }
}
```

### Unregister Device

Unregister a device from push notifications.

**Endpoint**: `POST /api/notifications/unregister`

**Request Body**:
```json
{
  "userId": "user-123",
  "deviceId": "device-456"
}
```

### Send Notification

Send a push notification to a user.

**Endpoint**: `POST /api/notifications/send`

**Request Body**:
```json
{
  "userId": "user-123",
  "notification": {
    "title": "New Lesson Available",
    "body": "Check out the new lesson on Neural Networks",
    "data": {
      "lessonId": "lesson-123",
      "courseId": "course-1"
    },
    "imageUrl": "https://cdn.example.com/lesson-thumb.jpg",
    "actionUrl": "/lessons/lesson-123",
    "category": "course_update",
    "priority": "normal"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "notif-1",
    "userId": "user-123",
    "title": "New Lesson Available",
    "status": "sent",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Send Bulk Notifications

Send notifications to multiple users.

**Endpoint**: `POST /api/notifications/send-bulk`

**Request Body**:
```json
{
  "userIds": ["user-123", "user-456", "user-789"],
  "notification": {
    "title": "Live Session Starting Soon",
    "body": "Join the live Q&A session in 15 minutes",
    "category": "live_session",
    "priority": "high"
  }
}
```

### Get Notification Preferences

Get user's notification preferences for a device.

**Endpoint**: `GET /api/notifications/:userId/:deviceId/preferences`

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "deviceId": "device-456",
    "categories": ["course_update", "assignment", "live_session", "achievement"],
    "enabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "timezone": "Asia/Kolkata"
  }
}
```

### Update Notification Preferences

Update notification preferences.

**Endpoint**: `PUT /api/notifications/:userId/:deviceId/preferences`

**Request Body**:
```json
{
  "categories": ["course_update", "live_session"],
  "enabled": true,
  "quietHoursStart": "23:00",
  "quietHoursEnd": "07:00",
  "timezone": "Asia/Kolkata"
}
```

### Track Notification Opened

Track when a user opens a notification.

**Endpoint**: `POST /api/notifications/:notificationId/opened`

### Get Notification History

Get notification history for a user.

**Endpoint**: `GET /api/notifications/:userId/history?limit=50`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-1",
      "title": "New Lesson Available",
      "body": "Check out the new lesson",
      "category": "course_update",
      "sentAt": "2024-01-15T10:00:00Z",
      "deliveryStats": {
        "sent": 1,
        "delivered": 1,
        "failed": 0,
        "opened": 1
      }
    }
  ]
}
```

---

## Mobile Analytics API

### Track Event

Track a mobile analytics event.

**Endpoint**: `POST /api/analytics/track`

**Request Body**:
```json
{
  "userId": "user-123",
  "event": "video_watched",
  "data": {
    "videoId": "video-123",
    "duration": 1800,
    "completionRate": 0.75,
    "quality": "720p"
  }
}
```

### Get Usage Stats

Get mobile usage statistics for a user.

**Endpoint**: `GET /api/analytics/:userId/usage`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalSessions": 45,
    "totalDuration": 86400,
    "averageSessionDuration": 1920,
    "screenViews": 320,
    "interactions": 1250,
    "errors": 5,
    "lastActive": "2024-01-15T10:00:00Z"
  }
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common Error Codes**:
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data
- `DOWNLOAD_LIMIT_EXCEEDED`: Too many downloads
- `SYNC_CONFLICT`: Synchronization conflict detected
- `DEVICE_NOT_REGISTERED`: Device not registered for notifications

---

## Rate Limiting

- **Default**: 200 requests per 15 minutes per IP
- **Download requests**: 10 per hour per user
- **Notification sends**: 100 per hour per user

---

## Mobile-Specific Features

### Field Selection

Reduce bandwidth by selecting only needed fields:

```
GET /api/content/courses?fields=id,title,thumbnail,progress
```

### Response Compression

Enable gzip/brotli compression:

```
GET /api/content/courses?compress=true
```

### Batch Requests

Combine multiple requests (future feature):

```
POST /api/batch
{
  "requests": [
    { "method": "GET", "url": "/api/content/courses" },
    { "method": "GET", "url": "/api/sync/status" }
  ]
}
```

### Offline-First Design

- All sync endpoints support conflict resolution
- Downloads expire after 30 days
- Progress syncs automatically when online
- Queued operations retry automatically

---

## Firebase Configuration

To enable push notifications, set the following environment variable:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"..."}'
```

---

## Testing

Use the provided Postman collection or curl commands:

```bash
# Register device
curl -X POST http://localhost:3012/api/notifications/register \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","deviceId":"device-456","deviceToken":"fcm-token","platform":"android"}'

# Request download
curl -X POST http://localhost:3012/api/downloads/request \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","deviceId":"device-456","contentType":"video","contentId":"video-1","courseId":"course-1","quality":"720p"}'
```

---

## Support

For issues or questions, contact the development team or refer to the main documentation.
