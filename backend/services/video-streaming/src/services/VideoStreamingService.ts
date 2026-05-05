/**
 * Video Streaming Service
 * Core service for video upload, processing, and streaming
 */

import AWS from 'aws-sdk';
import ffmpeg from 'fluent-ffmpeg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import {
  Video,
  VideoUploadRequest,
  VideoProcessingJob,
  VideoAnalytics,
  VideoProgress,
  VideoNote,
  VideoBookmark,
  StreamingSession,
  VideoPlayerConfig,
  UploadPresignedUrl,
  BulkUploadRequest,
  BulkUploadResponse,
  VideoStats,
  VideoFilters,
  QualityLevel,
  VideoStatus,
  ProcessingStatus,
  ProcessingStep,
  InteractionType
} from '../types';

export class VideoStreamingService {
  private db = getDatabase();
  private cache = getCache();
  private s3: AWS.S3;
  private cloudFront: AWS.CloudFront;

  constructor() {
    // Initialize AWS services
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.s3 = new AWS.S3();
    this.cloudFront = new AWS.CloudFront();
  }

  /**
   * Generate presigned URL for video upload
   */
  async generateUploadUrl(request: VideoUploadRequest): Promise<UploadPresignedUrl> {
    try {
      // Create video record
      const video = await this.db.insert<Video>('videos', {
        id: uuidv4(),
        title: request.title,
        description: request.description,
        course_id: request.course_id,
        instructor_id: request.instructor_id,
        original_filename: '',
        file_size: 0,
        status: VideoStatus.UPLOADING,
        s3_key: '',
        quality_levels: [],
        watermark_enabled: request.watermark_enabled || false,
        metadata: {
          chapters: request.chapters || [],
          tags: request.tags || []
        }
      });

      const s3Key = `videos/${video.id}/original/${uuidv4()}`;
      const expiresIn = 3600; // 1 hour

      const uploadUrl = this.s3.getSignedUrl('putObject', {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Expires: expiresIn,
        ContentType: 'video/*',
        Metadata: {
          videoId: video.id,
          instructorId: request.instructor_id,
          courseId: request.course_id
        }
      });

      // Update video with S3 key
      await this.db.update('videos', { s3_key: s3Key }, { id: video.id });

      return {
        upload_url: uploadUrl,
        video_id: video.id,
        expires_at: new Date(Date.now() + expiresIn * 1000),
        max_file_size: 5 * 1024 * 1024 * 1024, // 5GB
        allowed_types: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv']
      };
    } catch (error) {
      logger.error('Failed to generate upload URL', { error, request });
      throw new AppError('Failed to generate upload URL', 500);
    }
  }

  /**
   * Process uploaded video
   */
  async processVideo(videoId: string): Promise<VideoProcessingJob> {
    try {
      const video = await this.getVideoById(videoId);
      if (!video) {
        throw new AppError('Video not found', 404);
      }

      // Create processing job
      const job = await this.db.insert<VideoProcessingJob>('video_processing_jobs', {
        id: uuidv4(),
        video_id: videoId,
        status: ProcessingStatus.QUEUED,
        progress: 0,
        current_step: ProcessingStep.VALIDATION,
        started_at: new Date()
      });

      // Start processing asynchronously
      this.startVideoProcessing(job.id, video).catch(error => {
        logger.error('Video processing failed', { error, jobId: job.id, videoId });
      });

      return job;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to start video processing', { error, videoId });
      throw new AppError('Failed to start video processing', 500);
    }
  }

  /**
   * Get video player configuration
   */
  async getPlayerConfig(videoId: string, userId: string): Promise<VideoPlayerConfig> {
    try {
      const video = await this.getVideoById(videoId);
      if (!video) {
        throw new AppError('Video not found', 404);
      }

      if (video.status !== VideoStatus.READY) {
        throw new AppError('Video is not ready for playback', 400);
      }

      // Check user access
      const hasAccess = await this.checkVideoAccess(videoId, userId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403);
      }

      // Generate streaming session
      const session = await this.createStreamingSession(videoId, userId);

      // Get CDN URLs
      const hlsUrl = this.generateCDNUrl(video.hls_url!);
      const thumbnailUrl = this.generateCDNUrl(video.thumbnail_url!);

      return {
        video_id: videoId,
        hls_url: hlsUrl,
        dash_url: video.dash_url ? this.generateCDNUrl(video.dash_url) : undefined,
        thumbnail_url: thumbnailUrl,
        duration: video.duration || 0,
        quality_levels: video.quality_levels,
        chapters: video.metadata.chapters,
        watermark: video.watermark_enabled ? {
          enabled: true,
          text: `${userId}`,
          position: 'bottom-right',
          opacity: 0.7
        } : { enabled: false, opacity: 0, position: 'bottom-right' },
        analytics_endpoint: `/api/videos/${videoId}/analytics`,
        domain_restrictions: process.env.ALLOWED_DOMAINS?.split(',') || []
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get player config', { error, videoId, userId });
      throw new AppError('Failed to get player configuration', 500);
    }
  }

