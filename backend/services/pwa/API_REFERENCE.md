# PWA Service API Reference

Complete API reference for the Progressive Web App backend support service.

## Base URL

```
http://localhost:3015
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": {
    "type": "ERROR_TYPE",
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

## Service Worker Configuration

### Get Service Worker Config

Get dynamic service worker configuration including caching strategies and sync endpoints.

**Endpoint:** `GET /api/pwa/sw-config`

**Query Parameters:**
- `userId` (optional, string): User ID for personalized configuration

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "v1",
    "cacheVersion": "v1",
    "cacheMaxAge": 86400,
    "offlineFallbackUrl": "/offline.html",
    "cachingStrategies": [
      {
        "name": "static-assets",
        "pattern": "\\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$",
        "strategy": "cache-first",
        "cacheName": "static-v1",
        "maxAge": 2592000,
        "maxEntries": 100
      }
    ],
    "syncEndpoints": [
      {
        "name": "course-progress",
        "url": "/api/sync/progress",
        "method": "POST",
        "priority": "high"
      }
    ],
    "pushNotificationConfig": {
      "vapidPublicKey": "BKxyz...",
      "applicationServerKey": "BKxyz..."
    }
  }
}
```

### Get Web App Manifest

Get PWA manifest for app installation.

**Endpoint:** `GET /api/pwa/manifest.json`

**Response:**
```json
{
  "name": "Sai Mahendra - AI & Fullstack Development",
  "short_name": "Sai Mahendra",
  "description": "Learn AI and Fullstack Development with expert-led courses",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4F46E5",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    }
  ],
  "shortcuts": [
    {
      "name": "My Courses",
      "url": "/dashboard/courses",
      "icons": [...]
    }
  ]
}
```

### Get Cache Version

Get current cache version for cache busting.

**Endpoint:** `GET /api/pwa/cache-version`

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "v1"
  }
}
```

### Clear All Caches

Clear all service worker caches (admin only).

**Endpoint:** `POST /api/pwa/cache/clear`

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "message": "All caches cleared successfully"
}
```

## Offline Synchronization

### Queue Sync Request

Queue a data synchronization request for offline processing.

**Endpoint:** `POST /api/pwa/sync/queue`

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "endpoint": "/api/sync/progress",
  "method": "POST",
  "data": {
    "courseId": "course-uuid",
    "moduleId": "module-uuid",
    "progress": 75,
    "completedAt": "2024-01-15T10:30:00Z"
  },
  "priority": "high"
}
```

**Parameters:**
- `userId` (required, string): User ID
- `endpoint` (required, string): API endpoint to sync to
- `method` (required, string): HTTP method (GET, POST, PUT, DELETE)
- `data` (required, object): Data to sync
- `priority` (optional, string): Priority level (high, medium, low) - default: medium

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

### Process Sync Queue

Process pending synchronization requests.

**Endpoint:** `POST /api/pwa/sync/process`

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
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
    "failedCount": 0,
    "errors": []
  }
}
```

### Get Sync Status

Get synchronization status for a user.

**Endpoint:** `GET /api/pwa/sync/status/:userId`

**Authentication:** Required

**Path Parameters:**
- `userId` (required, string): User ID

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
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

### Cancel Sync Requests

Cancel pending synchronization requests.

**Endpoint:** `POST /api/pwa/sync/cancel`

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "syncIds": ["sync-uuid-1", "sync-uuid-2"]
}
```

**Parameters:**
- `userId` (required, string): User ID
- `syncIds` (optional, array): Specific sync IDs to cancel. If omitted, cancels all pending requests.

**Response:**
```json
{
  "success": true,
  "message": "Sync requests cancelled successfully"
}
```

### Get Offline Data

Get data for offline access.

**Endpoint:** `POST /api/pwa/offline/data`

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "dataTypes": ["courses", "progress", "videos", "notes", "bookmarks"],
  "lastSyncTimestamp": "2024-01-15T10:00:00Z"
}
```

**Parameters:**
- `userId` (required, string): User ID
- `dataTypes` (required, array): Types of data to fetch
- `lastSyncTimestamp` (optional, string): ISO timestamp of last sync

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "data-uuid",
        "userId": "user-uuid",
        "dataType": "courses",
        "data": [...],
        "version": 1,
        "lastModified": "2024-01-15T11:00:00Z",
        "syncStatus": "completed"
      }
    ],
    "syncToken": "token-string",
    "hasMore": false,
    "nextSyncTimestamp": "2024-01-15T11:00:00Z"
  }
}
```

## Push Notifications

### Subscribe to Push Notifications

Create a push notification subscription.

**Endpoint:** `POST /api/pwa/push/subscribe`

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BKxyz...",
      "auth": "abc123..."
    }
  },
  "platform": "web",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
}
```

**Parameters:**
- `userId` (required, string): User ID
- `subscription` (required, object): Push subscription object from browser
- `platform` (required, string): Platform (web, android, ios)
- `userAgent` (optional, string): User agent string

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

### Unsubscribe from Push Notifications

Remove a push notification subscription.

