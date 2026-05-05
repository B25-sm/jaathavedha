import { body, param, query } from 'express-validator';

export const createSessionSchema = [
  body('courseId')
    .isUUID()
    .withMessage('Valid course ID is required'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Title must be between 3 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('scheduledStart')
    .isISO8601()
    .withMessage('Valid scheduled start date is required')
    .custom((value) => {
      const date = new Date(value);
      if (date < new Date()) {
        throw new Error('Scheduled start must be in the future');
      }
      return true;
    }),
  body('scheduledEnd')
    .isISO8601()
    .withMessage('Valid scheduled end date is required')
    .custom((value, { req }) => {
      const start = new Date(req.body.scheduledStart);
      const end = new Date(value);
      if (end <= start) {
        throw new Error('Scheduled end must be after scheduled start');
      }
      return true;
    }),
  body('maxParticipants')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Max participants must be between 1 and 10000'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  body('settings.enableChat')
    .optional()
    .isBoolean()
    .withMessage('enableChat must be a boolean'),
  body('settings.enableQA')
    .optional()
    .isBoolean()
    .withMessage('enableQA must be a boolean'),
  body('settings.enablePolls')
    .optional()
    .isBoolean()
    .withMessage('enablePolls must be a boolean'),
  body('settings.enableHandRaise')
    .optional()
    .isBoolean()
    .withMessage('enableHandRaise must be a boolean'),
  body('settings.enableScreenShare')
    .optional()
    .isBoolean()
    .withMessage('enableScreenShare must be a boolean'),
  body('settings.enableRecording')
    .optional()
    .isBoolean()
    .withMessage('enableRecording must be a boolean'),
  body('settings.autoRecord')
    .optional()
    .isBoolean()
    .withMessage('autoRecord must be a boolean'),
  body('settings.chatModeration')
    .optional()
    .isBoolean()
    .withMessage('chatModeration must be a boolean'),
  body('settings.requireApproval')
    .optional()
    .isBoolean()
    .withMessage('requireApproval must be a boolean')
];

export const updateSessionSchema = [
  param('id')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Title must be between 3 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('scheduledStart')
    .optional()
    .isISO8601()
    .withMessage('Valid scheduled start date is required'),
  body('scheduledEnd')
    .optional()
    .isISO8601()
    .withMessage('Valid scheduled end date is required'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Max participants must be between 1 and 10000'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object')
];

export const sessionIdSchema = [
  param('id')
    .isUUID()
    .withMessage('Valid session ID is required')
];

export const listSessionsSchema = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page size must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['scheduled', 'live', 'ended', 'cancelled'])
    .withMessage('Invalid status value'),
  query('courseId')
    .optional()
    .isUUID()
    .withMessage('Valid course ID is required'),
  query('instructorId')
    .optional()
    .isUUID()
    .withMessage('Valid instructor ID is required')
];

export const joinSessionSchema = [
  param('id')
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('deviceInfo')
    .optional()
    .isObject()
    .withMessage('Device info must be an object')
];
