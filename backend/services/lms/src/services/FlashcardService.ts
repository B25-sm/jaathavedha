/**
 * Flashcard Service
 * Implements spaced repetition system using SM-2 algorithm
 */

import { getPostgresPool } from '@sai-mahendra/database';
import { AppError, logger } from '@sai-mahendra/utils';

interface Flashcard {
  id: string;
  courseId: string;
  userId: string;
  front: string;
  back: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  nextReview: Date;
  interval: number;
  easeFactor: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FlashcardReview {
  id: string;
  flashcardId: string;
  userId: string;
  quality: number; // 0-5 rating
  reviewedAt: Date;
  timeSpent: number;
}

interface ReviewSession {
  dueCards: Flashcard[];
  totalDue: number;
  newCards: number;
  reviewCards: number;
}

export class FlashcardService {
  /**
   * Create a new flashcard
   */
  async createFlashcard(
    courseId: string,
    userId: string,
    front: string,
    back: string,
    tags: string[] = [],
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): Promise<Flashcard> {
    const pool = getPostgresPool();

    try {
      const result = await pool.query(
        `INSERT INTO flashcards (course_id, user_id, front, back, tags, difficulty, next_review, interval, ease_factor, review_count)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1, 2.5, 0)
         RETURNING *`,
        [courseId, userId, front, back, JSON.stringify(tags), difficulty]
      );

      const row = result.rows[0];

      logger.info(`Created flashcard ${row.id} for user ${userId}`);

      return {
        id: row.id,
        courseId: row.course_id,
        userId: row.user_id,
        front: row.front,
        back: row.back,
        tags: row.tags,
        difficulty: row.difficulty,
        nextReview: row.next_review,
        interval: row.interval,
        easeFactor: parseFloat(row.ease_factor),
        reviewCount: row.review_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Error creating flashcard:', error);
      throw new AppError('Failed to create flashcard', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get flashcards for a course
   */
  async getFlashcards(
    courseId: string,
    userId: string,
    tags?: string[]
  ): Promise<Flashcard[]> {
    const pool = getPostgresPool();

    try {
      let query = `
        SELECT * FROM flashcards
        WHERE course_id = $1 AND user_id = $2
      `;
      const params: any[] = [courseId, userId];

      if (tags && tags.length > 0) {
        query += ` AND tags @> $3`;
        params.push(JSON.stringify(tags));
      }

      query += ` ORDER BY next_review ASC, created_at DESC`;

      const result = await pool.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        userId: row.user_id,
        front: row.front,
        back: row.back,
        tags: row.tags,
        difficulty: row.difficulty,
        nextReview: row.next_review,
        interval: row.interval,
        easeFactor: parseFloat(row.ease_factor),
        reviewCount: row.review_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Error getting flashcards:', error);
      throw new AppError('Failed to get flashcards', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get a single flashcard
   */
  async getFlashcard(flashcardId: string, userId: string): Promise<Flashcard> {
    const pool = getPostgresPool();

    try {
      const result = await pool.query(
        'SELECT * FROM flashcards WHERE id = $1 AND user_id = $2',
        [flashcardId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Flashcard not found', 404, 'FLASHCARD_NOT_FOUND');
      }

      const row = result.rows[0];

      return {
        id: row.id,
        courseId: row.course_id,
        userId: row.user_id,
        front: row.front,
        back: row.back,
        tags: row.tags,
        difficulty: row.difficulty,
        nextReview: row.next_review,
        interval: row.interval,
        easeFactor: parseFloat(row.ease_factor),
        reviewCount: row.review_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting flashcard:', error);
      throw new AppError('Failed to get flashcard', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Update a flashcard
   */
  async updateFlashcard(
    flashcardId: string,
    userId: string,
    updates: {
      front?: string;
      back?: string;
      tags?: string[];
      difficulty?: 'easy' | 'medium' | 'hard';
    }
  ): Promise<Flashcard> {
    const pool = getPostgresPool();

    try {
      // Verify ownership
      await this.getFlashcard(flashcardId, userId);

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.front !== undefined) {
        setClauses.push(`front = $${paramIndex++}`);
        values.push(updates.front);
      }
      if (updates.back !== undefined) {
        setClauses.push(`back = $${paramIndex++}`);
        values.push(updates.back);
      }
      if (updates.tags !== undefined) {
        setClauses.push(`tags = $${paramIndex++}`);
        values.push(JSON.stringify(updates.tags));
      }
      if (updates.difficulty !== undefined) {
        setClauses.push(`difficulty = $${paramIndex++}`);
        values.push(updates.difficulty);
      }

      setClauses.push(`updated_at = NOW()`);

      values.push(flashcardId, userId);

      const result = await pool.query(
        `UPDATE flashcards
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
         RETURNING *`,
        values
      );

      const row = result.rows[0];

      logger.info(`Updated flashcard ${flashcardId}`);

      return {
        id: row.id,
        courseId: row.course_id,
        userId: row.user_id,
        front: row.front,
        back: row.back,
        tags: row.tags,
        difficulty: row.difficulty,
        nextReview: row.next_review,
        interval: row.interval,
        easeFactor: parseFloat(row.ease_factor),
        reviewCount: row.review_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating flashcard:', error);
      throw new AppError('Failed to update flashcard', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Delete a flashcard
   */
  async deleteFlashcard(flashcardId: string, userId: string): Promise<void> {
    const pool = getPostgresPool();

    try {
      const result = await pool.query(
        'DELETE FROM flashcards WHERE id = $1 AND user_id = $2',
        [flashcardId, userId]
      );

      if (result.rowCount === 0) {
        throw new AppError('Flashcard not found', 404, 'FLASHCARD_NOT_FOUND');
      }

      logger.info(`Deleted flashcard ${flashcardId}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting flashcard:', error);
      throw new AppError('Failed to delete flashcard', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get due flashcards for review
   */
  async getDueFlashcards(userId: string, courseId?: string, limit: number = 20): Promise<ReviewSession> {
    const pool = getPostgresPool();

    try {
      let query = `
        SELECT * FROM flashcards
        WHERE user_id = $1 AND next_review <= NOW()
      `;
      const params: any[] = [userId];

      if (courseId) {
        query += ` AND course_id = $2`;
        params.push(courseId);
      }

      query += ` ORDER BY next_review ASC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await pool.query(query, params);

      const dueCards = result.rows.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        userId: row.user_id,
        front: row.front,
        back: row.back,
        tags: row.tags,
        difficulty: row.difficulty,
        nextReview: row.next_review,
        interval: row.interval,
        easeFactor: parseFloat(row.ease_factor),
        reviewCount: row.review_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      // Count total due
      let countQuery = `
        SELECT COUNT(*) as total FROM flashcards
        WHERE user_id = $1 AND next_review <= NOW()
      `;
      const countParams: any[] = [userId];

      if (courseId) {
        countQuery += ` AND course_id = $2`;
        countParams.push(courseId);
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalDue = parseInt(countResult.rows[0].total, 10);

      // Count new vs review cards
      const newCards = dueCards.filter((card) => card.reviewCount === 0).length;
      const reviewCards = dueCards.filter((card) => card.reviewCount > 0).length;

      return {
        dueCards,
        totalDue,
        newCards,
        reviewCards,
      };
    } catch (error) {
      logger.error('Error getting due flashcards:', error);
      throw new AppError('Failed to get due flashcards', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Review a flashcard using SM-2 algorithm
   * Quality: 0-5 (0=complete blackout, 5=perfect response)
   */
  async reviewFlashcard(
    flashcardId: string,
    userId: string,
    quality: number,
    timeSpent: number = 0
  ): Promise<{ flashcard: Flashcard; nextReview: Date }> {
    const pool = getPostgresPool();

    try {
      if (quality < 0 || quality > 5) {
        throw new AppError('Quality must be between 0 and 5', 400, 'INVALID_QUALITY');
      }

      // Get current flashcard
      const flashcard = await this.getFlashcard(flashcardId, userId);

      // SM-2 Algorithm
      let newEaseFactor = flashcard.easeFactor;
      let newInterval = flashcard.interval;

      // Calculate new ease factor
      newEaseFactor = newEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

      // Minimum ease factor is 1.3
      if (newEaseFactor < 1.3) {
        newEaseFactor = 1.3;
      }

      // Calculate new interval
      if (quality < 3) {
        // Failed - reset interval to 1 day
        newInterval = 1;
      } else {
        if (flashcard.reviewCount === 0) {
          newInterval = 1;
        } else if (flashcard.reviewCount === 1) {
          newInterval = 6;
        } else {
          newInterval = Math.round(flashcard.interval * newEaseFactor);
        }
      }

      // Calculate next review date
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + newInterval);

      // Update flashcard
      await pool.query(
        `UPDATE flashcards
         SET interval = $1, ease_factor = $2, next_review = $3, review_count = review_count + 1, updated_at = NOW()
         WHERE id = $4 AND user_id = $5`,
        [newInterval, newEaseFactor, nextReview, flashcardId, userId]
      );

      // Record review
      await pool.query(
        `INSERT INTO flashcard_reviews (flashcard_id, user_id, quality, time_spent)
         VALUES ($1, $2, $3, $4)`,
        [flashcardId, userId, quality, timeSpent]
      );

      logger.info(`Reviewed flashcard ${flashcardId} with quality ${quality}`);

      const updatedFlashcard = await this.getFlashcard(flashcardId, userId);

      return {
        flashcard: updatedFlashcard,
        nextReview,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error reviewing flashcard:', error);
      throw new AppError('Failed to review flashcard', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get flashcard review history
   */
  async getReviewHistory(
    userId: string,
    flashcardId?: string,
    limit: number = 50
  ): Promise<FlashcardReview[]> {
    const pool = getPostgresPool();

    try {
      let query = `
        SELECT * FROM flashcard_reviews
        WHERE user_id = $1
      `;
      const params: any[] = [userId];

      if (flashcardId) {
        query += ` AND flashcard_id = $2`;
        params.push(flashcardId);
      }

      query += ` ORDER BY reviewed_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await pool.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        flashcardId: row.flashcard_id,
        userId: row.user_id,
        quality: row.quality,
        reviewedAt: row.reviewed_at,
        timeSpent: row.time_spent,
      }));
    } catch (error) {
      logger.error('Error getting review history:', error);
      throw new AppError('Failed to get review history', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get flashcard statistics
   */
  async getFlashcardStats(userId: string, courseId?: string): Promise<{
    totalCards: number;
    dueToday: number;
    newCards: number;
    reviewedToday: number;
    averageEaseFactor: number;
    masteredCards: number;
  }> {
    const pool = getPostgresPool();

    try {
      let baseQuery = 'SELECT * FROM flashcards WHERE user_id = $1';
      const params: any[] = [userId];

      if (courseId) {
        baseQuery += ' AND course_id = $2';
        params.push(courseId);
      }

      const allCards = await pool.query(baseQuery, params);

      const totalCards = allCards.rows.length;
      const dueToday = allCards.rows.filter((card) => new Date(card.next_review) <= new Date()).length;
      const newCards = allCards.rows.filter((card) => card.review_count === 0).length;
      const masteredCards = allCards.rows.filter(
        (card) => card.review_count >= 5 && parseFloat(card.ease_factor) >= 2.5
      ).length;

      const avgEaseFactor =
        totalCards > 0
          ? allCards.rows.reduce((sum, card) => sum + parseFloat(card.ease_factor), 0) / totalCards
          : 2.5;

      // Count reviews today
      let reviewQuery = `
        SELECT COUNT(*) as count FROM flashcard_reviews
        WHERE user_id = $1 AND reviewed_at >= CURRENT_DATE
      `;
      const reviewParams: any[] = [userId];

      if (courseId) {
        reviewQuery += ` AND flashcard_id IN (SELECT id FROM flashcards WHERE course_id = $2)`;
        reviewParams.push(courseId);
      }

      const reviewResult = await pool.query(reviewQuery, reviewParams);
      const reviewedToday = parseInt(reviewResult.rows[0].count, 10);

      return {
        totalCards,
        dueToday,
        newCards,
        reviewedToday,
        averageEaseFactor: Math.round(avgEaseFactor * 100) / 100,
        masteredCards,
      };
    } catch (error) {
      logger.error('Error getting flashcard stats:', error);
      throw new AppError('Failed to get flashcard stats', 500, 'DATABASE_ERROR');
    }
  }
}
