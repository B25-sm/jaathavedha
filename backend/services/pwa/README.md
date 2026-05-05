# PWA Service

Progressive Web App backend support service for the Sai Mahendra platform. Provides service worker configuration, offline data synchronization, push notification management, and mobile-optimized API responses.

## Features

- **Service Worker Configuration**: Dynamic service worker configuration with caching strategies
- **Offline Synchronization**: Queue and process offline data synchronization requests
- **Push Notifications**: Web push notification subscription and delivery management
- **Mobile Optimization**: Mobile-optimized API responses with payload compression
- **Background Sync**: Background synchronization task management
- **PWA Analytics**: Track PWA-specific events and user behavior

## Requirements

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- VAPID keys for web push notifications

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate VAPID keys for push notifications
npx web-push generate-vapid-keys

# Update .env with generated keys
```

## Environment Variables

```env
# Server Configuration
PORT=3015
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/sai_mahendra
REDIS_URL=redis://localhost:6379

# VAPID Keys for Web Push
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@saimahendra.com

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Service Worker Configuration
SW_CACHE_VERSION=v1
SW_CACHE_MAX_AGE=86400
SW_OFFLINE_FALLBACK_URL=/offline.html

# Sync Configuration
SYNC_BATCH_SIZE=50
SYNC_MAX_RETRIES=3
SYNC_RETRY_DELAY=5000

# Mobile Optimization
MOBILE_IMAGE_QUALITY=75
MOBILE_MAX_PAYLOAD_SIZE=512000
MOBILE_CACHE_TTL=3600

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://saimahendra.com

# Logging
LOG_LEVEL=info
```

## API Endpoints

### Service Worker Configuration

#### GET /api/pwa/sw-config
Get service worker configuration including caching strategies and sync endpoints.

**Query Parameters:**
- `userId` (optional): User ID for personalized configuration

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "v1",
    "cacheVersion": "v1",
    "cacheMaxAge": 86400,
    "offlineFallbackUrl": "/offline.html",
    "cachingStrategies": [...],
    "syncEndpoints": [...],
    "pushNotificationConfig": {...}
  }
}
```

#### GET /api/pwa/manifest.json
Get web app manifest for PWA installation.

**Response:**
```json
{
  "name": "Sai Mahendra - AI & Fullstack Development",
  "short_name": "Sai Mahendra",
  "description": "Learn AI and Fullstack Development",
  "start_url": "/",
  "display": "standalone",
  "icons": [...],
  "shortcuts": [...]
}
```

#### GET /api/pwa/cache-version
Get current cache version for cache busting.

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "v1"
  }
}
```

#### POST /api/pwa/cache/clear
Clear all caches (admin only).

**Response:**
```json
{
  "success": true,
  "message": "All caches cleared successfully"
}
```

### Offline Synchronization

#### POST /api/pwa/sync/queue
Queue a sync request for offline data.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "endpoint": "/api/sync/progress",
  "method": "POST",
  "data": {
    "courseId": "course-uuid",
    "progress": 75
  },
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sync request queued successfully",
  "data": {
    "syncId": "sync-uuid"
  }
}
```

#### POST /api/pwa/sync/process
Process pending sync requests.

**Request Body:**
```json
{
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sync processing completed",
  "data": {
    "syncId": "batch-uuid",
    "status": "completed",
    "processedCount": 10,
    "failedCount": 0
  }
}
```

#### GET /api/pwa/sync/status/:userId
Get sync status for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "syncStatus": {
      "pending": 5,
      "in_progress": 2,
      "completed": 100,
      "failed": 1
    },
    "lastSyncAt": "2024-01-15T10:30:00Z"
  }
}
```

#### POST /api/pwa/sync/cancel
Cancel pending sync requests.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "syncIds": ["sync-uuid-1", "sync-uuid-2"]
}
```

#### POST /api/pwa/offline/data
Get offline data for user.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "dataTypes": ["courses", "progress", "videos"],
  "lastSyncTimestamp": "2024-01-15T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [...],
    "syncToken": "token",
    "hasMore": false,
    "nextSyncTimestamp": "2024-01-15T11:00:00Z"
  }
}
```

### Push Notifications

#### POST /api/pwa/push/subscribe
Subscribe to push notifications.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "key",
      "auth": "key"
    }
  },
  "platform": "web",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push subscription created successfully",
  "data": {
    "subscriptionId": "subscription-uuid"
  }
}
```

