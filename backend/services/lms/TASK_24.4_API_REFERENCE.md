# Task 24.4: Assessment and Feedback System - API Reference

## Overview

This document provides comprehensive API documentation for the assessment and feedback system, including immediate feedback, adaptive learning paths, and detailed analytics.

## Base URL

```
http://localhost:3010/api/assessments
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

---

## Assessment Management

### Create Assessment

Create a new assessment with questions and configuration.

**Endpoint:** `POST /api/assessments`

**Request Body:**
```json
{
  "courseId": "uuid",
  "title": "JavaScript Fundamentals Quiz",
  "description": "Test your knowledge of JavaScript basics",
  "type": "quiz",
  "duration": 1800,
  "passingScore": 70,
  "questions": [
    {
      "type": "multiple-choice",
      "question": "What is JavaScript?",
      "options": ["A programming language", "A coffee brand", "A framework"],
      "correctAnswer": "A programming language",
      "explanation": "JavaScript is a high-level programming language",
      "points": 10,
      "difficulty": "easy",
      "tags": ["basics", "introduction"]
    }
  ],
  "randomizeQuestions": false,
  "randomizeOptions": false,
  "showFeedback": true,
  "allowRetake": true,
  "maxAttempts": 3
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "courseId": "uuid",
    "title": "JavaScript Fundamentals Quiz",
    "questions": [...],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### Get Assessment by ID

Retrieve assessment details. Students see questions without answers, instructors/admins can see answers.

**Endpoint:** `GET /api/assessments/:assessmentId`

**Query Parameters:**
- `includeAnswers` (boolean, optional): Include correct answers (admin/instructor only)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "JavaScript Fundamentals Quiz",
    "description": "Test your knowledge...",
    "type": "quiz",
    "duration": 1800,
    "passingScore": 70,
    "questions": [
      {
        "id": "q1",
        "type": "multiple-choice",
        "question": "What is JavaScript?",
        "options": ["A programming language", "A coffee brand", "A framework"],
        "points": 10
      }
    ]
  }
}
```

---

### Get Assessments by Course

List all assessments for a specific course.

**Endpoint:** `GET /api/assessments/course/:courseId`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "JavaScript Fundamentals Quiz",
      "type": "quiz",
      "duration": 1800,
      "passingScore": 70,
      "allowRetake": true,
      "maxAttempts": 3,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Assessment Attempts

### Start Assessment Attempt

Begin a new assessment attempt. Returns randomized questions if configured.

**Endpoint:** `POST /api/assessments/:assessmentId/start`

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "attemptId": "uuid",
    "assessment": {
      "id": "uuid",
      "title": "JavaScript Fundamentals Quiz",
      "duration": 1800,
      "questions": [...]
    },
    "attemptNumber": 1,
    "startedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `403 Forbidden`: Maximum attempts exceeded or retakes not allowed
- `404 Not Found`: Assessment not found

---

### Submit Assessment Attempt

Submit answers and receive immediate feedback with grading.

**Endpoint:** `POST /api/assessments/attempts/:attemptId/submit`

**Request Body:**
```json
{
  "answers": {
    "q1": "A programming language",
    "q2": "true",
    "q3": ["option1", "option2"]
  },
  "timeSpent": 1200
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "attemptId": "uuid",
    "score": 85,
    "totalPoints": 100,
    "percentage": 85,
    "passed": true,
    "passingScore": 70,
    "completedAt": "2024-01-01T00:20:00Z",
    "feedback": [
      {
        "questionId": "q1",
        "question": "What is JavaScript?",
        "userAnswer": "A programming language",
        "correctAnswer": "A programming language",
        "isCorrect": true,
        "explanation": "JavaScript is a high-level programming language",
        "points": 10,
        "earnedPoints": 10
      },
      {
        "questionId": "q2",
        "question": "Is JavaScript compiled?",
        "userAnswer": "false",
        "correctAnswer": "true",
        "isCorrect": false,
        "explanation": "JavaScript is typically interpreted but modern engines use JIT compilation",
        "points": 10,
        "earnedPoints": 0
      }
    ],
    "recommendations": [
      "Great job! Review the questions you missed to achieve mastery",
      "Consider helping peers who are struggling with these topics"
    ]
  }
}
```

---

### Get User's Assessment Attempts

Retrieve all attempts for a specific assessment by the current user.

**Endpoint:** `GET /api/assessments/:assessmentId/attempts`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "assessmentId": "uuid",
      "userId": "uuid",
      "score": 85,
      "percentage": 85,
      "passed": true,
      "startedAt": "2024-01-01T00:00:00Z",
      "completedAt": "2024-01-01T00:20:00Z",
      "timeSpent": 1200,
      "attemptNumber": 1
    }
  ]
}
```

