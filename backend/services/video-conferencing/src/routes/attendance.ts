import express, { Request, Response } from 'express';
import AttendanceService from '../services/AttendanceService';
import MeetingService from '../services/MeetingService';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validateRequest, recordAttendanceSchema } from '../middleware/validation';
import logger from '../utils/logger';

const router = express.Router();
const attendanceService = new AttendanceService();
const meetingService = new MeetingService();

/**
 * Record participant join
 * POST /api/video-conferencing/attendance/join
 */
router.post(
  '/join',
  authenticate,
  validateRequest(recordAttendanceSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { meeting_id, user_id, join_time } = req.body;

      const attendance = await attendanceService.recordJoin(
        meeting_id,
        user_id,
        new Date(join_time)
      );

      res.status(201).json({
        success: true,
        data: attendance,
      });
    } catch (error: any) {
      logger.error('Failed to record join:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'ATTENDANCE_RECORDING_FAILED',
          message: 'Failed to record attendance',
        },
      });
    }
  }
);

/**
 * Record participant leave
 * POST /api/video-conferencing/attendance/leave
 */
router.post(
  '/leave',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { meeting_id, user_id, leave_time } = req.body;

      await attendanceService.recordLeave(
        meeting_id,
        user_id,
        new Date(leave_time)
      );

      res.json({
        success: true,
        message: 'Leave time recorded successfully',
      });
    } catch (error: any) {
      logger.error('Failed to record leave:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'ATTENDANCE_RECORDING_FAILED',
          message: 'Failed to record leave time',
        },
      });
    }
  }
);

/**
 * Get attendance by meeting ID
 * GET /api/video-conferencing/attendance/meeting/:meetingId
 */
router.get(
  '/meeting/:meetingId',
  authenticate,
  authorize('instructor', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const attendance = await attendanceService.getAttendanceByMeeting(
        req.params.meetingId
      );

      res.json({
        success: true,
        data: attendance,
        count: attendance.length,
      });
    } catch (error: any) {
      logger.error('Failed to get attendance:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'ATTENDANCE_RETRIEVAL_FAILED',
          message: 'Failed to retrieve attendance',
        },
      });
    }
  }
);

/**
 * Get attendance by user ID
 * GET /api/video-conferencing/attendance/user/:userId
 */
router.get(
  '/user/:userId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Users can only view their own attendance unless they're admin/instructor
      if (
        req.user?.id !== req.params.userId &&
        !['admin', 'instructor'].includes(req.user?.role || '')
      ) {
        res.status(403).json({
          error: {
            type: 'AUTHORIZATION_ERROR',
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You can only view your own attendance',
          },
        });
        return;
      }

      const attendance = await attendanceService.getAttendanceByUser(
        req.params.userId
      );

      res.json({
        success: true,
        data: attendance,
        count: attendance.length,
      });
    } catch (error: any) {
      logger.error('Failed to get attendance:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'ATTENDANCE_RETRIEVAL_FAILED',
          message: 'Failed to retrieve attendance',
        },
      });
    }
  }
);

/**
 * Generate attendance report for a meeting
 * GET /api/video-conferencing/attendance/meeting/:meetingId/report
 */
router.get(
  '/meeting/:meetingId/report',
  authenticate,
  authorize('instructor', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const meeting = await meetingService.getMeetingById(req.params.meetingId);

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

      const report = await attendanceService.generateAttendanceReport(
        req.params.meetingId,
        meeting
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Failed to generate attendance report:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'REPORT_GENERATION_FAILED',
          message: 'Failed to generate attendance report',
        },
      });
    }
  }
);

/**
 * Get user attendance statistics
 * GET /api/video-conferencing/attendance/user/:userId/stats
 */
router.get(
  '/user/:userId/stats',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Users can only view their own stats unless they're admin/instructor
      if (
        req.user?.id !== req.params.userId &&
        !['admin', 'instructor'].includes(req.user?.role || '')
      ) {
        res.status(403).json({
          error: {
            type: 'AUTHORIZATION_ERROR',
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You can only view your own statistics',
          },
        });
        return;
      }

      const stats = await attendanceService.getUserAttendanceStats(
        req.params.userId
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Failed to get attendance stats:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'STATS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve attendance statistics',
        },
      });
    }
  }
);

export default router;
