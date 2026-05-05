import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import logger from '../utils/logger';
import {
  CalendarEventRequest,
  CalendarEventUpdate,
  OAuthTokens,
  EventReminder,
  ReminderType,
} from '../types';

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<OAuthTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain access or refresh token');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expiry_date
          ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
          : 3600,
        scope: tokens.scope,
      };
    } catch (error) {
      logger.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresIn: credentials.expiry_date
          ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
          : 3600,
      };
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Set credentials for API calls
   */
  private setCredentials(accessToken: string, refreshToken: string): void {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  /**
   * Get calendar API instance
   */
  private getCalendarAPI(): calendar_v3.Calendar {
    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Create a calendar event
   */
  async createEvent(
    accessToken: string,
    refreshToken: string,
    eventData: CalendarEventRequest,
    calendarId: string = 'primary'
  ): Promise<string> {
    try {
      this.setCredentials(accessToken, refreshToken);
      const calendar = this.getCalendarAPI();

      const event: calendar_v3.Schema$Event = {
        summary: eventData.title,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: eventData.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: eventData.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
        },
        attendees: eventData.attendees?.map((email) => ({ email })),
        reminders: this.formatReminders(eventData.reminders),
        conferenceData: eventData.meetingUrl
          ? {
              entryPoints: [
                {
                  entryPointType: 'video',
                  uri: eventData.meetingUrl,
                  label: 'Join Meeting',
                },
              ],
            }
          : undefined,
      };

      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        conferenceDataVersion: eventData.meetingUrl ? 1 : undefined,
      });

      if (!response.data.id) {
        throw new Error('Failed to create event - no event ID returned');
      }

      logger.info('Google Calendar event created:', { eventId: response.data.id });
      return response.data.id;
    } catch (error) {
      logger.error('Error creating Google Calendar event:', error);
      throw new Error('Failed to create Google Calendar event');
    }
  }

  /**
   * Update a calendar event
   */
  async updateEvent(
    accessToken: string,
    refreshToken: string,
    eventId: string,
    updates: CalendarEventUpdate,
    calendarId: string = 'primary'
  ): Promise<void> {
    try {
      this.setCredentials(accessToken, refreshToken);
      const calendar = this.getCalendarAPI();

      const event: calendar_v3.Schema$Event = {
        summary: updates.title,
        description: updates.description,
        location: updates.location,
        start: updates.startTime
          ? {
              dateTime: updates.startTime.toISOString(),
              timeZone: updates.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
            }
          : undefined,
        end: updates.endTime
          ? {
              dateTime: updates.endTime.toISOString(),
              timeZone: updates.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
            }
          : undefined,
        attendees: updates.attendees?.map((email) => ({ email })),
        reminders: updates.reminders ? this.formatReminders(updates.reminders) : undefined,
        status: updates.status === 'cancelled' ? 'cancelled' : 'confirmed',
      };

      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: event,
      });

      logger.info('Google Calendar event updated:', { eventId });
    } catch (error) {
      logger.error('Error updating Google Calendar event:', error);
      throw new Error('Failed to update Google Calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    accessToken: string,
    refreshToken: string,
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<void> {
    try {
      this.setCredentials(accessToken, refreshToken);
      const calendar = this.getCalendarAPI();

      await calendar.events.delete({
        calendarId,
        eventId,
      });

      logger.info('Google Calendar event deleted:', { eventId });
    } catch (error) {
      logger.error('Error deleting Google Calendar event:', error);
      throw new Error('Failed to delete Google Calendar event');
    }
  }

  /**
   * Get user's calendar list
   */
  async getCalendarList(
    accessToken: string,
    refreshToken: string
  ): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
    try {
      this.setCredentials(accessToken, refreshToken);
      const calendar = this.getCalendarAPI();

      const response = await calendar.calendarList.list();

      return (
        response.data.items?.map((cal) => ({
          id: cal.id || '',
          summary: cal.summary || '',
          primary: cal.primary || false,
        })) || []
      );
    } catch (error) {
      logger.error('Error fetching calendar list:', error);
      throw new Error('Failed to fetch calendar list');
    }
  }

  /**
   * Get events from calendar
   */
  async getEvents(
    accessToken: string,
    refreshToken: string,
    startDate: Date,
    endDate: Date,
    calendarId: string = 'primary'
  ): Promise<calendar_v3.Schema$Event[]> {
    try {
      this.setCredentials(accessToken, refreshToken);
      const calendar = this.getCalendarAPI();

      const response = await calendar.events.list({
        calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      logger.error('Error fetching events:', error);
      throw new Error('Failed to fetch events');
    }
  }

  /**
   * Format reminders for Google Calendar API
   */
  private formatReminders(
    reminders?: EventReminder[]
  ): calendar_v3.Schema$EventReminders | undefined {
    if (!reminders || reminders.length === 0) {
      return {
        useDefault: true,
      };
    }

    return {
      useDefault: false,
      overrides: reminders.map((reminder) => ({
        method: this.mapReminderType(reminder.type),
        minutes: reminder.minutesBefore,
      })),
    };
  }

  /**
   * Map reminder type to Google Calendar method
   */
  private mapReminderType(type: ReminderType): string {
    switch (type) {
      case ReminderType.EMAIL:
        return 'email';
      case ReminderType.POPUP:
      case ReminderType.NOTIFICATION:
        return 'popup';
      default:
        return 'popup';
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccess(accessToken: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(accessToken);
      logger.info('Google Calendar access revoked');
    } catch (error) {
      logger.error('Error revoking access:', error);
      throw new Error('Failed to revoke access');
    }
  }
}

export default GoogleCalendarService;
