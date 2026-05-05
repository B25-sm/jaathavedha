/**
 * Mobile Content Service
 * Provides mobile-optimized content delivery with field selection and pagination
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { MobileContentRequest, MobileContentResponse } from '../types';

export class MobileContentService {
  private db: Pool;
  private redis: Redis;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Get mobile-optimized course list
   */
  async getCourses(
    userId: string,
    request: MobileContentRequest
  ): Promise<MobileContentResponse<any[]>> {
    const { fields, limit = 20, offset = 0, includeRelations = [] } = request;

    // Check cache
    const cacheKey = `mobile:courses:${userId}:${limit}:${offset}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build query
    let query = `
      SELECT c.*, 
             e.progress,
             e.last_accessed_at,
             COUNT(l.id) as total_lessons,
             COUNT(CASE WHEN up.completed THEN 1 END) as completed_lessons
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.user_id = $1
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = $1
      WHERE e.status = 'active'
      GROUP BY c.id, e.progress, e.last_accessed_at
      ORDER BY e.last_accessed_at DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query(query, [userId, limit, offset]);

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM courses c
       JOIN enrollments e ON c.id = e.course_id
       WHERE e.user_id = $1 AND e.status = 'active'`,
      [userId]
    );

    const total = parseInt(countResult.rows[0].count);

    // Apply field selection if specified
    let data = result.rows;
    if (fields && fields.length > 0) {
      data = this.selectFields(data, fields);
    }

    const response: MobileContentResponse<any[]> = {
      data,
      metadata: {
        fields: fields || Object.keys(result.rows[0] || {}),
        compressed: false,
        size: JSON.stringify(data).length,
        timestamp: new Date(),
      },
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };

    // Cache response
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(response));

    return response;
  }

  /**
   * Get mobile-optimized lesson content
   */
  async getLesson(
    userId: string,
    lessonId: string,
    request: MobileContentRequest
  ): Promise<MobileContentResponse<any>> {
    const { fields, includeRelations = [] } = request;

    // Check cache
    const cacheKey = `mobile:lesson:${lessonId}:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get lesson with progress
    const result = await this.db.query(
      `SELECT l.*,
              up.progress,
              up.last_position,
              up.completed,
              up.completed_at,
              c.title as course_title
       FROM lessons l
       LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = $1
       LEFT JOIN courses c ON l.course_id = c.id
       WHERE l.id = $2`,
      [userId, lessonId]
    );

    if (result.rows.length === 0) {
      throw new Error('Lesson not found');
    }

    let data = result.rows[0];

    // Include relations if requested
    if (includeRelations.includes('resources')) {
      const resources = await this.getLessonResources(lessonId);
      data.resources = resources;
    }

    if (includeRelations.includes('notes')) {
      const notes = await this.getUserNotes(userId, lessonId);
      data.notes = notes;
    }

    // Apply field selection
    if (fields && fields.length > 0) {
      data = this.selectFields([data], fields)[0];
    }

    const response: MobileContentResponse<any> = {
      data,
      metadata: {
        fields: fields || Object.keys(data),
        compressed: false,
        size: JSON.stringify(data).length,
        timestamp: new Date(),
      },
    };

    // Cache response
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(response));

    return response;
  }

  /**
   * Get user progress summary
   */
  async getProgressSummary(
    userId: string,
    request: MobileContentRequest
  ): Promise<MobileContentResponse<any>> {
    const cacheKey = `mobile:progress:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db.query(
      `SELECT 
         COUNT(DISTINCT e.course_id) as enrolled_courses,
         COUNT(DISTINCT CASE WHEN up.completed THEN l.id END) as completed_lessons,
         COUNT(DISTINCT l.id) as total_lessons,
         COALESCE(AVG(up.progress), 0) as average_progress,
         SUM(CASE WHEN up.completed THEN l.duration ELSE 0 END) as total_watch_time,
         COUNT(DISTINCT CASE WHEN up.last_accessed_at > NOW() - INTERVAL '7 days' 
               THEN l.id END) as lessons_this_week
       FROM enrollments e
       LEFT JOIN lessons l ON e.course_id = l.course_id
       LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = e.user_id
       WHERE e.user_id = $1 AND e.status = 'active'`,
      [userId]
    );

    const data = result.rows[0];

    const response: MobileContentResponse<any> = {
      data,
      metadata: {
        fields: Object.keys(data),
        compressed: false,
        size: JSON.stringify(data).length,
        timestamp: new Date(),
      },
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(response));

    return response;
  }

  /**
   * Get upcoming live sessions
   */
  async getUpcomingSessions(
    userId: string,
    request: MobileContentRequest
  ): Promise<MobileContentResponse<any[]>> {
    const { limit = 10, offset = 0 } = request;

    const result = await this.db.query(
      `SELECT ls.*,
              c.title as course_title,
              i.name as instructor_name,
              lsr.status as registration_status
       FROM live_sessions ls
       JOIN courses c ON ls.course_id = c.id
       JOIN instructors i ON ls.instructor_id = i.id
       LEFT JOIN live_session_registrations lsr 
         ON ls.id = lsr.session_id AND lsr.user_id = $1
       WHERE ls.scheduled_at > NOW()
         AND ls.status = 'scheduled'
         AND EXISTS (
           SELECT 1 FROM enrollments e 
           WHERE e.user_id = $1 AND e.course_id = ls.course_id AND e.status = 'active'
         )
       ORDER BY ls.scheduled_at ASC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const response: MobileContentResponse<any[]> = {
      data: result.rows,
      metadata: {
        fields: Object.keys(result.rows[0] || {}),
        compressed: false,
        size: JSON.stringify(result.rows).length,
        timestamp: new Date(),
      },
      pagination: {
        limit,
        offset,
        total: result.rows.length,
        hasMore: result.rows.length === limit,
      },
    };

    return response;
  }

  /**
   * Get lesson resources
   */
  private async getLessonResources(lessonId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT id, title, type, url, file_size, created_at
       FROM lesson_resources
       WHERE lesson_id = $1
       ORDER BY display_order ASC`,
      [lessonId]
    );

    return result.rows;
  }

  /**
   * Get user notes for lesson
   */
  private async getUserNotes(userId: string, lessonId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT id, content, timestamp, created_at
       FROM user_notes
       WHERE user_id = $1 AND lesson_id = $2
       ORDER BY timestamp ASC`,
      [userId, lessonId]
    );

    return result.rows;
  }

  /**
   * Select specific fields from data
   */
  private selectFields(data: any[], fields: string[]): any[] {
    return data.map((item) => {
      const selected: any = {};
      for (const field of fields) {
        if (field.includes('.')) {
          // Handle nested fields
          const parts = field.split('.');
          let value = item;
          for (const part of parts) {
            value = value?.[part];
          }
          this.setNestedValue(selected, field, value);
        } else if (item[field] !== undefined) {
          selected[field] = item[field];
        }
      }
      return selected;
    });
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    let current = obj;

    for (const part of parts) {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    current[last] = value;
  }

  /**
   * Invalidate cache for user
   */
  async invalidateCache(userId: string, pattern?: string): Promise<void> {
    const keys = await this.redis.keys(`mobile:${pattern || '*'}:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
