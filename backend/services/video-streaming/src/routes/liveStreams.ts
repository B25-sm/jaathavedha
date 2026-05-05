/**
 * Live Streaming Routes
 * API endpoints for live streaming and virtual classroom management
 */

import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { liveStreamSchema } from '../schemas/videoSchemas';
import { LiveStreamingService } from '../services/LiveStreamingService';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();
const liveStreamService = new LiveStreamingService();

/**
 * Create live stream
 * POST /api/live-streams
 */
router.post('/',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  validateRequest(liveStreamSchema),
  async (req, res, next) => {
    try {
      const liveStream = await liveStreamService.createLiveStream({
        ...req.body,
        instructor_id: req.user.id
      });

      res.status(201).json({
        success: true,
        data: liveStream
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get live streams
 * GET /api/live-streams
 */
router.get('/',
  authMiddleware,
  async (req, res, next) => {
    try {
      const filters = {
        instructor_id: req.user.role === 'instructor' ? req.user.id : req.query.instructor_id as string,
        course_id: req.query.course_id as string,
        status: req.query.status as any,
        date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
        date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10
      };

      const result = await liveStreamService.getLiveStreams(filters, pagination);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get live stream by ID
 * GET /api/live-streams/:id
 */
router.get('/:id',
  authMiddleware,
  async (req, res, next) => {
    try {
      const liveStream = await liveStreamService.getLiveStreamById(req.params.id);

      if (!liveStream) {
        return res.status(404).json({
          success: false,
          error: 'Live stream not found'
        });
      }

      res.json({
        success: true,
        data: liveStream
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Start live stream
 * POST /api/live-streams/:id/start
 */
router.post('/:id/start',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  async (req, res, next) => {
    try {
      const result = await liveStreamService.startLiveStream(req.params.id, req.user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * End live stream
 * POST /api/live-streams/:id/end
 */
router.post('/:id/end',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  async (req, res, next) => {
    try {
      await liveStreamService.endLiveStream(req.params.id, req.user.id);

      res.json({
        success: true,
        message: 'Live stream ended successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Join live stream as viewer
 * POST /api/live-streams/:id/join
 */
router.post('/:id/join',
  authMiddleware,
  async (req, res, next) => {
    try {
      const viewerInfo = await liveStreamService.joinLiveStream(req.params.id, req.user.id);

      res.json({
        success: true,
        data: viewerInfo
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Leave live stream
 * POST /api/live-streams/:id/leave
 */
router.post('/:id/leave',
  authMiddleware,
  async (req, res, next) => {
    try {
      await liveStreamService.leaveLiveStream(req.params.id, req.user.id);

      res.json({
        success: true,
        message: 'Left live stream successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get live stream analytics
 * GET /api/live-streams/:id/analytics
 */
router.get('/:id/analytics',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  async (req, res, next) => {
    try {
      const analytics = await liveStreamService.getLiveStreamAnalytics(req.params.id);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get live stream viewers
 * GET /api/live-streams/:id/viewers
 */
router.get('/:id/viewers',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  async (req, res, next) => {
    try {
      const viewers = await liveStreamService.getLiveStreamViewers(req.params.id);

      res.json({
        success: true,
        data: viewers
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;