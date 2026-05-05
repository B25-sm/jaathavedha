/**
 * Live Streaming Service
 * WebRTC-based live streaming and virtual classroom management
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import {
  LiveStreamConfig,
  LiveStreamStatus,
  LiveStreamViewer,
  LiveStreamAnalytics,
  VideoFilters,
  PaginatedResponse
} from '../types';

export class LiveStreamingService {
  private db = getDatabase();
  private cache = getCache();

  /**
   * Create a new live stream
   */
  async createLiveStream(config: Omit<LiveStreamConfig, 'id' | 'stream_key' | 'rtmp_url' | 'status' | 'created_at'>): Promise<LiveStreamConfig> {
    try {
      const streamKey = this.generateStreamKey();
      const rtmpUrl = `${process.env.RTMP_SERVER_URL}/live/${streamKey}`;

      const liveStream = await this.db.insert<LiveStreamConfig>('live_streams', {
        id: uuidv4(),
        title: config.title,
        description: config.description,
        instructor_id: config.instructor_id,
        course_id: config.course_id,
        scheduled_start: config.scheduled_start,
        scheduled_end: config.scheduled_end,
        max_viewers: config.max_viewers || 1000,
        is_recording_enabled: config.is_recording_enabled || true,
        chat_enabled: config.chat_enabled || true,
        q_and_a_enabled: config.q_and_a_enabled || true,
        stream_key: streamKey,
        rtmp_url: rtmpUrl,
        status: LiveStreamStatus.SCHEDULED,
        created_at: new Date()
      });

      logger.info('Live stream created', { streamId: liveStream.id, instructorId: config.instructor_id });
      return liveStream;
    } catch (error) {
      logger.error('Failed to create live stream', { error, config });
      throw new AppError('Failed to create live stream', 500);
    }
  }

  /**
   * Get live streams with filtering and pagination
   */
  async getLiveStreams(
    filters: Partial<LiveStreamConfig> = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 10 }
  ): Promise<PaginatedResponse<LiveStreamConfig>> {
    try {
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;

      const whereClause = this.buildLiveStreamWhereClause(filters);
      const { conditions, params } = whereClause;

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM live_streams ${conditions}`;
      const countResult = await this.db.queryOne<{ count: string }>(countQuery, params);
      const total = parseInt(countResult?.count || '0', 10);

      // Get paginated data
      const dataQuery = `
        SELECT ls.*, u.first_name || ' ' || u.last_name as instructor_name
        FROM live_streams ls
        LEFT JOIN users u ON ls.instructor_id = u.id
        ${conditions}
        ORDER BY ls.scheduled_start DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const data = await this.db.queryMany<any>(dataQuery, [...params, limit, offset]);

      return {
        data: data.map(row => ({
          id: row.id,
          title: row.title,
          description: row.description,
          instructor_id: row.instructor_id,
          course_id: row.course_id,
          scheduled_start: row.scheduled_start,
          scheduled_end: row.scheduled_end,
          max_viewers: row.max_viewers,
          is_recording_enabled: row.is_recording_enabled,
          chat_enabled: row.chat_enabled,
          q_and_a_enabled: row.q_and_a_enabled,
          stream_key: row.stream_key,
          rtmp_url: row.rtmp_url,
          hls_playback_url: row.hls_playback_url,
          status: row.status,
          created_at: row.created_at,
          instructor_name: row.instructor_name
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get live streams', { error, filters, pagination });
      throw new AppError('Failed to retrieve live streams', 500);
    }
  }

  /**
   * Get live stream by ID
   */
  async getLiveStreamById(id: string): Promise<LiveStreamConfig | null> {
    try {
      return await this.db.queryOne<LiveStreamConfig>(
        'SELECT * FROM live_streams WHERE id = $1',
        [id]
      );
    } catch (error) {
      logger.error('Failed to get live stream by ID', { error, id });
      return null;
    }
  }

  /**
   * Start a live stream
   */
  async startLiveStream(streamId: string, instructorId: string): Promise<{
    rtmp_url: string;
    stream_key: string;
    hls_playback_url: string;
  }> {
    try {
      const liveStream = await this.getLiveStreamById(streamId);
      
      if (!liveStream) {
        throw new AppError('Live stream not found', 404);
      }

      if (liveStream.instructor_id !== instructorId) {
        throw new AppError('Access denied', 403);
      }

      if (liveStream.status !== LiveStreamStatus.SCHEDULED) {
        throw new AppError('Live stream cannot be started', 400);
      }

      // Generate HLS playback URL
      const hlsPlaybackUrl = `${process.env.HLS_SERVER_URL}/live/${liveStream.stream_key}/index.m3u8`;

      // Update stream status
      await this.db.update('live_streams', {
        status: LiveStreamStatus.LIVE,
        hls_playback_url: hlsPlaybackUrl
      }, { id: streamId });

      // Initialize stream analytics
      await this.initializeStreamAnalytics(streamId);

      // Notify enrolled students
      await this.notifyStreamStart(streamId);

      logger.info('Live stream started', { streamId, instructorId });

      return {
        rtmp_url: liveStream.rtmp_url,
        stream_key: liveStream.stream_key,
        hls_playback_url: hlsPlaybackUrl
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to start live stream', { error, streamId, instructorId });
      throw new AppError('Failed to start live stream', 500);
    }
  }

  /**
   * End a live stream
   */
  async endLiveStream(streamId: string, instructorId: string): Promise<void> {
    try {
      const liveStream = await this.getLiveStreamById(streamId);
      
      if (!liveStream) {
        throw new AppError('Live stream not found', 404);
      }

      if (liveStream.instructor_id !== instructorId) {
        throw new AppError('Access denied', 403);
      }

      if (liveStream.status !== LiveStreamStatus.LIVE) {
        throw new AppError('Live stream is not currently live', 400);
      }

      // Update stream status
      await this.db.update('live_streams', {
        status: LiveStreamStatus.ENDED
      }, { id: streamId });

      // Finalize analytics
      await this.finalizeStreamAnalytics(streamId);

      // Process recording if enabled
      if (liveStream.is_recording_enabled) {
        await this.processStreamRecording(streamId);
      }

      // Notify viewers that stream has ended
      await this.notifyStreamEnd(streamId);

      logger.info('Live stream ended', { streamId, instructorId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to end live stream', { error, streamId, instructorId });
      throw new AppError('Failed to end live stream', 500);
    }
  }

  /**
   * Join a live stream as a viewer
   */
  async joinLiveStream(streamId: string, userId: string): Promise<{
    hls_playback_url: string;
    chat_enabled: boolean;
    q_and_a_enabled: boolean;
    viewer_token: string;
  }> {
    try {
      const liveStream = await this.getLiveStreamById(streamId);
      
      if (!liveStream) {
        throw new AppError('Live stream not found', 404);
      }

      if (liveStream.status !== LiveStreamStatus.LIVE) {
        throw new AppError('Live stream is not currently live', 400);
      }

      // Check if user has access to the stream
      const hasAccess = await this.checkStreamAccess(streamId, userId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403);
      }

      // Check viewer limit
      const currentViewers = await this.getCurrentViewerCount(streamId);
      if (currentViewers >= liveStream.max_viewers) {
        throw new AppError('Stream has reached maximum viewer capacity', 429);
      }

      // Create viewer record
      const viewerToken = this.generateViewerToken();
      await this.db.insert('live_stream_viewers', {
        id: uuidv4(),
        stream_id: streamId,
        user_id: userId,
        viewer_token: viewerToken,
        joined_at: new Date(),
        total_watch_time: 0,
        interactions: 0
      });

      // Update viewer count in cache
      await this.cache.incr(`stream_viewers:${streamId}`);

      logger.info('User joined live stream', { streamId, userId });

      return {
        hls_playback_url: liveStream.hls_playback_url!,
        chat_enabled: liveStream.chat_enabled,
        q_and_a_enabled: liveStream.q_and_a_enabled,
        viewer_token: viewerToken
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to join live stream', { error, streamId, userId });
      throw new AppError('Failed to join live stream', 500);
    }
  }

  /**
   * Leave a live stream
   */
  async leaveLiveStream(streamId: string, userId: string): Promise<void> {
    try {
      const viewer = await this.db.queryOne<LiveStreamViewer>(
        'SELECT * FROM live_stream_viewers WHERE stream_id = $1 AND user_id = $2 AND left_at IS NULL',
        [streamId, userId]
      );

      if (viewer) {
        const watchTime = Math.floor((Date.now() - viewer.joined_at.getTime()) / 1000);
        
        await this.db.update('live_stream_viewers', {
          left_at: new Date(),
          total_watch_time: watchTime
        }, { id: viewer.id });

        // Update viewer count in cache
        await this.cache.decr(`stream_viewers:${streamId}`);

        logger.info('User left live stream', { streamId, userId, watchTime });
      }
    } catch (error) {
      logger.error('Failed to leave live stream', { error, streamId, userId });
      // Don't throw error for leave operations
    }
  }

  /**
   * Get live stream analytics
   */
  async getLiveStreamAnalytics(streamId: string): Promise<LiveStreamAnalytics> {
    try {
      const [
        viewerStats,
        peakViewers,
        totalInteractions,
        retentionData
      ] = await Promise.all([
        this.db.queryOne<{ total_viewers: string; avg_watch_time: string }>(`
          SELECT 
            COUNT(DISTINCT user_id) as total_viewers,
            AVG(total_watch_time) as avg_watch_time
          FROM live_stream_viewers 
          WHERE stream_id = $1
        `, [streamId]),
        this.cache.get(`stream_peak_viewers:${streamId}`) || 0,
        this.db.queryOne<{ total: string }>(`
          SELECT SUM(interactions) as total 
          FROM live_stream_viewers 
          WHERE stream_id = $1
        `, [streamId]),
        this.getViewerRetentionData(streamId)
      ]);

      const totalViewers = parseInt(viewerStats?.total_viewers || '0', 10);
      const avgWatchTime = parseFloat(viewerStats?.avg_watch_time || '0');
      const totalInteractionsCount = parseInt(totalInteractions?.total || '0', 10);

      return {
        stream_id: streamId,
        peak_viewers: typeof peakViewers === 'number' ? peakViewers : parseInt(peakViewers || '0', 10),
        total_unique_viewers: totalViewers,
        average_watch_time: avgWatchTime,
        total_interactions: totalInteractionsCount,
        viewer_retention: retentionData,
        engagement_rate: totalViewers > 0 ? (totalInteractionsCount / totalViewers) * 100 : 0
      };
    } catch (error) {
      logger.error('Failed to get live stream analytics', { error, streamId });
      throw new AppError('Failed to retrieve analytics', 500);
    }
  }

  /**
   * Get current viewers of a live stream
   */
  async getLiveStreamViewers(streamId: string): Promise<LiveStreamViewer[]> {
    try {
      return await this.db.queryMany<LiveStreamViewer>(`
        SELECT lsv.*, u.first_name || ' ' || u.last_name as user_name
        FROM live_stream_viewers lsv
        LEFT JOIN users u ON lsv.user_id = u.id
        WHERE lsv.stream_id = $1 AND lsv.left_at IS NULL
        ORDER BY lsv.joined_at ASC
      `, [streamId]);
    } catch (error) {
      logger.error('Failed to get live stream viewers', { error, streamId });
      return [];
    }
  }

  // Private helper methods

  private generateStreamKey(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateViewerToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private buildLiveStreamWhereClause(filters: Partial<LiveStreamConfig>): { conditions: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.instructor_id) {
      conditions.push(`instructor_id = $${paramIndex++}`);
      params.push(filters.instructor_id);
    }

    if (filters.course_id) {
      conditions.push(`course_id = $${paramIndex++}`);
      params.push(filters.course_id);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return { conditions: whereClause, params };
  }

  private async checkStreamAccess(streamId: string, userId: string): Promise<boolean> {
    try {
      // Check if user is enrolled in the course or if it's a public stream
      const result = await this.db.queryOne<{ count: string }>(`
        SELECT COUNT(*) as count
        FROM live_streams ls
        LEFT JOIN enrollments e ON ls.course_id = e.program_id AND e.user_id = $2
        WHERE ls.id = $1 AND (e.status = 'active' OR ls.course_id IS NULL)
      `, [streamId, userId]);

      return parseInt(result?.count || '0', 10) > 0;
    } catch (error) {
      logger.error('Failed to check stream access', { error, streamId, userId });
      return false;
    }
  }

  private async getCurrentViewerCount(streamId: string): Promise<number> {
    try {
      const count = await this.cache.get(`stream_viewers:${streamId}`);
      return typeof count === 'number' ? count : parseInt(count || '0', 10);
    } catch (error) {
      logger.error('Failed to get current viewer count', { error, streamId });
      return 0;
    }
  }

  private async initializeStreamAnalytics(streamId: string): Promise<void> {
    try {
      await this.cache.set(`stream_viewers:${streamId}`, 0);
      await this.cache.set(`stream_peak_viewers:${streamId}`, 0);
      await this.cache.set(`stream_start_time:${streamId}`, Date.now());
    } catch (error) {
      logger.error('Failed to initialize stream analytics', { error, streamId });
    }
  }

  private async finalizeStreamAnalytics(streamId: string): Promise<void> {
    try {
      // Store final analytics in database
      const peakViewers = await this.cache.get(`stream_peak_viewers:${streamId}`) || 0;
      const startTime = await this.cache.get(`stream_start_time:${streamId}`);
      const duration = startTime ? Math.floor((Date.now() - parseInt(startTime.toString())) / 1000) : 0;

      await this.db.insert('live_stream_analytics', {
        id: uuidv4(),
        stream_id: streamId,
        peak_viewers: peakViewers,
        total_duration: duration,
        created_at: new Date()
      });

      // Clean up cache
      await this.cache.del(`stream_viewers:${streamId}`);
      await this.cache.del(`stream_peak_viewers:${streamId}`);
      await this.cache.del(`stream_start_time:${streamId}`);
    } catch (error) {
      logger.error('Failed to finalize stream analytics', { error, streamId });
    }
  }

  private async processStreamRecording(streamId: string): Promise<void> {
    try {
      // Process the recorded stream and convert to video
      // This would typically involve processing the RTMP recording
      logger.info('Processing stream recording', { streamId });
      
      // Implementation would depend on the streaming server setup
      // Could involve converting FLV to MP4, generating thumbnails, etc.
    } catch (error) {
      logger.error('Failed to process stream recording', { error, streamId });
    }
  }

  private async notifyStreamStart(streamId: string): Promise<void> {
    try {
      // Send notifications to enrolled students
      // This would integrate with the notification service
      logger.info('Notifying stream start', { streamId });
    } catch (error) {
      logger.error('Failed to notify stream start', { error, streamId });
    }
  }

  private async notifyStreamEnd(streamId: string): Promise<void> {
    try {
      // Notify viewers that stream has ended
      logger.info('Notifying stream end', { streamId });
    } catch (error) {
      logger.error('Failed to notify stream end', { error, streamId });
    }
  }

  private async getViewerRetentionData(streamId: string): Promise<{ timestamp: number; viewers: number }[]> {
    try {
      // Get viewer retention data over time
      // This would typically be collected during the stream
      return [];
    } catch (error) {
      logger.error('Failed to get viewer retention data', { error, streamId });
      return [];
    }
  }
}