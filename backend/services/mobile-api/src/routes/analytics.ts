import { Router, Request, Response, NextFunction } from 'express';
import { MobileAnalyticsService } from '../services/MobileAnalyticsService';
import { Pool } from 'pg';
import Redis from 'ioredis';

const router = Router();

// Initialize service (will be injected in main app)
let analyticsService: MobileAnalyticsService;

export const initAnalyticsService = (db: Pool, redis: Redis) => {
  analyticsService = new MobileAnalyticsService(db, redis);
};

// ==================== Learning Session Endpoints ====================

/**
 * @route POST /api/analytics/session/start
 * @desc Start a new learning session
 * @access Private
 */
router.post('/session/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, deviceId } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'userId and deviceId are required'
      });
    }

    const session = await analyticsService.startSession(userId, deviceId);

    res.json({
      success: true,
      data: session,
      message: 'Learning session started'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/analytics/session/end
 * @desc End a learning session
 * @access Private
 */
router.post('/session/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required'
      });
    }

    await analyticsService.endSession(sessionId);

    res.json({
      success: true,
      message: 'Learning session ended'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/analytics/session/activity
 * @desc Track activity within a session
 * @access Private
 */
router.post('/session/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, activityType, entityId } = req.body;

    if (!sessionId || !activityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, activityType, and entityId are required'
      });
    }

    await analyticsService.trackSessionActivity(sessionId, activityType, entityId);

    res.json({
      success: true,
      message: 'Activity tracked'
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Progress Synchronization Endpoints ====================

/**
 * @route POST /api/analytics/progress/sync
 * @desc Synchronize learning progress across devices
 * @access Private
 */
router.post('/progress/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, courseId, lessonId, videoId, progress, lastPosition, completedAt, deviceId } = req.body;

    if (!userId || !courseId || progress === undefined || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'userId, courseId, progress, and deviceId are required'
      });
    }

    const progressData = {
      userId,
      courseId,
      lessonId,
      videoId,
      progress,
      lastPosition,
      completedAt: completedAt ? new Date(completedAt) : undefined,
      deviceId,
      syncedAt: new Date()
    };

    await analyticsService.syncProgress(progressData);

    res.json({
      success: true,
      message: 'Progress synchronized',
      data: progressData
    });
  } catch (error: any) {
    if (error.message?.includes('CONFLICT')) {
      return res.status(409).json({
        success: false,
        error: 'Progress conflict detected',
        message: error.message
      });
    }
    next(error);
  }
});

/**
 * @route GET /api/analytics/progress/:userId/:courseId
 * @desc Get progress for a specific course
 * @access Private
 */
router.get('/progress/:userId/:courseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, courseId } = req.params;
    const { lessonId, videoId } = req.query;

    const progress = await analyticsService.getProgress(
      userId,
      courseId,
      lessonId as string,
      videoId as string
    );

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Progress not found'
      });
    }

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/progress/:userId/all
 * @desc Get all progress for a user
 * @access Private
 */
