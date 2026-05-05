import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface NoteData {
  user_id: string;
  timestamp: number;
  content: string;
  is_public?: boolean;
  tags?: string[];
}

interface NoteUpdate {
  content?: string;
  is_public?: boolean;
  tags?: string[];
}

export class NoteService {
  private db = getDatabase();

  async createNote(videoId: string, noteData: NoteData) {
    try {
      // Validate note data
      if (!noteData.content || noteData.content.trim().length === 0) {
        throw new AppError('Note content cannot be empty', 400);
      }

      if (noteData.timestamp < 0) {
        throw new AppError('Timestamp must be non-negative', 400);
      }

      const note = await this.db.insert('video_notes', {
        video_id: videoId,
        user_id: noteData.user_id,
        timestamp: noteData.timestamp,
        content: noteData.content,
        is_public: noteData.is_public || false,
        tags: JSON.stringify(noteData.tags || []),
      });

      logger.info('Note created successfully', { 
        noteId: note.id, 
        videoId, 
        userId: noteData.user_id 
      });

      return {
        ...note,
        tags: JSON.parse(note.tags as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create note', { error, videoId, noteData });
      throw new AppError('Failed to create note', 500);
    }
  }

  async getNotesByVideo(videoId: string, userId: string, includePublic: boolean = false) {
    try {
      let query = `
        SELECT vn.*, u.first_name, u.last_name 
        FROM video_notes vn
        LEFT JOIN users u ON vn.user_id = u.id
        WHERE vn.video_id = $1 AND (vn.user_id = $2`;
      
      if (includePublic) {
        query += ` OR vn.is_public = true`;
      }
      
      query += `) ORDER BY vn.timestamp ASC`;

      const notes = await this.db.queryMany(query, [videoId, userId]);

      return notes.map(note => ({
        ...note,
        tags: JSON.parse(note.tags as string),
        author: note.first_name && note.last_name ? {
          first_name: note.first_name,
          last_name: note.last_name,
        } : null,
      }));
    } catch (error) {
      logger.error('Failed to get notes by video', { error, videoId, userId });
      throw new AppError('Failed to retrieve notes', 500);
    }
  }

  async getNoteById(noteId: string) {
    try {
      const note = await this.db.queryOne(
        'SELECT * FROM video_notes WHERE id = $1',
        [noteId]
      );

      if (!note) {
        throw new AppError('Note not found', 404);
      }

      return {
        ...note,
        tags: JSON.parse(note.tags as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get note by ID', { error, noteId });
      throw new AppError('Failed to retrieve note', 500);
    }
  }

  async updateNote(noteId: string, userId: string, updates: NoteUpdate) {
    try {
      // Verify note exists and belongs to user
      const existingNote = await this.getNoteById(noteId);
      
      if (existingNote.user_id !== userId) {
        throw new AppError('Unauthorized to update this note', 403);
      }

      const updateData: any = {};
      
      if (updates.content !== undefined) {
        if (updates.content.trim().length === 0) {
          throw new AppError('Note content cannot be empty', 400);
        }
        updateData.content = updates.content;
      }

      if (updates.is_public !== undefined) {
        updateData.is_public = updates.is_public;
      }

      if (updates.tags !== undefined) {
        updateData.tags = JSON.stringify(updates.tags);
      }

      if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid updates provided', 400);
      }

      const note = await this.db.update('video_notes', updateData, { id: noteId });

      logger.info('Note updated successfully', { noteId, userId });

      return {
        ...note,
        tags: JSON.parse(note.tags as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update note', { error, noteId, userId });
      throw new AppError('Failed to update note', 500);
    }
  }

  async deleteNote(noteId: string, userId: string) {
    try {
      // Verify note exists and belongs to user
      const existingNote = await this.getNoteById(noteId);
      
      if (existingNote.user_id !== userId) {
        throw new AppError('Unauthorized to delete this note', 403);
      }

      await this.db.delete('video_notes', { id: noteId });

      logger.info('Note deleted successfully', { noteId, userId });

      return { deleted: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete note', { error, noteId, userId });
      throw new AppError('Failed to delete note', 500);
    }
  }

  async searchNotes(userId: string, searchTerm: string, videoId?: string) {
    try {
      let query = `
        SELECT * FROM video_notes 
        WHERE user_id = $1 AND content ILIKE $2`;
      
      const params: any[] = [userId, `%${searchTerm}%`];
      
      if (videoId) {
        query += ` AND video_id = $3`;
        params.push(videoId);
      }
      
      query += ` ORDER BY created_at DESC LIMIT 50`;

      const notes = await this.db.queryMany(query, params);

      return notes.map(note => ({
        ...note,
        tags: JSON.parse(note.tags as string),
      }));
    } catch (error) {
      logger.error('Failed to search notes', { error, userId, searchTerm });
      throw new AppError('Failed to search notes', 500);
    }
  }
}
