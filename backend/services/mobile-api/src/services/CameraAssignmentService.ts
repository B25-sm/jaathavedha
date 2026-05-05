/**
 * Camera Assignment Service
 * Handles mobile assignment submissions with camera integration
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '@sai-mahendra/utils';
import {
  AssignmentSubmission,
  CameraCapture,
  CameraUploadRequest,
  AssignmentSubmissionRequest,
} from '../types/mobileFeatures';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

export class CameraAssignmentService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    private db: Pool,
    private redis: Redis
  ) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'sai-mahendra-assignments';
  }

  /**
   * Upload camera capture
   */
  async uploadCameraCapture(
    userId: string,
    deviceId: string,
    request: CameraUploadRequest
  ): Promise<CameraCapture> {
    try {
      // Decode base64 file data
      const fileBuffer = Buffer.from(request.fileData, 'base64');

      // Generate unique file key
      const fileExtension = request.fileName.split('.').pop() || 'jpg';
      const fileKey = `assignments/${userId}/${request.assignmentId}/${uuidv4()}.${fileExtension}`;

      // Process image if it's a photo
      let processedBuffer = fileBuffer;
      let thumbnailUrl: string | undefined;

      if (request.captureType === 'photo' || request.captureType === 'scan') {
        // Optimize image
        processedBuffer = await sharp(fileBuffer)
          .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Generate thumbnail
        const thumbnailBuffer = await sharp(fileBuffer)
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();

        const thumbnailKey = `assignments/${userId}/${request.assignmentId}/thumbnails/${uuidv4()}.jpg`;
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: thumbnailKey,
            Body: thumbnailBuffer,
            ContentType: 'image/jpeg',
          })
        );

        thumbnailUrl = `https://${this.bucketName}.s3.amazonaws.com/${thumbnailKey}`;
      }

      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileKey,
          Body: processedBuffer,
          ContentType: request.mimeType,
        })
      );

      const fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${fileKey}`;

      // Create camera capture record
      const result = await this.db.query(
        `INSERT INTO camera_captures 
         (user_id, assignment_id, capture_type, file_url, thumbnail_url, 
          file_size, mime_type, width, height, duration, metadata, processing_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'completed')
         RETURNING *`,
        [
          userId,
          request.assignmentId,
          request.captureType,
          fileUrl,
          thumbnailUrl,
          processedBuffer.length,
          request.mimeType,
          request.metadata?.width,
          request.metadata?.height,
          request.metadata?.duration,
          JSON.stringify({
            deviceId,
            ...request.metadata,
          }),
        ]
      );

      // If it's a scan, queue OCR processing
      if (request.captureType === 'scan') {
        await this.queueOCRProcessing(result.rows[0].id, fileUrl);
      }

      logger.info(`Camera capture uploaded: ${result.rows[0].id}`);
      return this.mapCameraCaptureRow(result.rows[0]);
    } catch (error) {
      logger.error('Error uploading camera capture:', error);
      throw new Error('Failed to upload camera capture');
    }
  }

  /**
   * Create assignment submission
   */
  async createSubmission(
    userId: string,
    deviceId: string,
    request: AssignmentSubmissionRequest
  ): Promise<AssignmentSubmission> {
    try {
      // Verify assignment exists and user is enrolled
      const assignmentCheck = await this.db.query(
        `SELECT a.id, e.user_id 
         FROM assignments a
         JOIN enrollments e ON e.course_id = a.course_id
         WHERE a.id = $1 AND e.user_id = $2`,
        [request.assignmentId, userId]
      );

      if (assignmentCheck.rows.length === 0) {
        throw new Error('Assignment not found or user not enrolled');
      }

      // Create submission
      const result = await this.db.query(
        `INSERT INTO assignment_submissions 
         (user_id, assignment_id, course_id, submission_type, status, device_id)
         VALUES ($1, $2, $3, $4, 'draft', $5)
         RETURNING *`,
        [userId, request.assignmentId, request.courseId, request.submissionType, deviceId]
      );

      const submissionId = result.rows[0].id;

      // Link camera captures to submission
      if (request.captureIds && request.captureIds.length > 0) {
        await this.db.query(
          `UPDATE camera_captures 
           SET submission_id = $1 
           WHERE id = ANY($2) AND user_id = $3`,
          [submissionId, request.captureIds, userId]
        );
      }

      // Add text content if provided
      if (request.textContent) {
        await this.db.query(
          `UPDATE assignment_submissions 
           SET text_content = $1 
           WHERE id = $2`,
          [request.textContent, submissionId]
        );
      }

      logger.info(`Assignment submission created: ${submissionId}`);
      return this.mapSubmissionRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating submission:', error);
      throw new Error('Failed to create submission');
    }
  }

  /**
   * Submit assignment
   */
  async submitAssignment(
    submissionId: string,
    userId: string
  ): Promise<AssignmentSubmission> {
    try {
      const result = await this.db.query(
        `UPDATE assignment_submissions 
         SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND status = 'draft'
         RETURNING *`,
        [submissionId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Submission not found or already submitted');
      }

      // Notify instructor
      await this.notifyInstructor(result.rows[0]);

      logger.info(`Assignment submitted: ${submissionId}`);
      return this.mapSubmissionRow(result.rows[0]);
    } catch (error) {
      logger.error('Error submitting assignment:', error);
      throw new Error('Failed to submit assignment');
    }
  }

  /**
   * Get user submissions
   */
  async getUserSubmissions(
    userId: string,
    courseId?: string,
    status?: string
  ): Promise<AssignmentSubmission[]> {
    try {
      let query = `SELECT * FROM assignment_submissions WHERE user_id = $1`;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (courseId) {
        query += ` AND course_id = $${paramIndex}`;
        params.push(courseId);
        paramIndex++;
      }

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapSubmissionRow);
    } catch (error) {
      logger.error('Error getting user submissions:', error);
      throw new Error('Failed to get user submissions');
    }
  }

  /**
   * Get submission details with captures
   */
  async getSubmissionDetails(
    submissionId: string,
    userId: string
  ): Promise<{
    submission: AssignmentSubmission;
    captures: CameraCapture[];
  }> {
    try {
      const submissionResult = await this.db.query(
        `SELECT * FROM assignment_submissions WHERE id = $1 AND user_id = $2`,
        [submissionId, userId]
      );

      if (submissionResult.rows.length === 0) {
        throw new Error('Submission not found');
      }

      const capturesResult = await this.db.query(
        `SELECT * FROM camera_captures WHERE submission_id = $1 ORDER BY created_at`,
        [submissionId]
      );

      return {
        submission: this.mapSubmissionRow(submissionResult.rows[0]),
        captures: capturesResult.rows.map(this.mapCameraCaptureRow),
      };
    } catch (error) {
      logger.error('Error getting submission details:', error);
      throw new Error('Failed to get submission details');
    }
  }

  /**
   * Delete camera capture
   */
  async deleteCameraCapture(captureId: string, userId: string): Promise<void> {
    try {
      const result = await this.db.query(
        `DELETE FROM camera_captures 
         WHERE id = $1 AND user_id = $2 AND submission_id IS NULL`,
        [captureId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Capture not found or already submitted');
      }

      logger.info(`Camera capture deleted: ${captureId}`);
    } catch (error) {
      logger.error('Error deleting camera capture:', error);
      throw new Error('Failed to delete camera capture');
    }
  }

  /**
   * Get pending captures (not yet submitted)
   */
  async getPendingCaptures(
    userId: string,
    assignmentId?: string
  ): Promise<CameraCapture[]> {
    try {
      let query = `
        SELECT * FROM camera_captures 
        WHERE user_id = $1 AND submission_id IS NULL
      `;
      const params: any[] = [userId];

      if (assignmentId) {
        query += ` AND assignment_id = $2`;
        params.push(assignmentId);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapCameraCaptureRow);
    } catch (error) {
      logger.error('Error getting pending captures:', error);
      throw new Error('Failed to get pending captures');
    }
  }

  /**
   * Queue OCR processing for scanned documents
   */
  private async queueOCRProcessing(captureId: string, fileUrl: string): Promise<void> {
    // In production, this would queue a job to AWS Textract, Google Vision API, etc.
    await this.redis.lpush(
      'ocr:queue',
      JSON.stringify({ captureId, fileUrl })
    );
    logger.info(`OCR processing queued for capture: ${captureId}`);
  }

  /**
   * Notify instructor of new submission
   */
  private async notifyInstructor(submission: any): Promise<void> {
    // Queue notification
    await this.redis.lpush(
      'notifications:queue',
      JSON.stringify({
        type: 'assignment_submitted',
        assignmentId: submission.assignment_id,
        userId: submission.user_id,
        submissionId: submission.id,
      })
    );
  }

  /**
   * Helper: Map submission row to object
   */
  private mapSubmissionRow(row: any): AssignmentSubmission {
    return {
      id: row.id,
      userId: row.user_id,
      assignmentId: row.assignment_id,
      courseId: row.course_id,
      submissionType: row.submission_type,
      status: row.status,
      submittedAt: row.submitted_at,
      gradedAt: row.graded_at,
      grade: row.grade,
      feedback: row.feedback,
      deviceId: row.device_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Helper: Map camera capture row to object
   */
  private mapCameraCaptureRow(row: any): CameraCapture {
    return {
      id: row.id,
      submissionId: row.submission_id,
      userId: row.user_id,
      captureType: row.capture_type,
      fileUrl: row.file_url,
      thumbnailUrl: row.thumbnail_url,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      duration: row.duration,
      metadata: row.metadata,
      processingStatus: row.processing_status,
      ocrText: row.ocr_text,
      createdAt: row.created_at,
    };
  }
}