**Endpoint:** `DELETE /api/pwa/push/unsubscribe`

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push subscription removed successfully"
}
```

### Get User Subscriptions

Get all active push subscriptions for a user.

**Endpoint:** `GET /api/pwa/push/subscriptions/:userId`

**Authentication:** Required

**Path Parameters:**
- `userId` (required, string): User ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "subscription-uuid",
      "userId": "user-uuid",
      "endpoint": "https://fcm.googleapis.com/...",
      "keys": {
        "p256dh": "BKxyz...",
        "auth": "abc123..."
      },
      "platform": "web",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z",
      "isActive": true
    }
  ]
}
```

### Send Push Notification

Send a push notification to a user.

**Endpoint:** `POST /api/pwa/push/send`

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "New Course Available",
  "body": "Check out our latest AI course on Machine Learning!",
  "data": {
    "courseId": "course-uuid",
    "url": "/courses/machine-learning"
  },
  "icon": "/icons/icon-192x192.png",
  "badge": "/icons/badge-72x72.png",
  "image": "/images/course-banner.jpg",
  "actions": [
    {
      "action": "view",
      "title": "View Course",
      "icon": "/icons/view.png"
    },
    {
      "action": "dismiss",
      "title": "Dismiss"
    }
  ]
}
```

**Parameters:**
- `userId` (required, string): User ID
- `title` (required, string): Notification title
- `body` (required, string): Notification body text
- `data` (optional, object): Custom data payload
- `icon` (optional, string): Icon URL
- `badge` (optional, string): Badge icon URL
- `image` (optional, string): Large image URL
- `actions` (optional, array): Notification actions

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

### Get VAPID Public Key

Get VAPID public key for client-side subscription.

**Endpoint:** `GET /api/pwa/push/vapid-public-key`

**Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": "BKxyz..."
  }
}
```

## Mobile Optimization

### Optimize Response

Optimize API response for mobile devices.

**Endpoint:** `POST /api/pwa/mobile/optimize`

**Authentication:** Required

**Request Body:**
```json
{
  "data": {
    "courses": [...],
    "totalCount": 100
  },
  "compressionEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "courses": [...],
    "totalCount": 100
  },
  "metadata": {
    "timestamp": "2024-01-15T10:00:00Z",
    "version": "1.0",
    "cached": false,
    "payloadSize": 45000,
    "compressionRatio": 0.45
  }
}
```

### Get Mobile Config

Get mobile optimization configuration.

**Endpoint:** `GET /api/pwa/mobile/config`

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

### Optimize Image

Optimize image URL for mobile devices.

**Endpoint:** `POST /api/pwa/mobile/image/optimize`

**Authentication:** Required

**Request Body:**
```json
{
  "imageUrl": "https://cdn.example.com/image.jpg",
  "quality": 75,
  "maxWidth": 800,
  "maxHeight": 600
}
```

**Parameters:**
- `imageUrl` (required, string): Original image URL
- `quality` (optional, number): Image quality (1-100)
- `maxWidth` (optional, number): Maximum width in pixels
- `maxHeight` (optional, number): Maximum height in pixels

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizedUrl": "https://cdn.example.com/image.jpg?quality=75&width=800&format=webp"
  }
}
```

### Detect Network Status

Detect network capabilities from user agent.

**Endpoint:** `GET /api/pwa/mobile/network-status`

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

## Health Check

### Service Health

Check service health and dependencies.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "service": "pwa",
  "timestamp": "2024-01-15T10:00:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "redis": "connected",
    "database": "connected",
    "vapid": "configured"
  }
}
```

## Rate Limiting

All endpoints are rate-limited to 100 requests per 15 minutes per IP address.

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

**Rate Limit Exceeded Response:**
```json
{
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests from this IP, please try again later.",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

## Webhooks

The PWA service can send webhooks for certain events:

### Push Notification Delivered

Sent when a push notification is successfully delivered.

**Payload:**
```json
{
  "event": "push.delivered",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "userId": "user-uuid",
    "subscriptionId": "subscription-uuid",
    "notificationId": "notification-uuid",
    "platform": "web"
  }
}
```

### Sync Completed

Sent when offline sync is completed.

**Payload:**
```json
{
  "event": "sync.completed",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "userId": "user-uuid",
    "syncId": "sync-uuid",
    "processedCount": 10,
    "failedCount": 0
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
// Subscribe to push notifications
async function subscribeToPush(userId: string) {
  const registration = await navigator.serviceWorker.ready;
  
  // Get VAPID public key
  const response = await fetch('/api/pwa/push/vapid-public-key');
  const { data } = await response.json();
  
  // Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: data.publicKey
  });
  
  // Send subscription to server
  await fetch('/api/pwa/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      userId,
      subscription: subscription.toJSON(),
      platform: 'web',
      userAgent: navigator.userAgent
    })
  });
}

// Queue offline sync request
async function queueOfflineSync(userId: string, data: any) {
  await fetch('/api/pwa/sync/queue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      userId,
      endpoint: '/api/sync/progress',
      method: 'POST',
      data,
      priority: 'high'
    })
  });
}
```

## Support

For API support, contact: api-support@saimahendra.com
