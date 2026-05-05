/**
 * Video Streaming Validation Schemas
 */

import Joi from 'joi';

export const videoUploadSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).optional(),
  course_id: Joi.string().uuid().required(),
  chapters: Joi.array().items(
    Joi.object({
      title: Joi.string().min(1).max(255).required(),
      start_time: Joi.number().min(0).required(),
      end_time: Joi.number().min(0).required(),
      description: Joi.string().max(500).optional()
    })
  ).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  watermark_enabled: Joi.boolean().optional()
});

export const videoAnalyticsSchema = Joi.object({
  session_id: Joi.string().optional(),
  watch_time: Joi.number().min(0).required(),
  total_duration: Joi.number().min(0).required(),
  completion_percentage: Joi.number().min(0).max(100).required(),
  quality_changes: Joi.array().items(
    Joi.object({
      timestamp: Joi.number().min(0).required(),
      from_quality: Joi.string().required(),
      to_quality: Joi.string().required(),
      reason: Joi.string().valid('auto', 'manual').required()
    })
  ).optional(),
  interactions: Joi.array().items(
    Joi.object({
      type: Joi.string().valid(
        'play', 'pause', 'seek', 'speed_change', 'quality_change', 
        'fullscreen', 'note_added', 'bookmark_added', 'quiz_answered'
      ).required(),
      timestamp: Joi.number().min(0).required(),
      data: Joi.any().optional()
    })
  ).optional(),
  screen_resolution: Joi.string().optional(),
  network_type: Joi.string().optional(),
  bandwidth: Joi.number().min(0).optional()
});

export const noteSchema = Joi.object({
  timestamp: Joi.number().min(0).required(),
  content: Joi.string().min(1).max(1000).required(),
  is_public: Joi.boolean().optional()
});

export const bookmarkSchema = Joi.object({
  timestamp: Joi.number().min(0).required(),
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(500).optional()
});

export const bulkUploadSchema = Joi.object({
  videos: Joi.array().items(videoUploadSchema).min(1).max(50).required(),
  course_id: Joi.string().uuid().required(),
  processing_priority: Joi.string().valid('low', 'normal', 'high').optional()
});

export const liveStreamSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).optional(),
  course_id: Joi.string().uuid().optional(),
  scheduled_start: Joi.date().iso().required(),
  scheduled_end: Joi.date().iso().min(Joi.ref('scheduled_start')).required(),
  max_viewers: Joi.number().min(1).max(10000).optional(),
  is_recording_enabled: Joi.boolean().optional(),
  chat_enabled: Joi.boolean().optional(),
  q_and_a_enabled: Joi.boolean().optional()
});

export const videoFiltersSchema = Joi.object({
  course_id: Joi.string().uuid().optional(),
  instructor_id: Joi.string().uuid().optional(),
  status: Joi.string().valid('uploading', 'processing', 'ready', 'failed', 'archived').optional(),
  search: Joi.string().max(255).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().min(Joi.ref('date_from')).optional(),
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
  sort_by: Joi.string().valid('created_at', 'title', 'duration', 'status').optional(),
  sort_order: Joi.string().valid('asc', 'desc').optional()
});