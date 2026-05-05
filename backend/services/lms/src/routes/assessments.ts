import { Router } from 'express';
import { AssessmentService } from '../services/AssessmentService';
import { AdaptiveLearningService } from '../services/AdaptiveLearningService';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { assessmentSchemas } from '../schemas/assessmentSchemas';

const router = Router();
const assessmentService = new AssessmentService();
const adaptiveLearningService = new AdaptiveLearningService();

// ============================================================================
// Assessment Management
// ============================================================================

/**
 * Create a new assessment
 * POST /api/assessments
 */
router.post(
  '/',
  requireAuth,
  validate(assessmentSchemas.createAssessment),
  async (req, res, next) => {
    try {
      const assessmentData = {
        ...req.body,
        createdBy: req.user!.id,
      };
      const result = await assessmentService.createAssessment(assessmentData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get assessment by ID
 * GET /api/assessments/:assessmentId
 */
router.get('/:assessmentId', requireAuth, async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const includeAnswers = req.query.includeAnswers === 'true';
    
    // Only instructors/admins can see answers
    const canSeeAnswers = includeAnswers && ['instructor', 'admin'].includes(req.user!.role);
    
    const assessment = await assessmentService.getAssessmentById(assessmentId, canSeeAnswers);
    res.json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
});

/**
 * Get assessments by course
 * GET /api/assessments/course/:courseId
 */
router.get('/course/:courseId', requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const assessments = await assessmentService.getAssessmentsByCourse(courseId);
    res.json({ success: true, data: assessments });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Assessment Attempts
// ============================================================================

/**
 * Start an assessment attempt
 * POST /api/assessments/:assessmentId/start
 */
router.post(
  '/:assessmentId/start',
  requireAuth,
  async (req, res, next) => {
    try {
      const { assessmentId } = req.params;
      const userId = req.user!.id;
      
      const result = await assessmentService.startAssessmentAttempt(assessmentId, userId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Submit an assessment attempt
 * POST /api/assessments/attempts/:attemptId/submit
 */
router.post(
  '/attempts/:attemptId/submit',
  requireAuth,
  validate(assessmentSchemas.submitAssessment),
  async (req, res, next) => {
    try {
      const { attemptId } = req.params;
      const attemptData = {
        ...req.body,
        userId: req.user!.id,
        assessmentId: '', // Will be fetched from attempt
      };
      
      const result = await assessmentService.submitAssessmentAttempt(attemptId, attemptData);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user's assessment attempts
 * GET /api/assessments/:assessmentId/attempts
 */
router.get('/:assessmentId/attempts', requireAuth, async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user!.id;
    
    const attempts = await assessmentService.getUserAttempts(userId, assessmentId);
    res.json({ success: true, data: attempts });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Learning Analytics
// ============================================================================

/**
 * Get learning analytics for a user
 * GET /api/assessments/analytics/user/:userId
 */
router.get('/analytics/user/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { courseId } = req.query;
    
    // Users can only see their own analytics unless they're admin/instructor
    if (userId !== req.user!.id && !['admin', 'instructor'].includes(req.user!.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden: Cannot access other users analytics' },
      });
    }
    
    const analytics = await assessmentService.getLearningAnalytics(userId, courseId as string);
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
});

/**
 * Get learning analytics for current user
 * GET /api/assessments/analytics/me
 */
router.get('/analytics/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { courseId } = req.query;
    
    const analytics = await assessmentService.getLearningAnalytics(userId, courseId as string);
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Adaptive Learning
// ============================================================================

/**
 * Get personalized learning path
 * GET /api/assessments/learning-path/:courseId
 */
router.get('/learning-path/:courseId', requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user!.id;
    
    const learningPath = await adaptiveLearningService.getLearningPath(userId, courseId);
    res.json({ success: true, data: learningPath });
  } catch (error) {
    next(error);
  }
});

/**
 * Get adaptive learning analytics
 * GET /api/assessments/adaptive-analytics
 */
router.get('/adaptive-analytics', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { courseId } = req.query;
    
    const analytics = await adaptiveLearningService.getLearningAnalytics(userId, courseId as string);
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
});

/**
 * Get personalized content recommendations
 * GET /api/assessments/recommendations/:courseId
 */
router.get('/recommendations/:courseId', requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user!.id;
    
    const recommendations = await adaptiveLearningService.getRecommendations(userId, courseId);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    next(error);
  }
});

/**
 * Update learning path preferences
 * PUT /api/assessments/learning-path/:courseId
 */
router.put(
  '/learning-path/:courseId',
  requireAuth,
  validate(assessmentSchemas.updateLearningPath),
  async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const userId = req.user!.id;
      const preferences = req.body;
      
      // This would update user preferences in the learning path
      // For now, just return success
      res.json({ 
        success: true, 
        data: { 
          message: 'Learning path preferences updated',
          userId,
          courseId,
          preferences
        } 
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
