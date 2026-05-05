# Interactive Learning Management System (LMS) Service

## Overview

The LMS Service provides comprehensive interactive learning features including in-video quizzes, collaborative learning tools, gamification elements, and adaptive assessments for the Sai Mahendra educational platform.

## Features

### 1. Interactive Learning (Requirement 18.1-18.5)
- **In-Video Quizzes**: Timestamped quizzes with multiple question types
- **Timestamped Notes**: Rich text notes linked to specific video moments
- **Video Bookmarks**: Quick navigation to important video segments
- **Discussion Threads**: Video-specific discussions with upvoting and replies

### 2. Collaborative Learning (Requirement 18.6, 18.8, 18.10)
- **Forums**: Course-specific discussion forums with categories
- **Study Groups**: Peer learning groups with member management
- **Assignments**: Instructor-created assignments with submissions
- **Peer Reviews**: Student-to-student assignment reviews

### 3. Gamification (Requirement 18.7, 18.12)
- **Points System**: Earn points for various learning activities
  - Video completion: 100 points
  - Quiz completion: 50 points
  - Assignment submission: 75 points
  - Daily streak: 10 points
- **Badges**: Achievement badges with rarity levels
- **Leaderboards**: Global, course-specific, and time-based rankings
- **Learning Streaks**: Daily activity tracking with freeze capability

### 4. Assessments (Requirement 18.9, 6.4)
- **Comprehensive Assessments**: Quizzes, exams, and practice tests
- **Flashcards**: Spaced repetition learning with SM-2 algorithm
- **Adaptive Learning**: Personalized learning paths based on performance
- **Learning Analytics**: Detailed progress and engagement metrics

## Architecture

### Technology Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Databases**:
  - PostgreSQL: Structured data (quizzes, assignments, forums)
  - MongoDB: Analytics and flexible data (points, streaks, adaptive paths)
  - Redis: Session management and caching
- **Validation**: Joi schemas
- **Authentication**: JWT tokens via Redis sessions

### Project Structure
```
src/
├── index.ts                 # Application entry point
├── types/
│   └── index.ts            # TypeScript type definitions
├── middleware/
│   ├── auth.ts             # Authentication middleware
│   └── validation.ts       # Request validation middleware
├── schemas/
│   ├── interactiveSchemas.ts    # Interactive feature validation
│   ├── collaborativeSchemas.ts  # Collaborative feature validation
│   ├── gamificationSchemas.ts   # Gamification validation
│   └── assessmentSchemas.ts     # Assessment validation
├── services/
│   ├── InteractiveService.ts    # Interactive learning logic
│   ├── CollaborativeService.ts  # Collaborative learning logic
│   ├── GamificationService.ts   # Gamification logic
│   └── AssessmentService.ts     # Assessment logic
└── routes/
    ├── interactive.ts      # Interactive feature endpoints
    ├── collaborative.ts    # Collaborative feature endpoints
    ├── gamification.ts     # Gamification endpoints
    ├── assessments.ts      # Assessment endpoints
    └── health.ts           # Health check endpoint
```

## API Endpoints

### Interactive Learning

#### In-Video Quizzes
- `POST /api/interactive/videos/:videoId/quizzes` - Create quiz
- `GET /api/interactive/videos/:videoId/quizzes` - Get video quizzes
- `POST /api/interactive/quizzes/:quizId/attempt` - Submit quiz attempt

#### Video Notes
- `POST /api/interactive/videos/:videoId/notes` - Create note
- `GET /api/interactive/videos/:videoId/notes` - Get user notes
- `PUT /api/interactive/notes/:noteId` - Update note
- `DELETE /api/interactive/notes/:noteId` - Delete note

#### Video Bookmarks
- `POST /api/interactive/videos/:videoId/bookmarks` - Create bookmark
- `GET /api/interactive/videos/:videoId/bookmarks` - Get user bookmarks

#### Video Comments
- `POST /api/interactive/videos/:videoId/comments` - Create comment
- `GET /api/interactive/videos/:videoId/comments` - Get video comments
- `POST /api/interactive/comments/:commentId/reply` - Reply to comment
- `POST /api/interactive/comments/:commentId/vote` - Vote on comment

### Collaborative Learning

#### Forums
- `POST /api/collaborative/forums` - Create forum (instructor/admin)
- `GET /api/collaborative/courses/:courseId/forums` - Get course forums
- `POST /api/collaborative/forums/:forumId/posts` - Create post
- `GET /api/collaborative/forums/:forumId/posts` - Get forum posts
- `POST /api/collaborative/posts/:postId/replies` - Create reply
- `GET /api/collaborative/posts/:postId/replies` - Get post replies

#### Study Groups
- `POST /api/collaborative/study-groups` - Create study group
- `GET /api/collaborative/courses/:courseId/study-groups` - Get course groups
- `POST /api/collaborative/study-groups/:groupId/join` - Join group

#### Assignments
- `POST /api/collaborative/assignments` - Create assignment (instructor/admin)
- `GET /api/collaborative/courses/:courseId/assignments` - Get course assignments
- `POST /api/collaborative/assignments/:assignmentId/submit` - Submit assignment
- `POST /api/collaborative/submissions/:submissionId/grade` - Grade submission
- `POST /api/collaborative/submissions/:submissionId/peer-review` - Submit peer review

### Gamification

#### Points
- `POST /api/gamification/points/award` - Award points (instructor/admin)
- `GET /api/gamification/users/:userId/points` - Get user points
- `GET /api/gamification/me/points` - Get current user points
- `GET /api/gamification/users/:userId/points/transactions` - Get point history

