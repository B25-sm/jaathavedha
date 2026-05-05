/**
 * Interactive Learning Service
 * Handles in-video quizzes, notes, bookmarks, and discussions
 */

import { getPostgresPool, getMongoClient } from '@sai-mahendra/database';
import crypto from 'crypto';
import {
  VideoQuiz,
  QuizAttempt,
  VideoNote,
  VideoBookmark,
  VideoComment,
  PaginationParams,
  PaginatedResponse
} from '../types';

export class InteractiveService {
  /**
   * Create a new in-video quiz
   */
  async createVideoQuiz(
    videoId: string,
    quizData: Partial<VideoQuiz>,
    createdBy: string
  ): Promise<VideoQuiz> {
    const pool = getPostgresPool();
    const quizId = crypto.randomUUID();

    const query = `
      INSERT INTO video_quizzes (
        id, video_id, timestamp, title, description, questions,
        passing_score, time_limit, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      quizId,
      videoId,
      quizData.timestamp,
      quizData.title,
      quizData.description || null,
      JSON.stringify(quizData.questions),
      quizData.passingScore || 70,
      quizData.timeLimit || null,
      createdBy
    ];

    const result = await pool.query(query, values);
    return this.mapQuizRow(result.rows[0]);
  }

  /**
   * Get all quizzes for a video
   */
  async getVideoQuizzes(videoId: string): Promise<VideoQuiz[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM video_quizzes
      WHERE video_id = $1
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query, [videoId]);
    return result.rows.map(row => this.mapQuizRow(row));
  }

  /**
   * Submit a quiz attempt
   */
  async submitQuizAttempt(
    quizId: string,
    userId: string,
    answers: Record<string, string | string[]>
  ): Promise<QuizAttempt> {
    const pool = getPostgresPool();

    // Get quiz details
    const quizResult = await pool.query(
      'SELECT * FROM video_quizzes WHERE id = $1',
      [quizId]
    );

    if (quizResult.rows.length === 0) {
      throw new Error('Quiz not found');
    }

    const quiz = this.mapQuizRow(quizResult.rows[0]);

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;

    quiz.questions.forEach(question => {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const correctAnswer = question.correctAnswer;

      if (Array.isArray(correctAnswer)) {
        // Multiple correct answers
        if (
          Array.isArray(userAnswer) &&
          correctAnswer.length === userAnswer.length &&
          correctAnswer.every(ans => userAnswer.includes(ans))
        ) {
          earnedPoints += question.points;
        }
      } else {
        // Single correct answer
        if (userAnswer === correctAnswer) {
          earnedPoints += question.points;
        }
      }
    });

    const score = Math.round((earnedPoints / totalPoints) * 100);
    const passed = score >= quiz.passingScore;

    // Save attempt
    const attemptId = crypto.randomUUID();
    const insertQuery = `
      INSERT INTO quiz_attempts (
        id, quiz_id, user_id, answers, score, passed, completed_at, time_spent
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING *
    `;

    const attemptResult = await pool.query(insertQuery, [
      attemptId,
      quizId,
      userId,
      JSON.stringify(answers),
      score,
      passed,
      0 // Time spent would be tracked on frontend
    ]);

    // Award points if passed
    if (passed) {
      await this.awardQuizPoints(userId, quizId, 50);
    }

    return this.mapAttemptRow(attemptResult.rows[0]);
  }

  /**
   * Create a timestamped video note
   */
  async createVideoNote(
    videoId: string,
    userId: string,
    noteData: Partial<VideoNote>
  ): Promise<VideoNote> {
    const pool = getPostgresPool();
    const noteId = crypto.randomUUID();

    const query = `
      INSERT INTO video_notes (
        id, video_id, user_id, timestamp, content, is_public, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      noteId,
      videoId,
      userId,
      noteData.timestamp,
      noteData.content,
      noteData.isPublic || false,
      JSON.stringify(noteData.tags || [])
    ];

    const result = await pool.query(query, values);
    return this.mapNoteRow(result.rows[0]);
  }

  /**
   * Get user's notes for a video
   */
  async getUserVideoNotes(videoId: string, userId: string): Promise<VideoNote[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM video_notes
      WHERE video_id = $1 AND user_id = $2
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query, [videoId, userId]);
    return result.rows.map(row => this.mapNoteRow(row));
  }

