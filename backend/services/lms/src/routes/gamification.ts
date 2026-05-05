/**
 * Gamification Routes
 * Handles points, badges, achievements, leaderboards, streaks, and flashcards
 */

import { Router } from 'express';
import { GamificationService } from '../services/GamificationService';
import { FlashcardService } from '../services/FlashcardService';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { gamificationSchemas } from '../schemas/gamificationSchemas';

const router = Router();
const gamificationService = new GamificationService();
const flashcardService = new FlashcardService();

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// Points Endpoints
// ============================================================================

/**
 * GET /api/gamification/users/:userId/points
 * Get user points and level information
 */
router.get('/users/:userId/points', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Users can only view their own points unless admin
    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          type: 'AUTHORIZATION_ERROR',
          code: 'FORBIDDEN',
          message: 'You can only view your own points',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const points = await gamificationService.getUserPoints(userId);
    res.json({ success: true, data: points });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Badge Endpoints
// ============================================================================

/**
 * GET /api/gamification/badges
 * Get all available badges
 */
router.get('/badges', async (req, res, next) => {
  try {
    const badges = await gamificationService.getAllBadges();
    res.json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gamification/users/:userId/badges
 * Get user's earned badges
 */
router.get('/users/:userId/badges', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const badges = await gamificationService.getUserBadges(userId);
    res.json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Achievement Endpoints
// ============================================================================

/**
 * GET /api/gamification/achievements
 * Get all available achievements
 */
router.get('/achievements', async (req, res, next) => {
  try {
    const achievements = await gamificationService.getAllAchievements();
    res.json({ success: true, data: achievements });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gamification/users/:userId/achievements
 * Get user's achievement progress
 */
router.get('/users/:userId/achievements', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const achievements = await gamificationService.getUserAchievements(userId);
    res.json({ success: true, data: achievements });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Leaderboard Endpoints
// ============================================================================

/**
 * GET /api/gamification/leaderboard
 * Get leaderboard rankings
 * Query params: period (daily|weekly|monthly|all-time), scope (global|course), scopeId, limit
 */
router.get('/leaderboard', validate(gamificationSchemas.getLeaderboard), async (req, res, next) => {
  try {
    const { period = 'weekly', scope = 'global', scopeId, limit = 50 } = req.query;
    
    const leaderboard = await gamificationService.getLeaderboard(
      period as any,
      scope as any,
      scopeId as string,
      parseInt(limit as string, 10)
    );
    
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Streak Endpoints
// ============================================================================

/**
 * GET /api/gamification/users/:userId/streak
 * Get user's learning streak
 */
router.get('/users/:userId/streak', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const streak = await gamificationService.getUserStreak(userId);
    res.json({ success: true, data: streak });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gamification/users/:userId/streak
 * Update user's learning streak (called when user completes an activity)
 */
router.post('/users/:userId/streak', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Users can only update their own streak
    if (req.user!.id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'AUTHORIZATION_ERROR',
          code: 'FORBIDDEN',
          message: 'You can only update your own streak',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const result = await gamificationService.updateStreak(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gamification/users/:userId/streak/freeze
 * Use a streak freeze to prevent breaking the streak
 */
router.post('/users/:userId/streak/freeze', validate(gamificationSchemas.freezeStreak), async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Users can only freeze their own streak
    if (req.user!.id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          type: 'AUTHORIZATION_ERROR',
          code: 'FORBIDDEN',
          message: 'You can only freeze your own streak',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const result = await gamificationService.freezeStreak(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Flashcard Endpoints
// ============================================================================

/**
 * POST /api/gamification/courses/:courseId/flashcards
 * Create a new flashcard
 */
router.post('/courses/:courseId/flashcards', validate(gamificationSchemas.createFlashcard), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { front, back, tags, difficulty } = req.body;
    const userId = req.user!.id;

    const flashcard = await flashcardService.createFlashcard(
      courseId,
      userId,
      front,
      back,
      tags,
      difficulty
    );

    res.status(201).json({ success: true, data: flashcard });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gamification/courses/:courseId/flashcards
 * Get flashcards for a course
 * Query params: tags (comma-separated)
 */
router.get('/courses/:courseId/flashcards', async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { tags } = req.query;
    const userId = req.user!.id;

    const tagArray = tags ? (tags as string).split(',') : undefined;

    const flashcards = await flashcardService.getFlashcards(courseId, userId, tagArray);
    res.json({ success: true, data: flashcards });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gamification/flashcards/:flashcardId
 * Get a single flashcard
 */
router.get('/flashcards/:flashcardId', async (req, res, next) => {
  try {
    const { flashcardId } = req.params;
    const userId = req.user!.id;

    const flashcard = await flashcardService.getFlashcard(flashcardId, userId);
    res.json({ success: true, data: flashcard });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/gamification/flashcards/:flashcardId
 * Update a flashcard
 */
router.put('/flashcards/:flashcardId', validate(gamificationSchemas.updateFlashcard), async (req, res, next) => {
  try {
    const { flashcardId } = req.params;
    const userId = req.user!.id;
    const updates = req.body;

    const flashcard = await flashcardService.updateFlashcard(flashcardId, userId, updates);
    res.json({ success: true, data: flashcard });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/gamification/flashcards/:flashcardId
 * Delete a flashcard
 */
router.delete('/flashcards/:flashcardId', async (req, res, next) => {
  try {
    const { flashcardId } = req.params;
    const userId = req.user!.id;

    await flashcardService.deleteFlashcard(flashcardId, userId);
    res.json({ success: true, message: 'Flashcard deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gamification/flashcards/due
 * Get due flashcards for review
 * Query params: courseId, limit
 */
router.get('/flashcards/due', async (req, res, next) => {
  try {
    const { courseId, limit = 20 } = req.query;
    const userId = req.user!.id;

    const session = await flashcardService.getDueFlashcards(
      userId,
      courseId as string,
      parseInt(limit as string, 10)
    );

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gamification/flashcards/:flashcardId/review
 * Review a flashcard (spaced repetition)
 */
router.post('/flashcards/:flashcardId/review', validate(gamificationSchemas.reviewFlashcard), async (req, res, next) => {
  try {
    const { flashcardId } = req.params;
    const { quality, timeSpent } = req.body;
    const userId = req.user!.id;

    const result = await flashcardService.reviewFlashcard(flashcardId, userId, quality, timeSpent);

    // Update streak when reviewing flashcards
    await gamificationService.updateStreak(userId);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gamification/flashcards/reviews
 * Get flashcard review history
 * Query params: flashcardId, limit
 */
router.get('/flashcards/reviews', async (req, res, next) => {
  try {
    const { flashcardId, limit = 50 } = req.query;
    const userId = req.user!.id;

    const reviews = await flashcardService.getReviewHistory(
      userId,
      flashcardId as string,
      parseInt(limit as string, 10)
    );

    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gamification/flashcards/stats
 * Get flashcard statistics
 * Query params: courseId
 */
router.get('/flashcards/stats', async (req, res, next) => {
  try {
    const { courseId } = req.query;
    const userId = req.user!.id;

    const stats = await flashcardService.getFlashcardStats(userId, courseId as string);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

export default router;
