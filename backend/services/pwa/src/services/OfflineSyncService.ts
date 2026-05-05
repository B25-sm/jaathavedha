import { Logger } from 'winston';
import { RedisClientType } from 'redis';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  SyncRequest,
  SyncResponse,
  SyncStatus,
  SyncError,
  SyncQueueItem,
  OfflineData,
  OfflineDataRequest,
  OfflineDataResponse,
  BackgroundSyncTask
} from '../types';

/**
 * Offline Synchronization Service
 * Handles offline data synchronization and background sync tasks
 */
export class OfflineSyncService {
  private redis: RedisClientType;
  private db: Pool;
  private logger: Logger;
  private syncBatchSize: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(redis: RedisClientType, db: Pool, logger: Logger) {
    this.redis = redis;
    this.db = db;
    this.logger = logger;
    this.syncBatchSize = parseInt(process.env.SYNC_BATCH_SIZE || '50');
    this.maxRetries = parseInt(process.env.SYNC_MAX_RETRIES || '3');
    this.retryDelay = parseInt(process.env.SYNC_RETRY_DELAY || '5000');
  }

  /**
   * Queue sync request for offline data
   */
  async queueSyncRequest(request: Omit<SyncRequest, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    try {
      const syncRequest: SyncRequest = {
        id: uuidv4(),
        ...request,
        timestamp: new Date(),
        retryCount: 0,
        status: SyncStatus.PENDING
      };

      // Store in database
      await this.db.query(
        `INSERT INTO sync_requests (id, user_id, endpoint, method, data, timestamp, retry_count, status, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          syncRequest.id,
          syncRequest.userId,
          syncRequest.endpoint,
          syncRequest.method,
          JSON.stringify(syncRequest.data),
          syncRequest.timestamp,
          syncRequest.retryCount,
          syncRequest.status,
          syncRequest.priority
        ]
      );

      // Add to Redis queue for processing
      await this.redis.lPush(`sync:queue:${syncRequest.priority}`, syncRequest.id);

      this.logger.info('Sync request queued', { 
        syncId: syncRequest.id, 
        userId: syncRequest.userId,
        endpoint: syncRequest.endpoint 
      });

      return syncRequest.id;
    } catch (error: any) {
      this.logger.error('Error queuing sync request', { error: error.message, request });
      throw error;
    }
  }

  /**
   * Process pending sync requests
   */
  async processSyncQueue(userId?: string): Promise<SyncResponse> {
    try {
      const processedCount = 0;
      const failedCount = 0;
      const errors: SyncError[] = [];

      // Process high priority first, then medium, then low
      const priorities = ['high', 'medium', 'low'];

      for (const priority of priorities) {
        const queueKey = `sync:queue:${priority}`;
        const batchSize = this.syncBatchSize;

        // Get batch of sync requests
        const syncIds = await this.redis.lRange(queueKey, 0, batchSize - 1);

        for (const syncId of syncIds) {
          try {
            const result = await this.db.query(
              'SELECT * FROM sync_requests WHERE id = $1 AND status = $2',
              [syncId, SyncStatus.PENDING]
            );

            if (result.rows.length === 0) {
              // Remove from queue if not found or already processed
              await this.redis.lRem(queueKey, 1, syncId);
              continue;
            }

            const syncRequest = result.rows[0];

            // Skip if userId filter is provided and doesn't match
            if (userId && syncRequest.user_id !== userId) {
              continue;
            }

            // Process the sync request
            await this.processSyncRequest(syncRequest);

            // Remove from queue
            await this.redis.lRem(queueKey, 1, syncId);
          } catch (error: any) {
            this.logger.error('Error processing sync request', { error: error.message, syncId });
            errors.push({
              requestId: syncId,
              error: error.message,
              timestamp: new Date()
            });
          }
        }
      }

      return {
        syncId: uuidv4(),
        status: failedCount === 0 ? SyncStatus.COMPLETED : SyncStatus.FAILED,
        processedCount,
        failedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      this.logger.error('Error processing sync queue', { error: error.message });
      throw error;
    }
  }

  /**
   * Process individual sync request
   */
  private async processSyncRequest(syncRequest: any): Promise<void> {
    try {
      // Update status to in_progress
      await this.db.query(
        'UPDATE sync_requests SET status = $1 WHERE id = $2',
        [SyncStatus.IN_PROGRESS, syncRequest.id]
      );

      // Parse the data
      const data = typeof syncRequest.data === 'string' 
        ? JSON.parse(syncRequest.data) 
        : syncRequest.data;

      // Route to appropriate handler based on endpoint
      if (syncRequest.endpoint.includes('/progress')) {
        await this.syncCourseProgress(syncRequest.user_id, data);
      } else if (syncRequest.endpoint.includes('/video-analytics')) {
        await this.syncVideoAnalytics(syncRequest.user_id, data);
      } else if (syncRequest.endpoint.includes('/notes')) {
        await this.syncNotes(syncRequest.user_id, data);
      } else if (syncRequest.endpoint.includes('/bookmarks')) {
        await this.syncBookmarks(syncRequest.user_id, data);
      } else if (syncRequest.endpoint.includes('/quiz-responses')) {
        await this.syncQuizResponses(syncRequest.user_id, data);
      } else if (syncRequest.endpoint.includes('/preferences')) {
        await this.syncUserPreferences(syncRequest.user_id, data);
      }

      // Update status to completed
      await this.db.query(
        'UPDATE sync_requests SET status = $1 WHERE id = $2',
        [SyncStatus.COMPLETED, syncRequest.id]
      );

      this.logger.info('Sync request completed', { syncId: syncRequest.id });
    } catch (error: any) {
      this.logger.error('Error processing sync request', { 
        error: error.message, 
        syncId: syncRequest.id 
      });

      // Increment retry count
      const newRetryCount = syncRequest.retry_count + 1;

      if (newRetryCount >= this.maxRetries) {
        // Mark as failed if max retries reached
        await this.db.query(
          'UPDATE sync_requests SET status = $1, retry_count = $2 WHERE id = $3',
          [SyncStatus.FAILED, newRetryCount, syncRequest.id]
        );
      } else {
        // Reset to pending for retry
        await this.db.query(
          'UPDATE sync_requests SET status = $1, retry_count = $2 WHERE id = $3',
          [SyncStatus.PENDING, newRetryCount, syncRequest.id]
        );

        // Re-add to queue with delay
        setTimeout(async () => {
          await this.redis.lPush(`sync:queue:${syncRequest.priority}`, syncRequest.id);
        }, this.retryDelay);
      }

      throw error;
    }
  }

  /**
   * Sync course progress
   */
  private async syncCourseProgress(userId: string, data: any): Promise<void> {
    const { courseId, moduleId, progress, completedAt } = data;

    await this.db.query(
      `INSERT INTO user_progress (user_id, course_id, module_id, progress_percentage, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, course_id, module_id)
       DO UPDATE SET progress_percentage = $4, completed_at = $5, updated_at = NOW()`,
      [userId, courseId, moduleId, progress, completedAt]
    );
  }

  /**
   * Sync video analytics
   */
  private async syncVideoAnalytics(userId: string, data: any): Promise<void> {
    const { videoId, watchTime, completionPercentage, lastPosition } = data;

    await this.db.query(
      `INSERT INTO video_analytics (user_id, video_id, watch_time, completion_percentage, last_position, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, video_id)
       DO UPDATE SET watch_time = video_analytics.watch_time + $3, 
                     completion_percentage = $4, 
                     last_position = $5, 
                     updated_at = NOW()`,
      [userId, videoId, watchTime, completionPercentage, lastPosition]
    );
  }

  /**
   * Sync notes
   */
  private async syncNotes(userId: string, data: any): Promise<void> {
    const { videoId, timestamp, content, isPublic } = data;

    await this.db.query(
      `INSERT INTO video_notes (id, user_id, video_id, timestamp, content, is_public, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
      [userId, videoId, timestamp, content, isPublic || false]
    );
  }

  /**
   * Sync bookmarks
   */
  private async syncBookmarks(userId: string, data: any): Promise<void> {
    const { videoId, timestamp, title, description } = data;

    await this.db.query(
      `INSERT INTO video_bookmarks (id, user_id, video_id, timestamp, title, description, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
      [userId, videoId, timestamp, title, description]
    );
  }

  /**
   * Sync quiz responses
   */
  private async syncQuizResponses(userId: string, data: any): Promise<void> {
    const { quizId, questionId, answer, isCorrect, completedAt } = data;

    await this.db.query(
      `INSERT INTO quiz_responses (id, user_id, quiz_id, question_id, answer, is_correct, completed_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [userId, quizId, questionId, JSON.stringify(answer), isCorrect, completedAt]
    );
  }

  /**
   * Sync user preferences
   */
  private async syncUserPreferences(userId: string, data: any): Promise<void> {
    await this.db.query(
      `UPDATE users SET preferences = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(data), userId]
    );
  }

  /**
   * Get offline data for user
   */
  async getOfflineData(request: OfflineDataRequest): Promise<OfflineDataResponse> {
    try {
      const { userId, dataTypes, lastSyncTimestamp } = request;
      const offlineData: OfflineData[] = [];

      // Fetch data for each requested type
      for (const dataType of dataTypes) {
        let data: any[] = [];

        switch (dataType) {
          case 'courses':
            data = await this.getEnrolledCourses(userId, lastSyncTimestamp);
            break;
          case 'progress':
            data = await this.getUserProgress(userId, lastSyncTimestamp);
            break;
          case 'videos':
            data = await this.getVideoData(userId, lastSyncTimestamp);
            break;
          case 'notes':
            data = await this.getUserNotes(userId, lastSyncTimestamp);
            break;
          case 'bookmarks':
            data = await this.getUserBookmarks(userId, lastSyncTimestamp);
            break;
        }

        offlineData.push({
          id: uuidv4(),
          userId,
          dataType,
          data,
          version: 1,
          lastModified: new Date(),
          syncStatus: SyncStatus.COMPLETED
        });
      }

      return {
        data: offlineData,
        syncToken: uuidv4(),
        hasMore: false,
        nextSyncTimestamp: new Date()
      };
    } catch (error: any) {
      this.logger.error('Error getting offline data', { error: error.message, request });
      throw error;
    }
  }

  /**
   * Get enrolled courses for offline access
   */
  private async getEnrolledCourses(userId: string, lastSync?: Date): Promise<any[]> {
    const query = lastSync
      ? 'SELECT c.* FROM courses c JOIN enrollments e ON c.id = e.course_id WHERE e.user_id = $1 AND c.updated_at > $2'
      : 'SELECT c.* FROM courses c JOIN enrollments e ON c.id = e.course_id WHERE e.user_id = $1';

    const params = lastSync ? [userId, lastSync] : [userId];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get user progress data
   */
  private async getUserProgress(userId: string, lastSync?: Date): Promise<any[]> {
    const query = lastSync
      ? 'SELECT * FROM user_progress WHERE user_id = $1 AND updated_at > $2'
      : 'SELECT * FROM user_progress WHERE user_id = $1';

    const params = lastSync ? [userId, lastSync] : [userId];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get video data for offline viewing
   */
  private async getVideoData(userId: string, lastSync?: Date): Promise<any[]> {
    const query = `
      SELECT v.* FROM videos v
      JOIN courses c ON v.course_id = c.id
      JOIN enrollments e ON c.id = e.course_id
      WHERE e.user_id = $1
      ${lastSync ? 'AND v.updated_at > $2' : ''}
    `;

    const params = lastSync ? [userId, lastSync] : [userId];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get user notes
   */
  private async getUserNotes(userId: string, lastSync?: Date): Promise<any[]> {
    const query = lastSync
      ? 'SELECT * FROM video_notes WHERE user_id = $1 AND created_at > $2'
      : 'SELECT * FROM video_notes WHERE user_id = $1';

    const params = lastSync ? [userId, lastSync] : [userId];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get user bookmarks
   */
  private async getUserBookmarks(userId: string, lastSync?: Date): Promise<any[]> {
    const query = lastSync
      ? 'SELECT * FROM video_bookmarks WHERE user_id = $1 AND created_at > $2'
      : 'SELECT * FROM video_bookmarks WHERE user_id = $1';

    const params = lastSync ? [userId, lastSync] : [userId];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get sync status for user
   */
  async getSyncStatus(userId: string): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT status, COUNT(*) as count 
         FROM sync_requests 
         WHERE user_id = $1 
         GROUP BY status`,
        [userId]
      );

      const statusCounts: any = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0
      };

      result.rows.forEach(row => {
        statusCounts[row.status] = parseInt(row.count);
      });

      return {
        userId,
        syncStatus: statusCounts,
        lastSyncAt: await this.getLastSyncTime(userId)
      };
    } catch (error: any) {
      this.logger.error('Error getting sync status', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get last sync time for user
   */
  private async getLastSyncTime(userId: string): Promise<Date | null> {
    const result = await this.db.query(
      `SELECT MAX(timestamp) as last_sync 
       FROM sync_requests 
       WHERE user_id = $1 AND status = $2`,
      [userId, SyncStatus.COMPLETED]
    );

    return result.rows[0]?.last_sync || null;
  }

  /**
   * Cancel pending sync requests
   */
  async cancelSyncRequests(userId: string, syncIds?: string[]): Promise<void> {
    try {
      if (syncIds && syncIds.length > 0) {
        await this.db.query(
          `UPDATE sync_requests 
           SET status = $1 
           WHERE user_id = $2 AND id = ANY($3) AND status = $4`,
          [SyncStatus.CANCELLED, userId, syncIds, SyncStatus.PENDING]
        );
      } else {
        await this.db.query(
          `UPDATE sync_requests 
           SET status = $1 
           WHERE user_id = $2 AND status = $3`,
          [SyncStatus.CANCELLED, userId, SyncStatus.PENDING]
        );
      }

      this.logger.info('Sync requests cancelled', { userId, syncIds });
    } catch (error: any) {
      this.logger.error('Error cancelling sync requests', { error: error.message, userId });
      throw error;
    }
  }
}
