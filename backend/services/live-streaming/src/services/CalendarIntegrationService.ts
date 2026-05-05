import { SessionManagementService } from './SessionManagementService';
import { CalendarProvider, LiveSession } from '../types';

interface GoogleCalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  reminders: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

interface OutlookCalendarEvent {
  subject: string;
  body: { contentType: string; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  reminderMinutesBeforeStart: number;
}

export class CalendarIntegrationService {
  private sessionManagement: SessionManagementService;

  constructor() {
    this.sessionManagement = new SessionManagementService();
  }

  // ==================== GOOGLE CALENDAR ====================

  async addToGoogleCalendar(
    sessionId: string,
    userId: string,
    accessToken: string
  ): Promise<string> {
    const session = await this.sessionManagement.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const event = this.createGoogleCalendarEvent(session);

    try {
      // In a real implementation, this would call the Google Calendar API
      // For now, we'll simulate the response
      const eventId = `google_${Date.now()}`;

      // Create calendar reminder record
      await this.sessionManagement.createCalendarReminder({
        sessionId,
        userId,
        calendarProvider: CalendarProvider.GOOGLE,
        calendarEventId: eventId,
        reminderMinutesBefore: [15, 60, 1440]
      });

      // Sync the reminder
      await this.sessionManagement.syncCalendarReminder(eventId, eventId);

      return eventId;
    } catch (error) {
      console.error('Error adding to Google Calendar:', error);
      throw new Error('Failed to add event to Google Calendar');
    }
  }

