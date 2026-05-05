/**
 * Instructor Portal Validation Schemas
 */

import Joi from 'joi';

export const dashboardQuerySchema = Joi.object({
  instructor_id: Joi.string().uuid().optional(),
  date_range: Joi.string().valid('7d', '30d', '90d', '1y').optional(),
  timezone: Joi.string().optional()
});

export const studentAnalyticsSchema = Joi.object({
  instructor_id: Joi.string().uuid().optional(),
  course_id: Joi.string().uuid().optional(),
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
  sort_by: Joi.string().valid('name', 'enrollment_date', 'progress', 'engagement').optional(),
  sort_order: Joi.string().valid('asc', 'desc').optional(),
  search: Joi.string().max(255).optional()
});

export const bulkUploadSchema = Joi.object({
  course_id: Joi.string().uuid().required(),
  batch_name: Joi.string().min(1).max(255).required(),
  processing_priority: Joi.string().valid('low', 'normal', 'high').optional(),
  auto_publish: Joi.boolean().optional(),
  notification_settings: Joi.object({
    notify_on_completion: Joi.boolean().optional(),
    notify_on_failure: Joi.boolean().optional(),
    email_notifications: Joi.boolean().optional()
  }).optional()
});

export const contentScheduleSchema = Joi.object({
  course_id: Joi.string().uuid().required(),
  content_id: Joi.string().uuid().required(),
  content_type: Joi.string().valid('video', 'quiz', 'assignment', 'resource').required(),
  scheduled_release: Joi.date().iso().min('now').required(),
  release_conditions: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('prerequisite', 'date', 'progress', 'quiz_score').required(),
      value: Joi.any().required(),
      description: Joi.string().max(500).optional()
    })
  ).optional(),
  timezone: Joi.string().optional(),
  notify_students: Joi.boolean().optional()
});

export const bulkOperationSchema = Joi.object({
  operation_type: Joi.string().valid(
    'send_message', 'update_grades', 'enroll_students', 'unenroll_students',
    'publish_content', 'unpublish_content', 'delete_content'
  ).required(),
  target_type: Joi.string().valid('students', 'content', 'courses').required(),
  target_ids: Joi.array().items(Joi.string().uuid()).min(1).max(1000).required(),
  parameters: Joi.object().required(),
  schedule_for: Joi.date().iso().optional(),
  confirmation_required: Joi.boolean().optional()
});

export const contentFiltersSchema = Joi.object({
  instructor_id: Joi.string().uuid().optional(),
  course_id: Joi.string().uuid().optional(),
  content_type: Joi.string().valid('video', 'quiz', 'assignment', 'resource', 'document').optional(),
  status: Joi.string().valid('draft', 'published', 'archived', 'processing').optional(),
  date_range: Joi.string().valid('7d', '30d', '90d', '1y').optional(),
  search: Joi.string().max(255).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
  sort_by: Joi.string().valid('created_at', 'title', 'views', 'engagement', 'rating').optional(),
  sort_order: Joi.string().valid('asc', 'desc').optional()
});

export const settingsUpdateSchema = Joi.object({
  notification_preferences: Joi.object({
    email_notifications: Joi.boolean().optional(),
    push_notifications: Joi.boolean().optional(),
    sms_notifications: Joi.boolean().optional(),
    notification_types: Joi.object().pattern(
      Joi.string(),
      Joi.boolean()
    ).optional(),
    quiet_hours: Joi.object({
      enabled: Joi.boolean().optional(),
      start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      timezone: Joi.string().optional()
    }).optional()
  }).optional(),
  dashboard_preferences: Joi.object({
    default_view: Joi.string().valid('overview', 'analytics', 'content', 'students').optional(),
    widgets: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        type: Joi.string().required(),
        position: Joi.object({
          x: Joi.number().required(),
          y: Joi.number().required()
        }).required(),
        size: Joi.object({
          width: Joi.number().min(1).required(),
          height: Joi.number().min(1).required()
        }).required(),
        settings: Joi.object().optional(),
        enabled: Joi.boolean().optional()
      })
    ).optional(),
    refresh_interval: Joi.number().min(30).max(3600).optional(),
    date_range_default: Joi.string().valid('7d', '30d', '90d', '1y').optional()
  }).optional(),
  content_preferences: Joi.object({
    auto_save_interval: Joi.number().min(10).max(300).optional(),
    default_video_quality: Joi.string().valid('240p', '480p', '720p', '1080p').optional(),
    enable_auto_transcription: Joi.boolean().optional(),
    enable_auto_captions: Joi.boolean().optional(),
    default_content_visibility: Joi.string().valid('public', 'enrolled', 'private').optional(),
    watermark_settings: Joi.object({
      enabled: Joi.boolean().optional(),
      text: Joi.string().max(100).optional(),
      image_url: Joi.string().uri().optional(),
      position: Joi.string().valid('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center').optional(),
      opacity: Joi.number().min(0).max(1).optional()
    }).optional()
  }).optional(),
  privacy_settings: Joi.object({
    profile_visibility: Joi.string().valid('public', 'students', 'private').optional(),
    show_student_progress: Joi.boolean().optional(),
    show_revenue_data: Joi.boolean().optional(),
    allow_student_contact: Joi.boolean().optional(),
    data_retention_days: Joi.number().min(30).max(2555).optional() // Max ~7 years
  }).optional()
});

