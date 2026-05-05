# PWA Service Integration Guide

This guide explains how to integrate the PWA service with the Sai Mahendra platform frontend and other backend services.

## Table of Contents

1. [Frontend Integration](#frontend-integration)
2. [Service Worker Setup](#service-worker-setup)
3. [Push Notifications](#push-notifications)
4. [Offline Sync](#offline-sync)
5. [Mobile Optimization](#mobile-optimization)
6. [Backend Service Integration](#backend-service-integration)

## Frontend Integration

### 1. Service Worker Registration

Create a service worker file in your React app's public directory:

**public/service-worker.js**
```javascript
// Fetch service worker configuration from backend
let CONFIG = null;

async function loadConfig() {
  try {
    const response = await fetch('/api/pwa/sw-config');
    const data = await response.json();
    CONFIG = data.data;
    console.log('Service worker config loaded:', CONFIG);
  } catch (error) {
    console.error('Failed to load service worker config:', error);
  }
}

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  event.waitUntil(
    loadConfig().then(() => {
      return caches.open(CONFIG.cacheVersion).then((cache) => {
        return cache.addAll([
          '/',
          '/offline.html',
          '/manifest.json'
        ]);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CONFIG.cacheVersion)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Find matching caching strategy
  const strategy = CONFIG.cachingStrategies.find((s) =>
    new RegExp(s.pattern).test(url.pathname)
  );

  if (!strategy) {
    event.respondWith(fetch(request));
    return;
  }

  switch (strategy.strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(request, strategy.cacheName));
      break;
    case 'network-first':
      event.respondWith(networkFirst(request, strategy.cacheName));
      break;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(request, strategy.cacheName));
      break;
    default:
      event.respondWith(fetch(request));
  }
});

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    return caches.match('/offline.html');
  }
}

// Network-first strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || caches.match('/offline.html');
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  });
  
  return cached || fetchPromise;
}

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Process queued sync requests
  const response = await fetch('/api/pwa/sync/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`
    },
    body: JSON.stringify({
      userId: await getUserId()
    })
  });
  
  return response.json();
}

// Push notification
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    image: data.image,
    data: data.data,
    actions: data.actions || [],
    tag: data.tag,
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'view' && data.url) {
    event.waitUntil(
      clients.openWindow(data.url)
    );
  }
});
```

### 2. Register Service Worker in React App

**src/serviceWorkerRegistration.ts**
```typescript
export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('Service worker registered:', registration);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                console.log('New service worker available');
                // Show update notification to user
              }
            });
          });
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('Service worker unregistration failed:', error);
      });
  }
}
```

**src/index.tsx**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker
serviceWorkerRegistration.register();
```

## Push Notifications

### 1. Subscribe to Push Notifications

