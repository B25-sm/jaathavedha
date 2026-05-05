/**
 * Sync Validation Schemas
 * Joi schemas for offline sync operations
 */

import Joi from 'joi';

export const syncRequestSchema = {
  body: Joi.object({
    deviceId: Joi.string().required(),
    lastSyncTimestamp: Joi.date().iso().required(),
    operations: Joi.array()
      .items(
        Joi.object({
          operationType: Joi.string().valid('create', 'update', 'delete').required(),
          entityType: Joi.string()
            .valid('progress', 'note', 'bookmark', 'quiz_result', 'assignment')
            .required(),
          entityId: Joi.string().required(),
          data: Joi.object().required(),
          timestamp: Joi.date().iso().required(),
        })
      )
      .max(100)
      .required(),
  }),
};

export const resolveConflictSchema = {
  body: Joi.object({
    conflictId: Joi.string().required(),
    resolution: Joi.string().valid('client_wins', 'server_wins', 'merge').required(),
    mergedData: Joi.object().when('resolution', {
      is: 'merge',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),
};

export const getSyncStatusSchema = {
  query: Joi.object({
    deviceId: Joi.string().required(),
    since: Joi.date().iso().optional(),
  }),
};
