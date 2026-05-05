/**
 * Voice Note Service
 * Handles voice-to-text note-taking for mobile devices
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '@sai-mahendra/utils';
import {
  VoiceNote,
  VoiceTranscriptionRequest,
  VoiceTranscriptionResponse,
  TextNote,
} from '../types/mobileFeatures';
import { v4 as uuidv4 } from 'uuid';

export class VoiceNoteService {
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
    this.bucketName = process.env.S3_BUCKET_NAME || 'sai-mahendra-voice-notes';
  }

  /**
   * Create voice note with transcription
   */
  async createVoiceNote(
    userId: string,
    deviceId: string,
    request: VoiceTranscriptionRequest
  ): Promise<VoiceTranscriptionResponse> {
    try {
      // Upload audio to S3
      const audioKey = `voice-notes/${userId}/${uuidv4()}.${request.audioFormat}`;
      const audioBuffer = Buffer.from(request.audioData, 'base64');

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: audioKey,
          Body: audioBuffer,
          ContentType: `audio/${request.audioFormat}`,
        })
      );

      const audioUrl = `https://${this.bucketName}.s3.amazonaws.com/${audioKey}`;

      // Create voice note record
      const noteResult = await this.db.query(
        `INSERT INTO voice_notes 
         (user_id, course_id, lesson_id, video_id, video_position, 
          audio_url, language, duration, device_id, transcription_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
         RETURNING *`,
        [
          userId,
          request.courseId,
          request.lessonId,
          request.videoId,
          request.videoPosition,
          audioUrl,
          request.language,
          0, // Duration will be calculated
          deviceId,
        ]
      );

      const noteId = noteResult.rows[0].id;

      // Queue transcription job
      await this.queueTranscription(noteId, audioUrl, request.language);

      // For demo purposes, simulate transcription
      // In production, this would integrate with AWS Transcribe, Google Speech-to-Text, etc.
      const transcription = await this.simulateTranscription(audioBuffer, request.language);

      // Update note with transcription
      await this.db.query(
        `UPDATE voice_notes 
         SET transcription = $1, transcription_status = 'completed', 
             confidence = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [transcription.text, transcription.confidence, noteId]
      );

      logger.info(`Voice note created and transcribed: ${noteId}`);

      return {
        transcription: transcription.text,
        confidence: transcription.confidence,
        language: request.language,
        duration: transcription.duration,
        alternatives: transcription.alternatives,
        noteId,
      };
    } catch (error) {
      logger.error('Error creating voice note:', error);
      throw new Error('Failed to create voice note');
    }
  }

  /**
   * Get voice notes for user
   */
  async getVoiceNotes(
    userId: string,
    courseId?: string,
    lessonId?: string,
    videoId?: string
  ): Promise<VoiceNote[]> {
    try {
      let query = `SELECT * FROM voice_notes WHERE user_id = $1`;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (courseId) {
        query += ` AND course_id = $${paramIndex}`;
        params.push(courseId);
        paramIndex++;
      }

      if (lessonId) {
        query += ` AND lesson_id = $${paramIndex}`;
        params.push(lessonId);
        paramIndex++;
      }

      if (videoId) {
        query += ` AND video_id = $${paramIndex}`;
        params.push(videoId);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapVoiceNoteRow);
    } catch (error) {
      logger.error('Error getting voice notes:', error);
      throw new Error('Failed to get voice notes');
    }
  }

  /**
   * Create text note
   */
  async createTextNote(
    userId: string,
    deviceId: string,
    data: {
      courseId: string;
      lessonId: string;
      videoId?: string;
      videoPosition?: number;
      content: string;
      noteType: 'text' | 'voice' | 'mixed';
      tags?: string[];
      isBookmarked?: boolean;
    }
  ): Promise<TextNote> {
    try {
      const result = await this.db.query(
        `INSERT INTO text_notes 
         (user_id, course_id, lesson_id, video_id, video_position, 
          content, note_type, tags, is_bookmarked, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId,
          data.courseId,
          data.lessonId,
          data.videoId,
          data.videoPosition,
          data.content,
          data.noteType,
          JSON.stringify(data.tags || []),
          data.isBookmarked || false,
          deviceId,
        ]
      );

      logger.info(`Text note created: ${result.rows[0].id}`);
      return this.mapTextNoteRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating text note:', error);
      throw new Error('Failed to create text note');
    }
  }

  /**
   * Get text notes for user
   */
  async getTextNotes(
    userId: string,
    courseId?: string,
    lessonId?: string,
    videoId?: string
  ): Promise<TextNote[]> {
    try {
      let query = `SELECT * FROM text_notes WHERE user_id = $1`;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (courseId) {
        query += ` AND course_id = $${paramIndex}`;
        params.push(courseId);
        paramIndex++;
      }

      if (lessonId) {
        query += ` AND lesson_id = $${paramIndex}`;
        params.push(lessonId);
        paramIndex++;
      }

      if (videoId) {
        query += ` AND video_id = $${paramIndex}`;
        params.push(videoId);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapTextNoteRow);
    } catch (error) {
      logger.error('Error getting text notes:', error);
      throw new Error('Failed to get text notes');
    }
  }

  /**
   * Update text note
   */
  async updateTextNote(
    noteId: string,
    userId: string,
    updates: {
      content?: string;
      tags?: string[];
      isBookmarked?: boolean;
    }
  ): Promise<TextNote> {
    try {
      const result = await this.db.query(
        `UPDATE text_notes 
         SET content = COALESCE($1, content),
             tags = COALESCE($2, tags),
             is_bookmarked = COALESCE($3, is_bookmarked),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [
          updates.content,
          updates.tags ? JSON.stringify(updates.tags) : null,
          updates.isBookmarked,
          noteId,
          userId,
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Note not found');
      }

      logger.info(`Text note updated: ${noteId}`);
      return this.mapTextNoteRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating text note:', error);
      throw new Error('Failed to update text note');
    }
  }

  /**
   * Delete note
   */
  async deleteNote(noteId: string, userId: string, noteType: 'text' | 'voice'): Promise<void> {
    try {
      const table = noteType === 'text' ? 'text_notes' : 'voice_notes';
      const result = await this.db.query(
        `DELETE FROM ${table} WHERE id = $1 AND user_id = $2`,
        [noteId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Note not found');
      }

      logger.info(`${noteType} note deleted: ${noteId}`);
    } catch (error) {
      logger.error('Error deleting note:', error);
      throw new Error('Failed to delete note');
    }
  }

  /**
   * Search notes
   */
  async searchNotes(
    userId: string,
    searchQuery: string,
    courseId?: string
  ): Promise<{ textNotes: TextNote[]; voiceNotes: VoiceNote[] }> {
    try {
      let textQuery = `
        SELECT * FROM text_notes 
        WHERE user_id = $1 AND content ILIKE $2
      `;
      let voiceQuery = `
        SELECT * FROM voice_notes 
        WHERE user_id = $1 AND transcription ILIKE $2
      `;
      const params: any[] = [userId, `%${searchQuery}%`];

      if (courseId) {
        textQuery += ` AND course_id = $3`;
        voiceQuery += ` AND course_id = $3`;
        params.push(courseId);
      }

      textQuery += ` ORDER BY created_at DESC LIMIT 50`;
      voiceQuery += ` ORDER BY created_at DESC LIMIT 50`;

      const [textResult, voiceResult] = await Promise.all([
        this.db.query(textQuery, params),
        this.db.query(voiceQuery, params),
      ]);

      return {
        textNotes: textResult.rows.map(this.mapTextNoteRow),
        voiceNotes: voiceResult.rows.map(this.mapVoiceNoteRow),
      };
    } catch (error) {
      logger.error('Error searching notes:', error);
      throw new Error('Failed to search notes');
    }
  }

  /**
   * Sync notes across devices
   */
  async syncNotes(
    userId: string,
    deviceId: string,
    lastSyncTimestamp: Date
  ): Promise<{ textNotes: TextNote[]; voiceNotes: VoiceNote[] }> {
    try {
      const textResult = await this.db.query(
        `SELECT * FROM text_notes 
         WHERE user_id = $1 AND updated_at > $2
         ORDER BY updated_at DESC`,
        [userId, lastSyncTimestamp]
      );

      const voiceResult = await this.db.query(
        `SELECT * FROM voice_notes 
         WHERE user_id = $1 AND updated_at > $2
         ORDER BY updated_at DESC`,
        [userId, lastSyncTimestamp]
      );

      return {
        textNotes: textResult.rows.map(this.mapTextNoteRow),
        voiceNotes: voiceResult.rows.map(this.mapVoiceNoteRow),
      };
    } catch (error) {
      logger.error('Error syncing notes:', error);
      throw new Error('Failed to sync notes');
    }
  }

  /**
   * Queue transcription job (placeholder for actual implementation)
   */
  private async queueTranscription(
    noteId: string,
    audioUrl: string,
    language: string
  ): Promise<void> {
    // In production, this would queue a job to AWS Transcribe, Google Speech-to-Text, etc.
    await this.redis.lpush(
      'transcription:queue',
      JSON.stringify({ noteId, audioUrl, language })
    );
  }

  /**
   * Simulate transcription (placeholder for actual implementation)
   */
  private async simulateTranscription(
    audioBuffer: Buffer,
    language: string
  ): Promise<{
    text: string;
    confidence: number;
    duration: number;
    alternatives: Array<{ text: string; confidence: number }>;
  }> {
    // In production, this would call AWS Transcribe, Google Speech-to-Text, etc.
    // For now, return a simulated response
    return {
      text: 'This is a simulated transcription of the voice note.',
      confidence: 0.95,
      duration: 10,
      alternatives: [
        { text: 'This is a simulated transcription of the voice note.', confidence: 0.95 },
        { text: 'This is the simulated transcription of the voice note.', confidence: 0.85 },
      ],
    };
  }

  /**
   * Helper: Map voice note row to object
   */
  private mapVoiceNoteRow(row: any): VoiceNote {
    return {
      id: row.id,
      userId: row.user_id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      videoId: row.video_id,
      videoPosition: row.video_position,
      audioUrl: row.audio_url,
      transcription: row.transcription,
      transcriptionStatus: row.transcription_status,
      language: row.language,
      duration: row.duration,
      confidence: row.confidence,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deviceId: row.device_id,
      syncStatus: row.sync_status || 'synced',
    };
  }

  /**
   * Helper: Map text note row to object
   */
  private mapTextNoteRow(row: any): TextNote {
    return {
      id: row.id,
      userId: row.user_id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      videoId: row.video_id,
      videoPosition: row.video_position,
      content: row.content,
      noteType: row.note_type,
      tags: row.tags || [],
      isBookmarked: row.is_bookmarked,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deviceId: row.device_id,
      syncStatus: row.sync_status || 'synced',
    };
  }
}