export const liveSessionSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).optional(),
  course_id: Joi.string().uuid().optional(),
  scheduled_start: Joi.date().iso().min('now').required(),
  scheduled_end: Joi.date().iso().min(Joi.ref('scheduled_start')).required(),
  max_participants: Joi.number().min(1).max(10000).optional(),
  session_type: Joi.string().valid('live_class', 'webinar', 'office_hours', 'workshop').required(),
  is_recording_enabled: Joi.boolean().optional(),
  chat_enabled: Joi.boolean().optional(),
  q_and_a_enabled: Joi.boolean().optional(),
  breakout_rooms_enabled: Joi.boolean().optional(),
  waiting_room_enabled: Joi.boolean().optional(),
  registration_required: Joi.boolean().optional(),
  access_code: Joi.string().min(4).max(20).optional(),
  timezone: Joi.string().optional()
});

export const messageSchema = Joi.object({
  recipient_type: Joi.string().valid('student', 'group', 'course', 'all_students').required(),
  recipient_ids: Joi.array().items(Joi.string().uuid()).when('recipient_type', {
    is: Joi.valid('student', 'group'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  course_id: Joi.string().uuid().when('recipient_type', {
    is: 'course',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  subject: Joi.string().min(1).max(255).required(),
  message: Joi.string().min(1).max(5000).required(),
  message_type: Joi.string().valid('announcement', 'reminder', 'feedback', 'general').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  schedule_for: Joi.date().iso().optional(),
  include_attachments: Joi.boolean().optional(),
  require_acknowledgment: Joi.boolean().optional()
});

export const gradeUpdateSchema = Joi.object({
  student_id: Joi.string().uuid().required(),
  assignment_id: Joi.string().uuid().required(),
  score: Joi.number().min(0).required(),
  max_score: Joi.number().min(0).required(),
  feedback: Joi.string().max(2000).optional(),
  graded_at: Joi.date().iso().optional(),
  late_submission: Joi.boolean().optional(),
  extra_credit: Joi.number().min(0).optional()
});

export const collaborationInviteSchema = Joi.object({
  collaborator_email: Joi.string().email().required(),
  course_id: Joi.string().uuid().required(),
  role: Joi.string().valid('co_instructor', 'teaching_assistant', 'content_reviewer', 'guest_lecturer').required(),
  permissions: Joi.array().items(
    Joi.string().valid(
      'view_content', 'edit_content', 'publish_content', 'view_analytics',
      'manage_students', 'grade_assignments', 'conduct_sessions', 'manage_discussions'
    )
  ).min(1).required(),
  expires_at: Joi.date().iso().min('now').optional(),
  welcome_message: Joi.string().max(1000).optional()
});

export const contentTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  template_type: Joi.string().valid('course', 'module', 'lesson', 'quiz', 'assignment').required(),
  content_structure: Joi.object({
    sections: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        title: Joi.string().min(1).max(255).required(),
        type: Joi.string().valid('text', 'video', 'quiz', 'assignment', 'resource', 'discussion').required(),
        order: Joi.number().min(0).required(),
        required: Joi.boolean().optional(),
        content: Joi.any().optional(),
        validation_rules: Joi.array().items(
          Joi.object({
            field: Joi.string().required(),
            rule: Joi.string().required(),
            message: Joi.string().required()
          })
        ).optional()
      })
    ).required(),
    settings: Joi.object({
      auto_publish: Joi.boolean().optional(),
      require_approval: Joi.boolean().optional(),
      enable_comments: Joi.boolean().optional(),
      enable_ratings: Joi.boolean().optional(),
      drip_feed: Joi.boolean().optional(),
      drip_interval_days: Joi.number().min(1).optional()
    }).optional()
  }).required(),
  is_public: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
});