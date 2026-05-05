/**
 * Video Streaming Routes
 * API endpoints for video upload, streaming, and management
 */

import express from 'express';
import multer from 'multer';
import { VideoStreamingService } from '../services/VideoStreamingService';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { videoUploadSchema, videoAnalyticsSchema, noteSchema, bookmarkSchema } from '../schemas/videoSchemas';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();
const videoService = new VideoStreamingService();

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

/**
 * Generate presigned URL for video upload
 * POST /api/videos/upload-url
 */
router.post('/upload-url', 
  authMiddleware,
  validateRequest(videoUploadSchema),
  async (req, res, next) => {
    try {
      const uploadUrl = await videoService.generateUploadUrl({
        ...req.body,
        instructor_id: req.user.id
      });

      res.json({
        success: true,
        data: uploadUrl
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Process uploaded video
 * POST /api/videos/:id/process
 */
router.post('/:id/process',
  authMiddleware,
  async (req, res, next) => {
    try {
      const job = await videoService.processVideo(req.params.id);

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get video player configuration
 * GET /api/videos/:id/player
 */
router.get('/:id/player',
  authMiddleware,
  async (req, res, next) => {
    try {
      const config = await videoService.getPlayerConfig(req.params.id, req.user.id);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Track video analytics
 * POST /api/videos/:id/analytics
 */
router.post('/:id/analytics',
  authMiddleware,
  validateRequest(videoAnalyticsSchema),
  async (req, res, next) => {
    try {
      await videoService.trackAnalytics(req.params.id, req.user.id, {
        ...req.body,
        device_info: {
          user_agent: req.get('User-Agent') || '',
          screen_resolution: req.body.screen_resolution || '',
          network_type: req.body.network_type,
          bandwidth: req.body.bandwidth
        }
      });

      res.json({
        success: true,
        message: 'Analytics tracked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get video progress
 * GET /api/videos/:id/progress
 */
router.get('/:id/progress',
  authMiddleware,
  async (req, res, next) => {
    try {
      const progress = await videoService.getVideoProgress(req.params.id, req.user.id);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Add video note
 * POST /api/videos/:id/notes
 */
router.post('/:id/notes',
  authMiddleware,
  validateRequest(noteSchema),
  async (req, res, next) => {
    try {
      const note = await videoService.addNote(
        req.params.id,
        req.user.id,
        req.body.timestamp,
        req.body.content,
        req.body.is_public || false
      );

      res.status(201).json({
        success: true,
        data: note
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user notes for video
 * GET /api/videos/:id/notes
 */
router.get('/:id/notes',
  authMiddleware,
  async (req, res, next) => {
    try {
      const notes = await videoService.getUserNotes(req.params.id, req.user.id);

      res.json({
        success: true,
        data: notes
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Add video bookmark
 * POST /api/videos/:id/bookmarks
 */
router.post('/:id/bookmarks',
  authMiddleware,
  validateRequest(bookmarkSchema),
  async (req, res, next) => {
    try {
      const bookmark = await videoService.addBookmark(
        req.params.id,
        req.user.id,
        req.body.timestamp,
        req.body.title,
        req.body.description
      );

      res.status(201).json({
        success: true,
        data: bookmark
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user bookmarks for video
 * GET /api/videos/:id/bookmarks
 */
router.get('/:id/bookmarks',
  authMiddleware,
  async (req, res, next) => {
    try {
      const bookmarks = await videoService.getUserBookmarks(req.params.id, req.user.id);

      res.json({
        success: true,
        data: bookmarks
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get video statistics (admin/instructor only)
 * GET /api/videos/stats
 */
router.get('/stats',
  authMiddleware,
  async (req, res, next) => {
    try {
      // Check if user has permission to view stats
      if (!['admin', 'instructor'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const filters = {
        course_id: req.query.course_id as string,
        instructor_id: req.user.role === 'instructor' ? req.user.id : req.query.instructor_id as string,
        status: req.query.status as any,
        search: req.query.search as string,
        date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
        date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined
      };

      const stats = await videoService.getVideoStats(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Bulk upload videos
 * POST /api/videos/bulk-upload
 */
router.post('/bulk-upload',
  authMiddleware,
  async (req, res, next) => {
    try {
      // Check if user is instructor or admin
      if (!['admin', 'instructor'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const uploadUrls = [];
      for (const videoData of req.body.videos) {
        const uploadUrl = await videoService.generateUploadUrl({
          ...videoData,
          instructor_id: req.user.id
        });
        uploadUrls.push(uploadUrl);
      }

      res.json({
        success: true,
        data: {
          upload_urls: uploadUrls,
          batch_id: `batch_${Date.now()}`,
          total_videos: uploadUrls.length,
          estimated_processing_time: uploadUrls.length * 10 // 10 minutes per video estimate
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Search videos
 * GET /api/videos/search
 */
router.get('/search',
  authMiddleware,
  async (req, res, next) => {
    try {
      const query = req.query.q as string;
      const courseId = req.query.course_id as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Implement video search logic here
      // This would typically use Elasticsearch or similar search engine
      
      res.json({
        success: true,
        data: {
          videos: [],
          total: 0,
          limit,
          offset
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get video recommendations
 * GET /api/videos/:id/recommendations
 */
router.get('/:id/recommendations',
  authMiddleware,
  async (req, res, next) => {
    try {
      const videoId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 10;

      // Implement recommendation logic here
      // This would typically use ML algorithms or collaborative filtering
      
      res.json({
        success: true,
        data: {
          recommendations: [],
          total: 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Download video for offline viewing (enrolled students only)
 * GET /api/videos/:id/download
 */
router.get('/:id/download',
  authMiddleware,
  async (req, res, next) => {
    try {
      const videoId = req.params.id;
      const quality = req.query.quality as string || '720p';

      // Check if user has access to download
      const hasAccess = await videoService.checkVideoAccess(videoId, req.user.id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Generate temporary download URL
      const downloadUrl = await videoService.generateDownloadUrl(videoId, quality);

      res.json({
        success: true,
        data: {
          download_url: downloadUrl,
          expires_at: new Date(Date.now() + 3600000) // 1 hour
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;