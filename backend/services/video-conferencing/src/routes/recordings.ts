import express, { Request, Response } from 'express';
import RecordingService from '../services/RecordingService';
import { authenticate, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = express.Router();
const recordingService = new RecordingService();

/**
 * Get recording by ID
 * GET /api/video-conferencing/recordings/:id
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const recording = await recordingService.getRecordingById(req.params.id);

      if (!recording) {
        res.status(404).json({
          error: {
            type: 'NOT_FOUND',
            code: 'RECORDING_NOT_FOUND',
            message: 'Recording not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: recording,
      });
    } catch (error: any) {
      logger.error('Failed to get recording:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'RECORDING_RETRIEVAL_FAILED',
          message: 'Failed to retrieve recording',
        },
      });
    }
  }
);

/**
 * Get recordings by meeting ID
 * GET /api/video-conferencing/recordings/meeting/:meetingId
 */
router.get(
  '/meeting/:meetingId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const recordings = await recordingService.getRecordingsByMeeting(
        req.params.meetingId
      );

      res.json({
        success: true,
        data: recordings,
        count: recordings.length,
      });
    } catch (error: any) {
      logger.error('Failed to get recordings by meeting:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'RECORDINGS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve recordings',
        },
      });
    }
  }
);

/**
 * Generate playback URL for recording
 * GET /api/video-conferencing/recordings/:id/playback-url
 */
router.get(
  '/:id/playback-url',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const expiresIn = parseInt(req.query.expiresIn as string) || 3600;
      const playbackUrl = await recordingService.generatePlaybackUrl(
        req.params.id,
        expiresIn
      );

      // Track the view
      if (req.user) {
        await recordingService.trackRecordingView(req.params.id, req.user.id);
      }

      res.json({
        success: true,
        data: {
          playback_url: playbackUrl,
          expires_in: expiresIn,
        },
      });
    } catch (error: any) {
      logger.error('Failed to generate playback URL:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'PLAYBACK_URL_GENERATION_FAILED',
          message: error.message || 'Failed to generate playback URL',
        },
      });
    }
  }
);

/**
 * Delete recording
 * DELETE /api/video-conferencing/recordings/:id
 */
router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      await recordingService.deleteRecording(req.params.id);

      res.json({
        success: true,
        message: 'Recording deleted successfully',
      });
    } catch (error: any) {
      logger.error('Failed to delete recording:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'RECORDING_DELETION_FAILED',
          message: error.message || 'Failed to delete recording',
        },
      });
    }
  }
);

export default router;
