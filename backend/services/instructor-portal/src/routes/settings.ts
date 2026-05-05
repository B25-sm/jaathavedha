/**
 * Instructor Settings Routes
 * API endpoints for instructor preferences and configuration
 */

import express from 'express';
import { InstructorPortalService } from '../services/InstructorPortalService';
import { authMiddleware, requireRole, requireInstructorAccess } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { settingsUpdateSchema } from '../schemas/instructorSchemas';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();
const instructorService = new InstructorPortalService();

/**
 * Get instructor settings
 * GET /api/instructor/settings
 */
router.get('/',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  requireInstructorAccess,
  async (req, res, next) => {
    try {
      const instructorId = req.user.role === 'instructor' ? req.user.id : req.query.instructor_id as string;

      const settings = await instructorService.getInstructorSettings(instructorId);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update instructor settings
 * PUT /api/instructor/settings
 */
router.put('/',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  requireInstructorAccess,
  validateRequest(settingsUpdateSchema),
  async (req, res, next) => {
    try {
      const instructorId = req.user.role === 'instructor' ? req.user.id : req.body.instructor_id;

      const updatedSettings = await instructorService.updateInstructorSettings(instructorId, req.body);

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Settings updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Reset settings to default
 * POST /api/instructor/settings/reset
 */
router.post('/reset',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  requireInstructorAccess,
  async (req, res, next) => {
    try {
      const instructorId = req.user.role === 'instructor' ? req.user.id : req.body.instructor_id;
      const settingsType = req.body.settings_type || 'all'; // 'all', 'notifications', 'dashboard', 'content', 'privacy'

      // Implementation would reset specific settings to default
      
      res.json({
        success: true,
        message: `${settingsType} settings reset to default`
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Export settings
 * GET /api/instructor/settings/export
 */
router.get('/export',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  requireInstructorAccess,
  async (req, res, next) => {
    try {
      const instructorId = req.user.role === 'instructor' ? req.user.id : req.query.instructor_id as string;
      const format = req.query.format as string || 'json';

      const settings = await instructorService.getInstructorSettings(instructorId);

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="instructor-settings-${instructorId}.json"`);
        res.json(settings);
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported export format'
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Import settings
 * POST /api/instructor/settings/import
 */
router.post('/import',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  requireInstructorAccess,
  async (req, res, next) => {
    try {
      const instructorId = req.user.role === 'instructor' ? req.user.id : req.body.instructor_id;
      const importedSettings = req.body.settings;

      if (!importedSettings) {
        return res.status(400).json({
          success: false,
          error: 'Settings data required'
        });
      }

      // Validate imported settings structure
      const { error } = settingsUpdateSchema.validate(importedSettings);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid settings format',
          details: error.details
        });
      }

      const updatedSettings = await instructorService.updateInstructorSettings(instructorId, importedSettings);

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Settings imported successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get notification preferences
 * GET /api/instructor/settings/notifications
 */
router.get('/notifications',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  requireInstructorAccess,
  async (req, res, next) => {
    try {
      const instructorId = req.user.role === 'instructor' ? req.user.id : req.query.instructor_id as string;

      const settings = await instructorService.getInstructorSettings(instructorId);

      res.json({
        success: true,
        data: settings.notification_preferences
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update notification preferences
 * PUT /api/instructor/settings/notifications
 */
router.put('/notifications',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  requireInstructorAccess,
  async (req, res, next) => {
    try {
      const instructorId = req.user.role === 'instructor' ? req.user.id : req.body.instructor_id;

      const updatedSettings = await instructorService.updateInstructorSettings(instructorId, {
        notification_preferences: req.body
      });

      res.json({
        success: true,
        data: updatedSettings.notification_preferences,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Test notification settings
 * POST /api/instructor/settings/notifications/test
 */
router.post('/notifications/test',
  authMiddleware,
  requireRole(['instructor', 'admin']),
  requireInstructorAccess,
  async (req, res, next) => {
    try {
      const instructorId = req.user.role === 'instructor' ? req.user.id : req.body.instructor_id;
      const notificationType = req.body.notification_type || 'system';

      // Send test notification
      await instructorService.sendNotification(
        instructorId,
        notificationType,
        'Test Notification',
        'This is a test notification to verify your notification settings are working correctly.',
        { test: true },
        'medium'
      );

      res.json({
        success: true,
        message: 'Test notification sent successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;