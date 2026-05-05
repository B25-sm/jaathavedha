/**
 * Notification Validation Schemas
 * Joi schemas for push notification operations
 */

import Joi from 'joi';

export const registerDeviceSchema = {
  body: Joi.object({
    deviceId: Joi.string().required(),
    deviceType: Joi.string().valid('ios', 'android', 'web').required(),
    deviceName: Joi.string().required(),
    osVersion: Joi.string().required(),
    appVersion: Joi.string().required(),
    pushToken: Joi.string().optional(),
  }),
};

export const updatePushTokenSchema = {
  body: Joi.object({
    deviceId: Joi.string().required(),
    pushToken: Joi.string().required(),
  }),
};

export const sendNotificationSchema = {
  body: Joi.object({
    userIds: Joi.array().items(Joi.string()).optional(),
    deviceIds: Joi.array().items(Joi.string()).optional(),
    title: Joi.string().required().max(100),
    body: Joi.string().required().max(500),
    data: Joi.object().optional(),
    imageUrl: Joi.string().uri().optional(),
    actionUrl: Joi.string().uri().optional(),
    category: Joi.string()
      .valid('course_update', 'assignment', 'live_session', 'achievement', 'reminder', 'general')
      .required(),
    priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
    scheduledFor: Joi.date().iso().min('now').optional(),
  }).or('userIds', 'deviceIds'),
};

export const updateNotificationPreferencesSchema = {
  body: Joi.object({
    categories: Joi.array()
      .items(
        Joi.string().valid(
          'course_update',
          'assignment',
          'live_session',
          'achievement',
          'reminder',
          'general'
        )
      )
      .required(),
    enabled: Joi.boolean().required(),
    quietHoursStart: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),
    quietHoursEnd: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),
    timezone: Joi.string().optional(),
  }),
};

export const getNotificationsSchema = {
  query: Joi.object({
    status: Joi.string().valid('scheduled', 'sent', 'failed', 'cancelled').optional(),
    category: Joi.string()
      .valid('course_update', 'assignment', 'live_session', 'achievement', 'reminder', 'general')
      .optional(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
  }),
};
