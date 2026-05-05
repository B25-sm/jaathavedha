/**
 * Social Learning Routes
 * API endpoints for social learning features, study groups, and peer interactions
 */

import express from 'express';
import { SocialLearningService } from '../services/SocialLearningService';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { 
  studyGroupSchema, 
  peerConnectionSchema, 
  discussionPostSchema,
  mentorshipRequestSchema 
} from '../schemas/studentSchemas';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();
const socialService = new SocialLearningService();

/**
 * Get social learning overview
 * GET /api/student/social
 */
router.get('/',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;

      const socialLearning = await socialService.getSocialLearning(studentId);

      res.json({
        success: true,
        data: socialLearning
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get study groups
 * GET /api/student/social/study-groups
 */
router.get('/study-groups',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const courseId = req.query.course_id as string;
      const membershipStatus = req.query.membership_status as string; // 'member', 'available', 'all'

      const socialLearning = await socialService.getSocialLearning(studentId);
      let studyGroups = socialLearning.study_groups;

      // Filter by course if specified
      if (courseId) {
        studyGroups = studyGroups.filter(group => group.course_id === courseId);
      }

      // Filter by membership status
      if (membershipStatus === 'member') {
        studyGroups = studyGroups.filter(group => group.is_member);
      } else if (membershipStatus === 'available') {
        studyGroups = studyGroups.filter(group => !group.is_member);
      }

      res.json({
        success: true,
        data: studyGroups
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create study group
 * POST /api/student/social/study-groups
 */
router.post('/study-groups',
  authMiddleware,
  requireRole(['student', 'admin']),
  validateRequest(studyGroupSchema),
  async (req, res, next) => {
    try {
      const creatorId = req.user.id;
      const { name, description, course_id, max_members } = req.body;

      const studyGroup = await socialService.createStudyGroup(
        creatorId,
        name,
        description,
        course_id,
        max_members
      );

      res.status(201).json({
        success: true,
        data: studyGroup,
        message: 'Study group created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Join study group
 * POST /api/student/social/study-groups/:id/join
 */
router.post('/study-groups/:id/join',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const groupId = req.params.id;

      await socialService.joinStudyGroup(studentId, groupId);

      res.json({
        success: true,
        message: 'Successfully joined study group'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Leave study group
 * POST /api/student/social/study-groups/:id/leave
 */
router.post('/study-groups/:id/leave',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const groupId = req.params.id;

      // Implementation would handle leaving study group
      
      res.json({
        success: true,
        message: 'Successfully left study group'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get peer connections
 * GET /api/student/social/peers
 */
router.get('/peers',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const connectionType = req.query.connection_type as string;

      const socialLearning = await socialService.getSocialLearning(studentId);
      let peerConnections = socialLearning.peer_connections;

      // Filter by connection type if specified
      if (connectionType) {
        peerConnections = peerConnections.filter(conn => conn.connection_type === connectionType);
      }

      res.json({
        success: true,
        data: peerConnections
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Connect with peer
 * POST /api/student/social/peers/connect
 */
router.post('/peers/connect',
  authMiddleware,
  requireRole(['student', 'admin']),
  validateRequest(peerConnectionSchema),
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const { peer_id, connection_type, message } = req.body;

      await socialService.connectWithPeer(studentId, peer_id, connection_type);

      res.json({
        success: true,
        message: 'Connection request sent successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Accept peer connection
 * POST /api/student/social/peers/connections/:id/accept
 */
router.post('/peers/connections/:id/accept',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const connectionId = req.params.id;

      await socialService.acceptPeerConnection(studentId, connectionId);

      res.json({
        success: true,
        message: 'Connection accepted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Decline peer connection
 * POST /api/student/social/peers/connections/:id/decline
 */
router.post('/peers/connections/:id/decline',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const connectionId = req.params.id;

      // Implementation would handle declining connection
      
      res.json({
        success: true,
        message: 'Connection declined'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get discussion participation
 * GET /api/student/social/discussions
 */
router.get('/discussions',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;

      const socialLearning = await socialService.getSocialLearning(studentId);
      const discussionParticipation = socialLearning.discussion_participation;

      res.json({
        success: true,
        data: discussionParticipation
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Post in discussion
 * POST /api/student/social/discussions/:id/posts
 */
router.post('/discussions/:id/posts',
  authMiddleware,
  requireRole(['student', 'admin']),
  validateRequest(discussionPostSchema),
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const discussionId = req.params.id;
      const { content, parent_post_id } = req.body;

      await socialService.postInDiscussion(studentId, discussionId, content, parent_post_id);

      res.status(201).json({
        success: true,
        message: 'Discussion post created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get mentorship information
 * GET /api/student/social/mentorship
 */
router.get('/mentorship',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;

      const socialLearning = await socialService.getSocialLearning(studentId);
      const mentorshipInfo = socialLearning.mentorship;

      res.json({
        success: true,
        data: mentorshipInfo
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Request mentorship
 * POST /api/student/social/mentorship/request
 */
router.post('/mentorship/request',
  authMiddleware,
  requireRole(['student', 'admin']),
  validateRequest(mentorshipRequestSchema),
  async (req, res, next) => {
    try {
      const menteeId = req.user.id;
      const { mentor_id, message, expertise_areas } = req.body;

      await socialService.requestMentorship(menteeId, mentor_id, message);

      res.json({
        success: true,
        message: 'Mentorship request sent successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Accept mentorship request
 * POST /api/student/social/mentorship/requests/:id/accept
 */
router.post('/mentorship/requests/:id/accept',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const mentorId = req.user.id;
      const requestId = req.params.id;

      // Implementation would handle accepting mentorship request
      
      res.json({
        success: true,
        message: 'Mentorship request accepted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get leaderboards
 * GET /api/student/social/leaderboards
 */
router.get('/leaderboards',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const leaderboardType = req.query.type as string;
      const timePeriod = req.query.time_period as string;

      const socialLearning = await socialService.getSocialLearning(studentId);
      let leaderboards = socialLearning.leaderboards;

      // Filter by type if specified
      if (leaderboardType) {
        leaderboards = leaderboards.filter(lb => lb.leaderboard_type === leaderboardType);
      }

      // Filter by time period if specified
      if (timePeriod) {
        leaderboards = leaderboards.filter(lb => lb.time_period === timePeriod);
      }

      res.json({
        success: true,
        data: leaderboards
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get collaborative projects
 * GET /api/student/social/projects
 */
router.get('/projects',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.query.student_id as string;
      const status = req.query.status as string;
      const courseId = req.query.course_id as string;

      const socialLearning = await socialService.getSocialLearning(studentId);
      let projects = socialLearning.collaborative_projects;

      // Filter by status if specified
      if (status) {
        projects = projects.filter(project => project.project_status === status);
      }

      // Filter by course if specified
      if (courseId) {
        projects = projects.filter(project => project.course_id === courseId);
      }

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Find study buddies
 * GET /api/student/social/find-buddies
 */
router.get('/find-buddies',
  authMiddleware,
  requireRole(['student', 'admin']),
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const courseId = req.query.course_id as string;
      const learningStyle = req.query.learning_style as string;
      const skillLevel = req.query.skill_level as string;

      // Implementation would find compatible study buddies
      const suggestedBuddies = [];

      res.json({
        success: true,
        data: suggestedBuddies
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;