#### Badges
- `POST /api/gamification/badges` - Create badge (admin)
- `GET /api/gamification/badges` - Get all badges
- `GET /api/gamification/users/:userId/badges` - Get user badges
- `GET /api/gamification/me/badges` - Get current user badges

#### Achievements
- `POST /api/gamification/achievements` - Create achievement (admin)
- `GET /api/gamification/users/:userId/achievements` - Get user achievements
- `GET /api/gamification/me/achievements` - Get current user achievements

#### Leaderboards
- `GET /api/gamification/leaderboard` - Get leaderboard
  - Query params: `period` (daily/weekly/monthly/all-time), `scope` (global/course), `scopeId`, `limit`

#### Streaks
- `GET /api/gamification/users/:userId/streak` - Get user streak
- `GET /api/gamification/me/streak` - Get current user streak
- `POST /api/gamification/me/streak/update` - Update streak
- `POST /api/gamification/me/streak/freeze` - Freeze streak

### Assessments

#### Assessments
- `POST /api/assessments/assessments` - Create assessment (instructor/admin)
- `GET /api/assessments/assessments/:assessmentId` - Get assessment
- `GET /api/assessments/courses/:courseId/assessments` - Get course assessments
- `POST /api/assessments/assessments/:assessmentId/start` - Start assessment
- `POST /api/assessments/attempts/:attemptId/submit` - Submit assessment
- `GET /api/assessments/assessments/:assessmentId/attempts` - Get user attempts

#### Flashcards
- `POST /api/assessments/flashcards` - Create flashcard
- `GET /api/assessments/flashcards` - Get user flashcards
- `GET /api/assessments/flashcards/due` - Get due flashcards
- `POST /api/assessments/flashcards/:flashcardId/review` - Review flashcard

#### Adaptive Learning
- `GET /api/assessments/courses/:courseId/adaptive-path` - Get adaptive path
- `GET /api/assessments/courses/:courseId/analytics` - Get learning analytics

## Environment Variables

```env
# Server Configuration
PORT=3010
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sai_mahendra_dev
DB_USER=postgres
DB_PASSWORD=postgres123

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Database Schema

### PostgreSQL Tables

#### video_quizzes
- id (UUID, PK)
- video_id (UUID, FK)
- timestamp (INTEGER)
- title (VARCHAR)
- description (TEXT)
- questions (JSONB)
- passing_score (INTEGER)
- time_limit (INTEGER)
- created_by (UUID)
- created_at, updated_at (TIMESTAMP)

#### quiz_attempts
- id (UUID, PK)
- quiz_id (UUID, FK)
- user_id (UUID, FK)
- answers (JSONB)
- score (INTEGER)
- passed (BOOLEAN)
- completed_at (TIMESTAMP)
- time_spent (INTEGER)

#### video_notes
- id (UUID, PK)
- video_id (UUID, FK)
- user_id (UUID, FK)
- timestamp (INTEGER)
- content (TEXT)
- is_public (BOOLEAN)
- tags (JSONB)
- created_at, updated_at (TIMESTAMP)

#### video_bookmarks
- id (UUID, PK)
- video_id (UUID, FK)
- user_id (UUID, FK)
- timestamp (INTEGER)
- title (VARCHAR)
- description (TEXT)
- created_at (TIMESTAMP)

#### video_comments
- id (UUID, PK)
- video_id (UUID, FK)
- user_id (UUID, FK)
- content (TEXT)
- timestamp (INTEGER)
- parent_id (UUID, FK)
- upvotes, downvotes (INTEGER)
- created_at, updated_at (TIMESTAMP)

#### forums, forum_posts, forum_replies
- Complete forum system with posts and replies

#### study_groups, study_group_members
- Study group management

#### assignments, assignment_submissions, peer_reviews
- Assignment and peer review system

#### badges, user_badges, achievements, user_achievements
- Gamification elements

#### assessments, assessment_attempts
- Assessment system

#### flashcards, flashcard_reviews
- Spaced repetition flashcards

### MongoDB Collections

#### point_transactions
- userId, points, action, description, metadata, createdAt

#### user_points
- userId, totalPoints, coursePoints, weeklyPoints, monthlyPoints, lastUpdated

#### learning_streaks
- userId, currentStreak, longestStreak, lastActivityDate, freezesAvailable, freezesUsed, streakHistory

#### adaptive_paths
- userId, courseId, currentLevel, recommendedContent, strengths, weaknesses, learningStyle, pace, lastUpdated

## Points System

| Activity | Points |
|----------|--------|
| Video completion | 100 |
| Quiz passed | 50 |
| Assignment submission | 75 |
| Forum post | 10 |
| Daily streak | 10 |
| Badge earned | Variable |
| Achievement completed | Variable |

## Development

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

## Docker Support

### Development
```bash
docker build -f Dockerfile.dev -t lms-service:dev .
docker run -p 3010:3010 --env-file .env lms-service:dev
```

## Security Features

- JWT authentication via Redis sessions
- Role-based access control (student, instructor, admin)
- Request validation using Joi schemas
- Rate limiting (100 requests per 15 minutes)
- Helmet.js security headers
- CORS configuration
- Input sanitization

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "type": "ERROR_TYPE",
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": ["Additional error details"],
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Performance Considerations

- Database connection pooling
- Redis caching for sessions
- Pagination for list endpoints
- Efficient database queries with indexes
- Compression middleware for responses

## Future Enhancements

- Real-time notifications using WebSockets
- Advanced analytics dashboards
- AI-powered content recommendations
- Mobile app integration
- Offline mode support
- Video annotation tools
- Live collaboration features

## Support

For issues or questions, contact the development team or create an issue in the project repository.
