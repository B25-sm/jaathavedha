# Video Conferencing Service

## Overview

The Video Conferencing Service provides comprehensive integration with Zoom and Google Meet platforms for the Sai Mahendra educational platform. It enables instructors to create and manage live virtual classroom sessions with automatic recording, attendance tracking, and playback functionality.

## Features

### 🎥 Multi-Provider Support
- **Zoom Integration:** Full OAuth 2.0 Server-to-Server authentication
- **Google Meet Integration:** OAuth 2.0 with Google Calendar API
- Seamless switching between providers based on requirements

### 📹 Meeting Management
- Create, update, and delete meetings programmatically
- Schedule meetings with customizable settings
- Generate unique join URLs for participants
- Separate start URLs for instructors/hosts
- Meeting status tracking (scheduled, in_progress, completed, cancelled)

### 🎬 Recording Management
- Automatic cloud recording for Zoom meetings
- Asynchronous recording download and processing
- AWS S3 storage for long-term retention
- Presigned URL generation for secure playback
- Recording view tracking for analytics
- Multiple recording types support (speaker view, gallery view, shared screen)

### 📊 Attendance Tracking
- Real-time participant join/leave tracking
- Automatic attendance calculation based on duration
- Configurable attendance thresholds
- Comprehensive attendance reports
- Individual user attendance statistics
- Integration with Zoom participant webhooks

### 🔔 Webhook Integration
- Zoom webhook support for real-time events
- Automatic meeting status updates
- Recording completion notifications
- Participant tracking via webhooks
- Secure webhook signature verification

### 🔒 Security Features
- JWT-based authentication
- Role-based access control (RBAC)
- Webhook signature verification
- Encrypted credentials storage
- Rate limiting and request throttling
- Secure presigned URLs for recordings

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Video Conferencing Service                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Meeting    │  │  Recording   │  │  Attendance  │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│         ┌──────────────────┴──────────────────┐             │
│         │                                      │             │
│  ┌──────▼──────┐                      ┌───────▼──────┐      │
│  │    Zoom     │                      │ Google Meet  │      │
│  │   Service   │                      │   Service    │      │
│  └─────────────┘                      └──────────────┘      │
│         │                                      │             │
└─────────┼──────────────────────────────────────┼─────────────┘
          │                                      │
          ▼                                      ▼
   ┌─────────────┐                      ┌──────────────┐
   │  Zoom API   │                      │ Google APIs  │
   └─────────────┘                      └──────────────┘
```

## Technology Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (meetings, recordings, attendance)
- **Cache:** Redis (sessions, rate limiting)
- **Storage:** AWS S3 (recording files)
- **External APIs:** Zoom API, Google Calendar API, Google Meet
- **Authentication:** JWT, OAuth 2.0

## Prerequisites

1. **Node.js:** Version 18 or higher
2. **PostgreSQL:** Version 15 or higher
3. **Redis:** Version 7 or higher
4. **AWS Account:** For S3 storage
5. **Zoom Account:** With Server-to-Server OAuth app
6. **Google Cloud Project:** With Calendar API enabled

## Installation

### 1. Install Dependencies

```bash
cd backend/services/video-conferencing
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3017

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/sai_mahendra

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Zoom API Configuration
ZOOM_ACCOUNT_ID=your_zoom_account_id
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
ZOOM_WEBHOOK_SECRET_TOKEN=your_webhook_secret

# Google Meet API Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3017/api/video-conferencing/google/callback

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=sai-mahendra-recordings
AWS_S3_RECORDINGS_PREFIX=video-conferencing/recordings/

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
```

### 3. Run Database Migrations

Ensure the video conferencing schema migration has been run:

```bash
cd ../../database
npm run migrate
```

### 4. Start the Service

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## API Documentation

Comprehensive API documentation is available in [API_REFERENCE.md](./API_REFERENCE.md).

### Quick Start Example

**Create a Zoom Meeting:**

```bash
curl -X POST http://localhost:3017/api/video-conferencing/meetings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "zoom",
    "session_id": "uuid-here",
    "instructor_id": "uuid-here",
    "title": "Introduction to AI",
    "start_time": "2024-02-01T10:00:00Z",
    "duration_minutes": 60,
    "settings": {
      "waiting_room": true,
      "auto_recording": true
    }
  }'
```

## Configuration

### Zoom Setup

1. Create a Server-to-Server OAuth app in Zoom Marketplace
2. Configure app scopes:
   - `meeting:write:admin`
   - `meeting:read:admin`
   - `recording:read:admin`
   - `recording:write:admin`
3. Add webhook endpoint: `https://your-domain.com/api/video-conferencing/webhooks/zoom`
4. Subscribe to events:
   - Meeting Started
   - Meeting Ended
   - Participant Joined
   - Participant Left
   - Recording Completed

### Google Meet Setup

1. Create a project in Google Cloud Console
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `http://localhost:3017/api/video-conferencing/google/callback`
5. Configure OAuth consent screen

### AWS S3 Setup

1. Create an S3 bucket for recordings
2. Configure bucket policy for private access
3. Create IAM user with S3 permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`
4. Generate access keys for the IAM user

## Attendance Configuration

Attendance status is calculated based on configurable thresholds:

```env
# Minimum duration to count as attendance (minutes)
ATTENDANCE_MINIMUM_DURATION_MINUTES=5

