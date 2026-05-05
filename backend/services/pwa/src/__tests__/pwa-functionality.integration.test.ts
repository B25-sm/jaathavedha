/**
 * Integration Tests for PWA Functionality and Offline Capabilities
 * Tests service worker configuration, offline sync, and cache management
 */

import { createClient, RedisClientType } from 'redis';
import { Pool } from 'pg';
import { ServiceWorkerConfigService } from '../services/ServiceWorkerConfigService';
import { OfflineSyncService } from '../services/OfflineSyncService';
import winston from 'winston';

describe('PWA Functionality Integration Tests', () => {
  let redisClient: RedisClientType;
  let dbPool: Pool;
  let logger: winston.Logger;
  let swConfigService: ServiceWorkerConfigService;
  let offlineSyncService: OfflineSyncService;

  beforeAll(async () => {
    // Initialize logger
    logger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })]
    });

    // Connect to Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();

    // Connect to PostgreSQL
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Initialize services
    swConfigService = new ServiceWorkerConfigService(redisClient, logger);
    offlineSyncService = new OfflineSyncService(redisClient, dbPool, logger);
  });

  afterAll(async () => {
    await redisClient?.quit();
    await dbPool?.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await redisClient.flushDb();
  });

  describe('Service Worker Configuration', () => {
    it('should generate valid service worker configuration', async () => {
      const config = await swConfigService.getServiceWorkerConfig();

      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.cacheName).toContain('sai-mahendra-cache');
      expect(config.cacheStrategies).toBeDefined();
      expect(config.offlineFallbackUrl).toBe('/offline.html');
    });

    it('should include all required caching strategies', async () => {
      const config = await swConfigService.getServiceWorkerConfig();

      expect(config.cacheStrategies).toHaveProperty('static');
      expect(config.cacheStrategies).toHaveProperty('api');
      expect(config.cacheStrategies).toHaveProperty('images');
      expect(config.cacheStrategies).toHaveProperty('videos');

      // Verify cache-first strategy for static assets
      expect(config.cacheStrategies.static.strategy).toBe('cache-first');
      expect(config.cacheStrategies.static.maxAgeSeconds).toBeGreaterThan(0);

      // Verify network-first strategy for API calls
      expect(config.cacheStrategies.api.strategy).toBe('network-first');
    });

    it('should generate user-specific configuration when userId provided', async () => {
      const userId = 'test-user-123';
      const config = await swConfigService.getServiceWorkerConfig(userId);

      expect(config).toBeDefined();
      expect(config.syncEndpoints).toBeDefined();
      expect(config.syncEndpoints.length).toBeGreaterThan(0);
    });

    it('should generate valid web app manifest', async () => {
      const manifest = await swConfigService.getWebAppManifest();

      expect(manifest).toBeDefined();
      expect(manifest.name).toBe('Sai Mahendra - AI & Fullstack Development');
      expect(manifest.short_name).toBe('Sai Mahendra');
      expect(manifest.start_url).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBeDefined();
      expect(manifest.background_color).toBeDefined();
      expect(manifest.icons).toBeDefined();
      expect(manifest.icons.length).toBeGreaterThan(0);
    });

    it('should include PWA icons in multiple sizes', async () => {
      const manifest = await swConfigService.getWebAppManifest();

      const iconSizes = manifest.icons.map((icon: any) => icon.sizes);
      expect(iconSizes).toContain('192x192');
      expect(iconSizes).toContain('512x512');

      // Verify icon types
      manifest.icons.forEach((icon: any) => {
        expect(icon.type).toBe('image/png');
        expect(icon.src).toMatch(/^\/icons\//);
      });
    });

    it('should return current cache version', async () => {
      const version = await swConfigService.getCurrentCacheVersion();

      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
      expect(version).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it('should clear all caches successfully', async () => {
      // Set some cache data
      await redisClient.set('sw:cache:test-key', 'test-value');

      // Clear caches
      await swConfigService.clearAllCaches();

      // Verify cache is cleared
      const value = await redisClient.get('sw:cache:test-key');
      expect(value).toBeNull();
    });
  });

  describe('Offline Data Synchronization', () => {
    const testUserId = 'test-user-sync-123';

    it('should queue sync request successfully', async () => {
      const syncRequest = {
        userId: testUserId,
        endpoint: '/api/courses/progress',
        method: 'POST',
        data: { courseId: 'course-1', progress: 75 },
        priority: 'high' as const
      };

      const syncId = await offlineSyncService.queueSyncRequest(syncRequest);

      expect(syncId).toBeDefined();
      expect(typeof syncId).toBe('string');
      expect(syncId.length).toBeGreaterThan(0);
    });

    it('should queue multiple sync requests with different priorities', async () => {
      const requests = [
        {
          userId: testUserId,
          endpoint: '/api/courses/progress',
          method: 'POST',
          data: { courseId: 'course-1', progress: 75 },
          priority: 'high' as const
        },
        {
          userId: testUserId,
          endpoint: '/api/notes/create',
          method: 'POST',
          data: { content: 'Test note', videoId: 'video-1' },
          priority: 'medium' as const
        },
        {
          userId: testUserId,
          endpoint: '/api/preferences/update',
          method: 'PUT',
          data: { theme: 'dark' },
          priority: 'low' as const
        }
      ];

      const syncIds = await Promise.all(
        requests.map(req => offlineSyncService.queueSyncRequest(req))
      );

      expect(syncIds).toHaveLength(3);
      syncIds.forEach(id => {
        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
      });
    });

    it('should retrieve sync status for user', async () => {
      // Queue a sync request
      await offlineSyncService.queueSyncRequest({
        userId: testUserId,
        endpoint: '/api/courses/progress',
        method: 'POST',
        data: { courseId: 'course-1', progress: 75 },
        priority: 'high'
      });

      const status = await offlineSyncService.getSyncStatus(testUserId);

      expect(status).toBeDefined();
      expect(status.userId).toBe(testUserId);
      expect(status.pendingCount).toBeGreaterThan(0);
      expect(status.requests).toBeDefined();
      expect(Array.isArray(status.requests)).toBe(true);
    });

    it('should process sync queue and execute requests', async () => {
      // Queue multiple requests
      await offlineSyncService.queueSyncRequest({
        userId: testUserId,
        endpoint: '/api/courses/progress',
        method: 'POST',
        data: { courseId: 'course-1', progress: 75 },
        priority: 'high'
      });

      await offlineSyncService.queueSyncRequest({
        userId: testUserId,
        endpoint: '/api/notes/create',
        method: 'POST',
        data: { content: 'Test note' },
        priority: 'medium'
      });

      // Process sync queue
      const result = await offlineSyncService.processSyncQueue(testUserId);

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThan(0);
      expect(result.successful).toBeDefined();
      expect(result.failed).toBeDefined();
    });

    it('should cancel sync requests', async () => {
      // Queue a request
      const syncId = await offlineSyncService.queueSyncRequest({
        userId: testUserId,
        endpoint: '/api/courses/progress',
        method: 'POST',
        data: { courseId: 'course-1', progress: 75 },
        priority: 'high'
      });

      // Cancel the request
      await offlineSyncService.cancelSyncRequests(testUserId, [syncId]);

      // Verify it's cancelled
      const status = await offlineSyncService.getSyncStatus(testUserId);
      const cancelledRequest = status.requests.find((r: any) => r.id === syncId);
      
      expect(cancelledRequest?.status).toBe('cancelled');
    });

    it('should retrieve offline data for multiple data types', async () => {
      const request = {
        userId: testUserId,
        dataTypes: ['courses', 'progress', 'videos'],
        lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString() // 24 hours ago
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.userId).toBe(testUserId);
      expect(offlineData.data).toBeDefined();
      expect(offlineData.syncTimestamp).toBeDefined();
    });

    it('should handle incremental sync with timestamp', async () => {
      const lastSync = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      const request = {
        userId: testUserId,
        dataTypes: ['courses', 'progress'],
        lastSyncTimestamp: lastSync
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.lastSyncTimestamp).toBe(lastSync);
      expect(new Date(offlineData.syncTimestamp).getTime()).toBeGreaterThan(
        new Date(lastSync).getTime()
      );
    });
  });

  describe('Cache Management and Strategies', () => {
    it('should implement cache-first strategy for static assets', async () => {
      const config = await swConfigService.getServiceWorkerConfig();
      const staticStrategy = config.cacheStrategies.static;

      expect(staticStrategy.strategy).toBe('cache-first');
      expect(staticStrategy.patterns).toBeDefined();
      expect(staticStrategy.patterns.length).toBeGreaterThan(0);
      expect(staticStrategy.maxAgeSeconds).toBeGreaterThan(0);
      expect(staticStrategy.maxEntries).toBeGreaterThan(0);
    });

    it('should implement network-first strategy for API calls', async () => {
      const config = await swConfigService.getServiceWorkerConfig();
      const apiStrategy = config.cacheStrategies.api;

      expect(apiStrategy.strategy).toBe('network-first');
      expect(apiStrategy.patterns).toBeDefined();
      expect(apiStrategy.networkTimeoutSeconds).toBeDefined();
      expect(apiStrategy.networkTimeoutSeconds).toBeGreaterThan(0);
    });

    it('should implement stale-while-revalidate for HTML pages', async () => {
      const config = await swConfigService.getServiceWorkerConfig();
      const htmlStrategy = config.cacheStrategies.html;

      expect(htmlStrategy.strategy).toBe('stale-while-revalidate');
      expect(htmlStrategy.maxAgeSeconds).toBeGreaterThan(0);
    });

    it('should configure offline fallback page', async () => {
      const config = await swConfigService.getServiceWorkerConfig();

      expect(config.offlineFallbackUrl).toBe('/offline.html');
      expect(config.offlineFallbackEnabled).toBe(true);
    });

    it('should support cache versioning for updates', async () => {
      const version1 = await swConfigService.getCurrentCacheVersion();
      
      // Simulate version update
      await redisClient.set('sw:cache:version', 'v2.0.0');
      
      const version2 = await swConfigService.getCurrentCacheVersion();

      expect(version1).not.toBe(version2);
    });
  });

  describe('Background Sync and Queue Management', () => {
    const testUserId = 'test-user-bg-sync-123';

    it('should handle background sync registration', async () => {
      const syncRequest = {
        userId: testUserId,
        endpoint: '/api/courses/progress',
        method: 'POST',
        data: { courseId: 'course-1', progress: 85 },
        priority: 'high' as const
      };

      const syncId = await offlineSyncService.queueSyncRequest(syncRequest);

      expect(syncId).toBeDefined();

      // Verify request is in queue
      const status = await offlineSyncService.getSyncStatus(testUserId);
      expect(status.pendingCount).toBeGreaterThan(0);
    });

    it('should process high priority requests first', async () => {
      // Queue low priority request first
      await offlineSyncService.queueSyncRequest({
        userId: testUserId,
        endpoint: '/api/preferences/update',
        method: 'PUT',
        data: { theme: 'dark' },
        priority: 'low'
      });

      // Queue high priority request
      await offlineSyncService.queueSyncRequest({
        userId: testUserId,
        endpoint: '/api/courses/progress',
        method: 'POST',
        data: { courseId: 'course-1', progress: 90 },
        priority: 'high'
      });

      const status = await offlineSyncService.getSyncStatus(testUserId);
      
      // High priority should be first in queue
      expect(status.requests[0].priority).toBe('high');
    });

    it('should retry failed sync requests', async () => {
      // Queue a request that will fail
      const syncId = await offlineSyncService.queueSyncRequest({
        userId: testUserId,
        endpoint: '/api/invalid/endpoint',
        method: 'POST',
        data: { test: 'data' },
        priority: 'medium'
      });

      // Process queue (will fail)
      await offlineSyncService.processSyncQueue(testUserId);

      // Check retry count
      const status = await offlineSyncService.getSyncStatus(testUserId);
      const failedRequest = status.requests.find((r: any) => r.id === syncId);

      expect(failedRequest).toBeDefined();
      expect(failedRequest.retryCount).toBeGreaterThan(0);
    });

    it('should limit retry attempts', async () => {
      const maxRetries = 3;
      
      // Queue a request
      const syncId = await offlineSyncService.queueSyncRequest({
        userId: testUserId,
        endpoint: '/api/invalid/endpoint',
        method: 'POST',
        data: { test: 'data' },
        priority: 'medium'
      });

      // Process multiple times to exceed retry limit
      for (let i = 0; i <= maxRetries; i++) {
        await offlineSyncService.processSyncQueue(testUserId);
      }

      const status = await offlineSyncService.getSyncStatus(testUserId);
      const failedRequest = status.requests.find((r: any) => r.id === syncId);

      expect(failedRequest.status).toBe('failed');
      expect(failedRequest.retryCount).toBeLessThanOrEqual(maxRetries);
    });
  });

  describe('Offline Capability Testing', () => {
    const testUserId = 'test-user-offline-123';

    it('should support offline course data access', async () => {
      const request = {
        userId: testUserId,
        dataTypes: ['courses'],
        lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString()
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.data.courses).toBeDefined();
    });

    it('should support offline progress tracking', async () => {
      const request = {
        userId: testUserId,
        dataTypes: ['progress'],
        lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString()
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.data.progress).toBeDefined();
    });

    it('should support offline video metadata', async () => {
      const request = {
        userId: testUserId,
        dataTypes: ['videos'],
        lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString()
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.data.videos).toBeDefined();
    });

    it('should support offline notes access', async () => {
      const request = {
        userId: testUserId,
        dataTypes: ['notes'],
        lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString()
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.data.notes).toBeDefined();
    });

    it('should support offline bookmarks', async () => {
      const request = {
        userId: testUserId,
        dataTypes: ['bookmarks'],
        lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString()
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.data.bookmarks).toBeDefined();
    });

    it('should support offline quiz data', async () => {
      const request = {
        userId: testUserId,
        dataTypes: ['quizzes'],
        lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString()
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.data.quizzes).toBeDefined();
    });

    it('should handle multiple data types in single request', async () => {
      const request = {
        userId: testUserId,
        dataTypes: ['courses', 'progress', 'videos', 'notes'],
        lastSyncTimestamp: new Date(Date.now() - 86400000).toISOString()
      };

      const offlineData = await offlineSyncService.getOfflineData(request);

      expect(offlineData).toBeDefined();
      expect(offlineData.data.courses).toBeDefined();
      expect(offlineData.data.progress).toBeDefined();
      expect(offlineData.data.videos).toBeDefined();
      expect(offlineData.data.notes).toBeDefined();
    });
  });

  describe('PWA Installation and Manifest', () => {
    it('should provide installable PWA manifest', async () => {
      const manifest = await swConfigService.getWebAppManifest();

      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('/');
      expect(manifest.scope).toBe('/');
    });

    it('should include app shortcuts in manifest', async () => {
      const manifest = await swConfigService.getWebAppManifest();

      expect(manifest.shortcuts).toBeDefined();
      expect(Array.isArray(manifest.shortcuts)).toBe(true);
      expect(manifest.shortcuts.length).toBeGreaterThan(0);
    });

    it('should include screenshots for app stores', async () => {
      const manifest = await swConfigService.getWebAppManifest();

      expect(manifest.screenshots).toBeDefined();
      expect(Array.isArray(manifest.screenshots)).toBe(true);
    });

    it('should configure proper orientation', async () => {
      const manifest = await swConfigService.getWebAppManifest();

      expect(manifest.orientation).toBeDefined();
      expect(['any', 'portrait', 'landscape']).toContain(manifest.orientation);
    });

    it('should include categories for app classification', async () => {
      const manifest = await swConfigService.getWebAppManifest();

      expect(manifest.categories).toBeDefined();
      expect(Array.isArray(manifest.categories)).toBe(true);
      expect(manifest.categories).toContain('education');
    });
  });
});
