import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import logger from '../utils/logger';
import { GoogleMeetRequest, GoogleMeetResponse, MeetingSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';

export default class GoogleMeetService {
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Set OAuth credentials for a user
   */
  setCredentials(accessToken: string, refreshToken?: string): void {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<any> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error: any) {
      logger.error('Failed to exchange code for tokens:', error.message);
      throw new Error('Failed to authenticate with Google');
    }
  }

  /**
   * Create a Google Meet meeting via Google Calendar
   */
  async createMeeting(
    title: string,
    startTime: Date,
    durationMinutes: number,
    timezone: string,
    description?: string,
    attendeeEmails?: string[]
  ): Promise<GoogleMeetResponse> {
    try {
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      const event: GoogleMeetRequest = {
        summary: title,
        description: description,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: timezone,
        },
        conferenceData: {
          createRequest: {
            requestId: uuidv4(),
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
        attendees: attendeeEmails?.map((email) => ({ email })),
      };

      logger.info('Creating Google Meet meeting', { title });

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: event,
        sendUpdates: 'all',
      });

      if (!response.data.hangoutLink) {
        throw new Error('Failed to create Google Meet link');
      }

      logger.info('Google Meet meeting created successfully', {
        eventId: response.data.id,
      });

      return response.data as GoogleMeetResponse;
    } catch (error: any) {
      logger.error('Failed to create Google Meet meeting:', error.message);
      throw new Error('Failed to create Google Meet meeting');
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(eventId: string): Promise<GoogleMeetResponse> {
    try {
      const response = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      return response.data as GoogleMeetResponse;
    } catch (error: any) {
      logger.error('Failed to get Google Meet meeting:', error.message);
      throw new Error('Failed to retrieve Google Meet meeting');
    }
  }

  /**
   * Update a Google Meet meeting
   */
  async updateMeeting(
    eventId: string,
    updates: Partial<GoogleMeetRequest>
  ): Promise<void> {
    try {
      await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: updates,
        sendUpdates: 'all',
      });

      logger.info('Google Meet meeting updated successfully', { eventId });
    } catch (error: any) {
      logger.error('Failed to update Google Meet meeting:', error.message);
      throw new Error('Failed to update Google Meet meeting');
    }
  }

  /**
   * Delete a Google Meet meeting
   */
  async deleteMeeting(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all',
      });

      logger.info('Google Meet meeting deleted successfully', { eventId });
    } catch (error: any) {
      logger.error('Failed to delete Google Meet meeting:', error.message);
      throw new Error('Failed to delete Google Meet meeting');
    }
  }

  /**
   * Refresh access token if expired
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      return credentials.access_token || '';
    } catch (error: any) {
      logger.error('Failed to refresh Google access token:', error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Note: Google Meet does not provide built-in recording download API
   * Recordings are stored in Google Drive and need to be accessed separately
   * This would require additional Drive API integration
   */
  async getRecordingInfo(eventId: string): Promise<any> {
    logger.warn(
      'Google Meet recordings are stored in Google Drive and require separate Drive API access'
    );
    return {
      message:
        'Google Meet recordings must be accessed through Google Drive API',
      eventId,
    };
  }
}
