import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import {
  ZoomMeetingRequest,
  ZoomMeetingResponse,
  MeetingSettings,
} from '../types';

export default class ZoomService {
  private axiosInstance: AxiosInstance;
  private accountId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.accountId = process.env.ZOOM_ACCOUNT_ID || '';
    this.clientId = process.env.ZOOM_CLIENT_ID || '';
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET || '';

    this.axiosInstance = axios.create({
      baseURL: 'https://api.zoom.us/v2',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include access token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await this.getAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get OAuth access token using Server-to-Server OAuth
   */
  private async getAccessToken(): Promise<string> {
    try {
      // Return cached token if still valid
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      logger.info('Fetching new Zoom access token');

      const response = await axios.post(
        'https://zoom.us/oauth/token',
        null,
        {
          params: {
            grant_type: 'account_credentials',
            account_id: this.accountId,
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      logger.info('Zoom access token obtained successfully');
      return this.accessToken;
    } catch (error: any) {
      logger.error('Failed to get Zoom access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Zoom API');
    }
  }

  /**
   * Create a Zoom meeting
   */
  async createMeeting(
    userId: string,
    title: string,
    startTime: Date,
    durationMinutes: number,
    timezone: string,
    settings: MeetingSettings,
    agenda?: string
  ): Promise<ZoomMeetingResponse> {
    try {
      const meetingData: ZoomMeetingRequest = {
        topic: title,
        type: 2, // Scheduled meeting
        start_time: startTime.toISOString(),
        duration: durationMinutes,
        timezone: timezone,
        agenda: agenda,
        settings: {
          host_video: settings.host_video,
          participant_video: settings.participant_video,
          join_before_host: false,
          mute_upon_entry: settings.mute_upon_entry,
          watermark: true,
          use_pmi: false,
          approval_type: 0, // Automatically approve
          audio: 'both',
          auto_recording: settings.auto_recording ? 'cloud' : 'none',
          waiting_room: settings.waiting_room,
        },
      };

      logger.info('Creating Zoom meeting', { userId, title });

      const response = await this.axiosInstance.post(
        `/users/me/meetings`,
        meetingData
      );

      logger.info('Zoom meeting created successfully', { meetingId: response.data.id });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to create Zoom meeting');
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<ZoomMeetingResponse> {
    try {
      const response = await this.axiosInstance.get(`/meetings/${meetingId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to retrieve Zoom meeting');
    }
  }

  /**
   * Update a Zoom meeting
   */
  async updateMeeting(
    meetingId: string,
    updates: Partial<ZoomMeetingRequest>
  ): Promise<void> {
    try {
      await this.axiosInstance.patch(`/meetings/${meetingId}`, updates);
      logger.info('Zoom meeting updated successfully', { meetingId });
    } catch (error: any) {
      logger.error('Failed to update Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to update Zoom meeting');
    }
  }

  /**
   * Delete a Zoom meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/meetings/${meetingId}`);
      logger.info('Zoom meeting deleted successfully', { meetingId });
    } catch (error: any) {
      logger.error('Failed to delete Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to delete Zoom meeting');
    }
  }

  /**
   * Get meeting recordings
   */
  async getMeetingRecordings(meetingId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/meetings/${meetingId}/recordings`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.info('No recordings found for meeting', { meetingId });
        return null;
      }
      logger.error('Failed to get Zoom recordings:', error.response?.data || error.message);
      throw new Error('Failed to retrieve Zoom recordings');
    }
  }

  /**
   * Get meeting participants (for attendance tracking)
   */
  async getMeetingParticipants(meetingId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/past_meetings/${meetingId}/participants`,
        {
          params: {
            page_size: 300,
          },
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get Zoom participants:', error.response?.data || error.message);
      throw new Error('Failed to retrieve Zoom participants');
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    try {
      const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '';
      const message = `v0:${timestamp}:${payload}`;
      const hashForVerify = `v0=${require('crypto')
        .createHmac('sha256', secretToken)
        .update(message)
        .digest('hex')}`;

      return hashForVerify === signature;
    } catch (error) {
      logger.error('Failed to verify Zoom webhook signature:', error);
      return false;
    }
  }

  /**
   * Download recording file
   */
  async downloadRecording(downloadUrl: string): Promise<Buffer> {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error('Failed to download Zoom recording:', error.message);
      throw new Error('Failed to download Zoom recording');
    }
  }
}
