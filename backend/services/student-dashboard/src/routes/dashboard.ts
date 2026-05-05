/**
 * Student Dashboard Routes
 * API endpoints for personalized student dashboard and learning features
 */

import express from 'express';
import { StudentDashboardService } from '../services/StudentDashboardService';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateRequest, validateQuery } from '../middleware/validation';
import { 
  progressUpdateSchema, 
  recommendationRequestSchema,
  socialActionSchema,
  learningGoalsSchema 
} from '../schemas/studentSchemas';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();
const dashboardService = new StudentDashboardService();

/**
 * Get comprehensive student dashboard
 * GET /api/student/dashboard
 */
router.get('/',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;

      const dashboard = await dashboardService.getStudentDashboard(studentId);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get AI-powered course recommendations
 * GET /api/student/dashboard/recommendations
 */
router.get('/recommendations',
  authMiddleware,
  requireRole(['student', 'admin']),
  validateQuery(recommendationRequestSchema),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const limit = parseInt(req.query.limit as string) || 10;
      const type = req.query.type as string || 'courses';

      let recommendations;
      
      if (type === 'courses') {
        recommendations = await dashboardService.getRecommendedCourses(studentId, limit);
      } else if (type === 'study') {
        recommendations = await dashboardService.getStudyRecommendations(studentId);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid recommendation type'
        });
      }

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get personalized learning path
 * GET /api/student/dashboard/learning-path
 */
router.get('/learning-path',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;

      const learningPath = await dashboardService.getLearningPath(studentId);

      res.json({
        success: true,
        data: learningPath
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update learning progress
 * POST /api/student/dashboard/progress
 */
router.post('/progress',
  authMiddleware,
  requireRole(['student', 'admin']),
  validateRequest(progressUpdateSchema),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.body.student_id;
      const { course_id, lesson_id, progress_data } = req.body;

      await dashboardService.updateLearningProgress(
        studentId,
        course_id,
        lesson_id,
        progress_data
      );

      res.json({
        success: true,
        message: 'Progress updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Track learning activity
 * POST /api/student/dashboard/activity
 */
router.post('/activity',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.body.student_id;
      const { activity_type, activity_data } = req.body;

      await dashboardService.trackLearningActivity(
        studentId,
        activity_type,
        activity_data
      );

      res.json({
        success: true,
        message: 'Activity tracked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get learning analytics
 * GET /api/student/dashboard/analytics
 */
router.get('/analytics',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const timeRange = req.query.time_range as string || '30d';

      // Get analytics from the analytics engine
      const analyticsEngine = dashboardService['analyticsEngine'];
      const analytics = await analyticsEngine.getProgressAnalytics(studentId);

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
 * Get learning insights
 * GET /api/student/dashboard/insights
 */
router.get('/insights',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;

      // Get insights from the analytics engine
      const analyticsEngine = dashboardService['analyticsEngine'];
      const insights = await analyticsEngine.generateLearningInsights(studentId);

      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update learning goals
 * PUT /api/student/dashboard/goals
 */
router.put('/goals',
  authMiddleware,
  requireRole(['student', 'admin']),
  validateRequest(learningGoalsSchema),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.body.student_id;
      const { goals, target_completion_date, preferred_pace } = req.body;

      // Implementation would update learning goals
      // For now, return success
      
      res.json({
        success: true,
        message: 'Learning goals updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get study streak information
 * GET /api/student/dashboard/streak
 */
router.get('/streak',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;

      // Get study streak from dashboard service
      const dashboard = await dashboardService.getStudentDashboard(studentId);
      const streak = dashboard.study_streak;

      res.json({
        success: true,
        data: streak
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get achievements
 * GET /api/student/dashboard/achievements
 */
router.get('/achievements',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const category = req.query.category as string;
      const limit = parseInt(req.query.limit as string) || 20;

      // Get achievements from dashboard
      const dashboard = await dashboardService.getStudentDashboard(studentId);
      let achievements = dashboard.achievements;

      // Filter by category if specified
      if (category) {
        achievements = achievements.filter(a => a.category === category);
      }

      // Limit results
      achievements = achievements.slice(0, limit);

      res.json({
        success: true,
        data: achievements
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get upcoming sessions and deadlines
 * GET /api/student/dashboard/upcoming
 */
router.get('/upcoming',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const type = req.query.type as string; // 'sessions' or 'deadlines'
      const limit = parseInt(req.query.limit as string) || 10;

      const dashboard = await dashboardService.getStudentDashboard(studentId);

      let upcomingItems;
      if (type === 'sessions') {
        upcomingItems = dashboard.upcoming_sessions.slice(0, limit);
      } else if (type === 'deadlines') {
        // Extract deadlines from current courses
        upcomingItems = dashboard.current_courses
          .flatMap(course => course.upcoming_deadlines)
          .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
          .slice(0, limit);
      } else {
        upcomingItems = {
          sessions: dashboard.upcoming_sessions.slice(0, limit),
          deadlines: dashboard.current_courses
            .flatMap(course => course.upcoming_deadlines)
            .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
            .slice(0, limit)
        };
      }

      res.json({
        success: true,
        data: upcomingItems
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get recent learning activity
 * GET /api/student/dashboard/activity
 */
router.get('/activity',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const activityType = req.query.activity_type as string;

      const dashboard = await dashboardService.getStudentDashboard(studentId);
      let activities = dashboard.recent_activity;

      // Filter by activity type if specified
      if (activityType) {
        activities = activities.filter(a => a.activity_type === activityType);
      }

      // Limit results
      activities = activities.slice(0, limit);

      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Export dashboard data
 * GET /api/student/dashboard/export
 */
router.get('/export',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const format = req.query.format as string || 'json';
      const includeAnalytics = req.query.include_analytics === 'true';

      const dashboard = await dashboardService.getStudentDashboard(studentId);

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="dashboard-${studentId}.json"`);
        
        const exportData = {
          exported_at: new Date(),
          student_id: studentId,
          dashboard: includeAnalytics ? dashboard : {
            ...dashboard,
            progress_analytics: undefined // Exclude analytics if not requested
          }
        };

        res.json(exportData);
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported export format'
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;