**src/hooks/usePushNotifications.ts**
```typescript
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export function usePushNotifications() {
  const { user, token } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    checkSubscription();
  }, [user]);

  async function checkSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      setSubscription(existingSubscription);
      setIsSubscribed(!!existingSubscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }

  async function subscribe() {
    if (!user) {
      throw new Error('User must be logged in to subscribe');
    }

    try {
      // Get VAPID public key from backend
      const keyResponse = await fetch('/api/pwa/push/vapid-public-key');
      const { data } = await keyResponse.json();
      
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Subscribe to push notifications
      const registration = await navigator.serviceWorker.ready;
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });

      // Send subscription to backend
      await fetch('/api/pwa/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          subscription: pushSubscription.toJSON(),
          platform: 'web',
          userAgent: navigator.userAgent
        })
      });

      setSubscription(pushSubscription);
      setIsSubscribed(true);
      
      return pushSubscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw error;
    }
  }

  async function unsubscribe() {
    if (!subscription) {
      return;
    }

    try {
      await subscription.unsubscribe();
      
      // Remove subscription from backend
      await fetch('/api/pwa/push/unsubscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user?.id,
          endpoint: subscription.endpoint
        })
      });

      setSubscription(null);
      setIsSubscribed(false);
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    }
  }

  return {
    isSubscribed,
    subscription,
    subscribe,
    unsubscribe
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

### 2. Push Notification Component

**src/components/PushNotificationToggle.tsx**
```typescript
import React from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function PushNotificationToggle() {
  const { isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const [loading, setLoading] = React.useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      alert('Failed to update notification settings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="push-notification-toggle">
      <label>
        <input
          type="checkbox"
          checked={isSubscribed}
          onChange={handleToggle}
          disabled={loading}
        />
        Enable push notifications
      </label>
    </div>
  );
}
```

## Offline Sync

### 1. Offline Sync Hook

**src/hooks/useOfflineSync.ts**
```typescript
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export function useOfflineSync() {
  const { user, token } = useAuth();
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (user) {
      loadSyncStatus();
    }
  }, [user]);

  async function loadSyncStatus() {
    try {
      const response = await fetch(`/api/pwa/sync/status/${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const { data } = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  }

  async function queueSync(endpoint: string, method: string, data: any, priority: 'high' | 'medium' | 'low' = 'medium') {
    try {
      const response = await fetch('/api/pwa/sync/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user?.id,
          endpoint,
          method,
          data,
          priority
        })
      });

      const result = await response.json();
      await loadSyncStatus();
      return result.data.syncId;
    } catch (error) {
      console.error('Error queuing sync:', error);
      throw error;
    }
  }

  async function processSync() {
    if (!user) return;

    setIsSyncing(true);
    try {
      const response = await fetch('/api/pwa/sync/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id
        })
      });

      const result = await response.json();
      await loadSyncStatus();
      return result.data;
    } catch (error) {
      console.error('Error processing sync:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }

  async function getOfflineData(dataTypes: string[]) {
    try {
      const response = await fetch('/api/pwa/offline/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user?.id,
          dataTypes
        })
      });

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error getting offline data:', error);
      throw error;
    }
  }

  return {
    syncStatus,
    isSyncing,
    queueSync,
    processSync,
    getOfflineData,
    refreshStatus: loadSyncStatus
  };
}
```

### 2. Offline Sync Component

**src/components/OfflineSyncStatus.tsx**
```typescript
import React from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';

export function OfflineSyncStatus() {
  const { syncStatus, isSyncing, processSync } = useOfflineSync();

  if (!syncStatus) {
    return null;
  }

  const hasPending = syncStatus.syncStatus.pending > 0;

  return (
    <div className="offline-sync-status">
      <div className="sync-stats">
        <span>Pending: {syncStatus.syncStatus.pending}</span>
        <span>Completed: {syncStatus.syncStatus.completed}</span>
        {syncStatus.syncStatus.failed > 0 && (
          <span className="error">Failed: {syncStatus.syncStatus.failed}</span>
        )}
      </div>
      
      {hasPending && (
        <button
          onClick={processSync}
          disabled={isSyncing}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
}
```

## Mobile Optimization

### 1. Mobile API Client

**src/api/mobileClient.ts**
```typescript
export class MobileAPIClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setToken(token: string) {
    this.token = token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Optimize for mobile
    const response = await fetch(`${this.baseURL}/api/pwa/mobile/optimize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          endpoint,
          options
        },
        compressionEnabled: true
      })
    });

    const result = await response.json();
    return result.data;
  }

  async optimizeImage(imageUrl: string, quality?: number, maxWidth?: number, maxHeight?: number): Promise<string> {
    const response = await fetch(`${this.baseURL}/api/pwa/mobile/image/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        imageUrl,
        quality,
        maxWidth,
        maxHeight
      })
    });

    const result = await response.json();
    return result.data.optimizedUrl;
  }
}
```

## Backend Service Integration

### 1. Course Management Service Integration

When a user completes a module, queue it for offline sync:

```typescript
// In Course Management Service
async function updateProgress(userId: string, courseId: string, moduleId: string, progress: number) {
  // Update in database
  await db.query(
    'UPDATE user_progress SET progress_percentage = $1 WHERE user_id = $2 AND course_id = $3 AND module_id = $4',
    [progress, userId, courseId, moduleId]
  );

  // Queue for offline sync (if user is offline)
  await fetch('http://pwa-service:3015/api/pwa/sync/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      endpoint: '/api/sync/progress',
      method: 'POST',
      data: { courseId, moduleId, progress },
      priority: 'high'
    })
  });
}
```

### 2. Notification Service Integration

Send push notifications through PWA service:

```typescript
// In Notification Service
async function sendCourseReminder(userId: string, courseTitle: string) {
  await fetch('http://pwa-service:3015/api/pwa/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      title: 'Course Reminder',
      body: `Don't forget to continue "${courseTitle}"`,
      data: {
        type: 'course_reminder',
        courseId: 'course-uuid'
      },
      actions: [
        {
          action: 'view',
          title: 'Continue Learning'
        }
      ]
    })
  });
}
```

## Testing

### 1. Test Push Notifications

```bash
# Send test notification
curl -X POST http://localhost:3015/api/pwa/push/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "user-uuid",
    "title": "Test Notification",
    "body": "This is a test push notification"
  }'
```

### 2. Test Offline Sync

```bash
# Queue sync request
curl -X POST http://localhost:3015/api/pwa/sync/queue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "user-uuid",
    "endpoint": "/api/sync/progress",
    "method": "POST",
    "data": {
      "courseId": "course-uuid",
      "progress": 75
    },
    "priority": "high"
  }'

# Process sync queue
curl -X POST http://localhost:3015/api/pwa/sync/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "user-uuid"
  }'
```

## Troubleshooting

### Service Worker Not Registering

1. Ensure HTTPS is enabled (required for service workers)
2. Check browser console for errors
3. Verify service worker file is accessible at `/service-worker.js`
4. Clear browser cache and try again

### Push Notifications Not Working

1. Verify VAPID keys are configured correctly
2. Check notification permissions in browser
3. Ensure HTTPS is enabled
4. Test with browser developer tools

### Offline Sync Not Processing

1. Check network connectivity
2. Verify authentication token is valid
3. Check sync queue status
4. Review server logs for errors

## Best Practices

1. **Service Worker Updates**: Implement update notifications for users
2. **Cache Management**: Regularly clean up old caches
3. **Offline UX**: Show clear indicators when offline
4. **Sync Conflicts**: Handle conflicts gracefully
5. **Error Handling**: Provide user-friendly error messages
6. **Performance**: Monitor cache hit rates and optimize strategies
7. **Security**: Always use HTTPS in production
8. **Testing**: Test offline functionality thoroughly

## Additional Resources

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
