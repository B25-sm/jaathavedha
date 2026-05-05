/**
 * Download Service
 * Manages mobile video and content downloads with queue management
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { ContentDownloadRequest, DownloadQueueItem } from '../types';

export class DownloadService {
  private db: Pool;
  private redis: Redis;
  private readonly MAX_DOWNLOADS_PER_USER = 50;
  private readonly DOWNLOAD_EXPIRY_DAYS = 30;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Request a content download
   */
  async requestDownload(
    userId: string,
    deviceId: string,
    request: ContentDownloadRequest
  ): Promise<DownloadQueueItem> {
    const { contentType, contentId, courseId, quality = '720p', wifiOnly = true } = request;

    // Check if user has reached download limit
    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM download_queue 
       WHERE user_id = $1 AND status IN ('queued', 'downloading', 'completed')`,
      [userId]
    );

    const currentDownloads = parseInt(countResult.rows[0].count);
    if (currentDownloads >= this.MAX_DOWNLOADS_PER_USER) {
      throw new Error(`Download limit reached. Maximum ${this.MAX_DOWNLOADS_PER_USER} downloads allowed.`);
    }

    // Check if already downloaded or in queue
    const existingResult = await this.db.query(
      `SELECT id, status FROM download_queue 
       WHERE user_id = $1 AND device_id = $2 AND content_id = $3 AND status != 'failed'`,
      [userId, deviceId, contentId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.status === 'completed') {
        throw new Error('Content already downloaded');
      }
      throw new Error('Download already in queue');
    }

    // Get content info (video file size, etc.)
    const contentInfo = await this.getContentInfo(contentId, contentType, quality);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.DOWNLOAD_EXPIRY_DAYS);

    // Add to download queue
    const result = await this.db.query(
      `INSERT INTO download_queue 
       (user_id, device_id, content_type, content_id, course_id, quality, 
        priority, status, file_size, wifi_only, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued', $8, $9, $10)
       RETURNING *`,
      [
        userId,
        deviceId,
        contentType,
        contentId,
        courseId,
        quality,
        0, // priority
        contentInfo.fileSize,
        wifiOnly,
        expiresAt,
      ]
    );

    const download = result.rows[0];

    // Generate download URL (signed URL for S3)
    const downloadUrl = await this.generateDownloadUrl(contentId, contentType, quality);

    // Update with download URL
    await this.db.query(
      `UPDATE download_queue SET download_url = $2 WHERE id = $1`,
      [download.id, downloadUrl]
    );

    // Add to Redis queue for processing
    await this.redis.lpush(`download:queue:${userId}`, download.id);

    return {
      id: download.id,
      userId,
      deviceId,
      contentType,
      contentId,
      courseId,
      quality,
      priority: 0,
      status: 'queued',
      progress: 0,
      fileSize: contentInfo.fileSize,
      downloadedBytes: 0,
      downloadUrl,
      wifiOnly,
      retryCount: 0,
      createdAt: download.created_at,
      expiresAt,
    };
  }

  /**
   * Get user's downloads
   */
  async getDownloads(userId: string, deviceId: string): Promise<DownloadQueueItem[]> {
    const result = await this.db.query(
      `SELECT dq.*, 
              CASE 
                WHEN dq.content_type = 'video' THEN v.title
                WHEN dq.content_type = 'document' THEN d.title
              END as content_title,
              c.title as course_title
       FROM download_queue dq
       LEFT JOIN videos v ON dq.content_type = 'video' AND dq.content_id = v.id
       LEFT JOIN documents d ON dq.content_type = 'document' AND dq.content_id = d.id
       LEFT JOIN courses c ON dq.course_id = c.id
       WHERE dq.user_id = $1 AND dq.device_id = $2
       ORDER BY 
         CASE dq.status
           WHEN 'downloading' THEN 1
           WHEN 'queued' THEN 2
           WHEN 'paused' THEN 3
           WHEN 'completed' THEN 4
           WHEN 'failed' THEN 5
         END,
         dq.created_at DESC`,
      [userId, deviceId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      contentType: row.content_type,
      contentId: row.content_id,
      courseId: row.course_id,
      quality: row.quality,
      priority: row.priority,
      status: row.status,
      progress: row.progress,
      fileSize: row.file_size,
      downloadedBytes: row.downloaded_bytes,
      downloadUrl: row.download_url,
      wifiOnly: row.wifi_only,
      retryCount: row.retry_count,
      error: row.error,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Update download progress
   */
  async updateProgress(downloadId: string, progress: number, downloadedBytes: number): Promise<void> {
    await this.db.query(
      `UPDATE download_queue 
       SET progress = $2, downloaded_bytes = $3, 
           status = CASE WHEN $2 = 100 THEN 'completed' ELSE status END,
           completed_at = CASE WHEN $2 = 100 THEN NOW() ELSE completed_at END
       WHERE id = $1`,
      [downloadId, progress, downloadedBytes]
    );

    // If completed, add to offline_content
    if (progress === 100) {
      const downloadResult = await this.db.query(
        `SELECT * FROM download_queue WHERE id = $1`,
        [downloadId]
      );

      const download = downloadResult.rows[0];

      await this.db.query(
        `INSERT INTO offline_content 
         (user_id, device_id, content_type, content_id, course_id, 
          file_size, quality, status, progress, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', 100, $8)
         ON CONFLICT (user_id, device_id, content_id) DO NOTHING`,
        [
          download.user_id,
          download.device_id,
          download.content_type,
          download.content_id,
          download.course_id,
          download.file_size,
          download.quality,
          download.expires_at,
        ]
      );
    }
  }

  /**
   * Pause download
   */
  async pauseDownload(downloadId: string): Promise<void> {
    await this.db.query(
      `UPDATE download_queue SET status = 'paused' WHERE id = $1 AND status = 'downloading'`,
      [downloadId]
    );
  }

  /**
   * Resume download
   */
  async resumeDownload(downloadId: string): Promise<void> {
    await this.db.query(
      `UPDATE download_queue SET status = 'queued' WHERE id = $1 AND status = 'paused'`,
      [downloadId]
    );
  }

  /**
   * Delete download
   */
  async deleteDownload(downloadId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get download info
      const result = await client.query(
        `SELECT user_id, device_id, content_id FROM download_queue WHERE id = $1`,
        [downloadId]
      );

      if (result.rows.length === 0) {
        throw new Error('Download not found');
      }

      const { user_id, device_id, content_id } = result.rows[0];

      // Delete from queue
      await client.query(`DELETE FROM download_queue WHERE id = $1`, [downloadId]);

      // Delete from offline content
      await client.query(
        `DELETE FROM offline_content 
         WHERE user_id = $1 AND device_id = $2 AND content_id = $3`,
        [user_id, device_id, content_id]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get offline content for device
   */
  async getOfflineContent(userId: string, deviceId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT oc.*,
              CASE 
                WHEN oc.content_type = 'video' THEN v.title
                WHEN oc.content_type = 'document' THEN d.title
              END as content_title,
              c.title as course_title
       FROM offline_content oc
       LEFT JOIN videos v ON oc.content_type = 'video' AND oc.content_id = v.id
       LEFT JOIN documents d ON oc.content_type = 'document' AND oc.content_id = d.id
       LEFT JOIN courses c ON oc.course_id = c.id
       WHERE oc.user_id = $1 AND oc.device_id = $2 AND oc.status = 'completed'
       ORDER BY oc.downloaded_at DESC`,
      [userId, deviceId]
    );

    return result.rows;
  }

  /**
   * Clean expired downloads
   */
  async cleanExpiredDownloads(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM offline_content 
       WHERE expires_at < NOW() AND status = 'completed'
       RETURNING id`
    );

    return result.rows.length;
  }

  /**
   * Get content info (file size, etc.)
   */
  private async getContentInfo(
    contentId: string,
    contentType: string,
    quality: string
  ): Promise<{ fileSize: number }> {
    if (contentType === 'video') {
      const result = await this.db.query(
        `SELECT file_sizes FROM videos WHERE id = $1`,
        [contentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Video not found');
      }

      const fileSizes = result.rows[0].file_sizes || {};
      const fileSize = fileSizes[quality] || fileSizes['720p'] || 100000000; // Default 100MB

      return { fileSize };
    } else if (contentType === 'document') {
      const result = await this.db.query(
        `SELECT file_size FROM documents WHERE id = $1`,
        [contentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      return { fileSize: result.rows[0].file_size || 1000000 }; // Default 1MB
    }

    return { fileSize: 1000000 }; // Default 1MB
  }

  /**
   * Generate signed download URL
   */
  private async generateDownloadUrl(
    contentId: string,
    contentType: string,
    quality: string
  ): Promise<string> {
    // In production, this would generate a signed S3 URL
    // For now, return a placeholder URL
    const baseUrl = process.env.CDN_URL || 'https://cdn.saimahendra.com';
    return `${baseUrl}/${contentType}/${contentId}/${quality}/download?expires=${Date.now() + 3600000}`;
  }

  /**
   * Get storage info for device
   */
  async getStorageInfo(userId: string, deviceId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT 
         COALESCE(SUM(file_size), 0) as used_size,
         COUNT(*) as download_count,
         json_agg(
           json_build_object(
             'contentId', content_id,
             'contentType', content_type,
             'size', file_size,
             'downloadedAt', downloaded_at,
             'expiresAt', expires_at
           )
         ) as downloads
       FROM offline_content
       WHERE user_id = $1 AND device_id = $2 AND status = 'completed'`,
      [userId, deviceId]
    );

    const usedSize = parseInt(result.rows[0].used_size);
    const downloads = result.rows[0].downloads || [];

    return {
      userId,
      deviceId,
      totalSize: 10 * 1024 * 1024 * 1024, // 10GB limit
      usedSize,
      availableSize: 10 * 1024 * 1024 * 1024 - usedSize,
      downloads,
    };
  }
}
