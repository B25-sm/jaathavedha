/**
 * Mobile Content Routes
 * Mobile-optimized content delivery with field selection and pagination
 */

import { Router } from 'express';
import { getDatabase, getRedis } from '@sai-mahendra/database';
import { MobileContentService } from '../services/MobileContentService';

const router = Router();

/**
 * Get mobile-optimized course list
 * Supports field selection, pagination, and relation inclusion
 */
router.get('/courses', async (req, res, next) => {
  try {
    const { userId } = req.query;
    const { fields, limit, offset, includeRelations, compress } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const db = getDatabase();
    const redis = getRedis();
    const contentService = new MobileContentService(db, redis);

    const request = {
      fields: fields ? (fields as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
      includeRelations: includeRelations ? (includeRelations as string).split(',') : [],
      compress: compress === 'true',
    };

    const result = await contentService.getCourses(userId as string, request);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get mobile-optimized lesson content
 */
router.get('/lessons/:lessonId', async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { userId, fields, includeRelations } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const db = getDatabase();
    const redis = getRedis();
    const contentService = new MobileContentService(db, redis);

    const request = {
      fields: fields ? (fields as string).split(',') : undefined,
      includeRelations: includeRelations ? (includeRelations as string).split(',') : [],
    };

    const result = await contentService.getLesson(userId as string, lessonId, request);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user progress summary
 */
router.get('/progress/summary', async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const db = getDatabase();
    const redis = getRedis();
    const contentService = new MobileContentService(db, redis);

    const result = await contentService.getProgressSummary(userId as string, {});
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get upcoming live sessions
 */
router.get('/sessions/upcoming', async (req, res, next) => {
  try {
    const { userId, limit, offset } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const db = getDatabase();
    const redis = getRedis();
    const contentService = new MobileContentService(db, redis);

    const request = {
      limit: limit ? parseInt(limit as string) : 10,
      offset: offset ? parseInt(offset as string) : 0,
    };

    const result = await contentService.getUpcomingSessions(userId as string, request);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * Invalidate cache for user
 */
router.post('/cache/invalidate', async (req, res, next) => {
  try {
    const { userId, pattern } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const db = getDatabase();
    const redis = getRedis();
    const contentService = new MobileContentService(db, redis);

    await contentService.invalidateCache(userId, pattern);
    res.json({ success: true, message: 'Cache invalidated' });
  } catch (error) {
    next(error);
  }
});

export default router;
