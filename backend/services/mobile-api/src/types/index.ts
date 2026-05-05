/**
 * Mobile API Service Types
 * TypeScript interfaces and types for mobile-optimized API
 */

// Device Types
export interface UserDevice {
  id: string;
  userId: string;
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
  deviceName: string;
  osVersion: string;
  appVersion: string;
  fcmToken?: string;
  apnsToken?: string;
  isActive: boolean;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceRegistration {
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
  deviceName: string;
  osVersion: string;
  appVersion: string;
  pushToken?: string;
}

// Offline Content Types
export interface OfflineContent {
  id: string;
  userId: string;
  deviceId: string;
  contentType: 'video' | 'document' | 'quiz' | 'assignment';
  contentId: string;
  courseId: string;
  downloadedAt: Date;
  expiresAt: Date;
  fileSize: number;
  quality?: string;
  status: 'downloading' | 'completed' | 'expired' | 'failed';
  progress: number;
  metadata: Record<string, any>;
}

export interface ContentDownloadRequest {
  contentType: 'video' | 'document' | 'quiz' | 'assignment';
  contentId: string;
  courseId: string;
  quality?: string;
  wifiOnly?: boolean;
}

// Sync Types
export interface SyncOperation {
  id: string;
  userId: string;
  deviceId: string;
  operationType: 'create' | 'update' | 'delete';
  entityType: 'progress' | 'note' | 'bookmark' | 'quiz_result' | 'assignment';
  entityId: string;
  data: Record<string, any>;
  timestamp: Date;
  status: 'pending' | 'synced' | 'conflict' | 'failed';
  retryCount: number;
  syncedAt?: Date;
}

export interface SyncRequest {
  deviceId: string;
  lastSyncTimestamp: Date;
  operations: Array<{
    operationType: 'create' | 'update' | 'delete';
    entityType: string;
    entityId: string;
    data: Record<string, any>;
    timestamp: Date;
  }>;
}

export interface SyncResponse {
  success: boolean;
  syncedOperations: string[];
  conflicts: SyncConflict[];
  serverUpdates: Array<{
    entityType: string;
    entityId: string;
    data: Record<string, any>;
    timestamp: Date;
  }>;
  lastSyncTimestamp: Date;
}

export interface SyncConflict {
  id: string;
  userId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  clientData: Record<string, any>;
  serverData: Record<string, any>;
  clientTimestamp: Date;
  serverTimestamp: Date;
  resolution?: 'client_wins' | 'server_wins' | 'merge' | 'manual';
  resolvedAt?: Date;
  resolvedData?: Record<string, any>;
}

// Download Queue Types
export interface DownloadQueueItem {
  id: string;
  userId: string;
  deviceId: string;
  contentType: 'video' | 'document';
  contentId: string;
  courseId: string;
  quality?: string;
  priority: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress: number;
  fileSize: number;
  downloadedBytes: number;
  downloadUrl?: string;
  wifiOnly: boolean;
  retryCount: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
}

// Push Notification Types
export interface PushNotification {
  id: string;
  userId: string;
  deviceIds?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  category: 'course_update' | 'assignment' | 'live_session' | 'achievement' | 'reminder' | 'general';
  priority: 'high' | 'normal' | 'low';
  scheduledFor?: Date;
  sentAt?: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  deliveryStats?: {
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
  };
  createdAt: Date;
}

export interface NotificationSubscription {
  userId: string;
  deviceId: string;
  categories: string[];
  enabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

export interface SendNotificationRequest {
  userIds?: string[];
  deviceIds?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  category: string;
  priority?: 'high' | 'normal' | 'low';
  scheduledFor?: Date;
}

// Mobile Content Types
export interface MobileContentRequest {
  fields?: string[];
  limit?: number;
  offset?: number;
  includeRelations?: string[];
  compress?: boolean;
}

export interface MobileContentResponse<T> {
  data: T;
  metadata: {
    fields: string[];
    compressed: boolean;
    size: number;
    timestamp: Date;
  };
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// Mobile Analytics Types
export interface MobileAnalyticsEvent {
  id: string;
  userId: string;
  deviceId: string;
  eventType: string;
  eventCategory: 'engagement' | 'performance' | 'error' | 'navigation' | 'content';
  eventData: Record<string, any>;
  sessionId: string;
  timestamp: Date;
  deviceInfo: {
    deviceType: string;
    osVersion: string;
    appVersion: string;
    screenSize?: string;
    connectionType?: string;
  };
}

export interface MobileSession {
  id: string;
  userId: string;
  deviceId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  screenViews: number;
  interactions: number;
  errors: number;
  connectionType: string;
  batteryLevel?: number;
}

export interface CrossDeviceProgress {
  userId: string;
  courseId: string;
  lessonId: string;
  progress: number;
  lastPosition?: number;
  completedAt?: Date;
  devices: Array<{
    deviceId: string;
    lastAccessedAt: Date;
    progress: number;
  }>;
  syncedAt: Date;
}

// Batch Request Types
export interface BatchRequest {
  requests: Array<{
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }>;
}

export interface BatchResponse {
  responses: Array<{
    id: string;
    status: number;
    body: any;
    headers?: Record<string, string>;
  }>;
}

// Storage Management Types
export interface StorageInfo {
  userId: string;
  deviceId: string;
  totalSize: number;
  usedSize: number;
  availableSize: number;
  downloads: Array<{
    contentId: string;
    contentType: string;
    size: number;
    downloadedAt: Date;
    expiresAt: Date;
  }>;
}

// Error Types
export interface MobileAPIError {
  type: string;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId?: string;
}

// Request Context
export interface MobileRequestContext {
  userId: string;
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
  appVersion: string;
  connectionType?: string;
  batteryLevel?: number;
}