#### DELETE /api/pwa/push/unsubscribe
Unsubscribe from push notifications.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "endpoint": "https://fcm.googleapis.com/..."
}
```

#### GET /api/pwa/push/subscriptions/:userId
Get all active subscriptions for a user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "subscription-uuid",
      "userId": "user-uuid",
      "endpoint": "https://fcm.googleapis.com/...",
      "platform": "web",
      "createdAt": "2024-01-15T10:00:00Z",
      "isActive": true
    }
  ]
}
```

#### POST /api/pwa/push/send
Send push notification to user.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "title": "New Course Available",
  "body": "Check out our latest AI course!",
  "data": {
    "courseId": "course-uuid"
  },
  "icon": "/icons/icon-192x192.png",
  "actions": [
    {
      "action": "view",
      "title": "View Course"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push notification sent",
  "data": {
    "sent": 2,
    "failed": 0
  }
}
```

#### GET /api/pwa/push/vapid-public-key
Get VAPID public key for client-side subscription.

**Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": "BKxyz..."
  }
}
```

### Mobile Optimization

#### POST /api/pwa/mobile/optimize
Optimize API response for mobile devices.

**Request Body:**
```json
{
  "data": {...},
  "compressionEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {...},
  "metadata": {
    "timestamp": "2024-01-15T10:00:00Z",
    "version": "1.0",
    "cached": false,
    "payloadSize": 45000,
    "compressionRatio": 0.45
  }
}
```

#### GET /api/pwa/mobile/config
Get mobile optimization configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "imageQuality": 75,
    "maxPayloadSize": 512000,
    "cacheTTL": 3600,
    "compressionEnabled": true,
    "lazyLoadingEnabled": true
  }
}
```

#### POST /api/pwa/mobile/image/optimize
Optimize image URL for mobile devices.

**Request Body:**
```json
{
  "imageUrl": "https://cdn.example.com/image.jpg",
  "quality": 75,
  "maxWidth": 800,
  "maxHeight": 600
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizedUrl": "https://cdn.example.com/image.jpg?quality=75&width=800&format=webp"
  }
}
```

#### GET /api/pwa/mobile/network-status
Detect network capabilities from user agent.

**Response:**
```json
{
  "success": true,
  "data": {
    "online": true,
    "effectiveType": "4g",
    "downlink": 10,
    "rtt": 50,
    "saveData": false
  }
}
```

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run linter
npm run lint
```

## Database Schema

The PWA service uses the following database tables:

- `push_subscriptions`: Push notification subscriptions
- `sync_requests`: Offline synchronization queue
- `user_progress`: Course progress tracking
- `video_analytics`: Video viewing analytics
- `video_notes`: User notes with timestamps
- `video_bookmarks`: Video bookmarks
- `quiz_responses`: Quiz responses
- `offline_data_cache`: Offline data cache
- `background_sync_tasks`: Background sync tasks
- `pwa_analytics_events`: PWA analytics events

## Architecture

The PWA service follows a microservices architecture with:

1. **ServiceWorkerConfigService**: Manages service worker configuration and caching strategies
2. **OfflineSyncService**: Handles offline data synchronization and background sync
3. **PushNotificationService**: Manages push notification subscriptions and delivery
4. **MobileOptimizationService**: Optimizes API responses for mobile devices

## Caching Strategies

The service implements multiple caching strategies:

- **cache-first**: Static assets (JS, CSS, images)
- **network-first**: API data, user data
- **stale-while-revalidate**: HTML pages

## Offline Sync Priority

Sync requests are processed in priority order:

1. **High**: Course progress, video analytics, quiz responses
2. **Medium**: Notes, bookmarks
3. **Low**: User preferences

## Push Notification Types

- Transactional: Enrollment confirmations, payment receipts
- Engagement: Course reminders, new content alerts
- Marketing: Program announcements, special offers

## Security

- VAPID authentication for push notifications
- JWT authentication for API endpoints
- Rate limiting on all endpoints
- Input validation and sanitization
- Secure storage of subscription keys

## Monitoring

The service provides health check endpoints and logs:

- Service health: `/health`
- Metrics: Request duration, error rates, cache hit rates
- Logs: Winston logger with structured logging

## Troubleshooting

### Push notifications not working

1. Verify VAPID keys are configured correctly
2. Check browser console for subscription errors
3. Ensure HTTPS is enabled (required for push notifications)
4. Verify Firebase Cloud Messaging is configured

### Offline sync not processing

1. Check Redis connection
2. Verify database connectivity
3. Check sync queue status
4. Review error logs for failed requests

### Mobile optimization issues

1. Verify Redis cache is working
2. Check payload size limits
3. Review compression settings
4. Test with different network conditions

## License

Proprietary - Sai Mahendra Platform