  /**
   * Update a note
   */
  async updateNote(
    noteId: string,
    userId: string,
    updates: Partial<VideoNote>
  ): Promise<VideoNote> {
    const pool = getPostgresPool();

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIndex++}`);
      values.push(updates.content);
    }

    if (updates.isPublic !== undefined) {
      setClauses.push(`is_public = $${paramIndex++}`);
      values.push(updates.isPublic);
    }

    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(updates.tags));
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(noteId, userId);

    const query = `
      UPDATE video_notes
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Note not found or unauthorized');
    }

    return this.mapNoteRow(result.rows[0]);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string, userId: string): Promise<void> {
    const pool = getPostgresPool();

    const query = 'DELETE FROM video_notes WHERE id = $1 AND user_id = $2';
    const result = await pool.query(query, [noteId, userId]);

    if (result.rowCount === 0) {
      throw new Error('Note not found or unauthorized');
    }
  }

  /**
   * Create a video bookmark
   */
  async createBookmark(
    videoId: string,
    userId: string,
    bookmarkData: Partial<VideoBookmark>
  ): Promise<VideoBookmark> {
    const pool = getPostgresPool();
    const bookmarkId = crypto.randomUUID();

    const query = `
      INSERT INTO video_bookmarks (
        id, video_id, user_id, timestamp, title, description, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const values = [
      bookmarkId,
      videoId,
      userId,
      bookmarkData.timestamp,
      bookmarkData.title,
      bookmarkData.description || null
    ];

    const result = await pool.query(query, values);
    return this.mapBookmarkRow(result.rows[0]);
  }

  /**
   * Get user's bookmarks for a video
   */
  async getUserBookmarks(videoId: string, userId: string): Promise<VideoBookmark[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM video_bookmarks
      WHERE video_id = $1 AND user_id = $2
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query, [videoId, userId]);
    return result.rows.map(row => this.mapBookmarkRow(row));
  }

  /**
   * Create a video comment
   */
  async createVideoComment(
    videoId: string,
    userId: string,
    commentData: Partial<VideoComment>
  ): Promise<VideoComment> {
    const pool = getPostgresPool();
    const commentId = crypto.randomUUID();

    const query = `
      INSERT INTO video_comments (
        id, video_id, user_id, content, timestamp, parent_id, upvotes, downvotes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      commentId,
      videoId,
      userId,
      commentData.content,
      commentData.timestamp || null,
      null
    ];

    const result = await pool.query(query, values);
    return this.mapCommentRow(result.rows[0]);
  }

  /**
   * Get video comments with pagination
   */
  async getVideoComments(
    videoId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<VideoComment>> {
    const pool = getPostgresPool();
    const offset = (pagination.page - 1) * pagination.limit;

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM video_comments WHERE video_id = $1 AND parent_id IS NULL',
      [videoId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get comments
    const query = `
      SELECT * FROM video_comments
      WHERE video_id = $1 AND parent_id IS NULL
      ORDER BY upvotes DESC, created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [videoId, pagination.limit, offset]);
    const comments = result.rows.map(row => this.mapCommentRow(row));

    // Get replies for each comment
    for (const comment of comments) {
      comment.replies = await this.getCommentReplies(comment.id);
    }

    return {
      data: comments,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  /**
   * Reply to a comment
   */
  async replyToComment(
    parentId: string,
    userId: string,
    content: string
  ): Promise<VideoComment> {
    const pool = getPostgresPool();

    // Get parent comment
    const parentResult = await pool.query(
      'SELECT video_id FROM video_comments WHERE id = $1',
      [parentId]
    );

    if (parentResult.rows.length === 0) {
      throw new Error('Parent comment not found');
    }

    const videoId = parentResult.rows[0].video_id;
    const replyId = crypto.randomUUID();

    const query = `
      INSERT INTO video_comments (
        id, video_id, user_id, content, parent_id, upvotes, downvotes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 0, 0, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [replyId, videoId, userId, content, parentId]);
    return this.mapCommentRow(result.rows[0]);
  }

  /**
   * Vote on a comment
   */
  async voteComment(
    commentId: string,
    userId: string,
    voteType: 'upvote' | 'downvote' | 'remove'
  ): Promise<VideoComment> {
    const pool = getPostgresPool();

    // Check existing vote
    const existingVote = await pool.query(
      'SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (voteType === 'remove') {
      // Remove vote
      if (existingVote.rows.length > 0) {
        const oldVote = existingVote.rows[0].vote_type;
        await pool.query(
          'DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2',
          [commentId, userId]
        );

        // Update comment counts
        const field = oldVote === 'upvote' ? 'upvotes' : 'downvotes';
        await pool.query(
          `UPDATE video_comments SET ${field} = ${field} - 1 WHERE id = $1`,
          [commentId]
        );
      }
    } else {
      // Add or update vote
      if (existingVote.rows.length > 0) {
        const oldVote = existingVote.rows[0].vote_type;
        if (oldVote !== voteType) {
          // Change vote
          await pool.query(
            'UPDATE comment_votes SET vote_type = $1 WHERE comment_id = $2 AND user_id = $3',
            [voteType, commentId, userId]
          );

          // Update counts
          const oldField = oldVote === 'upvote' ? 'upvotes' : 'downvotes';
          const newField = voteType === 'upvote' ? 'upvotes' : 'downvotes';
          await pool.query(
            `UPDATE video_comments SET ${oldField} = ${oldField} - 1, ${newField} = ${newField} + 1 WHERE id = $1`,
            [commentId]
          );
        }
      } else {
        // New vote
        await pool.query(
          'INSERT INTO comment_votes (comment_id, user_id, vote_type) VALUES ($1, $2, $3)',
          [commentId, userId, voteType]
        );

        const field = voteType === 'upvote' ? 'upvotes' : 'downvotes';
        await pool.query(
          `UPDATE video_comments SET ${field} = ${field} + 1 WHERE id = $1`,
          [commentId]
        );
      }
    }

    // Return updated comment
    const result = await pool.query('SELECT * FROM video_comments WHERE id = $1', [commentId]);
    return this.mapCommentRow(result.rows[0]);
  }

  /**
   * Get replies for a comment
   */
  private async getCommentReplies(commentId: string): Promise<VideoComment[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM video_comments
      WHERE parent_id = $1
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, [commentId]);
    return result.rows.map(row => this.mapCommentRow(row));
  }

  /**
   * Award points for quiz completion
   */
  private async awardQuizPoints(userId: string, quizId: string, points: number): Promise<void> {
    const mongo = getMongoClient();
    const db = mongo.db();

    await db.collection('point_transactions').insertOne({
      userId,
      points,
      action: 'quiz_completed',
      description: `Completed quiz ${quizId}`,
      metadata: { quizId },
      createdAt: new Date()
    });

    await db.collection('user_points').updateOne(
      { userId },
      {
        $inc: { totalPoints: points },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true }
    );
  }

  // Mapping functions
  private mapQuizRow(row: any): VideoQuiz {
    return {
      id: row.id,
      videoId: row.video_id,
      timestamp: row.timestamp,
      title: row.title,
      description: row.description,
      questions: JSON.parse(row.questions),
      passingScore: row.passing_score,
      timeLimit: row.time_limit,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapAttemptRow(row: any): QuizAttempt {
    return {
      id: row.id,
      quizId: row.quiz_id,
      userId: row.user_id,
      answers: JSON.parse(row.answers),
      score: row.score,
      passed: row.passed,
      completedAt: row.completed_at,
      timeSpent: row.time_spent
    };
  }

  private mapNoteRow(row: any): VideoNote {
    return {
      id: row.id,
      videoId: row.video_id,
      userId: row.user_id,
      timestamp: row.timestamp,
      content: row.content,
      isPublic: row.is_public,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapBookmarkRow(row: any): VideoBookmark {
    return {
      id: row.id,
      videoId: row.video_id,
      userId: row.user_id,
      timestamp: row.timestamp,
      title: row.title,
      description: row.description,
      createdAt: row.created_at
    };
  }

  private mapCommentRow(row: any): VideoComment {
    return {
      id: row.id,
      videoId: row.video_id,
      userId: row.user_id,
      content: row.content,
      timestamp: row.timestamp,
      parentId: row.parent_id,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
