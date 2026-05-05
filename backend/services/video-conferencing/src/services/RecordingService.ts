import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query, getClient } from '../database';
import logger from '../utils/logger';
import ZoomService from './ZoomService';
import { Recording, RecordingStatus, MeetingProvider } from '../types';
import { v4 as uuidv4 } from 'uuid';

export default class RecordingService {
  private s3Client: S3Client;
  private zoomService: ZoomService;
  private bucketName: string;
  private recordingsPrefix: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.zoomService = new ZoomService();
    this.bucketName = process.env.AWS_S3_BUCKET || '';
    this.recordingsPrefix = process.env.AWS_S3_RECORDINGS_PREFIX || 'recordings/';
  }

  /**
   * Process recording from Zoom webhook
   */
  async processZoomRecording(
    meetingId: string,
    providerMeetingId: string,
    recordingFiles: any[]
  ): Promise<Recording[]> {
    const recordings: Recording[] = [];

    for (const file of recordingFiles) {
      try {
        const recordingId = uuidv4();
        const fileName = `${providerMeetingId}_${file.recording_type}_${Date.now()}.${file.file_type}`;
        const s3Key = `${this.recordingsPrefix}${fileName}`;

        // Store initial recording metadata
        const insertQuery = `
          INSERT INTO video_conferencing_recordings (
            id, meeting_id, provider_recording_id, file_name, file_size_bytes,
            duration_minutes, recording_type, download_url, s3_key, status,
            recorded_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING *
        `;

        const durationMinutes = Math.ceil(
          (new Date(file.recording_end).getTime() -
            new Date(file.recording_start).getTime()) /
            60000
        );

        const result = await query(insertQuery, [
          recordingId,
          meetingId,
          file.id,
          fileName,
          file.file_size,
          durationMinutes,
          file.recording_type,
          file.download_url,
          s3Key,
          RecordingStatus.PROCESSING,
          new Date(file.recording_start),
        ]);

        recordings.push(this.mapRowToRecording(result.rows[0]));

        // Download and upload to S3 asynchronously
        this.downloadAndUploadRecording(recordingId, file.download_url, s3Key, fileName);
      } catch (error) {
        logger.error('Failed to process recording file:', error);
      }
    }

    return recordings;
  }

  /**
   * Download recording from Zoom and upload to S3
   */
  private async downloadAndUploadRecording(
    recordingId: string,
    downloadUrl: string,
    s3Key: string,
    fileName: string
  ): Promise<void> {
    try {
      logger.info('Downloading recording from Zoom', { recordingId });

      // Update status to downloading
      await query(
        'UPDATE video_conferencing_recordings SET status = $1, updated_at = NOW() WHERE id = $2',
        [RecordingStatus.DOWNLOADING, recordingId]
      );

      // Download from Zoom
      const recordingBuffer = await this.zoomService.downloadRecording(downloadUrl);

      logger.info('Uploading recording to S3', { recordingId, s3Key });

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: recordingBuffer,
        ContentType: this.getContentType(fileName),
        Metadata: {
          recordingId: recordingId,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(uploadCommand);

      // Generate S3 URL
      const s3Url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

      // Update recording status
      await query(
        `UPDATE video_conferencing_recordings 
         SET status = $1, s3_url = $2, updated_at = NOW() 
         WHERE id = $3`,
        [RecordingStatus.DOWNLOADED, s3Url, recordingId]
      );

      logger.info('Recording uploaded successfully', { recordingId });
    } catch (error) {
      logger.error('Failed to download and upload recording:', error);

      // Update status to failed
      await query(
        'UPDATE video_conferencing_recordings SET status = $1, updated_at = NOW() WHERE id = $2',
        [RecordingStatus.FAILED, recordingId]
      );
    }
  }

  /**
   * Get recording by ID
   */
  async getRecordingById(recordingId: string): Promise<Recording | null> {
    try {
      const result = await query(
        'SELECT * FROM video_conferencing_recordings WHERE id = $1',
        [recordingId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToRecording(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get recording:', error);
      throw error;
    }
  }

  /**
   * Get recordings by meeting ID
   */
  async getRecordingsByMeeting(meetingId: string): Promise<Recording[]> {
    try {
      const result = await query(
        'SELECT * FROM video_conferencing_recordings WHERE meeting_id = $1 ORDER BY recorded_at DESC',
        [meetingId]
      );

      return result.rows.map(this.mapRowToRecording);
    } catch (error) {
      logger.error('Failed to get recordings by meeting:', error);
      throw error;
    }
  }

  /**
   * Generate presigned URL for recording playback
   */
  async generatePlaybackUrl(recordingId: string, expiresIn: number = 3600): Promise<string> {
    try {
      const recording = await this.getRecordingById(recordingId);
      if (!recording || !recording.s3_key) {
        throw new Error('Recording not found or not available');
      }

      if (recording.status !== RecordingStatus.DOWNLOADED) {
        throw new Error('Recording is not ready for playback');
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: recording.s3_key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.info('Generated playback URL', { recordingId, expiresIn });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate playback URL:', error);
      throw error;
    }
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingId: string): Promise<void> {
    try {
      const recording = await this.getRecordingById(recordingId);
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Delete from S3 if exists
      if (recording.s3_key) {
        // Note: Implement S3 deletion if needed
        logger.info('Recording deletion from S3 not implemented', { recordingId });
      }

      // Delete from database
      await query('DELETE FROM video_conferencing_recordings WHERE id = $1', [
        recordingId,
      ]);

      logger.info('Recording deleted successfully', { recordingId });
    } catch (error) {
      logger.error('Failed to delete recording:', error);
      throw error;
    }
  }

  /**
   * Track recording view
   */
  async trackRecordingView(recordingId: string, userId: string): Promise<void> {
    try {
      await query(
        `INSERT INTO video_conferencing_recording_views (id, recording_id, user_id, viewed_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())`,
        [recordingId, userId]
      );

      logger.info('Recording view tracked', { recordingId, userId });
    } catch (error) {
      logger.error('Failed to track recording view:', error);
      throw error;
    }
  }

  /**
   * Get content type from file name
   */
  private getContentType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const contentTypes: { [key: string]: string } = {
      mp4: 'video/mp4',
      m4a: 'audio/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      txt: 'text/plain',
      vtt: 'text/vtt',
    };

    return contentTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Map database row to Recording object
   */
  private mapRowToRecording(row: any): Recording {
    return {
      id: row.id,
      meeting_id: row.meeting_id,
      provider_recording_id: row.provider_recording_id,
      file_name: row.file_name,
      file_size_bytes: row.file_size_bytes,
      duration_minutes: row.duration_minutes,
      recording_type: row.recording_type,
      download_url: row.download_url,
      s3_key: row.s3_key,
      s3_url: row.s3_url,
      status: row.status,
      recorded_at: row.recorded_at,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