---

## Learning Analytics

### Get Learning Analytics

Retrieve detailed learning analytics for a user, including performance trends and insights.

**Endpoint:** `GET /api/assessments/analytics/me`

**Query Parameters:**
- `courseId` (uuid, optional): Filter analytics by course

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "courseId": "uuid",
    "summary": {
      "totalAttempts": 15,
      "passedAttempts": 12,
      "passRate": 80,
      "averageScore": 82,
      "totalTimeSpent": 18000,
      "averageTimePerAttempt": 1200
    },
    "byType": {
      "quiz": {
        "total": 10,
        "passed": 8,
        "averageScore": 85
      },
      "exam": {
        "total": 5,
        "passed": 4,
        "averageScore": 78
      }
    },
    "trend": "improving",
    "recentAttempts": [
      {
        "assessmentId": "uuid",
        "title": "JavaScript Advanced",
        "type": "quiz",
        "score": 90,
        "passed": true,
        "completedAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

### Get User Analytics (Admin/Instructor)

Retrieve analytics for any user (requires admin or instructor role).

**Endpoint:** `GET /api/assessments/analytics/user/:userId`

**Query Parameters:**
- `courseId` (uuid, optional): Filter analytics by course

**Response:** Same as "Get Learning Analytics"

**Error Responses:**
- `403 Forbidden`: Cannot access other users' analytics

---

## Adaptive Learning

### Get Learning Path

Retrieve personalized learning path with recommendations based on performance.

**Endpoint:** `GET /api/assessments/learning-path/:courseId`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "courseId": "uuid",
    "currentLevel": "intermediate",
    "learningStyle": "visual",
    "pace": "normal",
    "strengths": [
      "JavaScript basics",
      "Functions",
      "Arrays"
    ],
    "weaknesses": [
      "Async programming",
      "Closures"
    ],
    "completedContent": [
      "intro-video-1",
      "quiz-basics-1"
    ],
    "recommendedContent": [
      "async-tutorial",
      "closures-practice"
    ],
    "nextMilestone": "Pass intermediate certification"
  }
}
```

---

### Get Adaptive Analytics

Retrieve detailed adaptive learning analytics including learning velocity and time to mastery.

**Endpoint:** `GET /api/assessments/adaptive-analytics`

**Query Parameters:**
- `courseId` (uuid, optional): Filter analytics by course

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "courseId": "uuid",
    "strengths": [
      "JavaScript basics",
      "Functions"
    ],
    "weaknesses": [
      "Async programming",
      "Closures"
    ],
    "learningVelocity": 5.2,
    "timeToMastery": 8,
    "engagementScore": 85,
    "consistencyScore": 78,
    "recentPerformance": [
      {
        "assessmentId": "uuid",
        "score": 85,
        "passed": true,
        "timestamp": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

**Field Descriptions:**
- `learningVelocity`: Rate of improvement (points per assessment)
- `timeToMastery`: Estimated weeks to reach mastery (90%+ average)
- `engagementScore`: Activity frequency score (0-100)
- `consistencyScore`: Learning consistency score (0-100)

---

### Get Content Recommendations

Get personalized content recommendations based on learning path and performance.

**Endpoint:** `GET /api/assessments/recommendations/:courseId`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "contentId": "async-tutorial",
      "contentType": "video",
      "title": "Mastering Async JavaScript",
      "difficulty": "medium",
      "estimatedTime": 45,
      "reason": "Addresses identified weakness",
      "priority": 10
    },
    {
      "contentId": "closures-practice",
      "contentType": "practice",
      "title": "Closures Practice Problems",
      "difficulty": "medium",
      "estimatedTime": 30,
      "reason": "Addresses identified weakness",
      "priority": 9
    }
  ]
}
```

