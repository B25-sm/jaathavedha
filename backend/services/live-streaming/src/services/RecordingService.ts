import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { pgPool, logger } from '../index';
import { SessionRecording, RecordingStatus } from '../types';
import * as path from 'path';

/**
 * Recording Service
 * Manages session recording, storage, and processing
 */
class RecordingService {
  private s3Client: S3Client;
  private bucket: string;
  private cdnUrl: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    this.bucket = process.env.AWS_S3_BUCKET || 'sai-mahendra-recordings';
    this.cdnUrl = process.env.AWS_CLOUDFRONT_URL || '';
  }

  /**
   * Start recording a session
   */
  async startRecording(
    sessionId: string,
    quality: string = '1080p',
    format: string = 'mp4'
  ): Promise<SessionRecording> {
    const recordingId = uuidv4();
    const fileName = `session-${sessionId}-${Date.now()}.${format}`;
    const s3Key = `recordings/${sessionId}/${fileName}`;

    const query = `
      INSERT INTO session_recordings (
        id, session_id, file_name, file_size, duration,
        quality, format, s3_key, status, started_at
      ) VALUES ($1, $2, $3, 0, 0, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        recordingId,
        sessionId,
        fileName,
        quality,
        format,
        s3Key,
        RecordingStatus.RECORDING
      ]);

      const recording = this.mapRowToRecording(result.rows[0]);

      logger.info('Recording started', { sessionId, recordingId, quality });
      return recording;
    } catch (error) {
      logger.error('Failed to start recording', { error, sessionId });
      throw new Error('Failed to start recording');
    }
  }

  /**
   * Stop recording a session
   */
  async stopRecording(
    recordingId: string,
    fileSize: number,
    duration: number
  ): Promise<SessionRecording> {
    const query = `
      UPDATE session_recordings 
      SET status = $1, 
          file_size = $2,
          duration = $3,
          completed_at = NOW()
      WHERE id = $4 AND status = $5
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        RecordingStatus.PROCESSING,
        fileSize,
        duration,
        recordingId,
        RecordingStatus.RECORDING
      ]);

      if (result.rows.length === 0) {
        throw new Error('Recording not found or not in recording state');
      }

      const recording = this.mapRowToRecording(result.rows[0]);

      logger.info('Recording stopped', { recordingId, fileSize, duration });

      // Start async processing
      this.processRecording(recording).catch(err => {
        logger.error('Recording processing failed', { error: err, recordingId });
      });

      return recording;
    } catch (error) {
      logger.error('Failed to stop recording', { error, recordingId });
      throw new Error('Failed to stop recording');
    }
  }

  /**
   * Process recording (generate thumbnails, optimize, upload to S3)
   */
  private async processRecording(recording: SessionRecording): Promise<void> {
    try {
      logger.info('Processing recording', { recordingId: recording.id });

      // In production, this would:
      // 1. Generate thumbnails using FFmpeg
      // 2. Optimize video quality
      // 3. Upload to S3
      // 4. Generate CDN URLs
      // 5. Update database

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Generate S3 URL
      const s3Url = `https://${this.bucket}.s3.amazonaws.com/${recording.s3Key}`;
      const cdnUrl = this.cdnUrl 
        ? `${this.cdnUrl}/${recording.s3Key}` 
        : s3Url;
      const thumbnailUrl = `${cdnUrl.replace('.mp4', '-thumbnail.jpg')}`;

      // Update recording status
      const query = `
        UPDATE session_recordings 
        SET status = $1,
            s3_url = $2,
            cdn_url = $3,
            thumbnail_url = $4,
            processed_at = NOW()
        WHERE id = $5
      `;

      await pgPool.query(query, [
        RecordingStatus.COMPLETED,
        s3Url,
        cdnUrl,
        thumbnailUrl,
        recording.id
      ]);

      // Update session with recording URL
      await pgPool.query(
        'UPDATE live_sessions SET recording_url = $1 WHERE id = $2',
        [cdnUrl, recording.sessionId]
      );

      logger.info('Recording processed successfully', { 
        recordingId: recording.id,
        cdnUrl 
      });
    } catch (error) {
      logger.error('Recording processing failed', { 
        error, 
        recordingId: recording.id 
      });

      // Mark as failed
      await pgPool.query(
        'UPDATE session_recordings SET status = $1 WHERE id = $2',
        [RecordingStatus.FAILED, recording.id]
      );
    }
  }

  /**
   * Upload recording file to S3
   */
  async uploadRecording(
    recordingId: string,
    fileBuffer: Buffer,
    contentType: string = 'video/mp4'
  ): Promise<string> {
    try {
      const recording = await this.getRecording(recordingId);
      if (!recording) {
        throw new Error('Recording not found');
      }

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: recording.s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: {
          sessionId: recording.sessionId,
          recordingId: recording.id,
          quality: recording.quality
        }
      });

      await this.s3Client.send(command);

      const s3Url = `https://${this.bucket}.s3.amazonaws.com/${recording.s3Key}`;

      logger.info('Recording uploaded to S3', { recordingId, s3Url });
      return s3Url;
    } catch (error) {
      logger.error('Failed to upload recording', { error, recordingId });
      throw new Error('Failed to upload recording');
    }
  }

  /**
   * Get signed URL for recording download
   */
  async getSignedDownloadUrl(
    recordingId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const recording = await this.getRecording(recordingId);
      if (!recording) {
        throw new Error('Recording not found');
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: recording.s3Key
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn 
      });

      logger.info('Signed URL generated', { recordingId, expiresIn });
      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', { error, recordingId });
      throw new Error('Failed to generate signed URL');
    }
  }

  /**
   * Get recording by ID
   */
  async getRecording(recordingId: string): Promise<SessionRecording | null> {
    const query = 'SELECT * FROM session_recordings WHERE id = $1';

    try {
      const result = await pgPool.query(query, [recordingId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToRecording(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get recording', { error, recordingId });
      throw new Error('Failed to get recording');
    }
  }

  /**
   * Get recordings for a session
   */
  async getSessionRecordings(sessionId: string): Promise<SessionRecording[]> {
    const query = `
      SELECT * FROM session_recordings 
      WHERE session_id = $1 
      ORDER BY started_at DESC
    `;

    try {
      const result = await pgPool.query(query, [sessionId]);
      return result.rows.map(row => this.mapRowToRecording(row));
    } catch (error) {
      logger.error('Failed to get session recordings', { error, sessionId });
      throw new Error('Failed to get session recordings');
    }
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingId: string): Promise<void> {
    try {
      const recording = await this.getRecording(recordingId);
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Delete from S3 (in production)
      // await this.s3Client.send(new DeleteObjectCommand({
      //   Bucket: this.bucket,
      //   Key: recording.s3Key
      // }));

      // Delete from database
      await pgPool.query('DELETE FROM session_recordings WHERE id = $1', [
        recordingId
      ]);

      logger.info('Recording deleted', { recordingId });
    } catch (error) {
      logger.error('Failed to delete recording', { error, recordingId });
      throw new Error('Failed to delete recording');
    }
  }

  /**
   * Map database row to SessionRecording
   */
  private mapRowToRecording(row: any): SessionRecording {
    return {
      id: row.id,
      sessionId: row.session_id,
      fileName: row.file_name,
      fileSize: row.file_size,
      duration: row.duration,
      quality: row.quality,
      format: row.format,
      s3Key: row.s3_key,
      s3Url: row.s3_url,
      cdnUrl: row.cdn_url,
      thumbnailUrl: row.thumbnail_url,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      processedAt: row.processed_at
    };
  }
}

export default new RecordingService();
