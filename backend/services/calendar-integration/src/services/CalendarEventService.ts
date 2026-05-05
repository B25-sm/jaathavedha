import { query } from '../database';
import logger from '../utils/logger';
import {
  CalendarEvent,
  CalendarEventRequest,
  CalendarEventUpdate,
  CalendarProvider,
  EventStatus,
  CalendarStats,
} from '../types';

export class CalendarEventService {
  /**
   * Create a calendar event record
   */
  async createEvent(
    userId: string,
    provider: CalendarProvider,
    providerEventId: string,
    eventData: CalendarEventRequest,
    sessionId?: string,
    enrollmentId?: string
  ): Promise<CalendarEvent> {
    try {
      const result = await query(
        `INSERT INTO calendar_events 
        (user_id, session_id, enrollment_id, provider, provider_event_id, title, description, 
         location, start_time, end_time, timezone, meeting_url, attendees, reminders, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          userId,
          sessionId,
          enrollmentId,
          provider,
          providerEventId,
          eventData.title,
          eventData.description,
          eventData.location,
          eventData.startTime,
          eventData.endTime,
          eventData.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
          eventData.meetingUrl,
          eventData.attendees,
          JSON.stringify(eventData.reminders),
          JSON.stringify({ sessionId, enrollmentId }),
        ]
      );

      logger.info('Calendar event record created:', {
        userId,
        provider,
        eventId: result.rows[0].id,
      });

      return this.mapToEvent(result.rows[0]);
    } catch (error) {
      logger.error('Error creating calendar event record:', error);
      throw new Error('Failed to create calendar event record');
    }
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: string): Promise<CalendarEvent | null> {
    try {
      const result = await query(`SELECT * FROM calendar_events WHERE id = $1`, [eventId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapToEvent(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching event:', error);
      throw new Error('Failed to fetch event');
    }
  }

  /**
   * Get events by user
   */
  async getUserEvents(
    userId: string,
    provider?: CalendarProvider,
    status?: EventStatus
  ): Promise<CalendarEvent[]> {
    try {
      let queryText = `SELECT * FROM calendar_events WHERE user_id = $1`;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (provider) {
        queryText += ` AND provider = $${paramIndex++}`;
        params.push(provider);
      }

      if (status) {
        queryText += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      queryText += ` ORDER BY start_time DESC`;

      const result = await query(queryText, params);

      return result.rows.map((row) => this.mapToEvent(row));
    } catch (error) {
      logger.error('Error fetching user events:', error);
      throw new Error('Failed to fetch user events');
    }
  }

  /**
   * Get events by session
   */
  async getEventsBySession(sessionId: string): Promise<CalendarEvent[]> {
    try {
      const result = await query(
        `SELECT * FROM calendar_events WHERE session_id = $1 ORDER BY created_at DESC`,
        [sessionId]
      );

      return result.rows.map((row) => this.mapToEvent(row));
    } catch (error) {
      logger.error('Error fetching session events:', error);
      throw new Error('Failed to fetch session events');
    }
  }

  /**
   * Get events by enrollment
   */
  async getEventsByEnrollment(enrollmentId: string): Promise<CalendarEvent[]> {
    try {
      const result = await query(
        `SELECT * FROM calendar_events WHERE enrollment_id = $1 ORDER BY start_time ASC`,
        [enrollmentId]
      );

      return result.rows.map((row) => this.mapToEvent(row));
    } catch (error) {
      logger.error('Error fetching enrollment events:', error);
      throw new Error('Failed to fetch enrollment events');
    }
  }

  /**
   * Get upcoming events for user
   */
  async getUpcomingEvents(
    userId: string,
    limit: number = 10
  ): Promise<CalendarEvent[]> {
    try {
      const result = await query(
        `SELECT * FROM calendar_events 
        WHERE user_id = $1 AND start_time > NOW() AND status = 'scheduled'
        ORDER BY start_time ASC
        LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map((row) => this.mapToEvent(row));
    } catch (error) {
      logger.error('Error fetching upcoming events:', error);
      throw new Error('Failed to fetch upcoming events');
    }
  }

  /**
   * Update event
   */
  async updateEvent(eventId: string, updates: CalendarEventUpdate): Promise<void> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.title) {
        updateFields.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.location !== undefined) {
        updateFields.push(`location = $${paramIndex++}`);
        values.push(updates.location);
      }
      if (updates.startTime) {
        updateFields.push(`start_time = $${paramIndex++}`);
        values.push(updates.startTime);
      }
      if (updates.endTime) {
        updateFields.push(`end_time = $${paramIndex++}`);
        values.push(updates.endTime);
      }
      if (updates.timezone) {
        updateFields.push(`timezone = $${paramIndex++}`);
        values.push(updates.timezone);
      }
      if (updates.meetingUrl !== undefined) {
        updateFields.push(`meeting_url = $${paramIndex++}`);
        values.push(updates.meetingUrl);
      }
      if (updates.attendees) {
        updateFields.push(`attendees = $${paramIndex++}`);
        values.push(updates.attendees);
      }
      if (updates.reminders) {
        updateFields.push(`reminders = $${paramIndex++}`);
        values.push(JSON.stringify(updates.reminders));
      }
      if (updates.status) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (updateFields.length === 0) {
        return;
      }

