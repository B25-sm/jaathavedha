import express, { Request, Response } from 'express';
import MeetingService from '../services/MeetingService';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import {
  validateRequest,
  createMeetingSchema,
  updateMeetingSchema,
} from '../middleware/validation';
import logger from '../utils/logger';
import { CreateMeetingRequest, MeetingStatus } from '../types';

const router = express.Router();
const meetingService = new MeetingService();

/**
 * Create a new meeting
 * POST /api/video-conferencing/meetings
 */
router.post(
  '/',
  authenticate,
  authorize('instructor', 'admin'),
  validateRequest(createMeetingSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const meetingRequest: CreateMeetingRequest = {
        ...req.body,
        start_time: new Date(req.body.start_time),
      };

      const meeting = await meetingService.createMeeting(meetingRequest);

      res.status(201).json({
        success: true,
        data: meeting,
      });
    } catch (error: any) {
      logger.error('Failed to create meeting:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'MEETING_CREATION_FAILED',
          message: error.message || 'Failed to create meeting',
        },
      });
    }
  }
);

/**
 * Get meeting by ID
 * GET /api/video-conferencing/meetings/:id
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const meeting = await meetingService.getMeetingById(req.params.id);

      if (!meeting) {
        res.status(404).json({
          error: {
            type: 'NOT_FOUND',
            code: 'MEETING_NOT_FOUND',
            message: 'Meeting not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: meeting,
      });
    } catch (error: any) {
      logger.error('Failed to get meeting:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'MEETING_RETRIEVAL_FAILED',
          message: 'Failed to retrieve meeting',
        },
      });
    }
  }
);

/**
 * Get meetings by session ID
 * GET /api/video-conferencing/meetings/session/:sessionId
 */
router.get(
  '/session/:sessionId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const meetings = await meetingService.getMeetingsBySession(
        req.params.sessionId
      );

      res.json({
        success: true,
        data: meetings,
        count: meetings.length,
      });
    } catch (error: any) {
      logger.error('Failed to get meetings by session:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'MEETINGS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve meetings',
        },
      });
    }
  }
);

/**
 * Get meetings by instructor ID
 * GET /api/video-conferencing/meetings/instructor/:instructorId
 */
router.get(
  '/instructor/:instructorId',
  authenticate,
  authorize('instructor', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const meetings = await meetingService.getMeetingsByInstructor(
        req.params.instructorId
      );

      res.json({
        success: true,
        data: meetings,
        count: meetings.length,
      });
    } catch (error: any) {
      logger.error('Failed to get meetings by instructor:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'MEETINGS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve meetings',
        },
      });
    }
  }
);

/**
 * Get upcoming meetings
 * GET /api/video-conferencing/meetings/upcoming
 */
router.get(
  '/upcoming/list',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const meetings = await meetingService.getUpcomingMeetings(limit);

      res.json({
        success: true,
        data: meetings,
        count: meetings.length,
      });
    } catch (error: any) {
      logger.error('Failed to get upcoming meetings:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'MEETINGS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve upcoming meetings',
        },
      });
    }
  }
);

/**
 * Update meeting status
 * PATCH /api/video-conferencing/meetings/:id/status
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize('instructor', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;

      if (!Object.values(MeetingStatus).includes(status)) {
        res.status(400).json({
          error: {
            type: 'VALIDATION_ERROR',
            code: 'INVALID_STATUS',
            message: 'Invalid meeting status',
          },
        });
        return;
      }

      await meetingService.updateMeetingStatus(req.params.id, status);

      res.json({
        success: true,
        message: 'Meeting status updated successfully',
      });
    } catch (error: any) {
      logger.error('Failed to update meeting status:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'STATUS_UPDATE_FAILED',
          message: 'Failed to update meeting status',
        },
      });
    }
  }
);

/**
 * Delete meeting
 * DELETE /api/video-conferencing/meetings/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorize('instructor', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      await meetingService.deleteMeeting(req.params.id);

      res.json({
        success: true,
        message: 'Meeting deleted successfully',
      });
    } catch (error: any) {
      logger.error('Failed to delete meeting:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'MEETING_DELETION_FAILED',
          message: error.message || 'Failed to delete meeting',
        },
      });
    }
  }
);

export default router;
