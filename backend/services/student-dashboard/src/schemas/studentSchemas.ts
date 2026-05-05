/**
 * Student Dashboard Validation Schemas
 */

import Joi from 'joi';

export const progressUpdateSchema = Joi.object({
  student_id: Joi.string().uuid().optional(),
  course_id: Joi.string().uuid().required(),
  lesson_id: Joi.string().uuid().required(),
  progress_data: Joi.object({
    completion_percentage: Joi.number().min(0).max(100).required(),
    time_spent: Joi.number().min(0).required(), // seconds
    quiz_scores: Joi.array().items(
      Joi.object({
        quiz_id: Joi.string().uuid().required(),
        score: Joi.number().min(0).required(),
        max_score: Joi.number().min(0).required(),
        attempts: Joi.number().min(1).required(),
        completed_at: Joi.date().iso().required()
      })
    ).optional(),
    interactions: Joi.array().items(
      Joi.object({
        type: Joi.string().valid(
          'play', 'pause', 'seek', 'speed_change', 'quality_change',
          'note_added', 'bookmark_added', 'quiz_answered'
        ).required(),
        timestamp: Joi.number().min(0).required(),
        data: Joi.any().optional()
      })
    ).optional(),
    notes: Joi.array().items(
      Joi.object({
        timestamp: Joi.number().min(0).required(),
        content: Joi.string().min(1).max(1000).required(),
        is_public: Joi.boolean().optional()
      })
    ).optional(),
    bookmarks: Joi.array().items(
      Joi.object({
        timestamp: Joi.number().min(0).required(),
        title: Joi.string().min(1).max(255).required(),
        description: Joi.string().max(500).optional()
      })
    ).optional()
  }).required()
});

export const recommendationRequestSchema = Joi.object({
  student_id: Joi.string().uuid().optional(),
  type: Joi.string().valid('courses', 'study', 'content', 'paths').optional(),
  limit: Joi.number().min(1).max(50).optional(),
  filters: Joi.object({
    difficulty_level: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    category: Joi.string().max(100).optional(),
    duration_max: Joi.number().min(0).optional(), // hours
    price_max: Joi.number().min(0).optional(),
    instructor_id: Joi.string().uuid().optional(),
    tags: Joi.array().items(Joi.string().max(50)).optional()
  }).optional()
});

export const socialActionSchema = Joi.object({
  action_type: Joi.string().valid(
    'join_group', 'leave_group', 'connect_peer', 'accept_connection',
    'decline_connection', 'post_discussion', 'like_post', 'share_content'
  ).required(),
  target_id: Joi.string().uuid().required(),
  data: Joi.object().optional(),
  message: Joi.string().max(1000).optional()
});

export const learningGoalsSchema = Joi.object({
  student_id: Joi.string().uuid().optional(),
  goals: Joi.array().items(
    Joi.object({
      title: Joi.string().min(1).max(255).required(),
      description: Joi.string().max(1000).optional(),
      category: Joi.string().valid(
        'skill_development', 'career_advancement', 'certification',
        'personal_interest', 'academic_requirement'
      ).required(),
      priority: Joi.string().valid('low', 'medium', 'high').optional(),
      target_date: Joi.date().iso().min('now').optional(),
      success_criteria: Joi.array().items(Joi.string().max(255)).optional()
    })
  ).min(1).max(10).required(),
  target_completion_date: Joi.date().iso().min('now').optional(),
  preferred_pace: Joi.string().valid('slow', 'moderate', 'fast', 'intensive').optional(),
  study_schedule: Joi.object({
    preferred_days: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).min(1).required(),
    preferred_times: Joi.array().items(
      Joi.object({
        start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
        end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
        timezone: Joi.string().optional()
      })
    ).min(1).required(),
    daily_goal_minutes: Joi.number().min(15).max(480).required(),
    break_intervals: Joi.number().min(5).max(60).optional()
  }).optional()
});

export const studyGroupSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).required(),
  course_id: Joi.string().uuid().required(),
  max_members: Joi.number().min(2).max(50).optional(),
  is_private: Joi.boolean().optional(),
  meeting_schedule: Joi.object({
    frequency: Joi.string().valid('daily', 'weekly', 'biweekly', 'monthly').optional(),
    day_of_week: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').optional(),
    time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    timezone: Joi.string().optional(),
    duration_minutes: Joi.number().min(30).max(180).optional()
  }).optional(),
  group_rules: Joi.array().items(Joi.string().max(255)).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
});

