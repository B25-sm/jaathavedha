import { query } from '../database';
import logger from '../utils/logger';
import GoogleCalendarService from './GoogleCalendarService';
import OutlookCalendarService from './OutlookCalendarService';
import CalendarConnectionService from './CalendarConnectionService';
import CalendarEventService from './CalendarEventService';
import {
  CalendarProvider,
  CalendarEventRequest,
  SyncStatus,
  SyncLog,
  LiveSession,
  Enrollment,
} from '../types';

export class CalendarSyncService {
  private googleService: GoogleCalendarService;
  private outlookService: OutlookCalendarService;
  private connectionService: CalendarConnectionService;
  private eventService: CalendarEventService;

  constructor() {
    this.googleService = new GoogleCalendarService();
    this.outlookService = new OutlookCalendarService();
    this.connectionService = new CalendarConnectionService();
    this.eventService = new CalendarEventService();
  }

  /**
   * Sync all live sessions for an enrollment
   */
  async syncEnrollmentSessions(
    userId: string,
    enrollmentId: string
  ): Promise<{ success: boolean; eventsCreated: number; errors: string[] }> {
    try {
      // Get user's active calendar connections
      const connections = await this.connectionService.getUserConnections(userId);

      if (connections.length === 0) {
        return {
          success: false,
          eventsCreated: 0,
          errors: ['No active calendar connections found'],
        };
      }

      // Get enrollment details
      const enrollment = await this.getEnrollment(enrollmentId);
      if (!enrollment) {
        return {
          success: false,
          eventsCreated: 0,
          errors: ['Enrollment not found'],
        };
      }

      // Get live sessions for the program
      const sessions = await this.getLiveSessions(enrollment.programId);

      if (sessions.length === 0) {
        return {
          success: true,
          eventsCreated: 0,
          errors: [],
        };
      }

      let totalCreated = 0;
      const errors: string[] = [];

      // Create events in each connected calendar
      for (const connection of connections) {
        const syncLogId = await this.createSyncLog(userId, connection.provider);

        try {
          // Check if token needs refresh
          if (this.connectionService.isTokenExpired(connection)) {
            await this.refreshConnectionToken(userId, connection.provider);
            // Re-fetch connection with new tokens
            const updatedConnection = await this.connectionService.getConnection(
              userId,
              connection.provider
            );
            if (updatedConnection) {
              connection.accessToken = updatedConnection.accessToken;
              connection.refreshToken = updatedConnection.refreshToken;
            }
          }

          let created = 0;

          for (const session of sessions) {
            try {
              await this.createSessionEvent(
                userId,
                connection.provider,
                connection.accessToken,
                connection.refreshToken,
                session,
                enrollmentId,
                connection.calendarId
              );
              created++;
            } catch (error) {
              logger.error('Error creating session event:', error);
              errors.push(`Failed to create event for session ${session.id}`);
            }
          }

          totalCreated += created;

          await this.completeSyncLog(syncLogId, created, 0, 0);
          await this.connectionService.updateLastSync(userId, connection.provider);
        } catch (error) {
          logger.error('Error syncing with calendar:', error);
          await this.failSyncLog(syncLogId, (error as Error).message);
          errors.push(`Failed to sync with ${connection.provider}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        eventsCreated: totalCreated,
        errors,
      };
    } catch (error) {
      logger.error('Error syncing enrollment sessions:', error);
      throw new Error('Failed to sync enrollment sessions');
    }
  }

  /**
   * Create a single session event in calendar
   */
  async createSessionEvent(
    userId: string,
    provider: CalendarProvider,
    accessToken: string,
    refreshToken: string,
    session: LiveSession,
    enrollmentId?: string,
    calendarId?: string
  ): Promise<void> {
    try {
      const eventData: CalendarEventRequest = {
        sessionId: session.id,
        enrollmentId,
        title: session.title,
        description: session.description,
        startTime: session.startTime,
        endTime: session.endTime,
        timezone: session.timezone,
        meetingUrl: session.meetingUrl,
        reminders: [
          { type: 'email' as any, minutesBefore: 60 },
          { type: 'popup' as any, minutesBefore: 15 },
        ],
      };

      let providerEventId: string;

      if (provider === CalendarProvider.GOOGLE) {
        providerEventId = await this.googleService.createEvent(
          accessToken,
          refreshToken,
          eventData,
          calendarId
        );
      } else {
        providerEventId = await this.outlookService.createEvent(
          accessToken,
          eventData,
          calendarId
        );
      }

      // Store event in database
      await this.eventService.createEvent(
        userId,
        provider,
        providerEventId,
        eventData,
        session.id,
        enrollmentId
      );

      logger.info('Session event created:', { userId, provider, sessionId: session.id });
    } catch (error) {
      logger.error('Error creating session event:', error);
      throw error;
    }
  }

  /**
   * Update a session event across all calendars
   */
  async updateSessionEvent(
    sessionId: string,
    updates: {
      title?: string;
      description?: string;
      startTime?: Date;
      endTime?: Date;
      meetingUrl?: string;
    }
  ): Promise<void> {
    try {
      // Get all events for this session
      const events = await this.eventService.getEventsBySession(sessionId);

      for (const event of events) {
        const connection = await this.connectionService.getConnection(
          event.userId,
          event.provider
        );

        if (!connection) {
          logger.warn('Connection not found for event:', { eventId: event.id });
          continue;
        }

        // Check if token needs refresh
        if (this.connectionService.isTokenExpired(connection)) {
          await this.refreshConnectionToken(event.userId, event.provider);
          const updatedConnection = await this.connectionService.getConnection(
            event.userId,
            event.provider
          );
          if (updatedConnection) {
            connection.accessToken = updatedConnection.accessToken;
            connection.refreshToken = updatedConnection.refreshToken;
          }
        }

        try {
          if (event.provider === CalendarProvider.GOOGLE) {
            await this.googleService.updateEvent(
              connection.accessToken,
              connection.refreshToken,
              event.providerEventId,
              updates,
              connection.calendarId
            );
          } else {
            await this.outlookService.updateEvent(
              connection.accessToken,
              event.providerEventId,
              updates,
              connection.calendarId
            );
          }

          // Update local event record
          await this.eventService.updateEvent(event.id, updates);
        } catch (error) {
          logger.error('Error updating calendar event:', error);
        }
      }

      logger.info('Session events updated:', { sessionId });
    } catch (error) {
      logger.error('Error updating session events:', error);
      throw new Error('Failed to update session events');
    }
  }

  /**
   * Cancel a session event across all calendars
   */
  async cancelSessionEvent(sessionId: string): Promise<void> {
    try {
      const events = await this.eventService.getEventsBySession(sessionId);

      for (const event of events) {
        const connection = await this.connectionService.getConnection(
          event.userId,
          event.provider
        );

        if (!connection) {
          continue;
        }

        try {
          if (event.provider === CalendarProvider.GOOGLE) {
            await this.googleService.updateEvent(
              connection.accessToken,
              connection.refreshToken,
              event.providerEventId,
              { status: 'cancelled' as any },
              connection.calendarId
            );
          } else {
            await this.outlookService.updateEvent(
              connection.accessToken,
              event.providerEventId,
              { status: 'cancelled' as any },
              connection.calendarId
            );
          }

          await this.eventService.updateEventStatus(event.id, 'cancelled' as any);
        } catch (error) {
          logger.error('Error cancelling calendar event:', error);
        }
      }

      logger.info('Session events cancelled:', { sessionId });
    } catch (error) {
      logger.error('Error cancelling session events:', error);
      throw new Error('Failed to cancel session events');
    }
  }

  /**
   * Delete a session event from all calendars
   */
  async deleteSessionEvent(sessionId: string): Promise<void> {
    try {
      const events = await this.eventService.getEventsBySession(sessionId);

      for (const event of events) {
        const connection = await this.connectionService.getConnection(
          event.userId,
          event.provider
        );

        if (!connection) {
          continue;
        }

        try {
          if (event.provider === CalendarProvider.GOOGLE) {
            await this.googleService.deleteEvent(
              connection.accessToken,
              connection.refreshToken,
              event.providerEventId,
              connection.calendarId
            );
          } else {
            await this.outlookService.deleteEvent(
              connection.accessToken,
              event.providerEventId,
              connection.calendarId
            );
          }
        } catch (error) {
          logger.error('Error deleting calendar event:', error);
        }
      }

      // Delete local event records
      await this.eventService.deleteEventsBySession(sessionId);

      logger.info('Session events deleted:', { sessionId });
    } catch (error) {
      logger.error('Error deleting session events:', error);
      throw new Error('Failed to delete session events');
    }
  }

  /**
   * Refresh connection token
   */
  private async refreshConnectionToken(
    userId: string,
    provider: CalendarProvider
  ): Promise<void> {
    try {
      const connection = await this.connectionService.getConnection(userId, provider);

      if (!connection) {
        throw new Error('Connection not found');
      }

      let newTokens;

      if (provider === CalendarProvider.GOOGLE) {
        newTokens = await this.googleService.refreshAccessToken(connection.refreshToken);
      } else {
        newTokens = await this.outlookService.refreshAccessToken(connection.refreshToken);
      }

      await this.connectionService.updateTokens(userId, provider, newTokens);

      logger.info('Connection token refreshed:', { userId, provider });
    } catch (error) {
      logger.error('Error refreshing connection token:', error);
      throw error;
    }
  }

  /**
   * Get enrollment details
   */
  private async getEnrollment(enrollmentId: string): Promise<Enrollment | null> {
    try {
      const result = await query(
        `SELECT id, user_id, program_id, status, enrolled_at 
        FROM enrollments WHERE id = $1`,
        [enrollmentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        programId: row.program_id,
        status: row.status,
        enrolledAt: row.enrolled_at,
      };
    } catch (error) {
      logger.error('Error fetching enrollment:', error);
      throw error;
    }
  }

  /**
   * Get live sessions for a program
   */
  private async getLiveSessions(programId: string): Promise<LiveSession[]> {
    try {
      const result = await query(
        `SELECT id, course_id, instructor_id, title, description, start_time, end_time, 
        timezone, meeting_url, max_attendees, created_at
        FROM live_sessions 
        WHERE program_id = $1 AND is_active = true AND start_time > NOW()
        ORDER BY start_time ASC`,
        [programId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        instructorId: row.instructor_id,
        title: row.title,
        description: row.description,
        startTime: row.start_time,
        endTime: row.end_time,
        timezone: row.timezone,
        meetingUrl: row.meeting_url,
        maxAttendees: row.max_attendees,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error fetching live sessions:', error);
      throw error;
    }
  }

  /**
   * Create sync log
   */
  private async createSyncLog(userId: string, provider: CalendarProvider): Promise<string> {
    try {
      const result = await query(
        `INSERT INTO calendar_sync_logs (user_id, provider, status, started_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id`,
        [userId, provider, SyncStatus.IN_PROGRESS]
      );

      return result.rows[0].id;
    } catch (error) {
      logger.error('Error creating sync log:', error);
      throw error;
    }
  }

  /**
   * Complete sync log
   */
  private async completeSyncLog(
    syncLogId: string,
    created: number,
    updated: number,
    deleted: number
  ): Promise<void> {
    try {
      await query(
        `UPDATE calendar_sync_logs 
        SET status = $1, events_created = $2, events_updated = $3, events_deleted = $4, completed_at = NOW()
        WHERE id = $5`,
        [SyncStatus.COMPLETED, created, updated, deleted, syncLogId]
      );
    } catch (error) {
      logger.error('Error completing sync log:', error);
    }
  }

  /**
   * Fail sync log
   */
  private async failSyncLog(syncLogId: string, errorMessage: string): Promise<void> {
    try {
      await query(
        `UPDATE calendar_sync_logs 
        SET status = $1, error_message = $2, completed_at = NOW()
        WHERE id = $3`,
        [SyncStatus.FAILED, errorMessage, syncLogId]
      );
    } catch (error) {
      logger.error('Error failing sync log:', error);
    }
  }
}

export default CalendarSyncService;
