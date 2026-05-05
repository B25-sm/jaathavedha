import express, { Request, Response } from 'express';
import ZoomService from '../services/ZoomService';
import MeetingService from '../services/MeetingService';
import RecordingService from '../services/RecordingService';
import AttendanceService from '../services/AttendanceService';
import logger from '../utils/logger';
import { ZoomWebhookEvent, MeetingStatus } from '../types';

const router = express.Router();
const zoomService = new ZoomService();
const meetingService = new MeetingService();
const recordingService = new RecordingService();
const attendanceService = new AttendanceService();

/**
 * Zoom webhook endpoint
 * POST /api/video-conferencing/webhooks/zoom
 */
router.post('/zoom', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-zm-signature'] as string;
    const timestamp = req.headers['x-zm-request-timestamp'] as string;
    const payload = JSON.stringify(req.body);

    if (!zoomService.verifyWebhookSignature(payload, signature, timestamp)) {
      logger.warn('Invalid Zoom webhook signature');
      res.status(401).json({
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature',
        },
      });
      return;
    }

    const event: ZoomWebhookEvent = req.body;

    logger.info('Received Zoom webhook event', { event: event.event });

    // Handle different event types
    switch (event.event) {
      case 'meeting.started':
        await handleMeetingStarted(event);
        break;

      case 'meeting.ended':
        await handleMeetingEnded(event);
        break;

      case 'meeting.participant_joined':
        await handleParticipantJoined(event);
        break;

      case 'meeting.participant_left':
        await handleParticipantLeft(event);
        break;

      case 'recording.completed':
        await handleRecordingCompleted(event);
        break;

      default:
        logger.info('Unhandled Zoom webhook event', { event: event.event });
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('Failed to process Zoom webhook:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'WEBHOOK_PROCESSING_FAILED',
        message: 'Failed to process webhook',
      },
    });
  }
});

/**
 * Handle meeting started event
 */
async function handleMeetingStarted(event: ZoomWebhookEvent): Promise<void> {
  try {
    const providerMeetingId = event.payload.object.id.toString();

    // Find meeting in database
    const meetings = await meetingService.getMeetingsByInstructor(''); // Need to query by provider_meeting_id
    const meeting = meetings.find(
      (m) => m.provider_meeting_id === providerMeetingId
    );

    if (meeting) {
      await meetingService.updateMeetingStatus(
        meeting.id,
        MeetingStatus.IN_PROGRESS
      );
      logger.info('Meeting status updated to IN_PROGRESS', {
        meetingId: meeting.id,
      });
    }
  } catch (error) {
    logger.error('Failed to handle meeting started event:', error);
  }
}

/**
 * Handle meeting ended event
 */
async function handleMeetingEnded(event: ZoomWebhookEvent): Promise<void> {
  try {
    const providerMeetingId = event.payload.object.id.toString();

    // Find meeting in database
    const meetings = await meetingService.getMeetingsByInstructor('');
    const meeting = meetings.find(
      (m) => m.provider_meeting_id === providerMeetingId
    );

    if (meeting) {
      await meetingService.updateMeetingStatus(
        meeting.id,
        MeetingStatus.COMPLETED
      );

      // Fetch and process attendance data
      try {
        const participants = await zoomService.getMeetingParticipants(
          providerMeetingId
        );
        if (participants && participants.participants) {
          await attendanceService.processZoomAttendance(
            meeting.id,
            participants.participants
          );

          // Calculate attendance status
          await attendanceService.calculateAttendanceStatus(
            meeting.id,
            meeting.duration_minutes
          );
        }
      } catch (error) {
        logger.error('Failed to process attendance for ended meeting:', error);
      }

      logger.info('Meeting status updated to COMPLETED', {
        meetingId: meeting.id,
      });
    }
  } catch (error) {
    logger.error('Failed to handle meeting ended event:', error);
  }
}

/**
 * Handle participant joined event
 */
async function handleParticipantJoined(event: ZoomWebhookEvent): Promise<void> {
  try {
    const providerMeetingId = event.payload.object.id.toString();
    const participant = event.payload.object.participant;

    if (!participant) return;

    // Find meeting in database
    const meetings = await meetingService.getMeetingsByInstructor('');
    const meeting = meetings.find(
      (m) => m.provider_meeting_id === providerMeetingId
    );

    if (meeting) {
      const userId = participant.user_id || participant.id;
      const joinTime = new Date(participant.join_time);

      await attendanceService.recordJoin(meeting.id, userId, joinTime);

      logger.info('Participant join recorded', {
        meetingId: meeting.id,
        userId,
      });
    }
  } catch (error) {
    logger.error('Failed to handle participant joined event:', error);
  }
}

/**
 * Handle participant left event
 */
async function handleParticipantLeft(event: ZoomWebhookEvent): Promise<void> {
  try {
    const providerMeetingId = event.payload.object.id.toString();
    const participant = event.payload.object.participant;

    if (!participant || !participant.leave_time) return;

    // Find meeting in database
    const meetings = await meetingService.getMeetingsByInstructor('');
    const meeting = meetings.find(
      (m) => m.provider_meeting_id === providerMeetingId
    );

    if (meeting) {
      const userId = participant.user_id || participant.id;
      const leaveTime = new Date(participant.leave_time);

      await attendanceService.recordLeave(meeting.id, userId, leaveTime);

      logger.info('Participant leave recorded', {
        meetingId: meeting.id,
        userId,
      });
    }
  } catch (error) {
    logger.error('Failed to handle participant left event:', error);
  }
}

/**
 * Handle recording completed event
 */
async function handleRecordingCompleted(
  event: ZoomWebhookEvent
): Promise<void> {
  try {
    const providerMeetingId = event.payload.object.id.toString();
    const recordingFiles = event.payload.object.recording_files;

    if (!recordingFiles || recordingFiles.length === 0) return;

    // Find meeting in database
    const meetings = await meetingService.getMeetingsByInstructor('');
    const meeting = meetings.find(
      (m) => m.provider_meeting_id === providerMeetingId
    );

    if (meeting) {
      await recordingService.processZoomRecording(
        meeting.id,
        providerMeetingId,
        recordingFiles
      );

      logger.info('Recording processing initiated', {
        meetingId: meeting.id,
        fileCount: recordingFiles.length,
      });
    }
  } catch (error) {
    logger.error('Failed to handle recording completed event:', error);
  }
}

export default router;
