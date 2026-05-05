/**
 * Social Learning Routes
 * Mobile social learning and peer interaction features
 */

import express from 'express';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { SocialLearningService } from '../services/SocialLearningService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();

// Initialize service (will be injected by main app)
let socialService: SocialLearningService;

export function initializeSocialRoutes(db: Pool, redis: Redis) {
  socialService = new SocialLearningService(db, redis);
}

// ==================== Study Groups ====================

/**
 * POST /api/social/groups
 * Create study group
 */
router.post('/groups', authenticateToken, async (req, res) => {
  try {
    const { name, description, courseId, maxMembers, isPrivate, tags } = req.body;
    const userId = req.user!.userId;

    if (!name || !description || !courseId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, description, courseId',
      });
    }

    const group = await socialService.createStudyGroup(userId, {
      name,
      description,
      courseId,
      maxMembers,
      isPrivate,
      tags,
    });

    res.json({
      success: true,
      data: group,
    });
  } catch (error) {
    logger.error('Error creating study group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create study group',
    });
  }
});

/**
 * POST /api/social/groups/join
 * Join study group
 */
router.post('/groups/join', authenticateToken, async (req, res) => {
  try {
    const { groupId, inviteCode } = req.body;
    const userId = req.user!.userId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: 'groupId is required',
      });
    }

    const member = await socialService.joinStudyGroup(userId, {
      groupId,
      inviteCode,
    });

    res.json({
      success: true,
      data: member,
      message: 'Successfully joined study group',
    });
  } catch (error) {
    logger.error('Error joining study group:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to join study group',
    });
  }
});

/**
 * GET /api/social/groups
 * Get user's study groups
 */
router.get('/groups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { courseId } = req.query;

    const groups = await socialService.getUserStudyGroups(userId, courseId as string);

    res.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    logger.error('Error getting study groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get study groups',
    });
  }
});

/**
 * GET /api/social/groups/search
 * Search study groups
 */
router.get('/groups/search', authenticateToken, async (req, res) => {
  try {
    const { courseId, query, tags } = req.query;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'courseId is required',
      });
    }

    const groups = await socialService.searchStudyGroups(
      courseId as string,
      query as string,
      tags ? (tags as string).split(',') : undefined
    );

    res.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    logger.error('Error searching study groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search study groups',
    });
  }
});

// ==================== Peer Chat ====================

/**
 * POST /api/social/chat/send
 * Send chat message
 */
router.post('/chat/send', authenticateToken, async (req, res) => {
  try {
    const {
      groupId,
      recipientId,
      messageType,
      content,
      attachmentUrl,
      replyToId,
    } = req.body;
    const userId = req.user!.userId;

    if (!messageType || !content) {
      return res.status(400).json({
        success: false,
        error: 'messageType and content are required',
      });
    }

    if (!groupId && !recipientId) {
      return res.status(400).json({
        success: false,
        error: 'Either groupId or recipientId is required',
      });
    }

    const message = await socialService.sendChatMessage(userId, {
      groupId,
      recipientId,
      messageType,
      content,
      attachmentUrl,
      replyToId,
    });

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    logger.error('Error sending chat message:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send chat message',
    });
  }
});

/**
 * GET /api/social/chat/messages
 * Get chat messages
 */
router.get('/chat/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { groupId, recipientId, limit, offset } = req.query;

    const messages = await socialService.getChatMessages(
      userId,
      groupId as string,
      recipientId as string,
      limit ? parseInt(limit as string) : 50,
      offset ? parseInt(offset as string) : 0
    );

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error('Error getting chat messages:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get chat messages',
    });
  }
});

/**
 * POST /api/social/chat/read
 * Mark messages as read
 */
router.post('/chat/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        error: 'messageIds array is required',
      });
    }

    await socialService.markMessagesAsRead(userId, messageIds);

    res.json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read',
    });
  }
});

// ==================== Help Requests ====================

/**
 * POST /api/social/help
 * Create help request
 */
