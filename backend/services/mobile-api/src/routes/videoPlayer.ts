/**
 * Video Player Routes
 * Mobile-optimized video playback with gesture controls
 */

import express from 'express';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { VideoPlayerService } from '../services/VideoPlayerService';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();

// Initialize service (will be injected by main app)
let videoPlayerService: VideoPlayerService;

export function initializeVideoPlayerRoutes(db: Pool, redis: Redis) {
  videoPlayerService = new VideoPlayerService(db, redis);
}

/**
 * POST /api/video-player/gesture
 * Record video player gesture
 */
router.post('/gesture', authenticateToken, async (req, res) => {
  try {
    const { videoId, gestureType, action, position, metadata } = req.body;
    const userId = req.user!.userId;

    if (!videoId || !gestureType || !action || position === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: videoId, gestureType, action, position',
      });
    }

    const gesture = await videoPlayerService.recordGesture(
      userId,
      videoId,
      gestureType,
      action,
      position,
      metadata
    );

    res.json({
      success: true,
      data: gesture,
    });
  } catch (error) {
    logger.error('Error recording gesture:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record gesture',
    });
  }
});

/**
 * POST /api/video-player/state
 * Save video player state
 */
router.post('/state', authenticateToken, async (req, res) => {
  try {
    const {
      videoId,
      deviceId,
      position,
      duration,
      playbackSpeed,
      volume,
      quality,
      isPlaying,
      isFullscreen,
      brightness,
    } = req.body;
    const userId = req.user!.userId;

    if (!videoId || !deviceId || position === undefined || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const state = await videoPlayerService.savePlayerState({
      userId,
      videoId,
      deviceId,
      position,
      duration,
      playbackSpeed: playbackSpeed || 1.0,
      volume: volume || 1.0,
      quality: quality || 'auto',
      isPlaying: isPlaying || false,
      isFullscreen: isFullscreen || false,
      brightness,
    });

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    logger.error('Error saving player state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save player state',
    });
  }
});

/**
 * GET /api/video-player/state/:videoId/:deviceId
 * Get video player state
 */
router.get('/state/:videoId/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { videoId, deviceId } = req.params;
    const userId = req.user!.userId;

    const state = await videoPlayerService.getPlayerState(userId, videoId, deviceId);

    if (!state) {
      return res.status(404).json({
        success: false,
        error: 'Player state not found',
      });
    }

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    logger.error('Error getting player state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player state',
    });
  }
});

/**
 * GET /api/video-player/gesture-settings/:deviceId
 * Get gesture control settings
 */
router.get('/gesture-settings/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user!.userId;

    const settings = await videoPlayerService.getGestureSettings(userId, deviceId);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logger.error('Error getting gesture settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get gesture settings',
    });
  }
});

/**
 * PUT /api/video-player/gesture-settings/:deviceId
 * Update gesture control settings
 */
router.put('/gesture-settings/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user!.userId;
    const settings = req.body;

    const updatedSettings = await videoPlayerService.updateGestureSettings(
      userId,
      deviceId,
      settings
    );

    res.json({
      success: true,
      data: updatedSettings,
    });
  } catch (error) {
    logger.error('Error updating gesture settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update gesture settings',
    });
  }
});

/**
 * GET /api/video-player/analytics/gestures
 * Get gesture analytics
 */
router.get('/analytics/gestures', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { videoId, startDate, endDate } = req.query;

    const analytics = await videoPlayerService.getGestureAnalytics(
      userId,
      videoId as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Error getting gesture analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get gesture analytics',
    });
  }
});

/**
 * POST /api/video-player/sync/:videoId/:deviceId
 * Sync player state across devices
 */
router.post('/sync/:videoId/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { videoId, deviceId } = req.params;
    const userId = req.user!.userId;

    await videoPlayerService.syncPlayerStateAcrossDevices(userId, videoId, deviceId);

    res.json({
      success: true,
      message: 'Player state synced across devices',
    });
  } catch (error) {
    logger.error('Error syncing player state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync player state',
    });
  }
});

export default router;
