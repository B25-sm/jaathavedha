/**
 * Download Validation Schemas
 * Joi schemas for video download operations
 */

import Joi from 'joi';

export const downloadRequestSchema = {
  body: Joi.object({
    contentType: Joi.string().valid('video', 'document').required(),
    contentId: Joi.string().required(),
    courseId: Joi.string().required(),
    quality: Joi.string().valid('240p', '480p', '720p', '1080p').optional(),
    wifiOnly: Joi.boolean().default(true),
  }),
};

export const batchDownloadSchema = {
  body: Joi.object({
    downloads: Joi.array()
      .items(
        Joi.object({
          contentType: Joi.string().valid('video', 'document').required(),
          contentId: Joi.string().required(),
          courseId: Joi.string().required(),
          quality: Joi.string().valid('240p', '480p', '720p', '1080p').optional(),
          wifiOnly: Joi.boolean().default(true),
        })
      )
      .min(1)
      .max(10)
      .required(),
  }),
};

export const updateDownloadSchema = {
  params: Joi.object({
    downloadId: Joi.string().required(),
  }),
  body: Joi.object({
    status: Joi.string().valid('paused', 'cancelled', 'resumed').required(),
  }),
};

export const getDownloadsSchema = {
  query: Joi.object({
    status: Joi.string()
      .valid('queued', 'downloading', 'completed', 'failed', 'paused')
      .optional(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
  }),
};