  /**
   * Track video analytics
   */
  async trackAnalytics(videoId: string, userId: string, analytics: Partial<VideoAnalytics>): Promise<void> {
    try {
      await this.db.insert('video_analytics', {
        id: uuidv4(),
        video_id: videoId,
        user_id: userId,
        session_id: analytics.session_id || uuidv4(),
        watch_time: analytics.watch_time || 0,
        total_duration: analytics.total_duration || 0,
        completion_percentage: analytics.completion_percentage || 0,
        quality_changes: analytics.quality_changes || [],
        interactions: analytics.interactions || [],
        device_info: analytics.device_info || {},
        created_at: new Date()
      });

      // Update video progress
      await this.updateVideoProgress(videoId, userId, analytics);

      logger.info('Video analytics tracked', { videoId, userId });
    } catch (error) {
      logger.error('Failed to track video analytics', { error, videoId, userId });
      // Don't throw error for analytics failures
    }
  }

  /**
   * Add video note
   */
  async addNote(videoId: string, userId: string, timestamp: number, content: string, isPublic: boolean = false): Promise<VideoNote> {
    try {
      const note = await this.db.insert<VideoNote>('video_notes', {
        id: uuidv4(),
        video_id: videoId,
        user_id: userId,
        timestamp,
        content,
        is_public: isPublic,
        created_at: new Date(),
        updated_at: new Date()
      });

      logger.info('Video note added', { videoId, userId, timestamp });
      return note;
    } catch (error) {
      logger.error('Failed to add video note', { error, videoId, userId });
      throw new AppError('Failed to add note', 500);
    }
  }

  /**
   * Add video bookmark
   */
  async addBookmark(videoId: string, userId: string, timestamp: number, title: string, description?: string): Promise<VideoBookmark> {
    try {
      const bookmark = await this.db.insert<VideoBookmark>('video_bookmarks', {
        id: uuidv4(),
        video_id: videoId,
        user_id: userId,
        timestamp,
        title,
        description,
        created_at: new Date()
      });

      logger.info('Video bookmark added', { videoId, userId, timestamp });
      return bookmark;
    } catch (error) {
      logger.error('Failed to add video bookmark', { error, videoId, userId });
      throw new AppError('Failed to add bookmark', 500);
    }
  }

  /**
   * Get video progress for user
   */
  async getVideoProgress(videoId: string, userId: string): Promise<VideoProgress | null> {
    try {
      return await this.db.queryOne<VideoProgress>(
        'SELECT * FROM video_progress WHERE video_id = $1 AND user_id = $2',
        [videoId, userId]
      );
    } catch (error) {
      logger.error('Failed to get video progress', { error, videoId, userId });
      return null;
    }
  }

  /**
   * Get user notes for video
   */
  async getUserNotes(videoId: string, userId: string): Promise<VideoNote[]> {
    try {
      return await this.db.queryMany<VideoNote>(
        'SELECT * FROM video_notes WHERE video_id = $1 AND user_id = $2 ORDER BY timestamp ASC',
        [videoId, userId]
      );
    } catch (error) {
      logger.error('Failed to get user notes', { error, videoId, userId });
      return [];
    }
  }

  /**
   * Get user bookmarks for video
   */
  async getUserBookmarks(videoId: string, userId: string): Promise<VideoBookmark[]> {
    try {
      return await this.db.queryMany<VideoBookmark>(
        'SELECT * FROM video_bookmarks WHERE video_id = $1 AND user_id = $2 ORDER BY timestamp ASC',
        [videoId, userId]
      );
    } catch (error) {
      logger.error('Failed to get user bookmarks', { error, videoId, userId });
      return [];
    }
  }

