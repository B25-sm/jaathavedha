# Mobile Learning Features Developer Guide

## Quick Start

This guide provides a quick reference for using the mobile learning features implemented in Task 26.2.

---

## 1. Video Player with Gesture Controls

### Recording Gestures

```javascript
// Record a gesture interaction
POST /api/video-player/gesture

{
  "videoId": "video-uuid",
  "gestureType": "swipe_right",  // swipe_up, swipe_down, swipe_left, swipe_right, double_tap, pinch, long_press
  "action": "seek_forward",       // volume_up, volume_down, seek_forward, seek_backward, play_pause, zoom, speed_control
  "position": 120,                // Current video position in seconds
  "metadata": {
    "sensitivity": "medium"
  }
}
```

### Saving Player State

```javascript
// Save player state for resume playback
POST /api/video-player/state

{
  "videoId": "video-uuid",
  "deviceId": "device-123",
  "position": 150,              // Current position in seconds
  "duration": 600,              // Total video duration
  "playbackSpeed": 1.5,         // 0.5 to 2.0
  "volume": 0.8,                // 0.0 to 1.0
  "quality": "auto",            // auto, 240p, 480p, 720p, 1080p
  "isPlaying": true,
  "isFullscreen": false,
  "brightness": 0.7             // Optional, 0.0 to 1.0
}
```

### Getting Player State

```javascript
// Retrieve saved player state
GET /api/video-player/state/:videoId/:deviceId

Response:
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "videoId": "video-uuid",
    "deviceId": "device-123",
    "position": 150,
    "duration": 600,
    "playbackSpeed": 1.5,
    "volume": 0.8,
    "quality": "auto",
    "isPlaying": true,
    "isFullscreen": false,
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Gesture Settings

```javascript
// Get gesture control settings
GET /api/video-player/gesture-settings/:deviceId

// Update gesture settings
PUT /api/video-player/gesture-settings/:deviceId

{
  "swipeEnabled": true,
  "doubleTapEnabled": true,
  "volumeGestureEnabled": true,
  "brightnessGestureEnabled": true,
  "seekGestureSensitivity": "medium",  // low, medium, high
  "customGestures": []
}
```

---

## 2. Voice-to-Text Note-Taking

### Creating Voice Notes

```javascript
// Create voice note with automatic transcription
POST /api/voice-notes/transcribe

{
  "audioData": "base64-encoded-audio-data",
  "audioFormat": "mp3",         // mp3, wav, m4a
  "language": "en",             // en, es, fr, de, etc.
  "courseId": "course-uuid",
  "lessonId": "lesson-uuid",
  "videoId": "video-uuid",      // Optional
  "videoPosition": 180          // Optional, seconds
}

Response:
{
  "success": true,
  "data": {
    "transcription": "This is the transcribed text",
    "confidence": 0.95,
    "language": "en",
    "duration": 10,
    "alternatives": [
      { "text": "Alternative 1", "confidence": 0.85 }
    ],
    "noteId": "note-uuid"
  }
}
```

### Creating Text Notes

```javascript
// Create text note
POST /api/voice-notes/text

{
  "courseId": "course-uuid",
  "lessonId": "lesson-uuid",
  "videoId": "video-uuid",      // Optional
  "videoPosition": 180,         // Optional
  "content": "This is my note",
  "noteType": "text",           // text, voice, mixed
  "tags": ["important", "review"],
  "isBookmarked": true
}
```

### Retrieving Notes

```javascript
// Get voice notes
GET /api/voice-notes?courseId=course-uuid&lessonId=lesson-uuid

// Get text notes
GET /api/voice-notes/text?courseId=course-uuid&videoId=video-uuid

// Search notes
GET /api/voice-notes/search?query=keyword&courseId=course-uuid
```

### Updating and Deleting Notes

```javascript
// Update text note
PUT /api/voice-notes/text/:noteId

{
  "content": "Updated content",
  "tags": ["updated", "important"],
  "isBookmarked": false
}

// Delete note
DELETE /api/voice-notes/:noteType/:noteId
// noteType: 'text' or 'voice'
```

### Syncing Notes

```javascript
// Sync notes across devices
POST /api/voice-notes/sync

{
  "lastSyncTimestamp": "2024-01-15T10:00:00Z"
}

Response:
{
  "success": true,
  "data": {
    "textNotes": [...],
    "voiceNotes": [...]
  }
}
```

---

## 3. Camera Assignment Submission

### Uploading Camera Captures

```javascript
// Upload photo/video from camera
POST /api/assignments/camera/upload

{
  "assignmentId": "assignment-uuid",
  "courseId": "course-uuid",
  "captureType": "photo",       // photo, video, scan
  "fileData": "base64-encoded-file",
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg",
  "metadata": {
    "width": 1920,
    "height": 1080,
    "duration": 30              // For videos
  }
}

Response:
{
  "success": true,
  "data": {
    "id": "capture-uuid",
    "fileUrl": "https://s3.../photo.jpg",
    "thumbnailUrl": "https://s3.../thumb.jpg",
    "processingStatus": "completed"
  }
}
```

### Creating Assignment Submission

```javascript
// Create submission (draft)
POST /api/assignments/submit

{
  "assignmentId": "assignment-uuid",
  "courseId": "course-uuid",
  "submissionType": "camera",   // camera, gallery, document, text, mixed
  "captureIds": ["capture-uuid-1", "capture-uuid-2"],
  "textContent": "Optional text explanation"
}

