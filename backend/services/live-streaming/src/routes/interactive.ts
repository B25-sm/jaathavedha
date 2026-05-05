import { Router, Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import InteractiveService from '../services/InteractiveService';
import {
  sendChatMessageSchema,
  deleteChatMessageSchema,
  getChatHistorySchema,
  askQuestionSchema,
  answerQuestionSchema,
  upvoteQuestionSchema,
  createPollSchema,
  votePollSchema,
  raiseHandSchema,
  handleHandRaiseSchema,
  createSurveySchema,
  submitSurveyResponseSchema,
  startScreenShareSchema,
  uploadPresentationSchema,
  updatePresentationSlideSchema,
  manageParticipantSchema,
  sendReactionSchema
} from '../schemas/interactiveSchemas';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// ==================== CHAT ROUTES ====================

/**
 * Send a chat message
 * POST /api/live/interactive/:sessionId/chat
 */
router.post(
  '/:sessionId/chat',
  sendChatMessageSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { message, messageType, moderationEnabled } = req.body;
      const userId = req.user?.id;
      const userName = req.user?.name;

      const chatMessage = await InteractiveService.sendChatMessage(
        sessionId,
        userId,
        userName,
        message,
        messageType,
        moderationEnabled
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('chat:message', chatMessage);

      res.status(201).json({
        success: true,
        data: chatMessage
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get chat history
 * GET /api/live/interactive/:sessionId/chat
 */
router.get(
  '/:sessionId/chat',
  getChatHistorySchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { limit, before } = req.query;

      const messages = await InteractiveService.getChatHistory(
        sessionId,
        limit ? parseInt(limit as string) : 100,
        before ? new Date(before as string) : undefined
      );

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a chat message
 * DELETE /api/live/interactive/:sessionId/chat/:messageId
 */
router.delete(
  '/:sessionId/chat/:messageId',
  deleteChatMessageSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, messageId } = req.params;

      await InteractiveService.deleteChatMessage(sessionId, messageId);

      // Emit via WebSocket
      req.io?.to(sessionId).emit('chat:deleted', { messageId });

      res.json({
        success: true,
        message: 'Chat message deleted'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Pin a chat message
 * POST /api/live/interactive/:sessionId/chat/:messageId/pin
 */
router.post(
  '/:sessionId/chat/:messageId/pin',
  deleteChatMessageSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, messageId } = req.params;

      await InteractiveService.pinChatMessage(sessionId, messageId);

      // Emit via WebSocket
      req.io?.to(sessionId).emit('chat:pinned', { messageId });

      res.json({
        success: true,
        message: 'Chat message pinned'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== Q&A ROUTES ====================

/**
 * Ask a question
 * POST /api/live/interactive/:sessionId/qa
 */
router.post(
  '/:sessionId/qa',
  askQuestionSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { question } = req.body;
      const userId = req.user?.id;
      const userName = req.user?.name;

      const qaQuestion = await InteractiveService.askQuestion(
        sessionId,
        userId,
        userName,
        question
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('qa:question', qaQuestion);

      res.status(201).json({
        success: true,
        data: qaQuestion
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Answer a question
 * POST /api/live/interactive/:sessionId/qa/:questionId/answer
 */
router.post(
  '/:sessionId/qa/:questionId/answer',
  answerQuestionSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, questionId } = req.params;
      const { answer } = req.body;
      const answeredBy = req.user?.name;

      const qaQuestion = await InteractiveService.answerQuestion(
        sessionId,
        questionId,
        answer,
        answeredBy
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('qa:answered', qaQuestion);

      res.json({
        success: true,
        data: qaQuestion
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upvote a question
 * POST /api/live/interactive/:sessionId/qa/:questionId/upvote
 */
router.post(
  '/:sessionId/qa/:questionId/upvote',
  upvoteQuestionSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, questionId } = req.params;
      const userId = req.user?.id;

      const qaQuestion = await InteractiveService.upvoteQuestion(
        sessionId,
        questionId,
        userId
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('qa:upvoted', qaQuestion);

      res.json({
        success: true,
        data: qaQuestion
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Q&A questions
 * GET /api/live/interactive/:sessionId/qa
 */
router.get(
  '/:sessionId/qa',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { filter } = req.query;

      const questions = await InteractiveService.getQuestions(
        sessionId,
        filter as 'all' | 'answered' | 'unanswered'
      );

      res.json({
        success: true,
        data: questions
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== POLL ROUTES ====================

/**
 * Create a poll
 * POST /api/live/interactive/:sessionId/polls
 */
router.post(
  '/:sessionId/polls',
  createPollSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { question, options, pollType, isAnonymous, allowMultiple } = req.body;
      const createdBy = req.user?.name;

      const poll = await InteractiveService.createPoll(
        sessionId,
        createdBy,
        question,
        options,
        pollType,
        isAnonymous,
        allowMultiple
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('poll:created', poll);

      res.status(201).json({
        success: true,
        data: poll
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Vote on a poll
 * POST /api/live/interactive/:sessionId/polls/:pollId/vote
 */
router.post(
  '/:sessionId/polls/:pollId/vote',
  votePollSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, pollId } = req.params;
      const { optionIds } = req.body;
      const userId = req.user?.id;

      const poll = await InteractiveService.votePoll(
        sessionId,
        pollId,
        userId,
        optionIds
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('poll:updated', poll);

      res.json({
        success: true,
        data: poll
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Close a poll
 * POST /api/live/interactive/:sessionId/polls/:pollId/close
 */
router.post(
  '/:sessionId/polls/:pollId/close',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, pollId } = req.params;

      const poll = await InteractiveService.closePoll(sessionId, pollId);

      // Emit via WebSocket
      req.io?.to(sessionId).emit('poll:closed', poll);

      res.json({
        success: true,
        data: poll
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get polls
 * GET /api/live/interactive/:sessionId/polls
 */
router.get(
  '/:sessionId/polls',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const polls = await InteractiveService.getPolls(sessionId);

      res.json({
        success: true,
        data: polls
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== SURVEY ROUTES ====================

/**
 * Create a survey
 * POST /api/live/interactive/:sessionId/surveys
 */
router.post(
  '/:sessionId/surveys',
  createSurveySchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { title, description, surveyType, questions, isAnonymous } = req.body;
      const createdBy = req.user?.name;

      const survey = await InteractiveService.createSurvey(
        sessionId,
        createdBy,
        title,
        description,
        surveyType,
        questions,
        isAnonymous
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('survey:created', survey);

      res.status(201).json({
        success: true,
        data: survey
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Submit survey response
 * POST /api/live/interactive/:sessionId/surveys/:surveyId/respond
 */
router.post(
  '/:sessionId/surveys/:surveyId/respond',
  submitSurveyResponseSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, surveyId } = req.params;
      const { responses } = req.body;
      const userId = req.user?.id;

      const response = await InteractiveService.submitSurveyResponse(
        sessionId,
        surveyId,
        userId,
        responses
      );

      res.status(201).json({
        success: true,
        data: response
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get survey results
 * GET /api/live/interactive/:sessionId/surveys/:surveyId/results
 */
router.get(
  '/:sessionId/surveys/:surveyId/results',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, surveyId } = req.params;

      const results = await InteractiveService.getSurveyResults(sessionId, surveyId);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== HAND RAISE ROUTES ====================

/**
 * Raise hand
 * POST /api/live/interactive/:sessionId/hand-raise
 */
router.post(
  '/:sessionId/hand-raise',
  raiseHandSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.name;

      const handRaise = await InteractiveService.raiseHand(
        sessionId,
        userId,
        userName
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('hand:raised', handRaise);

      res.status(201).json({
        success: true,
        data: handRaise
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Lower hand
 * DELETE /api/live/interactive/:sessionId/hand-raise
 */
router.delete(
  '/:sessionId/hand-raise',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.id;

      await InteractiveService.lowerHand(sessionId, userId);

      // Emit via WebSocket
      req.io?.to(sessionId).emit('hand:lowered', { userId });

      res.json({
        success: true,
        message: 'Hand lowered'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Handle hand raise (accept/decline)
 * POST /api/live/interactive/:sessionId/hand-raise/:userId/handle
 */
router.post(
  '/:sessionId/hand-raise/:userId/handle',
  handleHandRaiseSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, userId } = req.params;
      const { action } = req.body;

      if (action === 'accept') {
        const handRaise = await InteractiveService.acceptHandRaise(sessionId, userId);
        req.io?.to(sessionId).emit('hand:accepted', handRaise);
        
        res.json({
          success: true,
          data: handRaise
        });
      } else {
        await InteractiveService.declineHandRaise(sessionId, userId);
        req.io?.to(sessionId).emit('hand:declined', { userId });
        
        res.json({
          success: true,
          message: 'Hand raise declined'
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get hand raise queue
 * GET /api/live/interactive/:sessionId/hand-raise
 */
router.get(
  '/:sessionId/hand-raise',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const queue = await InteractiveService.getHandRaiseQueue(sessionId);

      res.json({
        success: true,
        data: queue
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== SCREEN SHARING ROUTES ====================

/**
 * Start screen sharing
 * POST /api/live/interactive/:sessionId/screen-share
 */
router.post(
  '/:sessionId/screen-share',
  startScreenShareSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { shareType } = req.body;
      const userId = req.user?.id;
      const userName = req.user?.name;

      const screenShare = await InteractiveService.startScreenShare(
        sessionId,
        userId,
        userName,
        shareType
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('screen:started', screenShare);

      res.status(201).json({
        success: true,
        data: screenShare
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Stop screen sharing
 * DELETE /api/live/interactive/:sessionId/screen-share
 */
router.delete(
  '/:sessionId/screen-share',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.id;

      await InteractiveService.stopScreenShare(sessionId, userId);

      // Emit via WebSocket
      req.io?.to(sessionId).emit('screen:stopped', { userId });

      res.json({
        success: true,
        message: 'Screen sharing stopped'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== PRESENTATION ROUTES ====================

/**
 * Upload presentation
 * POST /api/live/interactive/:sessionId/presentations
 */
router.post(
  '/:sessionId/presentations',
  uploadPresentationSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { title, fileUrl, fileType, totalSlides } = req.body;
      const uploadedBy = req.user?.name;

      const presentation = await InteractiveService.uploadPresentation(
        sessionId,
        uploadedBy,
        title,
        fileUrl,
        fileType,
        totalSlides
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('presentation:uploaded', presentation);

      res.status(201).json({
        success: true,
        data: presentation
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update presentation slide
 * PUT /api/live/interactive/:sessionId/presentations/:presentationId/slide
 */
router.put(
  '/:sessionId/presentations/:presentationId/slide',
  updatePresentationSlideSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, presentationId } = req.params;
      const { slideNumber } = req.body;

      const presentation = await InteractiveService.updatePresentationSlide(
        sessionId,
        presentationId,
        slideNumber
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('presentation:slide-changed', {
        presentationId,
        slideNumber
      });

      res.json({
        success: true,
        data: presentation
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== PARTICIPANT MANAGEMENT ROUTES ====================

/**
 * Manage participant (mute, remove, ban, promote)
 * POST /api/live/interactive/:sessionId/participants/:userId/manage
 */
router.post(
  '/:sessionId/participants/:userId/manage',
  manageParticipantSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId, userId } = req.params;
      const { action, reason } = req.body;
      const actionBy = req.user?.name;

      await InteractiveService.manageParticipant(
        sessionId,
        userId,
        actionBy,
        action,
        reason
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('participant:action', {
        userId,
        action,
        actionBy
      });

      res.json({
        success: true,
        message: `Participant ${action} successful`
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== REACTION ROUTES ====================

/**
 * Send real-time reaction
 * POST /api/live/interactive/:sessionId/reactions
 */
router.post(
  '/:sessionId/reactions',
  sendReactionSchema,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { reactionType } = req.body;
      const userId = req.user?.id;

      const reaction = await InteractiveService.sendReaction(
        sessionId,
        userId,
        reactionType
      );

      // Emit via WebSocket
      req.io?.to(sessionId).emit('reaction:sent', reaction);

      res.status(201).json({
        success: true,
        data: reaction
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
