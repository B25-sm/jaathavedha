/**
 * PWA Service Type Definitions
 */

// Service Worker Configuration Types
export interface ServiceWorkerConfig {
  version: string;
  cacheVersion: string;
  cacheMaxAge: number;
  offlineFallbackUrl: string;
  cachingStrategies: CachingStrategy[];
  syncEndpoints: SyncEndpoint[];
  pushNotificationConfig: PushNotificationConfig;
}

export interface CachingStrategy {
  name: string;
  pattern: string;
  strategy: 'cache-first' | 'network-first' | 'cache-only' | 'network-only' | 'stale-while-revalidate';
  cacheName: string;
  maxAge?: number;
  maxEntries?: number;
}

export interface SyncEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  priority: 'high' | 'medium' | 'low';
}

export interface PushNotificationConfig {
  vapidPublicKey: string;
  applicationServerKey: string;
}

// Offline Sync Types
export interface SyncRequest {
  id: string;
  userId: string;
  endpoint: string;
  method: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  status: SyncStatus;
  priority: 'high' | 'medium' | 'low';
}

export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SyncResponse {
  syncId: string;
  status: SyncStatus;
  processedCount: number;
  failedCount: number;
  errors?: SyncError[];
}

export interface SyncError {
  requestId: string;
  error: string;
  timestamp: Date;
}

export interface SyncQueueItem {
  id: string;
  userId: string;
  action: string;
  payload: any;
  timestamp: Date;
  retries: number;
}

// Push Subscription Types
export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  platform: 'web' | 'android' | 'ios';
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface PushSubscriptionRequest {
  userId: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  platform: 'web' | 'android' | 'ios';
  userAgent?: string;
}

// Mobile Optimization Types
export interface MobileOptimizationConfig {
  imageQuality: number;
  maxPayloadSize: number;
  cacheTTL: number;
  compressionEnabled: boolean;
  lazyLoadingEnabled: boolean;
}

export interface MobileAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  timestamp: Date;
  version: string;
  cached: boolean;
  cacheExpiry?: Date;
  payloadSize: number;
  compressionRatio?: number;
}

export interface ErrorResponse {
  type: string;
  code: string;
  message: string;
  details?: any;
}

// Offline Data Types
export interface OfflineData {
  id: string;
  userId: string;
  dataType: string;
  data: any;
  version: number;
  lastModified: Date;
  syncStatus: SyncStatus;
}

export interface OfflineDataRequest {
  userId: string;
  dataTypes: string[];
  lastSyncTimestamp?: Date;
}

export interface OfflineDataResponse {
  data: OfflineData[];
  syncToken: string;
  hasMore: boolean;
  nextSyncTimestamp: Date;
}

// Cache Management Types
export interface CacheEntry {
  key: string;
  value: any;
  expiresAt: Date;
  size: number;
  accessCount: number;
  lastAccessed: Date;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
}

// Background Sync Types
export interface BackgroundSyncTask {
  id: string;
  userId: string;
  taskType: string;
  payload: any;
  scheduledAt: Date;
  executedAt?: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  error?: string;
}

export interface BackgroundSyncConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  taskTypes: string[];
}

// Network Status Types
export interface NetworkStatus {
  online: boolean;
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

// Progressive Enhancement Types
export interface ProgressiveEnhancementConfig {
  enableServiceWorker: boolean;
  enableOfflineMode: boolean;
  enableBackgroundSync: boolean;
  enablePushNotifications: boolean;
  enableCaching: boolean;
  networkAwareLoading: boolean;
}

// Analytics Types
export interface PWAAnalytics {
  userId: string;
  eventType: PWAEventType;
  eventData: any;
  timestamp: Date;
  networkStatus: NetworkStatus;
  platform: string;
  userAgent: string;
}

export enum PWAEventType {
  SERVICE_WORKER_INSTALLED = 'sw_installed',
  SERVICE_WORKER_ACTIVATED = 'sw_activated',
  SERVICE_WORKER_UPDATED = 'sw_updated',
  OFFLINE_MODE_ENTERED = 'offline_entered',
  OFFLINE_MODE_EXITED = 'offline_exited',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  PUSH_SUBSCRIPTION_CREATED = 'push_subscription_created',
  PUSH_SUBSCRIPTION_DELETED = 'push_subscription_deleted',
  PUSH_NOTIFICATION_RECEIVED = 'push_received',
  PUSH_NOTIFICATION_CLICKED = 'push_clicked'
}

// Manifest Types
export interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  background_color: string;
  theme_color: string;
  orientation?: 'portrait' | 'landscape' | 'any';
  icons: ManifestIcon[];
  categories?: string[];
  screenshots?: ManifestScreenshot[];
  shortcuts?: ManifestShortcut[];
}

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable' | 'monochrome';
}

export interface ManifestScreenshot {
  src: string;
  sizes: string;
  type: string;
  label?: string;
}

export interface ManifestShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
  icons?: ManifestIcon[];
}
