/**
 * Video Player Service
 * Handles mobile-optimized video playback with gesture controls
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { logger } from '@sai-mahendra/utils';
import {
  VideoPlayerGesture,
  VideoPlayerState,
  GestureControlSettings,
} from '../types/mobileFeatures';

export class VideoPlayerService {
  constructor(
    private db: Pool,
    private redis: Redis
  ) {}

  /**
   * Record video player gesture
   */
  async recordGesture(
    userId: string,
    videoId: string,
    gestureType: string,
    action: string,
    position: number,
    metadata?: Record<string, any>
  ): Promise<VideoPlayerGesture> {
    try {
      const result = await this.db.query(
        `INSERT INTO video_player_gestures 
         (user_id, video_id, gesture_type, action, position, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, videoId, gestureType, action, position, JSON.stringify(metadata || {})]
      );

      logger.info(`Gesture recorded: ${gestureType} -> ${action} for video ${videoId}`);
      return this.mapGestureRow(result.rows[0]);
    } catch (error) {
      logger.error('Error recording gesture:', error);
      throw new Error('Failed to record gesture');
    }
  }

  /**
   * Save video player state
   */
  async savePlayerState(state: Omit<VideoPlayerState, 'updatedAt'>): Promise<VideoPlayerState> {
    try {
      const result = await this.db.query(
        `INSERT INTO video_player_states 
         (user_id, video_id, device_id, position, duration, playback_speed, 
          volume, quality, is_playing, is_fullscreen, brightness, last_gesture)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (user_id, video_id, device_id) 
         DO UPDATE SET
           position = EXCLUDED.position,
           duration = EXCLUDED.duration,
           playback_speed = EXCLUDED.playback_speed,
           volume = EXCLUDED.volume,
           quality = EXCLUDED.quality,
           is_playing = EXCLUDED.is_playing,
           is_fullscreen = EXCLUDED.is_fullscreen,
           brightness = EXCLUDED.brightness,
           last_gesture = EXCLUDED.last_gesture,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          state.userId,
          state.videoId,
          state.deviceId,
          state.position,
          state.duration,
          state.playbackSpeed,
          state.volume,
          state.quality,
          state.isPlaying,
          state.isFullscreen,
          state.brightness,
          null,
        ]
      );

      // Cache the state in Redis for quick access
      const cacheKey = `player:state:${state.userId}:${state.videoId}:${state.deviceId}`;
      await this.redis.setex(cacheKey, 3600, JSON.stringify(result.rows[0]));

      logger.info(`Player state saved for video ${state.videoId}`);
      return this.mapPlayerStateRow(result.rows[0]);
    } catch (error) {
      logger.error('Error saving player state:', error);
      throw new Error('Failed to save player state');
    }
  }

  /**
   * Get video player state
   */
  async getPlayerState(
    userId: string,
    videoId: string,
    deviceId: string
  ): Promise<VideoPlayerState | null> {
    try {
      // Try cache first
      const cacheKey = `player:state:${userId}:${videoId}:${deviceId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from database
      const result = await this.db.query(
        `SELECT * FROM video_player_states 
         WHERE user_id = $1 AND video_id = $2 AND device_id = $3`,
        [userId, videoId, deviceId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const state = this.mapPlayerStateRow(result.rows[0]);
      
      // Cache for future requests
      await this.redis.setex(cacheKey, 3600, JSON.stringify(state));

      return state;
    } catch (error) {
      logger.error('Error getting player state:', error);
      throw new Error('Failed to get player state');
    }
  }

  /**
   * Get gesture control settings
   */
  async getGestureSettings(
    userId: string,
    deviceId: string
  ): Promise<GestureControlSettings> {
    try {
      const result = await this.db.query(
        `SELECT * FROM gesture_control_settings 
         WHERE user_id = $1 AND device_id = $2`,
        [userId, deviceId]
      );

      if (result.rows.length === 0) {
        // Return default settings
        return this.getDefaultGestureSettings(userId, deviceId);
      }

      return this.mapGestureSettingsRow(result.rows[0]);
    } catch (error) {
      logger.error('Error getting gesture settings:', error);
      throw new Error('Failed to get gesture settings');
    }
  }

  /**
   * Update gesture control settings
   */
  async updateGestureSettings(
    userId: string,
    deviceId: string,
    settings: Partial<GestureControlSettings>
  ): Promise<GestureControlSettings> {
    try {
      const result = await this.db.query(
        `INSERT INTO gesture_control_settings 
         (user_id, device_id, swipe_enabled, double_tap_enabled, 
          volume_gesture_enabled, brightness_gesture_enabled, 
          seek_gesture_sensitivity, custom_gestures)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, device_id) 
         DO UPDATE SET
           swipe_enabled = COALESCE(EXCLUDED.swipe_enabled, gesture_control_settings.swipe_enabled),
           double_tap_enabled = COALESCE(EXCLUDED.double_tap_enabled, gesture_control_settings.double_tap_enabled),
           volume_gesture_enabled = COALESCE(EXCLUDED.volume_gesture_enabled, gesture_control_settings.volume_gesture_enabled),
           brightness_gesture_enabled = COALESCE(EXCLUDED.brightness_gesture_enabled, gesture_control_settings.brightness_gesture_enabled),
           seek_gesture_sensitivity = COALESCE(EXCLUDED.seek_gesture_sensitivity, gesture_control_settings.seek_gesture_sensitivity),
           custom_gestures = COALESCE(EXCLUDED.custom_gestures, gesture_control_settings.custom_gestures),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          userId,
          deviceId,
          settings.swipeEnabled ?? true,
          settings.doubleTapEnabled ?? true,
          settings.volumeGestureEnabled ?? true,
          settings.brightnessGestureEnabled ?? true,
          settings.seekGestureSensitivity ?? 'medium',
          JSON.stringify(settings.customGestures || []),
        ]
      );

      logger.info(`Gesture settings updated for user ${userId}`);
      return this.mapGestureSettingsRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating gesture settings:', error);
      throw new Error('Failed to update gesture settings');
    }
  }

  /**
   * Get gesture analytics
   */
  async getGestureAnalytics(
    userId: string,
    videoId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      let query = `
        SELECT 
          gesture_type,
          action,
          COUNT(*) as usage_count,
          AVG(position) as avg_position
        FROM video_player_gestures
        WHERE user_id = $1
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (videoId) {
        query += ` AND video_id = $${paramIndex}`;
        params.push(videoId);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` GROUP BY gesture_type, action ORDER BY usage_count DESC`;

      const result = await this.db.query(query, params);

      return {
        totalGestures: result.rows.reduce((sum, row) => sum + parseInt(row.usage_count), 0),
        gestureBreakdown: result.rows,
        mostUsedGesture: result.rows[0] || null,
      };
    } catch (error) {
      logger.error('Error getting gesture analytics:', error);
      throw new Error('Failed to get gesture analytics');
    }
  }

  /**
   * Sync player state across devices
   */
  async syncPlayerStateAcrossDevices(
    userId: string,
    videoId: string,
    sourceDeviceId: string
  ): Promise<void> {
    try {
      // Get the latest state from source device
      const sourceState = await this.getPlayerState(userId, videoId, sourceDeviceId);
      if (!sourceState) {
        return;
      }

      // Update all other devices
      await this.db.query(
        `UPDATE video_player_states 
         SET position = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND video_id = $3 AND device_id != $4`,
        [sourceState.position, userId, videoId, sourceDeviceId]
      );

      // Clear cache for all devices
      const pattern = `player:state:${userId}:${videoId}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      logger.info(`Player state synced across devices for video ${videoId}`);
    } catch (error) {
      logger.error('Error syncing player state:', error);
      throw new Error('Failed to sync player state');
    }
  }

  /**
   * Helper: Get default gesture settings
   */
  private getDefaultGestureSettings(
    userId: string,
    deviceId: string
  ): GestureControlSettings {
    return {
      userId,
      deviceId,
      swipeEnabled: true,
      doubleTapEnabled: true,
      volumeGestureEnabled: true,
      brightnessGestureEnabled: true,
      seekGestureSensitivity: 'medium',
      customGestures: [],
    };
  }

  /**
   * Helper: Map gesture row to object
   */
  private mapGestureRow(row: any): VideoPlayerGesture {
    return {
      id: row.id,
      userId: row.user_id,
      videoId: row.video_id,
      gestureType: row.gesture_type,
      action: row.action,
      timestamp: row.timestamp,
      position: row.position,
      metadata: row.metadata,
    };
  }

  /**
   * Helper: Map player state row to object
   */
  private mapPlayerStateRow(row: any): VideoPlayerState {
    return {
      userId: row.user_id,
      videoId: row.video_id,
      deviceId: row.device_id,
      position: row.position,
      duration: row.duration,
      playbackSpeed: row.playback_speed,
      volume: row.volume,
      quality: row.quality,
      isPlaying: row.is_playing,
      isFullscreen: row.is_fullscreen,
      brightness: row.brightness,
      lastGesture: row.last_gesture,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Helper: Map gesture settings row to object
   */
  private mapGestureSettingsRow(row: any): GestureControlSettings {
    return {
      userId: row.user_id,
      deviceId: row.device_id,
      swipeEnabled: row.swipe_enabled,
      doubleTapEnabled: row.double_tap_enabled,
      volumeGestureEnabled: row.volume_gesture_enabled,
      brightnessGestureEnabled: row.brightness_gesture_enabled,
      seekGestureSensitivity: row.seek_gesture_sensitivity,
      customGestures: row.custom_gestures || [],
    };
  }
}