Response:
{
  "success": true,
  "data": {
    "id": "submission-uuid",
    "status": "draft",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Finalizing Submission

```javascript
// Submit assignment (finalize draft)
POST /api/assignments/:submissionId/finalize

Response:
{
  "success": true,
  "data": {
    "id": "submission-uuid",
    "status": "submitted",
    "submittedAt": "2024-01-15T10:35:00Z"
  },
  "message": "Assignment submitted successfully"
}
```

### Retrieving Submissions

```javascript
// Get user submissions
GET /api/assignments/submissions?courseId=course-uuid&status=submitted

// Get submission details
GET /api/assignments/submissions/:submissionId

Response:
{
  "success": true,
  "data": {
    "submission": {
      "id": "submission-uuid",
      "status": "submitted",
      "grade": 95,
      "feedback": "Great work!"
    },
    "captures": [
      {
        "id": "capture-uuid",
        "fileUrl": "https://...",
        "thumbnailUrl": "https://..."
      }
    ]
  }
}
```

### Managing Captures

```javascript
// Get pending captures (not yet submitted)
GET /api/assignments/camera/pending?assignmentId=assignment-uuid

// Delete capture
DELETE /api/assignments/camera/:captureId
```

---

## 4. Social Learning Features

### Study Groups

```javascript
// Create study group
POST /api/social/groups

{
  "name": "React Study Group",
  "description": "Learning React together",
  "courseId": "course-uuid",
  "maxMembers": 50,
  "isPrivate": false,
  "tags": ["react", "javascript"]
}

// Join study group
POST /api/social/groups/join

{
  "groupId": "group-uuid",
  "inviteCode": "ABC123"       // Required for private groups
}

// Get user's study groups
GET /api/social/groups?courseId=course-uuid

// Search study groups
GET /api/social/groups/search?courseId=course-uuid&query=react&tags=javascript
```

### Peer Chat

```javascript
// Send chat message
POST /api/social/chat/send

{
  "groupId": "group-uuid",      // For group chat
  "recipientId": "user-uuid",   // For direct message
  "messageType": "text",        // text, voice, image, video, file, link
  "content": "Hello everyone!",
  "attachmentUrl": "https://...", // Optional
  "replyToId": "message-uuid"   // Optional, for threading
}

// Get chat messages
GET /api/social/chat/messages?groupId=group-uuid&limit=50&offset=0

// Mark messages as read
POST /api/social/chat/read

{
  "messageIds": ["msg-uuid-1", "msg-uuid-2"]
}
```

### Help Requests

```javascript
// Create help request
POST /api/social/help

{
  "courseId": "course-uuid",
  "lessonId": "lesson-uuid",
  "title": "Need help with React hooks",
  "description": "I'm confused about useEffect dependencies",
  "tags": ["react", "hooks"],
  "priority": "medium"          // low, medium, high
}

// Get help requests
GET /api/social/help?courseId=course-uuid&status=open

// Respond to help request
POST /api/social/help/:requestId/respond

{
  "content": "Here's how useEffect works..."
}
```

### Resource Sharing

```javascript
// Share resource
POST /api/social/resources/share

{
  "groupId": "group-uuid",      // Optional
  "courseId": "course-uuid",
  "lessonId": "lesson-uuid",    // Optional
  "resourceType": "link",       // note, link, file, video, article
  "title": "Great React Tutorial",
  "description": "Comprehensive guide to React hooks",
  "resourceUrl": "https://...",
  "fileData": "base64...",      // Optional, for file uploads
  "tags": ["react", "tutorial"]
}

// Get shared resources
GET /api/social/resources?courseId=course-uuid&groupId=group-uuid&resourceType=link
```

### Study Sessions

```javascript
// Schedule study session
POST /api/social/sessions/schedule

{
  "groupId": "group-uuid",      // Optional
  "title": "React Hooks Study Session",
  "description": "Let's learn hooks together",
  "courseId": "course-uuid",
  "lessonId": "lesson-uuid",    // Optional
  "scheduledAt": "2024-01-20T15:00:00Z",
  "duration": 60,               // Minutes
  "participantIds": ["user-uuid-1", "user-uuid-2"]
}

// Get study sessions
GET /api/social/sessions?groupId=group-uuid&status=scheduled
```

### Peer Recommendations

```javascript
// Get peer recommendations
GET /api/social/recommendations?courseId=course-uuid

Response:
{
  "success": true,
  "data": [
    {
      "userId": "current-user-uuid",
      "recommendedPeerId": "peer-uuid",
      "reason": "similar_progress",
      "score": 0.85,
      "commonCourses": ["course-uuid-1", "course-uuid-2"]
    }
  ]
}
```

---

## Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': 'Bearer <jwt-token>',
  'x-device-id': 'device-unique-id',
  'Content-Type': 'application/json'
}
```

---

## Error Handling

All endpoints return a consistent error format:

```javascript
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

- **Default limit**: 200 requests per 15 minutes per IP
- **Mobile-optimized**: Higher limits for mobile devices
- **Batch requests**: Use batch endpoints when available

---

## Best Practices

### Video Player
1. Save player state every 10-30 seconds
2. Sync state when switching devices
3. Use gesture analytics to improve UX
4. Cache player settings locally

### Voice Notes
1. Compress audio before upload
2. Use appropriate audio format (mp3 recommended)
3. Implement offline queue for poor connectivity
4. Sync notes periodically

### Camera Assignment
1. Compress images before upload (use Sharp or similar)
2. Generate thumbnails on client side
3. Save drafts frequently
4. Validate file size and format

### Social Learning
1. Implement real-time updates with WebSocket/SSE
2. Cache frequently accessed data
3. Paginate chat messages
4. Use optimistic UI updates

---

## Testing

Run the integration test:

```bash
cd backend/services/mobile-api
npm install axios
node test-mobile-learning-features.js
```

---

## Support

For issues or questions:
- Check API documentation: `API_REFERENCE.md`
- Review completion report: `TASK_26.2_COMPLETION_REPORT.md`
- Contact: backend-team@saimahendra.com