# Percentage of meeting duration required for "present" status
ATTENDANCE_THRESHOLD_PERCENTAGE=75
```

**Attendance Status Rules:**
- **Present:** Duration ≥ 75% of meeting duration
- **Late:** Duration between 50% and 75%
- **Absent:** Duration < 50% OR < 5 minutes

## Recording Processing

Recordings are processed asynchronously:

1. **Webhook Received:** Zoom sends `recording.completed` event
2. **Metadata Stored:** Recording info saved to database (status: `processing`)
3. **Download Initiated:** Recording downloaded from Zoom (status: `downloading`)
4. **Upload to S3:** File uploaded to AWS S3
5. **Status Updated:** Recording marked as `downloaded`
6. **Playback Ready:** Presigned URLs generated on-demand

**Configuration:**

```env
# Enable automatic recording for all meetings
AUTO_RECORD_MEETINGS=true

# Recording retention period (days)
RECORDING_RETENTION_DAYS=90

# Allow students to download recordings
DOWNLOAD_RECORDINGS_ENABLED=true
```

## Scheduled Tasks

The service runs scheduled tasks for maintenance:

### Mark Past Meetings as Completed
- **Schedule:** Every hour
- **Function:** Updates meetings that have ended to `completed` status
- **Environment:** Production only

## Testing

### Run Unit Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

## Development

### Project Structure

```
src/
├── database/           # Database connection and queries
│   └── index.ts
├── middleware/         # Express middleware
│   ├── auth.ts        # Authentication and authorization
│   └── validation.ts  # Request validation schemas
├── routes/            # API route handlers
│   ├── meetings.ts    # Meeting endpoints
│   ├── recordings.ts  # Recording endpoints
│   ├── attendance.ts  # Attendance endpoints
│   └── webhooks.ts    # Webhook handlers
├── services/          # Business logic services
│   ├── MeetingService.ts      # Meeting management
│   ├── ZoomService.ts         # Zoom API integration
│   ├── GoogleMeetService.ts   # Google Meet integration
│   ├── RecordingService.ts    # Recording management
│   └── AttendanceService.ts   # Attendance tracking
├── types/             # TypeScript type definitions
│   └── index.ts
├── utils/             # Utility functions
│   └── logger.ts      # Winston logger configuration
└── index.ts           # Application entry point
```

### Adding New Features

1. **Define Types:** Add interfaces to `src/types/index.ts`
2. **Create Service:** Implement business logic in `src/services/`
3. **Add Routes:** Create API endpoints in `src/routes/`
4. **Add Validation:** Define schemas in `src/middleware/validation.ts`
5. **Write Tests:** Add tests in `src/__tests__/`
6. **Update Documentation:** Update API_REFERENCE.md

### Code Style

The project uses ESLint for code quality:

```bash
npm run lint
npm run lint:fix
```

## Monitoring and Logging

### Logging

The service uses Winston for structured logging:

- **Development:** Console output with colors
- **Production:** File-based logging (`logs/error.log`, `logs/combined.log`)

**Log Levels:**
- `error` - Error conditions
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug messages

### Health Check

**Endpoint:** `GET /api/video-conferencing/health`

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 3600
}
```

## Troubleshooting

### Common Issues

**1. Zoom Authentication Fails**
- Verify `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, and `ZOOM_CLIENT_SECRET`
- Check app activation status in Zoom Marketplace
- Ensure app has required scopes

**2. Recording Download Fails**
- Verify AWS credentials and S3 bucket access
- Check S3 bucket policy and IAM permissions
- Ensure sufficient disk space for temporary files

**3. Webhook Signature Verification Fails**
- Verify `ZOOM_WEBHOOK_SECRET_TOKEN` matches Zoom app configuration
- Check webhook endpoint is publicly accessible
- Ensure raw body parser is used for webhook route

**4. Google Meet Integration Issues**
- Verify OAuth credentials and redirect URI
- Check Calendar API is enabled in Google Cloud Console
- Ensure user has granted necessary permissions

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

## Security Considerations

1. **Environment Variables:** Never commit `.env` files to version control
2. **JWT Secret:** Use strong, randomly generated secrets in production
3. **Webhook Secrets:** Rotate webhook secrets periodically
4. **AWS Credentials:** Use IAM roles instead of access keys when possible
5. **Rate Limiting:** Adjust rate limits based on expected traffic
6. **CORS:** Configure `ALLOWED_ORIGINS` for production domains only

## Performance Optimization

1. **Database Indexing:** Indexes are created on frequently queried columns
2. **Connection Pooling:** PostgreSQL pool configured for optimal performance
3. **Redis Caching:** Session data and rate limiting use Redis
4. **Async Processing:** Recording downloads happen asynchronously
5. **Presigned URLs:** Generated on-demand to avoid storage overhead

## Deployment

### Docker Deployment

Build the Docker image:

```bash
docker build -f Dockerfile.dev -t video-conferencing-service .
```

Run the container:

```bash
docker run -p 3017:3017 --env-file .env video-conferencing-service
```

### Production Deployment

1. Set `NODE_ENV=production`
2. Use environment-specific configuration
3. Enable HTTPS/TLS
4. Configure load balancing
5. Set up monitoring and alerting
6. Configure log aggregation
7. Enable auto-scaling based on load

## Contributing

1. Follow the existing code structure and style
2. Write tests for new features
3. Update documentation
4. Submit pull requests with clear descriptions

## License

Copyright © 2024 Sai Mahendra Platform. All rights reserved.

## Support

For issues or questions:
- Check the [API Reference](./API_REFERENCE.md)
- Review the [Troubleshooting](#troubleshooting) section
- Contact the development team

---

**Version:** 1.0.0  
**Last Updated:** January 2024