router.post('/help', authenticateToken, async (req, res) => {
  try {
    const { courseId, lessonId, title, description, tags, priority } = req.body;
    const userId = req.user!.userId;

    if (!courseId || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'courseId, title, and description are required',
      });
    }

    const helpRequest = await socialService.createHelpRequest(userId, {
      courseId,
      lessonId,
      title,
      description,
      tags,
      priority,
    });

    res.json({
      success: true,
      data: helpRequest,
    });
  } catch (error) {
    logger.error('Error creating help request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create help request',
    });
  }
});

/**
 * GET /api/social/help
 * Get help requests
 */
router.get('/help', authenticateToken, async (req, res) => {
  try {
    const { courseId, status, userId } = req.query;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'courseId is required',
      });
    }

    const helpRequests = await socialService.getHelpRequests(
      courseId as string,
      status as string,
      userId as string
    );

    res.json({
      success: true,
      data: helpRequests,
    });
  } catch (error) {
    logger.error('Error getting help requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get help requests',
    });
  }
});

/**
 * POST /api/social/help/:requestId/respond
 * Respond to help request
 */
router.post('/help/:requestId/respond', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { content } = req.body;
    const userId = req.user!.userId;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'content is required',
      });
    }

    const helpRequest = await socialService.respondToHelpRequest(
      requestId,
      userId,
      content
    );

    res.json({
      success: true,
      data: helpRequest,
    });
  } catch (error) {
    logger.error('Error responding to help request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to respond to help request',
    });
  }
});

// ==================== Resource Sharing ====================

/**
 * POST /api/social/resources/share
 * Share resource
 */
router.post('/resources/share', authenticateToken, async (req, res) => {
  try {
    const {
      groupId,
      courseId,
      lessonId,
      resourceType,
      title,
      description,
      resourceUrl,
      fileData,
      tags,
    } = req.body;
    const userId = req.user!.userId;

    if (!courseId || !resourceType || !title) {
      return res.status(400).json({
        success: false,
        error: 'courseId, resourceType, and title are required',
      });
    }

    const resource = await socialService.shareResource(userId, {
      groupId,
      courseId,
      lessonId,
      resourceType,
      title,
      description,
      resourceUrl,
      fileData,
      tags,
    });

    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    logger.error('Error sharing resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share resource',
    });
  }
});

/**
 * GET /api/social/resources
 * Get shared resources
 */
router.get('/resources', authenticateToken, async (req, res) => {
  try {
    const { courseId, groupId, resourceType } = req.query;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'courseId is required',
      });
    }

    const resources = await socialService.getSharedResources(
      courseId as string,
      groupId as string,
      resourceType as string
    );

    res.json({
      success: true,
      data: resources,
    });
  } catch (error) {
    logger.error('Error getting shared resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get shared resources',
    });
  }
});

// ==================== Study Sessions ====================

/**
 * POST /api/social/sessions/schedule
 * Schedule study session
 */
router.post('/sessions/schedule', authenticateToken, async (req, res) => {
  try {
    const {
      groupId,
      title,
      description,
      courseId,
      lessonId,
      scheduledAt,
      duration,
      participantIds,
    } = req.body;
    const userId = req.user!.userId;

    if (!title || !courseId || !scheduledAt || !duration) {
      return res.status(400).json({
        success: false,
        error: 'title, courseId, scheduledAt, and duration are required',
      });
    }

    const session = await socialService.scheduleStudySession(userId, {
      groupId,
      title,
      description,
      courseId,
      lessonId,
      scheduledAt: new Date(scheduledAt),
      duration,
      participantIds,
    });

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error('Error scheduling study session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule study session',
    });
  }
});

/**
 * GET /api/social/sessions
 * Get study sessions
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { groupId, status } = req.query;

    const sessions = await socialService.getStudySessions(
      userId,
      groupId as string,
      status as string
    );

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error('Error getting study sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get study sessions',
    });
  }
});

// ==================== Peer Recommendations ====================

/**
 * GET /api/social/recommendations
 * Get peer recommendations
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { courseId } = req.query;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'courseId is required',
      });
    }

    const recommendations = await socialService.getPeerRecommendations(
      userId,
      courseId as string
    );

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    logger.error('Error getting peer recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get peer recommendations',
    });
  }
});

export default router;
