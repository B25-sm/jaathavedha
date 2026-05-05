# Interactive Virtual Classroom Features API Reference

## Overview

This document describes the REST API and WebSocket events for interactive features in the live streaming virtual classroom system.

## Base URL

```
http://localhost:3011/api/interactive
```

## Authentication

All endpoints require JWT authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

---

## Chat Features

### Send Chat Message

Send a message to the session chat.

**Endpoint:** `POST /:sessionId/chat`

**Request Body:**
```json
{
  "message": "Hello everyone!",
  "messageType": "text",
  "moderationEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sessionId": "uuid",
    "userId": "uuid",
    "userName": "John Doe",
    "message": "Hello everyone!",
    "messageType": "text",
    "isPinned": false,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**WebSocket Event:** `chat:message`

---

### Get Chat History

Retrieve chat message history.

**Endpoint:** `GET /:sessionId/chat?limit=100&before=2024-01-15T10:00:00Z`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "message": "Hello!",
      "userName": "John Doe",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### Delete Chat Message

Delete a chat message (instructor/admin only).

**Endpoint:** `DELETE /:sessionId/chat/:messageId`

**Response:**
```json
{
  "success": true,
  "message": "Chat message deleted"
}
```

**WebSocket Event:** `chat:deleted`

---

### Pin Chat Message

Pin an important message (instructor/admin only).

**Endpoint:** `POST /:sessionId/chat/:messageId/pin`

**Response:**
```json
{
  "success": true,
  "message": "Chat message pinned"
}
```

**WebSocket Event:** `chat:pinned`

---

## Q&A Features

### Ask Question

Submit a question during the live session.

**Endpoint:** `POST /:sessionId/qa`

**Request Body:**
```json
{
  "question": "Can you explain the concept again?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sessionId": "uuid",
    "userId": "uuid",
    "userName": "Jane Smith",
    "question": "Can you explain the concept again?",
    "upvotes": 0,
    "isAnswered": false,
    "timestamp": "2024-01-15T10:35:00Z"
  }
}
```

**WebSocket Event:** `qa:question`

---

### Answer Question

Answer a student's question (instructor only).

**Endpoint:** `POST /:sessionId/qa/:questionId/answer`

**Request Body:**
```json
{
  "answer": "Sure! Let me explain it in a different way..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "question": "Can you explain the concept again?",
    "answer": "Sure! Let me explain it in a different way...",
    "answeredBy": "Instructor Name",
    "answeredAt": "2024-01-15T10:36:00Z",
    "isAnswered": true
  }
}
```

**WebSocket Event:** `qa:answered`

---

### Upvote Question

Upvote a question to show it's important.

**Endpoint:** `POST /:sessionId/qa/:questionId/upvote`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "question": "Can you explain the concept again?",
    "upvotes": 5
  }
}
```

**WebSocket Event:** `qa:upvoted`

---

### Get Questions

Retrieve all questions with optional filtering.

**Endpoint:** `GET /:sessionId/qa?filter=unanswered`

**Query Parameters:**
- `filter`: `all`, `answered`, `unanswered`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "question": "Can you explain the concept again?",
      "upvotes": 5,
      "isAnswered": false
    }
  ]
}
```

---

## Poll Features

### Create Poll

Create an interactive poll (instructor only).

**Endpoint:** `POST /:sessionId/polls`

**Request Body:**
```json
{
  "question": "Do you understand the concept?",
  "options": ["Yes, completely", "Somewhat", "No, need more explanation"],
  "pollType": "multiple_choice",
  "isAnonymous": true,
  "allowMultiple": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sessionId": "uuid",
    "question": "Do you understand the concept?",
    "options": [
      {
        "id": "uuid",
        "text": "Yes, completely",
        "votes": 0,
        "percentage": 0
      }
    ],
    "pollType": "multiple_choice",
    "isActive": true,
    "totalVotes": 0
  }
}
```

**WebSocket Event:** `poll:created`

---

### Vote on Poll

Submit a vote for a poll.

**Endpoint:** `POST /:sessionId/polls/:pollId/vote`

**Request Body:**
```json
{
  "optionIds": ["uuid"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "options": [
      {
        "id": "uuid",
        "text": "Yes, completely",
        "votes": 15,
        "percentage": 60
      }
    ],
    "totalVotes": 25
  }
}
```

**WebSocket Event:** `poll:updated`

---

### Close Poll

Close a poll and finalize results (instructor only).

**Endpoint:** `POST /:sessionId/polls/:pollId/close`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isActive": false,
    "closedAt": "2024-01-15T10:45:00Z"
  }
}
```

