import { Logger } from 'winston';
import { RedisClientType } from 'redis';
import {
  ServiceWorkerConfig,
  CachingStrategy,
  SyncEndpoint,
  PushNotificationConfig,
  WebAppManifest
} from '../types';

/**
 * Service Worker Configuration Service
 * Manages service worker configuration, caching strategies, and PWA manifest
 */
export class ServiceWorkerConfigService {
  private redis: RedisClientType;
  private logger: Logger;
  private cacheVersion: string;

  constructor(redis: RedisClientType, logger: Logger) {
    this.redis = redis;
    this.logger = logger;
    this.cacheVersion = process.env.SW_CACHE_VERSION || 'v1';
  }

  /**
   * Get service worker configuration
   */
  async getServiceWorkerConfig(userId?: string): Promise<ServiceWorkerConfig> {
    try {
      const config: ServiceWorkerConfig = {
        version: this.cacheVersion,
        cacheVersion: this.cacheVersion,
        cacheMaxAge: parseInt(process.env.SW_CACHE_MAX_AGE || '86400'),
        offlineFallbackUrl: process.env.SW_OFFLINE_FALLBACK_URL || '/offline.html',
        cachingStrategies: this.getCachingStrategies(),
        syncEndpoints: this.getSyncEndpoints(),
        pushNotificationConfig: await this.getPushNotificationConfig()
      };

      return config;
    } catch (error: any) {
      this.logger.error('Error getting service worker config', { error: error.message });
      throw error;
    }
  }

  /**
   * Get caching strategies for different resource types
   */
  private getCachingStrategies(): CachingStrategy[] {
    return [
      {
        name: 'static-assets',
        pattern: '\\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$',
        strategy: 'cache-first',
        cacheName: `static-${this.cacheVersion}`,
        maxAge: 30 * 24 * 60 * 60, // 30 days
        maxEntries: 100
      },
      {
        name: 'api-data',
        pattern: '/api/(courses|programs|content)',
        strategy: 'network-first',
        cacheName: `api-data-${this.cacheVersion}`,
        maxAge: 5 * 60, // 5 minutes
        maxEntries: 50
      },
      {
        name: 'user-data',
        pattern: '/api/(profile|enrollments|progress)',
        strategy: 'network-first',
        cacheName: `user-data-${this.cacheVersion}`,
        maxAge: 60, // 1 minute
        maxEntries: 20
      },
      {
        name: 'video-content',
        pattern: '/api/videos',
        strategy: 'cache-first',
        cacheName: `video-${this.cacheVersion}`,
        maxAge: 7 * 24 * 60 * 60, // 7 days
        maxEntries: 30
      },
      {
        name: 'images',
        pattern: '/images/',
        strategy: 'cache-first',
        cacheName: `images-${this.cacheVersion}`,
        maxAge: 30 * 24 * 60 * 60, // 30 days
        maxEntries: 100
      },
      {
        name: 'documents',
        pattern: '\\.(pdf|doc|docx|xls|xlsx)$',
        strategy: 'cache-first',
        cacheName: `documents-${this.cacheVersion}`,
        maxAge: 7 * 24 * 60 * 60, // 7 days
        maxEntries: 50
      },
      {
        name: 'html-pages',
        pattern: '/$|/[^.]*$',
        strategy: 'network-first',
        cacheName: `pages-${this.cacheVersion}`,
        maxAge: 60 * 60, // 1 hour
        maxEntries: 20
      }
    ];
  }

  /**
   * Get sync endpoints for offline synchronization
   */
  private getSyncEndpoints(): SyncEndpoint[] {
    return [
      {
        name: 'course-progress',
        url: '/api/sync/progress',
        method: 'POST',
        priority: 'high'
      },
      {
        name: 'video-analytics',
        url: '/api/sync/video-analytics',
        method: 'POST',
        priority: 'high'
      },
      {
        name: 'notes',
        url: '/api/sync/notes',
        method: 'POST',
        priority: 'medium'
      },
      {
        name: 'bookmarks',
        url: '/api/sync/bookmarks',
        method: 'POST',
        priority: 'medium'
      },
      {
        name: 'quiz-responses',
        url: '/api/sync/quiz-responses',
        method: 'POST',
        priority: 'high'
      },
      {
        name: 'user-preferences',
        url: '/api/sync/preferences',
        method: 'PUT',
        priority: 'low'
      }
    ];
  }

  /**
   * Get push notification configuration
   */
  private async getPushNotificationConfig(): Promise<PushNotificationConfig> {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    
    return {
      vapidPublicKey,
      applicationServerKey: vapidPublicKey
    };
  }

  /**
   * Get web app manifest
   */
  async getWebAppManifest(): Promise<WebAppManifest> {
    try {
      const manifest: WebAppManifest = {
        name: 'Sai Mahendra - AI & Fullstack Development',
        short_name: 'Sai Mahendra',
        description: 'Learn AI and Fullstack Development with expert-led courses',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#4F46E5',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['education', 'productivity'],
        screenshots: [
          {
            src: '/screenshots/desktop-1.png',
            sizes: '1280x720',
            type: 'image/png',
            label: 'Course Dashboard'
          },
          {
            src: '/screenshots/mobile-1.png',
            sizes: '750x1334',
            type: 'image/png',
            label: 'Mobile Learning'
          }
        ],
        shortcuts: [
          {
            name: 'My Courses',
            short_name: 'Courses',
            description: 'View your enrolled courses',
            url: '/dashboard/courses',
            icons: [
              {
                src: '/icons/shortcut-courses.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Continue Learning',
            short_name: 'Continue',
            description: 'Resume your last lesson',
            url: '/dashboard/continue',
            icons: [
              {
                src: '/icons/shortcut-continue.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          }
        ]
      };

      return manifest;
    } catch (error: any) {
      this.logger.error('Error getting web app manifest', { error: error.message });
      throw error;
    }
  }

  /**
   * Update cache version (for cache busting)
   */
  async updateCacheVersion(newVersion: string): Promise<void> {
    try {
      this.cacheVersion = newVersion;
      await this.redis.set('pwa:cache_version', newVersion);
      this.logger.info('Cache version updated', { version: newVersion });
    } catch (error: any) {
      this.logger.error('Error updating cache version', { error: error.message });
      throw error;
    }
  }

  /**
   * Get current cache version
   */
  async getCurrentCacheVersion(): Promise<string> {
    try {
      const version = await this.redis.get('pwa:cache_version');
      return version || this.cacheVersion;
    } catch (error: any) {
      this.logger.error('Error getting cache version', { error: error.message });
      return this.cacheVersion;
    }
  }

  /**
   * Clear all caches (for admin use)
   */
  async clearAllCaches(): Promise<void> {
    try {
      // Increment cache version to invalidate all caches
      const currentVersion = await this.getCurrentCacheVersion();
      const versionNumber = parseInt(currentVersion.replace('v', '')) || 1;
      const newVersion = `v${versionNumber + 1}`;
      
      await this.updateCacheVersion(newVersion);
      
      this.logger.info('All caches cleared', { oldVersion: currentVersion, newVersion });
    } catch (error: any) {
      this.logger.error('Error clearing caches', { error: error.message });
      throw error;
    }
  }
}