  private createGoogleCalendarEvent(session: LiveSession): GoogleCalendarEvent {
    return {
      summary: session.title,
      description: this.formatSessionDescription(session),
      start: {
        dateTime: new Date(session.scheduledStart).toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: new Date(session.scheduledEnd).toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 }, // 24 hours
          { method: 'popup', minutes: 60 },   // 1 hour
          { method: 'popup', minutes: 15 }    // 15 minutes
        ]
      }
    };
  }

  async updateGoogleCalendarEvent(
    eventId: string,
    session: LiveSession,
    accessToken: string
  ): Promise<void> {
    const event = this.createGoogleCalendarEvent(session);

    try {
      // In a real implementation, this would call the Google Calendar API
      console.log(`Updating Google Calendar event ${eventId}`);
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw new Error('Failed to update Google Calendar event');
    }
  }

  async deleteGoogleCalendarEvent(
    eventId: string,
    accessToken: string
  ): Promise<void> {
    try {
      // In a real implementation, this would call the Google Calendar API
      console.log(`Deleting Google Calendar event ${eventId}`);
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw new Error('Failed to delete Google Calendar event');
    }
  }

  // ==================== OUTLOOK CALENDAR ====================

  async addToOutlookCalendar(
    sessionId: string,
    userId: string,
    accessToken: string
  ): Promise<string> {
    const session = await this.sessionManagement.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const event = this.createOutlookCalendarEvent(session);

    try {
      // In a real implementation, this would call the Microsoft Graph API
      const eventId = `outlook_${Date.now()}`;

      // Create calendar reminder record
      await this.sessionManagement.createCalendarReminder({
        sessionId,
        userId,
        calendarProvider: CalendarProvider.OUTLOOK,
        calendarEventId: eventId,
        reminderMinutesBefore: [15, 60, 1440]
      });

      // Sync the reminder
      await this.sessionManagement.syncCalendarReminder(eventId, eventId);

      return eventId;
    } catch (error) {
      console.error('Error adding to Outlook Calendar:', error);
      throw new Error('Failed to add event to Outlook Calendar');
    }
  }

  private createOutlookCalendarEvent(session: LiveSession): OutlookCalendarEvent {
    return {
      subject: session.title,
      body: {
        contentType: 'HTML',
        content: this.formatSessionDescription(session)
      },
      start: {
        dateTime: new Date(session.scheduledStart).toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: new Date(session.scheduledEnd).toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      reminderMinutesBeforeStart: 60
    };
  }

  async updateOutlookCalendarEvent(
    eventId: string,
    session: LiveSession,
    accessToken: string
  ): Promise<void> {
    const event = this.createOutlookCalendarEvent(session);

    try {
      // In a real implementation, this would call the Microsoft Graph API
      console.log(`Updating Outlook Calendar event ${eventId}`);
    } catch (error) {
      console.error('Error updating Outlook Calendar event:', error);
      throw new Error('Failed to update Outlook Calendar event');
    }
  }

  async deleteOutlookCalendarEvent(
    eventId: string,
    accessToken: string
  ): Promise<void> {
    try {
      // In a real implementation, this would call the Microsoft Graph API
      console.log(`Deleting Outlook Calendar event ${eventId}`);
    } catch (error) {
      console.error('Error deleting Outlook Calendar event:', error);
      throw new Error('Failed to delete Outlook Calendar event');
    }
  }

  // ==================== APPLE CALENDAR ====================

  async generateICalFile(sessionId: string): Promise<string> {
    const session = await this.sessionManagement.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const ical = this.createICalEvent(session);
    return ical;
  }

  private createICalEvent(session: LiveSession): string {
    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const start = formatDate(new Date(session.scheduledStart));
    const end = formatDate(new Date(session.scheduledEnd));
    const created = formatDate(new Date());

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sai Mahendra Platform//Live Session//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:session-${session.id}@saimahendra.com
DTSTAMP:${created}
DTSTART:${start}
DTEND:${end}
SUMMARY:${session.title}
DESCRIPTION:${this.formatSessionDescription(session).replace(/\n/g, '\\n')}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT24H
ACTION:DISPLAY
DESCRIPTION:Session reminder - 24 hours
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Session reminder - 1 hour
END:VALARM
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Session reminder - 15 minutes
END:VALARM
END:VEVENT
END:VCALENDAR`;
  }

  // ==================== HELPER METHODS ====================

  private formatSessionDescription(session: LiveSession): string {
    let description = session.description || '';
    
    description += `\n\nSession Details:\n`;
    description += `- Start: ${new Date(session.scheduledStart).toLocaleString()}\n`;
    description += `- End: ${new Date(session.scheduledEnd).toLocaleString()}\n`;
    description += `- Duration: ${this.calculateDuration(session.scheduledStart, session.scheduledEnd)}\n`;
    
    if (session.maxParticipants) {
      description += `- Max Participants: ${session.maxParticipants}\n`;
    }

    description += `\n\nJoin the session through the Sai Mahendra Platform.`;

    return description;
  }

  private calculateDuration(start: Date, end: Date): string {
    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // ==================== BULK OPERATIONS ====================

  async syncSessionToCalendars(
    sessionId: string,
    userIds: string[],
    provider: CalendarProvider
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const userId of userIds) {
      try {
        // In a real implementation, you would fetch the user's access token
        const accessToken = 'dummy_token';

        switch (provider) {
          case CalendarProvider.GOOGLE:
            await this.addToGoogleCalendar(sessionId, userId, accessToken);
            break;
          case CalendarProvider.OUTLOOK:
            await this.addToOutlookCalendar(sessionId, userId, accessToken);
            break;
          default:
            throw new Error(`Unsupported calendar provider: ${provider}`);
        }

        success.push(userId);
      } catch (error) {
        console.error(`Failed to sync calendar for user ${userId}:`, error);
        failed.push(userId);
      }
    }

    return { success, failed };
  }

  async removeSessionFromCalendars(sessionId: string): Promise<void> {
    const reminders = await this.sessionManagement.getCalendarReminders(sessionId);

    for (const reminder of reminders) {
      if (!reminder.calendarEventId || !reminder.isSynced) {
        continue;
      }

      try {
        // In a real implementation, you would fetch the user's access token
        const accessToken = 'dummy_token';

        switch (reminder.calendarProvider) {
          case CalendarProvider.GOOGLE:
            await this.deleteGoogleCalendarEvent(reminder.calendarEventId, accessToken);
            break;
          case CalendarProvider.OUTLOOK:
            await this.deleteOutlookCalendarEvent(reminder.calendarEventId, accessToken);
            break;
        }
      } catch (error) {
        console.error(`Failed to remove calendar event for reminder ${reminder.id}:`, error);
      }
    }
  }
}