---

### Update Learning Path Preferences

Update user's learning preferences (learning style, pace, etc.).

**Endpoint:** `PUT /api/assessments/learning-path/:courseId`

**Request Body:**
```json
{
  "learningStyle": "visual",
  "pace": "fast",
  "strengths": ["JavaScript", "React"],
  "weaknesses": ["Node.js"]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Learning path preferences updated",
    "userId": "uuid",
    "courseId": "uuid",
    "preferences": {
      "learningStyle": "visual",
      "pace": "fast"
    }
  }
}
```

---

## Question Types

### Multiple Choice
Single correct answer from multiple options.

```json
{
  "type": "multiple-choice",
  "question": "What is JavaScript?",
  "options": ["A programming language", "A coffee brand", "A framework"],
  "correctAnswer": "A programming language",
  "points": 10
}
```

### Multiple Select
Multiple correct answers from options.

```json
{
  "type": "multiple-select",
  "question": "Which are JavaScript frameworks?",
  "options": ["React", "Angular", "Python", "Vue"],
  "correctAnswer": ["React", "Angular", "Vue"],
  "points": 15
}
```

### True/False
Boolean question.

```json
{
  "type": "true-false",
  "question": "JavaScript is a compiled language",
  "correctAnswer": "false",
  "points": 5
}
```

### Short Answer
Text-based answer with multiple acceptable variations.

```json
{
  "type": "short-answer",
  "question": "What does DOM stand for?",
  "correctAnswer": ["Document Object Model", "document object model"],
  "points": 10
}
```

### Essay
Long-form answer (requires manual grading).

```json
{
  "type": "essay",
  "question": "Explain the event loop in JavaScript",
  "points": 20
}
```

### Code
Code-based answer (requires manual grading).

```json
{
  "type": "code",
  "question": "Write a function to reverse a string",
  "points": 25
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Assessment must have at least one question",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "message": "Authentication required",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "type": "AUTHORIZATION_ERROR",
    "message": "Maximum attempts (3) exceeded",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "type": "NOT_FOUND",
    "message": "Assessment not found",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "type": "SYSTEM_ERROR",
    "message": "Failed to submit assessment attempt",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

---

## Rate Limiting

All endpoints are subject to rate limiting:
- **Window:** 15 minutes
- **Max Requests:** 100 per IP address

When rate limit is exceeded:
```json
{
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests from this IP, please try again later.",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

---

## Integration Examples

### Complete Assessment Flow

```javascript
// 1. Get available assessments
const assessments = await fetch('/api/assessments/course/course-123');

// 2. Start an assessment
const attempt = await fetch('/api/assessments/assessment-123/start', {
  method: 'POST'
});

// 3. Submit answers
const result = await fetch(`/api/assessments/attempts/${attempt.attemptId}/submit`, {
  method: 'POST',
  body: JSON.stringify({
    answers: {
      q1: 'answer1',
      q2: 'answer2'
    },
    timeSpent: 1200
  })
});

// 4. Get feedback and recommendations
console.log(result.feedback);
console.log(result.recommendations);

// 5. Get updated learning path
const learningPath = await fetch('/api/assessments/learning-path/course-123');
```

---

## Webhooks (Future Enhancement)

Future versions will support webhooks for:
- Assessment completion
- Milestone achievements
- Learning path updates
- Performance alerts

---

## Changelog

### Version 1.0.0 (2024-01-01)
- Initial release
- Assessment creation and management
- Immediate feedback system
- Adaptive learning paths
- Detailed analytics
- Content recommendations
