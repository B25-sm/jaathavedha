import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface BookmarkData {
  user_id: string;
  timestamp: number;
  title: string;
  description?: string;
}

export class BookmarkService {
  private db = getDatabase();

  async createBookmark(videoId: string, bookmarkData: BookmarkData) {
    try {
      // Validate bookmark data
      if (!bookmarkData.title || bookmarkData.title.trim().length === 0) {
        throw new AppError('Bookmark title cannot be empty', 400);
      }

      if (bookmarkData.timestamp < 0) {
        throw new AppError('Timestamp must be non-negative', 400);
      }

      // Check if bookmark already exists at this timestamp
      const existing = await this.db.queryOne(
        `SELECT id FROM video_bookmarks 
         WHERE user_id = $1 AND video_id = $2 AND timestamp = $3`,
        [bookmarkData.user_id, videoId, bookmarkData.timestamp]
      );

      if (existing) {
        throw new AppError('Bookmark already exists at this timestamp', 409);
      }

      const bookmark = await this.db.insert('video_bookmarks', {
        video_id: videoId,
        user_id: bookmarkData.user_id,
        timestamp: bookmarkData.timestamp,
        title: bookmarkData.title,
        description: bookmarkData.description || null,
      });

      logger.info('Bookmark created successfully', { 
        bookmarkId: bookmark.id, 
        videoId, 
        userId: bookmarkData.user_id 
      });

      return bookmark;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create bookmark', { error, videoId, bookmarkData });
      throw new AppError('Failed to create bookmark', 500);
    }
  }

  async getBookmarksByVideo(videoId: string, userId: string) {
    try {
      const bookmarks = await this.db.queryMany(
        `SELECT * FROM video_bookmarks 
         WHERE video_id = $1 AND user_id = $2 
         ORDER BY timestamp ASC`,
        [videoId, userId]
      );

      return bookmarks;
    } catch (error) {
      logger.error('Failed to get bookmarks by video', { error, videoId, userId });
      throw new AppError('Failed to retrieve bookmarks', 500);
    }
  }

  async getBookmarkById(bookmarkId: string) {
    try {
      const bookmark = await this.db.queryOne(
        'SELECT * FROM video_bookmarks WHERE id = $1',
        [bookmarkId]
      );

      if (!bookmark) {
        throw new AppError('Bookmark not found', 404);
      }

      return bookmark;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get bookmark by ID', { error, bookmarkId });
      throw new AppError('Failed to retrieve bookmark', 500);
    }
  }

  async updateBookmark(bookmarkId: string, userId: string, updates: Partial<BookmarkData>) {
    try {
      // Verify bookmark exists and belongs to user
      const existingBookmark = await this.getBookmarkById(bookmarkId);
      
      if (existingBookmark.user_id !== userId) {
        throw new AppError('Unauthorized to update this bookmark', 403);
      }

      const updateData: any = {};
      
      if (updates.title !== undefined) {
        if (updates.title.trim().length === 0) {
          throw new AppError('Bookmark title cannot be empty', 400);
        }
        updateData.title = updates.title;
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }

      if (updates.timestamp !== undefined) {
        if (updates.timestamp < 0) {
          throw new AppError('Timestamp must be non-negative', 400);
        }
        updateData.timestamp = updates.timestamp;
      }

      if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid updates provided', 400);
      }

      const bookmark = await this.db.update('video_bookmarks', updateData, { id: bookmarkId });

      logger.info('Bookmark updated successfully', { bookmarkId, userId });

      return bookmark;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update bookmark', { error, bookmarkId, userId });
      throw new AppError('Failed to update bookmark', 500);
    }
  }

  async deleteBookmark(bookmarkId: string, userId: string) {
    try {
      // Verify bookmark exists and belongs to user
      const existingBookmark = await this.getBookmarkById(bookmarkId);
      
      if (existingBookmark.user_id !== userId) {
        throw new AppError('Unauthorized to delete this bookmark', 403);
      }

      await this.db.delete('video_bookmarks', { id: bookmarkId });

      logger.info('Bookmark deleted successfully', { bookmarkId, userId });

      return { deleted: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete bookmark', { error, bookmarkId, userId });
      throw new AppError('Failed to delete bookmark', 500);
    }
  }

  async getUserBookmarks(userId: string, limit: number = 50) {
    try {
      const bookmarks = await this.db.queryMany(
        `SELECT vb.*, v.title as video_title 
         FROM video_bookmarks vb
         LEFT JOIN videos v ON vb.video_id = v.id
         WHERE vb.user_id = $1 
         ORDER BY vb.created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );

      return bookmarks;
    } catch (error) {
      logger.error('Failed to get user bookmarks', { error, userId });
      throw new AppError('Failed to retrieve user bookmarks', 500);
    }
  }
}
