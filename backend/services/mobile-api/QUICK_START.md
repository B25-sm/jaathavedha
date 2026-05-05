# Mobile API Service - Quick Start Guide

## Overview

The Mobile API Service provides mobile-optimized endpoints for offline sync, video downloads, and push notifications.

**Port**: 3012  
**Base URL**: `http://localhost:3012`

---

## Quick Setup

### 1. Install Dependencies
```bash
cd backend/services/mobile-api
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Run Database Migrations
```bash
cd ../../database
npm run migrate
```

### 4. Start Service
```bash
cd ../services/mobile-api
npm run dev
```

### 5. Verify Health
```bash
curl http://localhost:3012/health
```

---

## Firebase Setup (Push Notifications)

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Cloud Messaging

### 2. Get Service Account Key
1. Project Settings → Service Accounts
2. Generate New Private Key
3. Download JSON file

### 3. Configure Environment
```bash
# In .env file
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"..."}'
```

---

## Common Use Cases

### 1. Register Mobile Device
```bash
curl -X POST http://localhost:3012/api/notifications/register \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "deviceId": "device-456",
    "deviceToken": "fcm-token-xyz",
    "platform": "android",
    "deviceInfo": {
      "deviceName": "Samsung Galaxy S21",
      "osVersion": "Android 13",
      "appVersion": "1.2.0"
    }
  }'
```

### 2. Request Video Download
```bash
curl -X POST http://localhost:3012/api/downloads/request \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "deviceId": "device-456",
    "contentType": "video",
    "contentId": "video-789",
    "courseId": "course-1",
    "quality": "720p",
    "wifiOnly": true
  }'
```

### 3. Sync Progress
```bash
curl -X POST http://localhost:3012/api/sync/progress \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### 4. Get Mobile-Optimized Courses
```bash
curl "http://localhost:3012/api/content/courses?userId=user-123&fields=id,title,progress&limit=10"
```

### 5. Send Push Notification
```bash
curl -X POST http://localhost:3012/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "notification": {
      "title": "New Lesson Available",
      "body": "Check out the new lesson on Neural Networks",
      "category": "course_update",
      "priority": "normal",
      "actionUrl": "/lessons/lesson-123"
    }
  }'
```

---

## Key Features

### Mobile-Optimized Content
- **Field Selection**: `?fields=id,title,progress`
- **Pagination**: `?limit=20&offset=0`
- **Compression**: `?compress=true`
- **Caching**: Automatic Redis caching

### Offline Sync
- **Progress**: Learning progress across devices
- **Notes**: Timestamped notes with video position
- **Bookmarks**: Video bookmarks and highlights
- **Conflict Resolution**: Automatic last-write-wins

### Video Downloads
- **Quality Options**: 240p, 480p, 720p, 1080p
- **Queue Management**: Pause, resume, delete
- **Storage Limits**: 10GB per device
- **Expiration**: 30-day auto-expiry
- **WiFi-Only**: Configurable network restrictions

### Push Notifications
- **Platforms**: Android (FCM), iOS (APNS)
- **Categories**: 6 notification types
- **Preferences**: Per-device customization
- **Quiet Hours**: Do-not-disturb scheduling
- **Rich Notifications**: Images, actions, deep links

---

## API Endpoints Summary

### Content Delivery
- `GET /api/content/courses` - Course list
- `GET /api/content/lessons/:id` - Lesson details
- `GET /api/content/progress/summary` - Progress summary
- `GET /api/content/sessions/upcoming` - Live sessions

### Offline Sync
- `POST /api/sync/progress` - Sync progress
- `POST /api/sync/notes` - Sync notes
- `POST /api/sync/bookmarks` - Sync bookmarks
- `GET /api/sync/:userId/:deviceId/status` - Sync status
- `POST /api/sync/full` - Full sync

### Downloads
- `POST /api/downloads/request` - Request download
- `GET /api/downloads/:userId/:deviceId/list` - List downloads
- `PUT /api/downloads/:id/progress` - Update progress
- `PUT /api/downloads/:id/pause` - Pause download
- `PUT /api/downloads/:id/resume` - Resume download
- `DELETE /api/downloads/:id` - Delete download
- `GET /api/downloads/:userId/:deviceId/offline` - Offline content
- `GET /api/downloads/:userId/:deviceId/storage` - Storage info

### Push Notifications
- `POST /api/notifications/register` - Register device
- `POST /api/notifications/unregister` - Unregister device
- `POST /api/notifications/send` - Send notification
- `POST /api/notifications/send-bulk` - Bulk send
- `GET /api/notifications/:userId/:deviceId/preferences` - Get preferences
- `PUT /api/notifications/:userId/:deviceId/preferences` - Update preferences
- `POST /api/notifications/:id/opened` - Track opened
- `GET /api/notifications/:userId/history` - History

### Analytics
- `POST /api/analytics/track` - Track event
- `GET /api/analytics/:userId/usage` - Usage stats

### Health
- `GET /health` - Service health check

---

## Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3012

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sai_mahendra_dev
DB_USER=postgres
DB_PASSWORD=postgres123

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MongoDB
MONGODB_URL=mongodb://localhost:27017/sai_mahendra_mobile

# Firebase (Push Notifications)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# CDN
CDN_URL=https://cdn.saimahendra.com

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

---

## Troubleshooting

### Service Won't Start
```bash
# Check database connection
psql -h localhost -U postgres -d sai_mahendra_dev

# Check Redis connection
redis-cli ping

# Check MongoDB connection
mongosh mongodb://localhost:27017
```

### Push Notifications Not Working
1. Verify Firebase credentials in `.env`
2. Check device token is valid
3. Verify notification preferences are enabled
4. Check quiet hours settings

### Downloads Failing
1. Verify user enrollment in course
2. Check download limit (50 per user)
3. Verify storage space available
4. Check CDN URL configuration

### Sync Conflicts
1. Check sync timestamps
2. Review conflict resolution strategy
3. Use manual resolution if needed
4. Verify device clock is accurate

---

## Performance Tips

1. **Use Field Selection**: Reduce payload size by 60-80%
   ```
   ?fields=id,title,progress
   ```

2. **Enable Compression**: Reduce bandwidth by 70%
   ```
   ?compress=true
   ```

3. **Leverage Caching**: Redis caches responses for 5 minutes

4. **Batch Operations**: Use full sync for multiple entities

5. **WiFi-Only Downloads**: Save mobile data

---

## Development

### Run in Development Mode
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

### Run Tests (when available)
```bash
npm test
```

---

## Documentation

- **API Reference**: See `API_REFERENCE.md`
- **Completion Report**: See `TASK_26.1_COMPLETION_REPORT.md`
- **Database Schema**: See `backend/database/migrations/013_mobile_api_schema.sql`

---

## Support

For issues or questions:
1. Check API documentation
2. Review completion report
3. Check service logs
4. Contact development team

---

## Next Steps

1. ✅ Service is running
2. ⏳ Integrate with mobile apps
3. ⏳ Configure Firebase credentials
4. ⏳ Set up CDN URLs
5. ⏳ Configure monitoring and alerts
6. ⏳ Load testing
7. ⏳ Production deployment

---

**Service**: Mobile API Service  
**Port**: 3012  
**Status**: ✅ Ready for Integration
