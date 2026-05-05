/**
 * Validation Schemas for Assessment Features
 */

import Joi from 'joi';

export const assessmentSchemas = {
  // Assessment schemas
  createAssessment: {
    body: Joi.object({
      courseId: Joi.string().uuid().required(),
      title: Joi.string().min(5).max(200).required(),
      description: Joi.string().min(10).max(2000).required(),
      type: Joi.string().valid('quiz', 'exam', 'practice', 'adaptive').required(),
      duration: Joi.number().min(60).max(14400).required(), // 1 min to 4 hours
      passingScore: Joi.number().min(0).max(100).default(70),
      questions: Joi.array().items(
        Joi.object({
          type: Joi.string().valid('multiple-choice', 'multiple-select', 'true-false', 'short-answer', 'essay', 'code').required(),
          question: Joi.string().min(5).max(2000).required(),
          options: Joi.array().items(Joi.string()).when('type', {
            is: Joi.string().valid('multiple-choice', 'multiple-select'),
            then: Joi.required().min(2).max(10),
            otherwise: Joi.optional()
          }),
          correctAnswer: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
          ).required(),
          explanation: Joi.string().max(2000).optional(),
          points: Joi.number().min(1).max(100).default(10),
          difficulty: Joi.string().valid('easy', 'medium', 'hard').default('medium'),
          tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
        })
      ).min(1).max(100).required(),
      randomizeQuestions: Joi.boolean().default(false),
      randomizeOptions: Joi.boolean().default(false),
      showFeedback: Joi.boolean().default(true),
      allowRetake: Joi.boolean().default(true),
      maxAttempts: Joi.number().min(1).max(10).default(3)
    })
  },

  updateAssessment: {
    body: Joi.object({
      title: Joi.string().min(5).max(200).optional(),
      description: Joi.string().min(10).max(2000).optional(),
      duration: Joi.number().min(60).max(14400).optional(),
      passingScore: Joi.number().min(0).max(100).optional(),
      randomizeQuestions: Joi.boolean().optional(),
      randomizeOptions: Joi.boolean().optional(),
      showFeedback: Joi.boolean().optional(),
      allowRetake: Joi.boolean().optional(),
      maxAttempts: Joi.number().min(1).max(10).optional()
    }).min(1)
  },

  // Assessment attempt schemas
  startAssessment: {
    body: Joi.object({
      assessmentId: Joi.string().uuid().required()
    })
  },

  submitAssessment: {
    body: Joi.object({
      answers: Joi.object().pattern(
        Joi.string(),
        Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()))
      ).required()
    })
  },

  // Flashcard schemas
  createFlashcard: {
    body: Joi.object({
      courseId: Joi.string().uuid().required(),
      front: Joi.string().min(1).max(1000).required(),
      back: Joi.string().min(1).max(2000).required(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      difficulty: Joi.string().valid('easy', 'medium', 'hard').default('medium')
    })
  },

  updateFlashcard: {
    body: Joi.object({
      front: Joi.string().min(1).max(1000).optional(),
      back: Joi.string().min(1).max(2000).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      difficulty: Joi.string().valid('easy', 'medium', 'hard').optional()
    }).min(1)
  },

  reviewFlashcard: {
    body: Joi.object({
      quality: Joi.number().min(0).max(5).required() // SM-2 algorithm quality rating
    })
  },

  // Adaptive learning schemas
  updateLearningPath: {
    body: Joi.object({
      strengths: Joi.array().items(Joi.string().max(100)).optional(),
      weaknesses: Joi.array().items(Joi.string().max(100)).optional(),
      learningStyle: Joi.string().valid('visual', 'auditory', 'kinesthetic', 'reading').optional(),
      pace: Joi.string().valid('slow', 'normal', 'fast').optional()
    }).min(1)
  }
};
