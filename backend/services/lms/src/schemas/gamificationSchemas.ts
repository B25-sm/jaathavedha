/**
 * Validation Schemas for Gamification Features
 */

import Joi from 'joi';

export const gamificationSchemas = {
  // Points schemas
  awardPoints: {
    body: Joi.object({
      userId: Joi.string().uuid().required(),
      points: Joi.number().integer().min(1).max(10000).required(),
      action: Joi.string().max(100).required(),
      description: Joi.string().max(500).required(),
      metadata: Joi.object().optional()
    })
  },

  // Badge schemas
  createBadge: {
    body: Joi.object({
      name: Joi.string().min(3).max(100).required(),
      description: Joi.string().min(10).max(500).required(),
      icon: Joi.string().uri().required(),
      category: Joi.string().valid('achievement', 'milestone', 'special').required(),
      criteria: Joi.object({
        type: Joi.string().valid('points', 'courses', 'streak', 'quiz', 'custom').required(),
        threshold: Joi.number().min(1).optional(),
        conditions: Joi.object().optional()
      }).required(),
      rarity: Joi.string().valid('common', 'rare', 'epic', 'legendary').default('common'),
      points: Joi.number().min(0).max(1000).default(0)
    })
  },

  // Achievement schemas
  createAchievement: {
    body: Joi.object({
      name: Joi.string().min(3).max(100).required(),
      description: Joi.string().min(10).max(500).required(),
      icon: Joi.string().uri().required(),
      type: Joi.string().valid('course', 'quiz', 'assignment', 'social', 'streak').required(),
      requirement: Joi.number().min(1).required(),
      points: Joi.number().min(0).max(1000).default(0)
    })
  },

  // Leaderboard query schemas
  getLeaderboard: {
    query: Joi.object({
      period: Joi.string().valid('daily', 'weekly', 'monthly', 'all-time').default('weekly'),
      scope: Joi.string().valid('global', 'course').default('global'),
      scopeId: Joi.string().uuid().when('scope', {
        is: 'course',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      limit: Joi.number().min(1).max(100).default(50)
    })
  },

  // Streak schemas
  freezeStreak: {
    body: Joi.object({
      date: Joi.date().iso().optional()
    })
  },

  // Flashcard schemas
  createFlashcard: {
    body: Joi.object({
      front: Joi.string().min(1).max(1000).required(),
      back: Joi.string().min(1).max(2000).required(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).default([]),
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
      quality: Joi.number().integer().min(0).max(5).required(),
      timeSpent: Joi.number().integer().min(0).max(600).default(0)
    })
  }
};
