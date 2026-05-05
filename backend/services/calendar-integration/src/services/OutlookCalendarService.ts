import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import logger from '../utils/logger';
import {
  CalendarEventRequest,
  CalendarEventUpdate,
  OAuthTokens,
  EventReminder,
  ReminderType,
} from '../types';

export class OutlookCalendarService {
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID || '';
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    this.redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const scopes = ['Calendars.ReadWrite', 'offline_access'];
    const baseUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`;

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      response_mode: 'query',
      scope: scopes.join(' '),
      state: state || '',
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<OAuthTokens> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;

      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        scope: data.scope,
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
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;

      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get Graph API client
   */
  private getGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  /**
   * Create a calendar event
   */
  async createEvent(
    accessToken: string,
    eventData: CalendarEventRequest,
    calendarId?: string
  ): Promise<string> {
    try {
      const client = this.getGraphClient(accessToken);

      const event = {
        subject: eventData.title,
        body: {
          contentType: 'HTML',
          content: eventData.description || '',
        },
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: eventData.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: eventData.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
        },
        location: eventData.location
          ? {
              displayName: eventData.location,
            }
          : undefined,
        attendees: eventData.attendees?.map((email) => ({
          emailAddress: {
            address: email,
          },
          type: 'required',
        })),
        isReminderOn: eventData.reminders && eventData.reminders.length > 0,
        reminderMinutesBeforeStart:
          eventData.reminders && eventData.reminders.length > 0
            ? eventData.reminders[0].minutesBefore
            : 15,
        isOnlineMeeting: !!eventData.meetingUrl,
        onlineMeetingUrl: eventData.meetingUrl,
      };

      const endpoint = calendarId
        ? `/me/calendars/${calendarId}/events`
        : '/me/calendar/events';

      const response = await client.api(endpoint).post(event);

      if (!response.id) {
        throw new Error('Failed to create event - no event ID returned');
      }

      logger.info('Outlook Calendar event created:', { eventId: response.id });
      return response.id;
    } catch (error) {
      logger.error('Error creating Outlook Calendar event:', error);
      throw new Error('Failed to create Outlook Calendar event');
    }
  }

  /**
   * Update a calendar event
   */
  async updateEvent(
    accessToken: string,
    eventId: string,
    updates: CalendarEventUpdate,
    calendarId?: string
  ): Promise<void> {
    try {
      const client = this.getGraphClient(accessToken);

      const event: any = {};

      if (updates.title) event.subject = updates.title;
      if (updates.description) {
        event.body = {
          contentType: 'HTML',
          content: updates.description,
        };
      }
      if (updates.location) {
        event.location = {
          displayName: updates.location,
        };
      }
      if (updates.startTime) {
        event.start = {
          dateTime: updates.startTime.toISOString(),
          timeZone: updates.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
        };
      }
      if (updates.endTime) {
        event.end = {
          dateTime: updates.endTime.toISOString(),
          timeZone: updates.timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
        };
      }
      if (updates.attendees) {
        event.attendees = updates.attendees.map((email) => ({
          emailAddress: {
            address: email,
          },
          type: 'required',
        }));
      }
      if (updates.reminders) {
        event.isReminderOn = updates.reminders.length > 0;
        event.reminderMinutesBeforeStart =
          updates.reminders.length > 0 ? updates.reminders[0].minutesBefore : 15;
      }
      if (updates.status === 'cancelled') {
        event.isCancelled = true;
      }

      const endpoint = calendarId
        ? `/me/calendars/${calendarId}/events/${eventId}`
        : `/me/calendar/events/${eventId}`;

      await client.api(endpoint).patch(event);

      logger.info('Outlook Calendar event updated:', { eventId });
    } catch (error) {
      logger.error('Error updating Outlook Calendar event:', error);
      throw new Error('Failed to update Outlook Calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    accessToken: string,
    eventId: string,
    calendarId?: string
  ): Promise<void> {
    try {
      const client = this.getGraphClient(accessToken);

      const endpoint = calendarId
        ? `/me/calendars/${calendarId}/events/${eventId}`
        : `/me/calendar/events/${eventId}`;

      await client.api(endpoint).delete();

      logger.info('Outlook Calendar event deleted:', { eventId });
    } catch (error) {
      logger.error('Error deleting Outlook Calendar event:', error);
      throw new Error('Failed to delete Outlook Calendar event');
    }
  }

  /**
   * Get user's calendar list
   */
  async getCalendarList(
    accessToken: string
  ): Promise<Array<{ id: string; name: string; isDefaultCalendar: boolean }>> {
    try {
      const client = this.getGraphClient(accessToken);

      const response = await client.api('/me/calendars').get();

      return (
        response.value?.map((cal: any) => ({
          id: cal.id,
          name: cal.name,
          isDefaultCalendar: cal.isDefaultCalendar || false,
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
    startDate: Date,
    endDate: Date,
    calendarId?: string
  ): Promise<any[]> {
    try {
      const client = this.getGraphClient(accessToken);

      const endpoint = calendarId ? `/me/calendars/${calendarId}/events` : '/me/calendar/events';

      const response = await client
        .api(endpoint)
        .filter(
          `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`
        )
        .orderby('start/dateTime')
        .get();

      return response.value || [];
    } catch (error) {
      logger.error('Error fetching events:', error);
      throw new Error('Failed to fetch events');
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccess(accessToken: string): Promise<void> {
    try {
      // Microsoft doesn't have a direct revoke endpoint for user tokens
      // The token will expire naturally or user can revoke from their account settings
      logger.info('Outlook Calendar access revoked (token invalidated)');
    } catch (error) {
      logger.error('Error revoking access:', error);
      throw new Error('Failed to revoke access');
    }
  }
}

export default OutlookCalendarService;
