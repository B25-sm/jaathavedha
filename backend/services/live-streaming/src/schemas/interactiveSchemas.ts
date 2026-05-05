import { body, param, query } from 'express-validator';

export const sendChatMessageSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  body('messageType')
    .optional()
    .isIn(['text', 'system', 'announcement'])
    .withMessage('Invalid message type')
];

export const deleteChatMessageSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  param('messageId')
    .isUUID()
    .withMessage('Valid message ID is required')
];

export const getChatHistorySchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('before')
    .optional()
    .isISO8601()
    .withMessage('Valid date is required for before parameter')
];

export const askQuestionSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('question')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Question must be between 5 and 500 characters')
];

export const answerQuestionSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  param('questionId')
    .isUUID()
    .withMessage('Valid question ID is required'),
  body('answer')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Answer must be between 1 and 2000 characters')
];

export const upvoteQuestionSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  param('questionId')
    .isUUID()
    .withMessage('Valid question ID is required')
];

export const createPollSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('question')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Question must be between 5 and 200 characters'),
  body('options')
    .isArray({ min: 2, max: 10 })
    .withMessage('Poll must have between 2 and 10 options'),
  body('pollType')
    .isIn(['multiple_choice', 'yes_no', 'rating'])
    .withMessage('Invalid poll type'),
  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be a boolean'),
  body('allowMultiple')
    .optional()
    .isBoolean()
    .withMessage('allowMultiple must be a boolean')
];

export const votePollSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  param('pollId')
    .isUUID()
    .withMessage('Valid poll ID is required'),
  body('optionIds')
    .isArray({ min: 1 })
    .withMessage('At least one option must be selected'),
  body('optionIds.*')
    .isUUID()
    .withMessage('Valid option IDs are required')
];

export const raiseHandSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required')
];

export const handleHandRaiseSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  param('userId')
    .isUUID()
    .withMessage('Valid user ID is required'),
  body('action')
    .isIn(['accept', 'decline'])
    .withMessage('Action must be either accept or decline')
];

export const createSurveySchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Title must be between 3 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('surveyType')
    .isIn(['pre_session', 'mid_session', 'post_session'])
    .withMessage('Invalid survey type'),
  body('questions')
    .isArray({ min: 1, max: 20 })
    .withMessage('Survey must have between 1 and 20 questions'),
  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be a boolean')
];

export const submitSurveyResponseSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  param('surveyId')
    .isUUID()
    .withMessage('Valid survey ID is required'),
  body('responses')
    .isArray({ min: 1 })
    .withMessage('At least one response is required')
];

export const startScreenShareSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('shareType')
    .isIn(['screen', 'window', 'tab'])
    .withMessage('Invalid share type')
];

export const uploadPresentationSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Title must be between 3 and 255 characters'),
  body('fileUrl')
    .isURL()
    .withMessage('Valid file URL is required'),
  body('fileType')
    .isIn(['pdf', 'pptx'])
    .withMessage('File type must be pdf or pptx'),
  body('totalSlides')
    .isInt({ min: 1, max: 500 })
    .withMessage('Total slides must be between 1 and 500')
];

export const updatePresentationSlideSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  param('presentationId')
    .isUUID()
    .withMessage('Valid presentation ID is required'),
  body('slideNumber')
    .isInt({ min: 1 })
    .withMessage('Valid slide number is required')
];

export const manageParticipantSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  param('userId')
    .isUUID()
    .withMessage('Valid user ID is required'),
  body('action')
    .isIn(['mute', 'unmute', 'remove', 'ban', 'promote', 'demote'])
    .withMessage('Invalid action type'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters')
];

export const sendReactionSchema = [
  param('sessionId')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('reactionType')
    .isIn(['thumbs_up', 'thumbs_down', 'clap', 'confused', 'slow_down', 'speed_up'])
    .withMessage('Invalid reaction type')
];