**WebSocket Event:** `poll:closed`

---

### Get Polls

Retrieve all polls for a session.

**Endpoint:** `GET /:sessionId/polls`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "question": "Do you understand the concept?",
      "isActive": false,
      "totalVotes": 25
    }
  ]
}
```

---

## Survey Features

### Create Survey

Create a pre/mid/post session survey (instructor only).

**Endpoint:** `POST /:sessionId/surveys`

**Request Body:**
```json
{
  "title": "Post-Session Feedback",
  "description": "Please share your feedback",
  "surveyType": "post_session",
  "questions": [
    {
      "id": "q1",
      "text": "How would you rate this session?",
      "type": "rating",
      "required": true
    },
    {
      "id": "q2",
      "text": "What did you learn today?",
      "type": "text",
      "required": false
    }
  ],
  "isAnonymous": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Post-Session Feedback",
    "surveyType": "post_session",
    "isActive": true
  }
}
```

**WebSocket Event:** `survey:created`

---

### Submit Survey Response

Submit responses to a survey.

**Endpoint:** `POST /:sessionId/surveys/:surveyId/respond`

**Request Body:**
```json
{
  "responses": [
    {
      "questionId": "q1",
      "answer": 5
    },
    {
      "questionId": "q2",
      "answer": "I learned about WebRTC and real-time communication"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "surveyId": "uuid",
    "submittedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### Get Survey Results

Get aggregated survey results (instructor only).

**Endpoint:** `GET /:sessionId/surveys/:surveyId/results`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Post-Session Feedback",
    "totalResponses": 45,
    "responses": [...]
  }
}
```

---

## Hand Raise Features

### Raise Hand

Request to speak during the session.

**Endpoint:** `POST /:sessionId/hand-raise`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "userName": "Student Name",
    "queuePosition": 3,
    "status": "pending",
    "raisedAt": "2024-01-15T10:40:00Z"
  }
}
```

**WebSocket Event:** `hand:raised`

---

### Lower Hand

Cancel speaking request.

**Endpoint:** `DELETE /:sessionId/hand-raise`

**Response:**
```json
{
  "success": true,
  "message": "Hand lowered"
}
```

**WebSocket Event:** `hand:lowered`

---

### Handle Hand Raise

Accept or decline a speaking request (instructor only).

**Endpoint:** `POST /:sessionId/hand-raise/:userId/handle`

**Request Body:**
```json
{
  "action": "accept"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "status": "accepted",
    "acceptedAt": "2024-01-15T10:41:00Z"
  }
}
```

**WebSocket Events:** `hand:accepted` or `hand:declined`

---

### Get Hand Raise Queue

Get the current queue of raised hands (instructor only).

**Endpoint:** `GET /:sessionId/hand-raise`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userName": "Student Name",
      "queuePosition": 1,
      "raisedAt": "2024-01-15T10:40:00Z"
    }
  ]
}
```

---

## Screen Sharing Features

### Start Screen Sharing

Start sharing screen/window/tab.

**Endpoint:** `POST /:sessionId/screen-share`

**Request Body:**
```json
{
  "shareType": "screen"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "shareType": "screen",
    "startedAt": "2024-01-15T10:45:00Z",
    "isActive": true
  }
}
```

**WebSocket Event:** `screen:started`

---

### Stop Screen Sharing

Stop sharing screen.

**Endpoint:** `DELETE /:sessionId/screen-share`

**Response:**
```json
{
  "success": true,
  "message": "Screen sharing stopped"
}
```

**WebSocket Event:** `screen:stopped`

---

## Presentation Features

### Upload Presentation

Upload a presentation file (PDF/PPTX).

**Endpoint:** `POST /:sessionId/presentations`

**Request Body:**
```json
{
  "title": "Introduction to WebRTC",
  "fileUrl": "https://cdn.example.com/presentations/webrtc-intro.pdf",
  "fileType": "pdf",
  "totalSlides": 25
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Introduction to WebRTC",
    "totalSlides": 25,
    "currentSlide": 1,
    "isActive": false
  }
}
```

**WebSocket Event:** `presentation:uploaded`

---

### Update Presentation Slide

Navigate to a different slide.

**Endpoint:** `PUT /:sessionId/presentations/:presentationId/slide`

**Request Body:**
```json
{
  "slideNumber": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "currentSlide": 5
  }
}
```

**WebSocket Event:** `presentation:slide-changed`

---

## Participant Management

### Manage Participant

Mute, remove, ban, or promote participants (instructor only).

**Endpoint:** `POST /:sessionId/participants/:userId/manage`

**Request Body:**
```json
{
  "action": "mute",
  "reason": "Disruptive behavior"
}
```

**Actions:** `mute`, `unmute`, `remove`, `ban`, `promote`, `demote`

**Response:**
```json
{
  "success": true,
  "message": "Participant mute successful"
}
```

**WebSocket Event:** `participant:action`

---

## Real-Time Reactions

### Send Reaction

Send a real-time reaction/feedback.

**Endpoint:** `POST /:sessionId/reactions`

**Request Body:**
```json
{
  "reactionType": "thumbs_up"
}
```

**Reaction Types:** `thumbs_up`, `thumbs_down`, `clap`, `confused`, `slow_down`, `speed_up`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "reactionType": "thumbs_up",
    "timestamp": "2024-01-15T10:50:00Z"
  }
}
```

