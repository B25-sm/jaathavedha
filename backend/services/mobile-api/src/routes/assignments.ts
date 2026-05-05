/**
 * Assignment Routes
 * Mobile assignment submissions with camera integration
 */

import express from 'express';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { CameraAssignmentService } from '../services/CameraAssignmentService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();

// Initialize service (will be injected by main app)
let assignmentService: CameraAssignmentService;

export function initializeAssignmentRoutes(db: Pool, redis: Redis) {
  assignmentService = new CameraAssignmentService(db, redis);
}

/**
 * POST /api/assignments/camera/upload
 * Upload camera capture
 */
router.post('/camera/upload', authenticateToken, async (req, res) => {
  try {
    const {
      assignmentId,
      courseId,
      captureType,
      fileData,
      fileName,
      mimeType,
      metadata,
    } = req.body;
    const userId = req.user!.userId;
    const deviceId = req.headers['x-device-id'] as string;

    if (!assignmentId || !courseId || !captureType || !fileData || !fileName || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const capture = await assignmentService.uploadCameraCapture(userId, deviceId, {
      assignmentId,
      courseId,
      captureType,
      fileData,
      fileName,
      mimeType,
      metadata,
    });

    res.json({
      success: true,
      data: capture,
    });
  } catch (error) {
    logger.error('Error uploading camera capture:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload camera capture',
    });
  }
});

/**
 * POST /api/assignments/submit
 * Create assignment submission
 */
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const {
      assignmentId,
      courseId,
      submissionType,
      captureIds,
      textContent,
      attachments,
    } = req.body;
    const userId = req.user!.userId;
    const deviceId = req.headers['x-device-id'] as string;

    if (!assignmentId || !courseId || !submissionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const submission = await assignmentService.createSubmission(userId, deviceId, {
      assignmentId,
      courseId,
      submissionType,
      captureIds,
      textContent,
      attachments,
    });

    res.json({
      success: true,
      data: submission,
    });
  } catch (error) {
    logger.error('Error creating submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create submission',
    });
  }
});

/**
 * POST /api/assignments/:submissionId/finalize
 * Submit assignment (finalize draft)
 */
router.post('/:submissionId/finalize', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user!.userId;

    const submission = await assignmentService.submitAssignment(submissionId, userId);

    res.json({
      success: true,
      data: submission,
      message: 'Assignment submitted successfully',
    });
  } catch (error) {
    logger.error('Error submitting assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit assignment',
    });
  }
});

/**
 * GET /api/assignments/submissions
 * Get user submissions
 */
router.get('/submissions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { courseId, status } = req.query;

    const submissions = await assignmentService.getUserSubmissions(
      userId,
      courseId as string,
      status as string
    );

    res.json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    logger.error('Error getting submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get submissions',
    });
  }
});

/**
 * GET /api/assignments/submissions/:submissionId
 * Get submission details with captures
 */
router.get('/submissions/:submissionId', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user!.userId;

    const details = await assignmentService.getSubmissionDetails(submissionId, userId);

    res.json({
      success: true,
      data: details,
    });
  } catch (error) {
    logger.error('Error getting submission details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get submission details',
    });
  }
});

/**
 * DELETE /api/assignments/camera/:captureId
 * Delete camera capture
 */
router.delete('/camera/:captureId', authenticateToken, async (req, res) => {
  try {
    const { captureId } = req.params;
    const userId = req.user!.userId;

    await assignmentService.deleteCameraCapture(captureId, userId);

    res.json({
      success: true,
      message: 'Camera capture deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting camera capture:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete camera capture',
    });
  }
});

/**
 * GET /api/assignments/camera/pending
 * Get pending captures (not yet submitted)
 */
router.get('/camera/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { assignmentId } = req.query;

    const captures = await assignmentService.getPendingCaptures(
      userId,
      assignmentId as string
    );

    res.json({
      success: true,
      data: captures,
    });
  } catch (error) {
    logger.error('Error getting pending captures:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending captures',
    });
  }
});

export default router;
