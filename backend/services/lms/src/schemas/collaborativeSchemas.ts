/**
 * Validation Schemas for Collaborative Learning Features
 */

import Joi from 'joi';

export const collaborativeSchemas = {
  // Forum schemas
  createForum: {
    body: Joi.object({
      courseId: Joi.string().uuid().required(),
      title: Joi.string().min(5).max(200).required(),
      description: Joi.string().min(10).max(1000).required(),
      category: Joi.string().max(50).required()
    })
  },

  updateForum: {
    body: Joi.object({
      title: Joi.string().min(5).max(200).optional(),
      description: Joi.string().min(10).max(1000).optional(),
      category: Joi.string().max(50).optional(),
      isLocked: Joi.boolean().optional()
    }).min(1)
  },

  // Forum post schemas
  createPost: {
    body: Joi.object({
      title: Joi.string().min(5).max(200).required(),
      content: Joi.string().min(10).max(10000).required(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
    })
  },

  updatePost: {
    body: Joi.object({
      title: Joi.string().min(5).max(200).optional(),
      content: Joi.string().min(10).max(10000).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
    }).min(1)
  },

  // Forum reply schemas
  createReply: {
    body: Joi.object({
      content: Joi.string().min(1).max(5000).required()
    })
  },

  // Study group schemas
  createStudyGroup: {
    body: Joi.object({
      courseId: Joi.string().uuid().required(),
      name: Joi.string().min(3).max(100).required(),
      description: Joi.string().min(10).max(1000).required(),
      maxMembers: Joi.number().min(2).max(50).default(10),
      isPrivate: Joi.boolean().default(false)
    })
  },

  updateStudyGroup: {
    body: Joi.object({
      name: Joi.string().min(3).max(100).optional(),
      description: Joi.string().min(10).max(1000).optional(),
      maxMembers: Joi.number().min(2).max(50).optional(),
      isPrivate: Joi.boolean().optional()
    }).min(1)
  },

  // Assignment schemas
  createAssignment: {
    body: Joi.object({
      courseId: Joi.string().uuid().required(),
      title: Joi.string().min(5).max(200).required(),
      description: Joi.string().min(10).max(2000).required(),
      instructions: Joi.string().min(10).max(5000).required(),
      dueDate: Joi.date().iso().greater('now').required(),
      maxScore: Joi.number().min(1).max(1000).default(100),
      allowLateSubmission: Joi.boolean().default(true),
      peerReviewRequired: Joi.boolean().default(false),
      peerReviewCount: Joi.number().min(1).max(5).default(2)
    })
  },

  updateAssignment: {
    body: Joi.object({
      title: Joi.string().min(5).max(200).optional(),
      description: Joi.string().min(10).max(2000).optional(),
      instructions: Joi.string().min(10).max(5000).optional(),
      dueDate: Joi.date().iso().optional(),
      maxScore: Joi.number().min(1).max(1000).optional(),
      allowLateSubmission: Joi.boolean().optional(),
      peerReviewRequired: Joi.boolean().optional(),
      peerReviewCount: Joi.number().min(1).max(5).optional()
    }).min(1)
  },

  // Assignment submission schemas
  submitAssignment: {
    body: Joi.object({
      content: Joi.string().min(10).max(50000).required(),
      attachments: Joi.array().items(Joi.string().uri()).max(10).optional()
    })
  },

  gradeSubmission: {
    body: Joi.object({
      score: Joi.number().min(0).required(),
      feedback: Joi.string().min(10).max(5000).required()
    })
  },

  // Peer review schemas
  submitPeerReview: {
    body: Joi.object({
      score: Joi.number().min(0).required(),
      feedback: Joi.string().min(20).max(2000).required(),
      criteria: Joi.object().pattern(
        Joi.string(),
        Joi.number().min(0).max(100)
      ).required()
    })
  }
};
