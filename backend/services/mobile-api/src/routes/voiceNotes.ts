/**
 * Voice Notes Routes
 * Voice-to-text note-taking for mobile devices
 */

import express from 'express';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { VoiceNoteService } from '../services/VoiceNoteService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '@sai-mahendra/utils';

const router = express.Router();

// Initialize service (will be injected by main app)
let voiceNoteService: VoiceNoteService;

export function initializeVoiceNoteRoutes(db: Pool, redis: Redis) {
  voiceNoteService = new VoiceNoteService(db, redis);
}

/**
 * POST /api/voice-notes/transcribe
 * Create voice note with transcription
 */
router.post('/transcribe', authenticateToken, async (req, res) => {
  try {
    const { audioData, audioFormat, language, videoId, videoPosition, courseId, lessonId } =
      req.body;
    const userId = req.user!.userId;
    const deviceId = req.headers['x-device-id'] as string;

    if (!audioData || !audioFormat || !language || !courseId || !lessonId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await voiceNoteService.createVoiceNote(userId, deviceId, {
      audioData,
      audioFormat,
      language,
      videoId,
      videoPosition,
      courseId,
      lessonId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error creating voice note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create voice note',
    });
  }
});

/**
 * GET /api/voice-notes
 * Get voice notes for user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { courseId, lessonId, videoId } = req.query;

    const notes = await voiceNoteService.getVoiceNotes(
      userId,
      courseId as string,
      lessonId as string,
      videoId as string
    );

    res.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    logger.error('Error getting voice notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get voice notes',
    });
  }
});

/**
 * POST /api/voice-notes/text
 * Create text note
 */
router.post('/text', authenticateToken, async (req, res) => {
  try {
    const {
      courseId,
      lessonId,
      videoId,
      videoPosition,
      content,
      noteType,
      tags,
      isBookmarked,
    } = req.body;
    const userId = req.user!.userId;
    const deviceId = req.headers['x-device-id'] as string;

    if (!courseId || !lessonId || !content || !noteType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const note = await voiceNoteService.createTextNote(userId, deviceId, {
      courseId,
      lessonId,
      videoId,
      videoPosition,
      content,
      noteType,
      tags,
      isBookmarked,
    });

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    logger.error('Error creating text note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create text note',
    });
  }
});

/**
 * GET /api/voice-notes/text
 * Get text notes for user
 */
router.get('/text', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { courseId, lessonId, videoId } = req.query;

    const notes = await voiceNoteService.getTextNotes(
      userId,
      courseId as string,
      lessonId as string,
      videoId as string
    );

    res.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    logger.error('Error getting text notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get text notes',
    });
  }
});

/**
 * PUT /api/voice-notes/text/:noteId
 * Update text note
 */
router.put('/text/:noteId', authenticateToken, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user!.userId;
    const { content, tags, isBookmarked } = req.body;

    const note = await voiceNoteService.updateTextNote(noteId, userId, {
      content,
      tags,
      isBookmarked,
    });

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    logger.error('Error updating text note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update text note',
    });
  }
});

/**
 * DELETE /api/voice-notes/:noteType/:noteId
 * Delete note
 */
router.delete('/:noteType/:noteId', authenticateToken, async (req, res) => {
  try {
    const { noteType, noteId } = req.params;
    const userId = req.user!.userId;

    if (noteType !== 'text' && noteType !== 'voice') {
      return res.status(400).json({
        success: false,
        error: 'Invalid note type',
      });
    }

    await voiceNoteService.deleteNote(noteId, userId, noteType as 'text' | 'voice');

    res.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete note',
    });
  }
});

/**
 * GET /api/voice-notes/search
 * Search notes
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { query, courseId } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }

    const results = await voiceNoteService.searchNotes(
      userId,
      query as string,
      courseId as string
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error searching notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search notes',
    });
  }
});

/**
 * POST /api/voice-notes/sync
 * Sync notes across devices
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const deviceId = req.headers['x-device-id'] as string;
    const { lastSyncTimestamp } = req.body;

    if (!lastSyncTimestamp) {
      return res.status(400).json({
        success: false,
        error: 'lastSyncTimestamp is required',
      });
    }

    const notes = await voiceNoteService.syncNotes(
      userId,
      deviceId,
      new Date(lastSyncTimestamp)
    );

    res.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    logger.error('Error syncing notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync notes',
    });
  }
});

export default router;
