/**
 * Validation Schemas for Interactive Learning Features
 */

import Joi from 'joi';

// Quiz schemas
export const createQuizSchema = {
  body: Joi.object({
    timestamp: Joi.number().min(0).required(),
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(1000).optional(),
    questions: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        type: Joi.string().valid('multiple_choice', 'true_false', 'short_answer').required(),
        question: Joi.string().min(5).max(1000).required(),
        options: Joi.array().items(Joi.string()).when('type', {
          is: 'multiple_choice',
          then: Joi.required().min(2).max(6),
          otherwise: Joi.optional()
        }),
        correct_answer: Joi.alternatives().try(
          Joi.string(),
          Joi.array().items(Joi.string())
        ).required(),
        points: Joi.number().min(1).max(100).default(10)
      })
    ).min(1).max(20).required(),
    passing_score: Joi.number().min(0).max(100).default(70),
    time_limit: Joi.number().min(30).max(3600).optional()
  })
};

export const submitQuizAttemptSchema = {
  body: Joi.object({
    answers: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()))
    ).required()
  })
};

// Note schemas
export const createNoteSchema = {
  body: Joi.object({
    timestamp: Joi.number().min(0).required(),
    content: Joi.string().min(1).max(5000).required(),
    is_public: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
  })
};

export const updateNoteSchema = {
  body: Joi.object({
    content: Joi.string().min(1).max(5000).optional(),
    is_public: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
  }).min(1)
};

// Bookmark schemas
export const createBookmarkSchema = {
  body: Joi.object({
    timestamp: Joi.number().min(0).required(),
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(500).optional()
  })
};

export const updateBookmarkSchema = {
  body: Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    description: Joi.string().max(500).optional(),
    timestamp: Joi.number().min(0).optional()
  }).min(1)
};

// Comment schemas
export const createCommentSchema = {
  body: Joi.object({
    content: Joi.string().min(1).max(2000).required(),
    timestamp: Joi.number().min(0).optional(),
    parent_id: Joi.string().uuid().optional()
  })
};

export const voteCommentSchema = {
  body: Joi.object({
    vote_type: Joi.string().valid('upvote', 'downvote').required()
  })
};

// Legacy export for backward compatibility
export const interactiveSchemas = {
  createQuiz: createQuizSchema,
  submitQuizAttempt: submitQuizAttemptSchema,
  createNote: createNoteSchema,
  updateNote: updateNoteSchema,
  createBookmark: createBookmarkSchema,
  updateBookmark: updateBookmarkSchema,
  createComment: createCommentSchema,
  voteComment: voteCommentSchema,
};

