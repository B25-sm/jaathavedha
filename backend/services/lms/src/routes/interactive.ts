import { Router } from 'express';
import { QuizService } from '../services/QuizService';
import { NoteService } from '../services/NoteService';
import { BookmarkService } from '../services/BookmarkService';
import { CommentService } from '../services/CommentService';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  createQuizSchema,
  submitQuizAttemptSchema,
  createNoteSchema,
  updateNoteSchema,
  createBookmarkSchema,
  updateBookmarkSchema,
  createCommentSchema,
  voteCommentSchema,
} from '../schemas/interactiveSchemas';

const router = Router();
const quizService = new QuizService();
const noteService = new NoteService();
const bookmarkService = new BookmarkService();
const commentService = new CommentService();

// ============================================================================
// In-video Quizzes
// ============================================================================

/**
 * Create a new in-video quiz
 * POST /api/interactive/videos/:videoId/quizzes
 */
router.post(
  '/videos/:videoId/quizzes',
  authenticate,
  validate(createQuizSchema),
  async (req, res, next) => {
    try {
      const { videoId } = req.params;
      const quizData = {
        ...req.body,
        created_by: req.user!.id,
      };
      const result = await quizService.createQuiz(videoId, quizData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get all quizzes for a video
 * GET /api/interactive/videos/:videoId/quizzes
 */
router.get('/videos/:videoId/quizzes', optionalAuth, async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const quizzes = await quizService.getQuizzesByVideo(videoId);
    res.json({ success: true, data: quizzes });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a specific quiz by ID
 * GET /api/interactive/quizzes/:quizId
 */
router.get('/quizzes/:quizId', optionalAuth, async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await quizService.getQuizById(quizId);
    res.json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
});

/**
 * Submit a quiz attempt
 * POST /api/interactive/quizzes/:quizId/attempt
 */
router.post(
  '/quizzes/:quizId/attempt',
  authenticate,
  validate(submitQuizAttemptSchema),
  async (req, res, next) => {
    try {
      const { quizId } = req.params;
      const { answers } = req.body;
      const result = await quizService.submitQuizAttempt(quizId, req.user!.id, answers);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user's quiz attempts
 * GET /api/interactive/quizzes/:quizId/attempts
 */
router.get('/quizzes/:quizId/attempts', authenticate, async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const attempts = await quizService.getUserAttempts(req.user!.id, quizId);
    res.json({ success: true, data: attempts });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Timestamped Notes
// ============================================================================

/**
 * Create a new note
 * POST /api/interactive/videos/:videoId/notes
 */
router.post(
  '/videos/:videoId/notes',
  authenticate,
  validate(createNoteSchema),
  async (req, res, next) => {
    try {
      const { videoId } = req.params;
      const noteData = {
        ...req.body,
        user_id: req.user!.id,
      };
      const result = await noteService.createNote(videoId, noteData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get notes for a video
 * GET /api/interactive/videos/:videoId/notes
 */
router.get('/videos/:videoId/notes', authenticate, async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const includePublic = req.query.include_public === 'true';
    const notes = await noteService.getNotesByVideo(videoId, req.user!.id, includePublic);
    res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a note
 * PUT /api/interactive/notes/:noteId
 */
router.put(
  '/notes/:noteId',
  authenticate,
  validate(updateNoteSchema),
  async (req, res, next) => {
    try {
      const { noteId } = req.params;
      const result = await noteService.updateNote(noteId, req.user!.id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a note
 * DELETE /api/interactive/notes/:noteId
 */
router.delete('/notes/:noteId', authenticate, async (req, res, next) => {
  try {
    const { noteId } = req.params;
    await noteService.deleteNote(noteId, req.user!.id);
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Search notes
 * GET /api/interactive/notes/search
 */
router.get('/notes/search', authenticate, async (req, res, next) => {
  try {
    const { q, video_id } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Search query is required' } 
      });
    }
    const notes = await noteService.searchNotes(
      req.user!.id, 
      q, 
      video_id as string | undefined
    );
    res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Video Bookmarks
// ============================================================================

/**
 * Create a new bookmark
 * POST /api/interactive/videos/:videoId/bookmarks
 */
router.post(
  '/videos/:videoId/bookmarks',
  authenticate,
  validate(createBookmarkSchema),
  async (req, res, next) => {
    try {
      const { videoId } = req.params;
      const bookmarkData = {
        ...req.body,
        user_id: req.user!.id,
      };
      const result = await bookmarkService.createBookmark(videoId, bookmarkData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get bookmarks for a video
 * GET /api/interactive/videos/:videoId/bookmarks
 */
router.get('/videos/:videoId/bookmarks', authenticate, async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const bookmarks = await bookmarkService.getBookmarksByVideo(videoId, req.user!.id);
    res.json({ success: true, data: bookmarks });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a bookmark
 * PUT /api/interactive/bookmarks/:bookmarkId
 */
router.put(
  '/bookmarks/:bookmarkId',
  authenticate,
  validate(updateBookmarkSchema),
  async (req, res, next) => {
    try {
      const { bookmarkId } = req.params;
      const result = await bookmarkService.updateBookmark(bookmarkId, req.user!.id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a bookmark
 * DELETE /api/interactive/bookmarks/:bookmarkId
 */
router.delete('/bookmarks/:bookmarkId', authenticate, async (req, res, next) => {
  try {
    const { bookmarkId } = req.params;
    await bookmarkService.deleteBookmark(bookmarkId, req.user!.id);
    res.json({ success: true, message: 'Bookmark deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all user bookmarks
 * GET /api/interactive/bookmarks
 */
router.get('/bookmarks', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const bookmarks = await bookmarkService.getUserBookmarks(req.user!.id, limit);
    res.json({ success: true, data: bookmarks });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Video Comments/Discussions
// ============================================================================

/**
 * Create a new comment
 * POST /api/interactive/videos/:videoId/comments
 */
router.post(
  '/videos/:videoId/comments',
  authenticate,
  validate(createCommentSchema),
  async (req, res, next) => {
    try {
      const { videoId } = req.params;
      const commentData = {
        ...req.body,
        user_id: req.user!.id,
      };
      const result = await commentService.createComment(videoId, commentData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get comments for a video
 * GET /api/interactive/videos/:videoId/comments
 */
router.get('/videos/:videoId/comments', optionalAuth, async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = req.user?.id;
    
    const comments = await commentService.getCommentsByVideo(videoId, userId, limit, offset);
    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
});

/**
 * Get replies to a comment
 * GET /api/interactive/comments/:commentId/replies
 */
router.get('/comments/:commentId/replies', optionalAuth, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const replies = await commentService.getCommentReplies(commentId, userId);
    res.json({ success: true, data: replies });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a comment
 * PUT /api/interactive/comments/:commentId
 */
router.put('/comments/:commentId', authenticate, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Content is required' } 
      });
    }
    
    const result = await commentService.updateComment(commentId, req.user!.id, content);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a comment
 * DELETE /api/interactive/comments/:commentId
 */
router.delete('/comments/:commentId', authenticate, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'instructor';
    await commentService.deleteComment(commentId, req.user!.id, isAdmin);
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Vote on a comment
 * POST /api/interactive/comments/:commentId/vote
 */
router.post(
  '/comments/:commentId/vote',
  authenticate,
  validate(voteCommentSchema),
  async (req, res, next) => {
    try {
      const { commentId } = req.params;
      const voteData = {
        user_id: req.user!.id,
        vote_type: req.body.vote_type,
      };
      const result = await commentService.voteComment(commentId, voteData);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get comments by timestamp
 * GET /api/interactive/videos/:videoId/comments/timestamp/:timestamp
 */
router.get('/videos/:videoId/comments/timestamp/:timestamp', optionalAuth, async (req, res, next) => {
  try {
    const { videoId, timestamp } = req.params;
    const range = parseInt(req.query.range as string) || 30;
    const comments = await commentService.getCommentsByTimestamp(
      videoId, 
      parseInt(timestamp), 
      range
    );
    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
});

export default router;