**WebSocket Event:** `reaction:sent`

---

## WebSocket Events

### Connection

```javascript
const socket = io('http://localhost:3011', {
  auth: {
    token: 'jwt_token'
  }
});
```

### Join Session

```javascript
socket.emit('join-session', {
  sessionId: 'uuid',
  userId: 'uuid',
  userName: 'John Doe',
  role: 'student'
});
```

### Listen for Events

```javascript
// Chat events
socket.on('chat:message', (message) => {
  console.log('New message:', message);
});

// Q&A events
socket.on('qa:question', (question) => {
  console.log('New question:', question);
});

// Poll events
socket.on('poll:created', (poll) => {
  console.log('New poll:', poll);
});

// Hand raise events
socket.on('hand:raised', (handRaise) => {
  console.log('Hand raised:', handRaise);
});

// Screen sharing events
socket.on('screen:started', (data) => {
  console.log('Screen sharing started:', data);
});

// Participant events
socket.on('user-joined', (user) => {
  console.log('User joined:', user);
});

socket.on('user-left', (user) => {
  console.log('User left:', user);
});
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    {
      "field": "message",
      "message": "Message must be between 1 and 1000 characters"
    }
  ]
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

All endpoints are rate-limited to prevent abuse:
- **Chat messages:** 10 per minute per user
- **Polls/Surveys:** 5 per hour per instructor
- **Hand raises:** 3 per 5 minutes per user
- **Reactions:** 20 per minute per user

---

## Best Practices

1. **Always authenticate** - Include JWT token in all requests
2. **Handle WebSocket reconnection** - Implement exponential backoff
3. **Validate input** - Check data before sending to API
4. **Handle errors gracefully** - Show user-friendly error messages
5. **Optimize polling** - Use WebSocket events instead of polling
6. **Respect rate limits** - Implement client-side throttling
7. **Clean up on disconnect** - Remove event listeners properly

---

## Example Client Implementation

```javascript
class VirtualClassroom {
  constructor(sessionId, token) {
    this.sessionId = sessionId;
    this.token = token;
    this.socket = null;
    this.initSocket();
  }

  initSocket() {
    this.socket = io('http://localhost:3011', {
      auth: { token: this.token }
    });

    this.socket.on('connect', () => {
      this.joinSession();
    });

    this.socket.on('chat:message', this.handleChatMessage.bind(this));
    this.socket.on('poll:created', this.handlePollCreated.bind(this));
    this.socket.on('hand:raised', this.handleHandRaised.bind(this));
  }

  joinSession() {
    this.socket.emit('join-session', {
      sessionId: this.sessionId,
      userId: this.userId,
      userName: this.userName,
      role: this.role
    });
  }

  async sendChatMessage(message) {
    const response = await fetch(
      `http://localhost:3011/api/interactive/${this.sessionId}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ message })
      }
    );
    return response.json();
  }

  handleChatMessage(message) {
    // Update UI with new message
    console.log('New message:', message);
  }

  handlePollCreated(poll) {
    // Show poll to user
    console.log('New poll:', poll);
  }

  handleHandRaised(handRaise) {
    // Update hand raise queue
    console.log('Hand raised:', handRaise);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
```

---

## Support

For issues or questions, contact the development team or refer to the main API documentation.