export const peerConnectionSchema = Joi.object({
  peer_id: Joi.string().uuid().required(),
  connection_type: Joi.string().valid('study_buddy', 'mentor', 'mentee', 'classmate', 'friend').required(),
  message: Joi.string().min(1).max(500).required(),
  shared_interests: Joi.array().items(Joi.string().max(100)).optional(),
  availability: Joi.object({
    days: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).optional(),
    times: Joi.array().items(
      Joi.object({
        start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
        end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
      })
    ).optional(),
    timezone: Joi.string().optional()
  }).optional()
});

export const discussionPostSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required(),
  parent_post_id: Joi.string().uuid().optional(),
  attachments: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('image', 'document', 'link').required(),
      url: Joi.string().uri().required(),
      title: Joi.string().max(255).optional(),
      description: Joi.string().max(500).optional()
    })
  ).max(5).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(5).optional(),
  is_question: Joi.boolean().optional(),
  is_anonymous: Joi.boolean().optional()
});

export const mentorshipRequestSchema = Joi.object({
  mentor_id: Joi.string().uuid().required(),
  message: Joi.string().min(10).max(1000).required(),
  expertise_areas: Joi.array().items(Joi.string().max(100)).min(1).max(10).required(),
  learning_goals: Joi.array().items(Joi.string().max(255)).min(1).max(5).required(),
  availability: Joi.object({
    hours_per_week: Joi.number().min(1).max(20).required(),
    preferred_days: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).min(1).required(),
    preferred_times: Joi.array().items(
      Joi.object({
        start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
        end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
      })
    ).min(1).required(),
    timezone: Joi.string().required()
  }).required(),
  mentorship_duration: Joi.string().valid('1_month', '3_months', '6_months', '1_year', 'ongoing').required(),
  communication_preferences: Joi.object({
    video_calls: Joi.boolean().optional(),
    voice_calls: Joi.boolean().optional(),
    text_chat: Joi.boolean().optional(),
    email: Joi.boolean().optional(),
    in_person: Joi.boolean().optional()
  }).optional()
});

export const achievementClaimSchema = Joi.object({
  achievement_id: Joi.string().uuid().required(),
  evidence: Joi.object({
    type: Joi.string().valid('completion', 'score', 'time', 'streak', 'social').required(),
    data: Joi.object().required(),
    verification_url: Joi.string().uri().optional()
  }).optional()
});

export const studySessionSchema = Joi.object({
  course_id: Joi.string().uuid().required(),
  session_type: Joi.string().valid('video', 'reading', 'quiz', 'assignment', 'discussion', 'practice').required(),
  planned_duration: Joi.number().min(5).max(480).required(), // minutes
  learning_objectives: Joi.array().items(Joi.string().max(255)).optional(),
  study_method: Joi.string().valid('focused', 'pomodoro', 'spaced', 'active_recall', 'mixed').optional(),
  environment: Joi.object({
    location: Joi.string().valid('home', 'library', 'cafe', 'office', 'other').optional(),
    noise_level: Joi.string().valid('silent', 'quiet', 'moderate', 'noisy').optional(),
    distractions: Joi.array().items(Joi.string().max(100)).optional()
  }).optional(),
  resources: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('video', 'document', 'website', 'book', 'tool').required(),
      title: Joi.string().max(255).required(),
      url: Joi.string().uri().optional()
    })
  ).optional()
});

export const feedbackSchema = Joi.object({
  target_type: Joi.string().valid('course', 'instructor', 'content', 'platform', 'feature').required(),
  target_id: Joi.string().uuid().optional(),
  feedback_type: Joi.string().valid('bug_report', 'feature_request', 'improvement', 'compliment', 'complaint').required(),
  rating: Joi.number().min(1).max(5).optional(),
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().min(10).max(2000).required(),
  category: Joi.string().max(100).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  attachments: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('image', 'document', 'video', 'audio').required(),
      url: Joi.string().uri().required(),
      description: Joi.string().max(255).optional()
    })
  ).max(5).optional(),
  is_anonymous: Joi.boolean().optional()
});