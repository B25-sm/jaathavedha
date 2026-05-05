import { query, getClient } from '../database';
import logger from '../utils/logger';
import ZoomService from './ZoomService';
import GoogleMeetService from './GoogleMeetService';
import {
  Meeting,
  MeetingProvider,
  MeetingStatus,
  MeetingSettings,
  CreateMeetingRequest,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export default class MeetingService {
  private zoomService: ZoomService;
  private googleMeetService: GoogleMeetService;

  constructor() {
    this.zoomService = new ZoomService();
    this.googleMeetService = new GoogleMeetService();
  }

  /**
   * Create a new meeting
   */
  async createMeeting(request: CreateMeetingRequest): Promise<Meeting> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const meetingId = uuidv4();
      const timezone = request.timezone || process.env.DEFAULT_TIMEZONE || 'UTC';
      const settings: MeetingSettings = {
        waiting_room: request.settings?.waiting_room ?? true,
        auto_recording: request.settings?.auto_recording ?? true,
        mute_upon_entry: request.settings?.mute_upon_entry ?? true,
        allow_screen_sharing: request.settings?.allow_screen_sharing ?? true,
        allow_chat: request.settings?.allow_chat ?? true,
        host_video: request.settings?.host_video ?? true,
        participant_video: request.settings?.participant_video ?? true,
      };

      let providerMeetingId: string;
      let joinUrl: string;
      let startUrl: string | undefined;
      let password: string | undefined;

      // Create meeting with the selected provider
      if (request.provider === MeetingProvider.ZOOM) {
        const zoomMeeting = await this.zoomService.createMeeting(
          request.instructor_id,
          request.title,
          request.start_time,
          request.duration_minutes,
          timezone,
          settings,
          request.description
        );

        providerMeetingId = zoomMeeting.id.toString();
        joinUrl = zoomMeeting.join_url;
        startUrl = zoomMeeting.start_url;
        password = zoomMeeting.password;
      } else if (request.provider === MeetingProvider.GOOGLE_MEET) {
        // Note: Google Meet requires OAuth tokens per user
        // This is a simplified version - in production, you'd need to manage user tokens
        const googleMeeting = await this.googleMeetService.createMeeting(
          request.title,
          request.start_time,
          request.duration_minutes,
          timezone,
          request.description,
          request.attendee_emails
        );

        providerMeetingId = googleMeeting.id;
        joinUrl = googleMeeting.hangoutLink;
      } else {
        throw new Error(`Unsupported meeting provider: ${request.provider}`);
      }

      // Store meeting in database
      const insertQuery = `
        INSERT INTO video_conferencing_meetings (
          id, provider, provider_meeting_id, session_id, instructor_id,
          title, description, start_time, duration_minutes, timezone,
          join_url, start_url, password, status, settings,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        meetingId,
        request.provider,
        providerMeetingId,
        request.session_id,
        request.instructor_id,
        request.title,
        request.description,
        request.start_time,
        request.duration_minutes,
        timezone,
        joinUrl,
        startUrl,
        password,
        MeetingStatus.SCHEDULED,
        JSON.stringify(settings),
      ]);

      await client.query('COMMIT');

      logger.info('Meeting created successfully', {
        meetingId,
        provider: request.provider,
      });

      return this.mapRowToMeeting(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create meeting:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get meeting by ID
   */
  async getMeetingById(meetingId: string): Promise<Meeting | null> {
    try {
      const result = await query(
        'SELECT * FROM video_conferencing_meetings WHERE id = $1',
        [meetingId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToMeeting(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get meeting:', error);
      throw error;
    }
  }

  /**
   * Get meetings by session ID
   */
  async getMeetingsBySession(sessionId: string): Promise<Meeting[]> {
    try {
      const result = await query(
        'SELECT * FROM video_conferencing_meetings WHERE session_id = $1 ORDER BY start_time DESC',
        [sessionId]
      );

      return result.rows.map(this.mapRowToMeeting);
    } catch (error) {
      logger.error('Failed to get meetings by session:', error);
      throw error;
    }
  }

  /**
   * Get meetings by instructor ID
   */
  async getMeetingsByInstructor(instructorId: string): Promise<Meeting[]> {
    try {
      const result = await query(
        'SELECT * FROM video_conferencing_meetings WHERE instructor_id = $1 ORDER BY start_time DESC',
        [instructorId]
      );

      return result.rows.map(this.mapRowToMeeting);
    } catch (error) {
      logger.error('Failed to get meetings by instructor:', error);
      throw error;
    }
  }

  /**
   * Update meeting status
   */
  async updateMeetingStatus(
    meetingId: string,
    status: MeetingStatus
  ): Promise<void> {
    try {
      await query(
        'UPDATE video_conferencing_meetings SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, meetingId]
      );

      logger.info('Meeting status updated', { meetingId, status });
    } catch (error) {
      logger.error('Failed to update meeting status:', error);
      throw error;
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get meeting details
      const meeting = await this.getMeetingById(meetingId);
      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Delete from provider
      if (meeting.provider === MeetingProvider.ZOOM) {
        await this.zoomService.deleteMeeting(meeting.provider_meeting_id);
      } else if (meeting.provider === MeetingProvider.GOOGLE_MEET) {
        await this.googleMeetService.deleteMeeting(meeting.provider_meeting_id);
      }

      // Delete from database
      await client.query(
        'DELETE FROM video_conferencing_meetings WHERE id = $1',
        [meetingId]
      );

      await client.query('COMMIT');

      logger.info('Meeting deleted successfully', { meetingId });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete meeting:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get upcoming meetings
   */
  async getUpcomingMeetings(limit: number = 10): Promise<Meeting[]> {
    try {
      const result = await query(
        `SELECT * FROM video_conferencing_meetings 
         WHERE start_time > NOW() AND status = $1 
         ORDER BY start_time ASC 
         LIMIT $2`,
        [MeetingStatus.SCHEDULED, limit]
      );

      return result.rows.map(this.mapRowToMeeting);
    } catch (error) {
      logger.error('Failed to get upcoming meetings:', error);
      throw error;
    }
  }

  /**
   * Mark past meetings as completed
   */
  async markPastMeetingsCompleted(): Promise<number> {
    try {
      const result = await query(
        `UPDATE video_conferencing_meetings 
         SET status = $1, updated_at = NOW() 
         WHERE start_time + (duration_minutes || ' minutes')::INTERVAL < NOW() 
         AND status IN ($2, $3)`,
        [MeetingStatus.COMPLETED, MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS]
      );

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to mark past meetings as completed:', error);
      throw error;
    }
  }

  /**
   * Map database row to Meeting object
   */
  private mapRowToMeeting(row: any): Meeting {
    return {
      id: row.id,
      provider: row.provider,
      provider_meeting_id: row.provider_meeting_id,
      session_id: row.session_id,
      instructor_id: row.instructor_id,
      title: row.title,
      description: row.description,
      start_time: row.start_time,
      duration_minutes: row.duration_minutes,
      timezone: row.timezone,
      join_url: row.join_url,
      start_url: row.start_url,
      password: row.password,
      status: row.status,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