router.get('/progress/:userId/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const allProgress = await analyticsService.getAllProgress(userId);

    res.json({
      success: true,
      data: allProgress,
      count: allProgress.length
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Engagement Tracking Endpoints ====================

/**
 * @route POST /api/analytics/engagement/track
 * @desc Track an engagement event
 * @access Private
 */
router.post('/engagement/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, engagementType, metadata } = req.body;

    if (!userId || !engagementType) {
      return res.status(400).json({
        success: false,
        error: 'userId and engagementType are required'
      });
    }

    await analyticsService.trackEngagement(userId, engagementType, metadata || {});

    res.json({
      success: true,
      message: 'Engagement tracked'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/engagement/:userId
 * @desc Get engagement metrics for a user
 * @access Private
 */
router.get('/engagement/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const metrics = await analyticsService.getEngagementMetrics(userId);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Learning Habit Endpoints ====================

/**
 * @route GET /api/analytics/habits/:userId
 * @desc Analyze learning habits for a user
 * @access Private
 */
router.get('/habits/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const habits = await analyticsService.analyzeLearningHabits(userId);

    res.json({
      success: true,
      data: habits
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/analytics/habits/:userId/reminders
 * @desc Set reminder preferences for a user
 * @access Private
 */
router.put('/habits/:userId/reminders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { enabled, frequency, time, days } = req.body;

    if (enabled === undefined || !frequency || !time || !days) {
      return res.status(400).json({
        success: false,
        error: 'enabled, frequency, time, and days are required'
      });
    }

    const preferences = { enabled, frequency, time, days };
    await analyticsService.setReminderPreferences(userId, preferences);

    res.json({
      success: true,
      message: 'Reminder preferences updated',
      data: preferences
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/habits/:userId/reminders/upcoming
 * @desc Get upcoming reminders for a user
 * @access Private
 */
router.get('/habits/:userId/reminders/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const reminders = await analyticsService.getUpcomingReminders(userId);

    res.json({
      success: true,
      data: reminders,
      count: reminders.length
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Analytics Reports Endpoints ====================

/**
 * @route GET /api/analytics/report/:userId
 * @desc Get comprehensive mobile analytics report
 * @access Private
 */
router.get('/report/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { period } = req.query;

    const validPeriods = ['7d', '30d', '90d'];
    const selectedPeriod = validPeriods.includes(period as string) ? (period as string) : '7d';

    const report = await analyticsService.getMobileAnalyticsReport(userId, selectedPeriod);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/dashboard/:userId
 * @desc Get dashboard summary for mobile app
 * @access Private
 */
router.get('/dashboard/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    // Get all key metrics in parallel
    const [engagement, habits, progress] = await Promise.all([
      analyticsService.getEngagementMetrics(userId),
      analyticsService.analyzeLearningHabits(userId),
      analyticsService.getAllProgress(userId)
    ]);

    // Calculate summary stats
    const activeCourses = progress.filter(p => p.progress < 100).length;
    const completedCourses = progress.filter(p => p.progress === 100).length;
    const totalProgress = progress.length > 0
      ? Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / progress.length)
      : 0;

    res.json({
      success: true,
      data: {
        engagement: {
          score: engagement.engagementScore,
          dailyStreak: engagement.dailyActiveStreak,
          weeklyStreak: engagement.weeklyActiveStreak,
          totalLearningTime: engagement.totalLearningTime,
          lastActive: engagement.lastActiveDate
        },
        courses: {
          active: activeCourses,
          completed: completedCourses,
          totalProgress
        },
        habits: {
          preferredTime: habits.preferredLearningTime,
          consistencyScore: habits.consistencyScore,
          averageSessionsPerDay: habits.averageSessionsPerDay,
          mostActiveDay: habits.mostActiveDay
        },
        reminders: habits.reminderPreferences
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Mobile-Specific Analytics Endpoints ====================

/**
 * @route GET /api/analytics/mobile/:userId/devices
 * @desc Get device usage analytics
 * @access Private
 */
router.get('/mobile/:userId/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const deviceAnalytics = await analyticsService.getMobileDeviceAnalytics(userId);

    res.json({
      success: true,
      data: deviceAnalytics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/mobile/:userId/features
 * @desc Get feature usage analytics
 * @access Private
 */
router.get('/mobile/:userId/features', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const featureAnalytics = await analyticsService.getFeatureUsageAnalytics(userId);

    res.json({
      success: true,
      data: featureAnalytics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/analytics/mobile/feature/track
 * @desc Track feature usage
 * @access Private
 */
router.post('/mobile/feature/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, featureName } = req.body;

    if (!userId || !featureName) {
      return res.status(400).json({
        success: false,
        error: 'userId and featureName are required'
      });
    }

    await analyticsService.trackFeatureUsage(userId, featureName);

    res.json({
      success: true,
      message: 'Feature usage tracked'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/mobile/:userId/performance
 * @desc Get performance metrics
 * @access Private
 */
router.get('/mobile/:userId/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { deviceId } = req.query;

    const performanceMetrics = await analyticsService.getPerformanceMetrics(
      userId,
      deviceId as string
    );

    res.json({
      success: true,
      data: performanceMetrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/analytics/mobile/performance/track
 * @desc Track performance metric
 * @access Private
 */
router.post('/mobile/performance/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, deviceId, metricType, metricValue, metadata } = req.body;

    if (!userId || !deviceId || !metricType || metricValue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, deviceId, metricType, and metricValue are required'
      });
    }

    await analyticsService.trackPerformanceMetric(
      userId,
      deviceId,
      metricType,
      metricValue,
      metadata
    );

    res.json({
      success: true,
      message: 'Performance metric tracked'
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Cross-Device Sync Optimization Endpoints ====================

/**
 * @route GET /api/analytics/sync/:userId/optimize
 * @desc Get sync optimization recommendations
 * @access Private
 */
router.get('/sync/:userId/optimize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const optimization = await analyticsService.optimizeSyncStrategy(userId);

    res.json({
      success: true,
      data: optimization
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/analytics/sync/conflict/resolve
 * @desc Resolve a progress sync conflict
 * @access Private
 */
router.post('/sync/conflict/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conflictId, resolution, manualProgress } = req.body;

    if (!conflictId || !resolution) {
      return res.status(400).json({
        success: false,
        error: 'conflictId and resolution are required'
      });
    }

    if (resolution === 'manual' && manualProgress === undefined) {
      return res.status(400).json({
        success: false,
        error: 'manualProgress is required for manual resolution'
      });
    }

    await analyticsService.resolveProgressConflict(conflictId, resolution, manualProgress);

    res.json({
      success: true,
      message: 'Conflict resolved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Engagement Optimization Endpoints ====================

/**
 * @route GET /api/analytics/engagement/:userId/insights
 * @desc Get personalized engagement insights
 * @access Private
 */
router.get('/engagement/:userId/insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const insights = await analyticsService.getEngagementInsights(userId);

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    next(error);
  }
});

// ==================== Legacy Endpoints (for backward compatibility) ====================

/**
 * @route POST /api/analytics/track
 * @desc Legacy event tracking endpoint
 * @access Private
 */
router.post('/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, event, data } = req.body;

    if (!userId || !event) {
      return res.status(400).json({
        success: false,
        error: 'userId and event are required'
      });
    }

    await analyticsService.trackEngagement(userId, event, data || {});

    res.json({
      success: true,
      data: {
        userId,
        event,
        data,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/:userId/usage
 * @desc Legacy usage stats endpoint
 * @access Private
 */
router.get('/:userId/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const metrics = await analyticsService.getEngagementMetrics(userId);

    res.json({
      success: true,
      data: {
        userId,
        totalSessions: metrics.coursesInProgress + metrics.coursesCompleted,
        totalTime: metrics.totalLearningTime,
        lastActive: metrics.lastActiveDate
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
export { initAnalyticsService };