      values.push(eventId);

      await query(
        `UPDATE calendar_events 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}`,
        values
      );

      logger.info('Calendar event updated:', { eventId });
    } catch (error) {
      logger.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Update event status
   */
  async updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
    try {
      await query(
        `UPDATE calendar_events 
        SET status = $1, updated_at = NOW()
        WHERE id = $2`,
        [status, eventId]
      );

      logger.info('Calendar event status updated:', { eventId, status });
    } catch (error) {
      logger.error('Error updating event status:', error);
      throw new Error('Failed to update event status');
    }
  }

  /**
   * Delete event
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await query(`DELETE FROM calendar_events WHERE id = $1`, [eventId]);

      logger.info('Calendar event deleted:', { eventId });
    } catch (error) {
      logger.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Delete events by session
   */
  async deleteEventsBySession(sessionId: string): Promise<void> {
    try {
      await query(`DELETE FROM calendar_events WHERE session_id = $1`, [sessionId]);

      logger.info('Calendar events deleted for session:', { sessionId });
    } catch (error) {
      logger.error('Error deleting session events:', error);
      throw new Error('Failed to delete session events');
    }
  }

  /**
   * Get calendar statistics for user
   */
  async getCalendarStats(userId: string): Promise<CalendarStats> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE start_time > NOW() AND status = 'scheduled') as upcoming_events,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_events,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_events,
          MAX(updated_at) as last_sync_at
        FROM calendar_events
        WHERE user_id = $1`,
        [userId]
      );

      const row = result.rows[0];

      return {
        totalEvents: parseInt(row.total_events) || 0,
        upcomingEvents: parseInt(row.upcoming_events) || 0,
        completedEvents: parseInt(row.completed_events) || 0,
        cancelledEvents: parseInt(row.cancelled_events) || 0,
        lastSyncAt: row.last_sync_at,
      };
    } catch (error) {
      logger.error('Error fetching calendar stats:', error);
      throw new Error('Failed to fetch calendar stats');
    }
  }

  /**
   * Mark past events as completed
   */
  async markPastEventsCompleted(): Promise<number> {
    try {
      const result = await query(
        `UPDATE calendar_events 
        SET status = 'completed', updated_at = NOW()
        WHERE end_time < NOW() AND status = 'scheduled'
        RETURNING id`
      );

      const count = result.rowCount || 0;
      logger.info(`Marked ${count} past events as completed`);

      return count;
    } catch (error) {
      logger.error('Error marking past events completed:', error);
      throw new Error('Failed to mark past events completed');
    }
  }

  /**
   * Map database row to CalendarEvent
   */
  private mapToEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id,
      enrollmentId: row.enrollment_id,
      provider: row.provider,
      providerEventId: row.provider_event_id,
      title: row.title,
      description: row.description,
      location: row.location,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      status: row.status,
      meetingUrl: row.meeting_url,
      attendees: row.attendees,
      reminders: row.reminders ? JSON.parse(row.reminders) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default CalendarEventService;