  /**
   * Get video statistics
   */
  async getVideoStats(filters: VideoFilters = {}): Promise<VideoStats> {
    try {
      const cacheKey = `video_stats:${JSON.stringify(filters)}`;
      const cached = await this.cache.get<VideoStats>(cacheKey);
      if (cached) return cached;

      const whereClause = this.buildWhereClause(filters);
      const { conditions, params } = whereClause;

      const [
        totalResult,
        durationResult,
        sizeResult,
        statusResult,
        qualityResult,
        storageResult,
        processingResult
      ] = await Promise.all([
        this.db.queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM videos ${conditions}`, params),
        this.db.queryOne<{ total: string }>(`SELECT COALESCE(SUM(duration), 0) as total FROM videos ${conditions}`, params),
        this.db.queryOne<{ total: string }>(`SELECT COALESCE(SUM(file_size), 0) as total FROM videos ${conditions}`, params),
        this.db.queryMany<{ status: VideoStatus; count: string }>(`
          SELECT status, COUNT(*) as count 
          FROM videos ${conditions} 
          GROUP BY status
        `, params),
        this.db.queryMany<{ resolution: string; count: string }>(`
          SELECT 
            jsonb_array_elements(quality_levels)->>'resolution' as resolution,
            COUNT(*) as count
          FROM videos ${conditions}
          WHERE jsonb_array_length(quality_levels) > 0
          GROUP BY resolution
        `, params),
        this.getStorageUsage(),
        this.getProcessingStats()
      ]);

      const stats: VideoStats = {
        total_videos: parseInt(totalResult?.count || '0', 10),
        total_duration: parseInt(durationResult?.total || '0', 10),
        total_size: parseInt(sizeResult?.total || '0', 10),
        videos_by_status: statusResult.map(row => ({
          status: row.status,
          count: parseInt(row.count, 10)
        })),
        videos_by_quality: qualityResult.map(row => ({
          resolution: row.resolution,
          count: parseInt(row.count, 10)
        })),
        storage_usage: storageResult,
        processing_stats: processingResult
      };

      // Cache for 10 minutes
      await this.cache.set(cacheKey, stats, { ttl: 600 });

      return stats;
    } catch (error) {
      logger.error('Failed to get video stats', { error, filters });
      throw new AppError('Failed to retrieve video statistics', 500);
    }
  }

  // Private helper methods

  private async startVideoProcessing(jobId: string, video: Video): Promise<void> {
    try {
      await this.updateJobProgress(jobId, ProcessingStatus.PROCESSING, 10, ProcessingStep.VALIDATION);

      // Download original video from S3
      const tempDir = `/tmp/video-processing/${video.id}`;
      const originalPath = path.join(tempDir, 'original.mp4');
      
      await this.downloadFromS3(video.s3_key, originalPath);
      
      // Validate video
      const metadata = await this.extractVideoMetadata(originalPath);
      await this.updateJobProgress(jobId, ProcessingStatus.PROCESSING, 20, ProcessingStep.TRANSCODING);

      // Generate quality levels
      const qualityLevels = await this.generateQualityLevels(originalPath, video.id);
      await this.updateJobProgress(jobId, ProcessingStatus.PROCESSING, 60, ProcessingStep.THUMBNAIL_GENERATION);

      // Generate thumbnails
      const thumbnailUrl = await this.generateThumbnails(originalPath, video.id);
      await this.updateJobProgress(jobId, ProcessingStatus.PROCESSING, 70, ProcessingStep.HLS_GENERATION);

      // Generate HLS streams
      const hlsUrl = await this.generateHLSStreams(qualityLevels, video.id);
      await this.updateJobProgress(jobId, ProcessingStatus.PROCESSING, 85, ProcessingStep.ENCRYPTION);

      // Apply encryption if needed
      if (process.env.VIDEO_ENCRYPTION_ENABLED === 'true') {
        await this.encryptVideoStreams(video.id);
      }

      await this.updateJobProgress(jobId, ProcessingStatus.PROCESSING, 95, ProcessingStep.FINALIZATION);

      // Update video record
      await this.db.update('videos', {
        status: VideoStatus.READY,
        duration: metadata.duration,
        quality_levels: qualityLevels,
        thumbnail_url: thumbnailUrl,
        hls_url: hlsUrl,
        metadata: {
          ...video.metadata,
          width: metadata.width,
          height: metadata.height,
          bitrate: metadata.bitrate,
          fps: metadata.fps,
          codec: metadata.codec,
          format: metadata.format
        }
      }, { id: video.id });

      await this.updateJobProgress(jobId, ProcessingStatus.COMPLETED, 100, ProcessingStep.FINALIZATION);

      // Clean up temporary files
      await this.cleanupTempFiles(tempDir);

      logger.info('Video processing completed successfully', { videoId: video.id, jobId });
    } catch (error) {
      logger.error('Video processing failed', { error, videoId: video.id, jobId });
      
      await this.updateJobProgress(jobId, ProcessingStatus.FAILED, 0, ProcessingStep.FINALIZATION, error.message);
      await this.db.update('videos', { status: VideoStatus.FAILED }, { id: video.id });
    }
  }

  private async updateJobProgress(
    jobId: string, 
    status: ProcessingStatus, 
    progress: number, 
    step: ProcessingStep,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { status, progress, current_step: step };
    
    if (status === ProcessingStatus.COMPLETED) {
      updateData.completed_at = new Date();
    }
    
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await this.db.update('video_processing_jobs', updateData, { id: jobId });
  }

  private async downloadFromS3(s3Key: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key
      };

      const stream = this.s3.getObject(params).createReadStream();
      const writeStream = fs.createWriteStream(localPath);

      stream.pipe(writeStream);
      
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  private async extractVideoMetadata(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          duration: metadata.format.duration,
          width: videoStream.width,
          height: videoStream.height,
          bitrate: videoStream.bit_rate,
          fps: eval(videoStream.r_frame_rate || '0'),
          codec: videoStream.codec_name,
          format: metadata.format.format_name
        });
      });
    });
  }

  private async generateQualityLevels(originalPath: string, videoId: string): Promise<QualityLevel[]> {
    const qualities = [
      { resolution: '240p', width: 426, height: 240, bitrate: 400000 },
      { resolution: '480p', width: 854, height: 480, bitrate: 1000000 },
      { resolution: '720p', width: 1280, height: 720, bitrate: 2500000 },
      { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000000 }
    ];

    const qualityLevels: QualityLevel[] = [];

    for (const quality of qualities) {
      const outputPath = `/tmp/video-processing/${videoId}/${quality.resolution}.mp4`;
      const s3Key = `videos/${videoId}/qualities/${quality.resolution}.mp4`;

      await this.transcodeVideo(originalPath, outputPath, quality);
      await this.uploadToS3(outputPath, s3Key);

      const fileStats = fs.statSync(outputPath);
      
      qualityLevels.push({
        resolution: quality.resolution,
        bitrate: quality.bitrate,
        file_size: fileStats.size,
        s3_key: s3Key
      });
    }

    return qualityLevels;
  }

  private async transcodeVideo(inputPath: string, outputPath: string, quality: any): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${quality.width}x${quality.height}`)
        .videoBitrate(quality.bitrate)
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private async uploadToS3(filePath: string, s3Key: string): Promise<void> {
    const fileContent = fs.readFileSync(filePath);
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'video/mp4'
    };

    await this.s3.upload(params).promise();
  }

  private async generateThumbnails(originalPath: string, videoId: string): Promise<string> {
    const thumbnailPath = `/tmp/video-processing/${videoId}/thumbnail.jpg`;
    const s3Key = `videos/${videoId}/thumbnail.jpg`;

    return new Promise((resolve, reject) => {
      ffmpeg(originalPath)
        .screenshots({
          timestamps: ['10%'],
          filename: 'thumbnail.jpg',
          folder: `/tmp/video-processing/${videoId}/`,
          size: '320x240'
        })
        .on('end', async () => {
          try {
            await this.uploadToS3(thumbnailPath, s3Key);
            resolve(this.generateCDNUrl(s3Key));
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  private async generateHLSStreams(qualityLevels: QualityLevel[], videoId: string): Promise<string> {
    // Generate HLS playlist and segments
    const hlsDir = `/tmp/video-processing/${videoId}/hls/`;
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    
    // Create master playlist
    let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n';
    
    for (const quality of qualityLevels) {
      masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bitrate},RESOLUTION=${this.getResolutionDimensions(quality.resolution)}\n`;
      masterPlaylist += `${quality.resolution}/playlist.m3u8\n`;
    }

    fs.writeFileSync(playlistPath, masterPlaylist);

    // Upload HLS files to S3
    const s3Key = `videos/${videoId}/hls/playlist.m3u8`;
    await this.uploadToS3(playlistPath, s3Key);

    return this.generateCDNUrl(s3Key);
  }

  private async encryptVideoStreams(videoId: string): Promise<void> {
    // Implement AES-128 encryption for HLS streams
    const encryptionKey = crypto.randomBytes(16);
    const keyPath = `videos/${videoId}/encryption.key`;
    
    // Upload encryption key to S3
    await this.s3.upload({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: keyPath,
      Body: encryptionKey,
      ContentType: 'application/octet-stream'
    }).promise();

    // Update video record with encryption key
    await this.db.update('videos', {
      encryption_key: encryptionKey.toString('hex')
    }, { id: videoId });
  }

  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      logger.warn('Failed to cleanup temp files', { error, tempDir });
    }
  }

  private generateCDNUrl(s3Key: string): string {
    const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
    if (cloudFrontDomain) {
      return `https://${cloudFrontDomain}/${s3Key}`;
    }
    return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
  }

  private getResolutionDimensions(resolution: string): string {
    const dimensions = {
      '240p': '426x240',
      '480p': '854x480',
      '720p': '1280x720',
      '1080p': '1920x1080'
    };
    return dimensions[resolution] || '854x480';
  }

  private async getVideoById(id: string): Promise<Video | null> {
    return await this.db.queryOne<Video>('SELECT * FROM videos WHERE id = $1', [id]);
  }

  private async checkVideoAccess(videoId: string, userId: string): Promise<boolean> {
    // Check if user is enrolled in the course containing this video
    const result = await this.db.queryOne<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM enrollments e
      JOIN videos v ON e.program_id = v.course_id
      WHERE v.id = $1 AND e.user_id = $2 AND e.status = 'active'
    `, [videoId, userId]);

    return parseInt(result?.count || '0', 10) > 0;
  }

  private async createStreamingSession(videoId: string, userId: string): Promise<StreamingSession> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return await this.db.insert<StreamingSession>('streaming_sessions', {
      id: uuidv4(),
      video_id: videoId,
      user_id: userId,
      session_token: sessionToken,
      expires_at: expiresAt,
      ip_address: '', // Will be set by the API endpoint
      user_agent: '', // Will be set by the API endpoint
      domain: '', // Will be set by the API endpoint
      created_at: new Date()
    });
  }

  private async updateVideoProgress(videoId: string, userId: string, analytics: Partial<VideoAnalytics>): Promise<void> {
    const existingProgress = await this.getVideoProgress(videoId, userId);
    
    const progressData = {
      video_id: videoId,
      user_id: userId,
      last_position: analytics.watch_time || 0,
      completion_percentage: analytics.completion_percentage || 0,
      total_watch_time: (existingProgress?.total_watch_time || 0) + (analytics.watch_time || 0),
      is_completed: (analytics.completion_percentage || 0) >= 90,
      completed_at: (analytics.completion_percentage || 0) >= 90 ? new Date() : null,
      updated_at: new Date()
    };

    if (existingProgress) {
      await this.db.update('video_progress', progressData, { 
        video_id: videoId, 
        user_id: userId 
      });
    } else {
      await this.db.insert('video_progress', {
        id: uuidv4(),
        ...progressData
      });
    }
  }

  private buildWhereClause(filters: VideoFilters): { conditions: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.course_id) {
      conditions.push(`course_id = $${paramIndex++}`);
      params.push(filters.course_id);
    }

    if (filters.instructor_id) {
      conditions.push(`instructor_id = $${paramIndex++}`);
      params.push(filters.instructor_id);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.search) {
      conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.date_from) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return { conditions: whereClause, params };
  }

  private async getStorageUsage(): Promise<any> {
    // Implement storage usage calculation
    return {
      original: 0,
      transcoded: 0,
      thumbnails: 0,
      total: 0
    };
  }

  private async getProcessingStats(): Promise<any> {
    // Implement processing statistics calculation
    return {
      average_processing_time: 0,
      success_rate: 0,
      failed_jobs: 0
    };
  }
}