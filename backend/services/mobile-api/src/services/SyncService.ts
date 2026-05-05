/**
 * Sync Service
 * Handles offline content synchronization with conflict resolution
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { SyncRequest, SyncResponse, SyncConflict, SyncOperation } from '../types';

export class SyncService {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Sync progress data from mobile device
   */
  async syncProgress(userId: string, deviceId: string, progressData: any[]): Promise<any> {
    const client = await this.db.connect();
    const syncedItems: string[] = [];
    const conflicts: SyncConflict[] = [];

    try {
      await client.query('BEGIN');

      for (const item of progressData) {
        const { lessonId, progress, lastPosition, timestamp } = item;

        // Check for existing progress
        const existing = await client.query(
          `SELECT progress, last_position, updated_at 
           FROM cross_device_progress 
           WHERE user_id = $1 AND lesson_id = $2`,
          [userId, lessonId]
        );

        if (existing.rows.length > 0) {
          const serverData = existing.rows[0];
          const serverTimestamp = new Date(serverData.updated_at);
          const clientTimestamp = new Date(timestamp);

          // Check for conflict (server has newer data)
          if (serverTimestamp > clientTimestamp && serverData.progress !== progress) {
            conflicts.push({
              id: `conflict-${Date.now()}`,
              userId,
              deviceId,
              entityType: 'progress',
              entityId: lessonId,
              clientData: { progress, lastPosition },
              serverData: { progress: serverData.progress, lastPosition: serverData.last_position },
              clientTimestamp,
              serverTimestamp,
            });
            continue;
          }
        }

        // Upsert progress
        await client.query(
          `INSERT INTO cross_device_progress 
           (user_id, lesson_id, progress, last_position, synced_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), $5)
           ON CONFLICT (user_id, lesson_id) 
           DO UPDATE SET 
             progress = GREATEST(cross_device_progress.progress, EXCLUDED.progress),
             last_position = EXCLUDED.last_position,
             synced_at = NOW(),
             updated_at = EXCLUDED.updated_at`,
          [userId, lessonId, progress, lastPosition, timestamp]
        );

        // Update device info in devices array
        await client.query(
          `UPDATE cross_device_progress 
           SET devices = COALESCE(devices, '[]'::jsonb) || 
             jsonb_build_object('deviceId', $3, 'lastAccessedAt', NOW(), 'progress', $4)
           WHERE user_id = $1 AND lesson_id = $2`,
          [userId, lessonId, deviceId, progress]
        );

        syncedItems.push(lessonId);
      }

      await client.query('COMMIT');

      // Invalidate cache
      await this.redis.del(`mobile:progress:${userId}`);

      return {
        userId,
        synced: syncedItems.length,
        conflicts: conflicts.length,
        timestamp: new Date(),
        syncedItems,
        conflicts,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Sync notes from mobile device
   */
  async syncNotes(userId: string, deviceId: string, notes: any[]): Promise<any> {
    const client = await this.db.connect();
    const syncedNotes: string[] = [];

    try {
      await client.query('BEGIN');

      for (const note of notes) {
        const { id, lessonId, content, timestamp: noteTimestamp, deleted } = note;

        if (deleted) {
          // Delete note
          await client.query(
            `DELETE FROM user_notes WHERE id = $1 AND user_id = $2`,
            [id, userId]
          );
        } else {
          // Upsert note
          await client.query(
            `INSERT INTO user_notes 
             (id, user_id, lesson_id, content, timestamp, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (id) 
             DO UPDATE SET 
               content = EXCLUDED.content,
               timestamp = EXCLUDED.timestamp,
               updated_at = NOW()`,
            [id, userId, lessonId, content, noteTimestamp]
          );
        }

        syncedNotes.push(id);
      }

      await client.query('COMMIT');

      return {
        userId,
        notesSynced: syncedNotes.length,
        timestamp: new Date(),
        syncedNotes,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Sync bookmarks from mobile device
   */
  async syncBookmarks(userId: string, deviceId: string, bookmarks: any[]): Promise<any> {
    const client = await this.db.connect();
    const syncedBookmarks: string[] = [];

    try {
      await client.query('BEGIN');

      for (const bookmark of bookmarks) {
        const { id, lessonId, timestamp: bookmarkTimestamp, title, deleted } = bookmark;

        if (deleted) {
          // Delete bookmark
          await client.query(
            `DELETE FROM user_bookmarks WHERE id = $1 AND user_id = $2`,
            [id, userId]
          );
        } else {
          // Upsert bookmark
          await client.query(
            `INSERT INTO user_bookmarks 
             (id, user_id, lesson_id, timestamp, title, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (id) 
             DO UPDATE SET 
               timestamp = EXCLUDED.timestamp,
               title = EXCLUDED.title,
               updated_at = NOW()`,
            [id, userId, lessonId, bookmarkTimestamp, title]
          );
        }

        syncedBookmarks.push(id);
      }

      await client.query('COMMIT');

      return {
        userId,
        bookmarksSynced: syncedBookmarks.length,
        timestamp: new Date(),
        syncedBookmarks,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get sync status for user
   */
  async getSyncStatus(userId: string, deviceId: string): Promise<any> {
    // Get last sync time for device
    const deviceResult = await this.db.query(
      `SELECT last_sync_at FROM user_devices 
       WHERE user_id = $1 AND device_id = $2`,
      [userId, deviceId]
    );

    const lastSync = deviceResult.rows[0]?.last_sync_at || null;

    // Get pending sync operations
    const pendingResult = await this.db.query(
      `SELECT COUNT(*) as count FROM sync_operations 
       WHERE user_id = $1 AND device_id = $2 AND status = 'pending'`,
      [userId, deviceId]
    );

    const pendingItems = parseInt(pendingResult.rows[0].count);

    // Get conflicts
    const conflictsResult = await this.db.query(
      `SELECT COUNT(*) as count FROM sync_conflicts 
       WHERE user_id = $1 AND device_id = $2 AND resolution IS NULL`,
      [userId, deviceId]
    );

    const conflicts = parseInt(conflictsResult.rows[0].count);

    return {
      userId,
      deviceId,
      lastSync,
      pendingItems,
      conflicts,
      status: conflicts > 0 ? 'conflicts' : pendingItems > 0 ? 'pending' : 'synced',
    };
  }

  /**
   * Perform full sync operation
   */
  async performSync(userId: string, syncRequest: SyncRequest): Promise<SyncResponse> {
    const { deviceId, lastSyncTimestamp, operations } = syncRequest;
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const syncedOperations: string[] = [];
      const conflicts: SyncConflict[] = [];

      // Process client operations
      for (const op of operations) {
        const { operationType, entityType, entityId, data, timestamp } = op;

        // Store operation
        const opResult = await client.query(
          `INSERT INTO sync_operations 
           (user_id, device_id, operation_type, entity_type, entity_id, data, timestamp, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
           RETURNING id`,
          [userId, deviceId, operationType, entityType, entityId, data, timestamp]
        );

        const operationId = opResult.rows[0].id;

        // Apply operation based on type
        try {
          await this.applyOperation(client, userId, op);
          
          // Mark as synced
          await client.query(
            `UPDATE sync_operations SET status = 'synced', synced_at = NOW() WHERE id = $1`,
            [operationId]
          );

          syncedOperations.push(operationId);
        } catch (error: any) {
          if (error.message.includes('conflict')) {
            // Handle conflict
            await client.query(
              `UPDATE sync_operations SET status = 'conflict' WHERE id = $1`,
              [operationId]
            );
            conflicts.push({
              id: operationId,
              userId,
              deviceId,
              entityType,
              entityId,
              clientData: data,
              serverData: {}, // Would fetch from server
              clientTimestamp: new Date(timestamp),
              serverTimestamp: new Date(),
            });
          } else {
            throw error;
          }
        }
      }

      // Get server updates since last sync
      const serverUpdates = await this.getServerUpdates(client, userId, deviceId, lastSyncTimestamp);

      // Update device last sync time
      await client.query(
        `UPDATE user_devices SET last_sync_at = NOW() WHERE user_id = $1 AND device_id = $2`,
        [userId, deviceId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        syncedOperations,
        conflicts,
        serverUpdates,
        lastSyncTimestamp: new Date(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Apply sync operation
   */
  private async applyOperation(client: any, userId: string, operation: any): Promise<void> {
    const { operationType, entityType, entityId, data } = operation;

    switch (entityType) {
      case 'progress':
        if (operationType === 'update') {
          await client.query(
            `UPDATE cross_device_progress 
             SET progress = $3, last_position = $4, updated_at = NOW()
             WHERE user_id = $1 AND lesson_id = $2`,
            [userId, entityId, data.progress, data.lastPosition]
          );
        }
        break;

      case 'note':
        if (operationType === 'create' || operationType === 'update') {
          await client.query(
            `INSERT INTO user_notes (id, user_id, lesson_id, content, timestamp, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
            [entityId, userId, data.lessonId, data.content, data.timestamp]
          );
        } else if (operationType === 'delete') {
          await client.query(
            `DELETE FROM user_notes WHERE id = $1 AND user_id = $2`,
            [entityId, userId]
          );
        }
        break;

      case 'bookmark':
        if (operationType === 'create' || operationType === 'update') {
          await client.query(
            `INSERT INTO user_bookmarks (id, user_id, lesson_id, timestamp, title, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (id) DO UPDATE SET timestamp = EXCLUDED.timestamp, title = EXCLUDED.title`,
            [entityId, userId, data.lessonId, data.timestamp, data.title]
          );
        } else if (operationType === 'delete') {
          await client.query(
            `DELETE FROM user_bookmarks WHERE id = $1 AND user_id = $2`,
            [entityId, userId]
          );
        }
        break;

      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Get server updates since last sync
   */
  private async getServerUpdates(
    client: any,
    userId: string,
    deviceId: string,
    lastSyncTimestamp: Date
  ): Promise<any[]> {
    const updates: any[] = [];

    // Get progress updates
    const progressResult = await client.query(
      `SELECT lesson_id, progress, last_position, updated_at
       FROM cross_device_progress
       WHERE user_id = $1 AND updated_at > $2`,
      [userId, lastSyncTimestamp]
    );

    for (const row of progressResult.rows) {
      updates.push({
        entityType: 'progress',
        entityId: row.lesson_id,
        data: {
          progress: row.progress,
          lastPosition: row.last_position,
        },
        timestamp: row.updated_at,
      });
    }

    // Get note updates
    const notesResult = await client.query(
      `SELECT id, lesson_id, content, timestamp, updated_at
       FROM user_notes
       WHERE user_id = $1 AND updated_at > $2`,
      [userId, lastSyncTimestamp]
    );

    for (const row of notesResult.rows) {
      updates.push({
        entityType: 'note',
        entityId: row.id,
        data: {
          lessonId: row.lesson_id,
          content: row.content,
          timestamp: row.timestamp,
        },
        timestamp: row.updated_at,
      });
    }

    return updates;
  }

  /**
   * Resolve sync conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'client_wins' | 'server_wins' | 'merge',
    resolvedData?: any
  ): Promise<void> {
    await this.db.query(
      `UPDATE sync_conflicts 
       SET resolution = $2, resolved_at = NOW(), resolved_data = $3
       WHERE id = $1`,
      [conflictId, resolution, resolvedData]
    );
  }
}
