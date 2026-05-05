import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface ForumData {
  course_id: string;
  title: string;
  description: string;
  category: string;
  created_by: string;
}

interface PostData {
  forum_id: string;
  user_id: string;
  title: string;
  content: string;
  tags?: string[];
}

interface ReplyData {
  post_id: string;
  user_id: string;
  content: string;
}

export class ForumService {
  private db = getDatabase();

  /**
   * Create a new forum for a course
   */
  async createForum(forumData: ForumData) {
    try {
      if (!forumData.title || forumData.title.trim().length === 0) {
        throw new AppError('Forum title is required', 400);
      }

      if (!forumData.description || forumData.description.trim().length === 0) {
        throw new AppError('Forum description is required', 400);
      }

      const forum = await this.db.insert('forums', {
        course_id: forumData.course_id,
        title: forumData.title.trim(),
        description: forumData.description.trim(),
        category: forumData.category,
        created_by: forumData.created_by,
      });

      logger.info('Forum created successfully', { 
        forumId: forum.id, 
        courseId: forumData.course_id 
      });

      return forum;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create forum', { error, forumData });
      throw new AppError('Failed to create forum', 500);
    }
  }

  /**
   * Get forums for a course
   */
  async getForumsByCourse(courseId: string, category?: string) {
    try {
      let query = `
        SELECT f.*, 
               COUNT(DISTINCT fp.id) as post_count,
               u.first_name || ' ' || u.last_name as creator_name
        FROM forums f
        LEFT JOIN forum_posts fp ON f.id = fp.forum_id
        LEFT JOIN users u ON f.created_by = u.id
        WHERE f.course_id = $1
      `;
      const params: any[] = [courseId];

      if (category) {
        query += ' AND f.category = $2';
        params.push(category);
      }

      query += ' GROUP BY f.id, u.first_name, u.last_name ORDER BY f.created_at DESC';

      const forums = await this.db.queryMany(query, params);
      return forums;
    } catch (error) {
      logger.error('Failed to get forums by course', { error, courseId });
      throw new AppError('Failed to retrieve forums', 500);
    }
  }

  /**
   * Get a single forum by ID
   */
  async getForumById(forumId: string) {
    try {
      const forum = await this.db.queryOne(
        `SELECT f.*, 
                COUNT(DISTINCT fp.id) as post_count,
                u.first_name || ' ' || u.last_name as creator_name
         FROM forums f
         LEFT JOIN forum_posts fp ON f.id = fp.forum_id
         LEFT JOIN users u ON f.created_by = u.id
         WHERE f.id = $1
         GROUP BY f.id, u.first_name, u.last_name`,
        [forumId]
      );

      if (!forum) {
        throw new AppError('Forum not found', 404);
      }

      return forum;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get forum by ID', { error, forumId });
      throw new AppError('Failed to retrieve forum', 500);
    }
  }

  /**
   * Create a new post in a forum
   */
  async createPost(postData: PostData) {
    try {
      if (!postData.title || postData.title.trim().length === 0) {
        throw new AppError('Post title is required', 400);
      }

      if (!postData.content || postData.content.trim().length === 0) {
        throw new AppError('Post content is required', 400);
      }

      // Verify forum exists and is not locked
      const forum = await this.db.queryOne(
        'SELECT is_locked FROM forums WHERE id = $1',
        [postData.forum_id]
      );

      if (!forum) {
        throw new AppError('Forum not found', 404);
      }

      if (forum.is_locked) {
        throw new AppError('Forum is locked', 403);
      }

      const post = await this.db.insert('forum_posts', {
        forum_id: postData.forum_id,
        user_id: postData.user_id,
        title: postData.title.trim(),
        content: postData.content.trim(),
        tags: postData.tags ? JSON.stringify(postData.tags) : '[]',
      });

      logger.info('Forum post created successfully', { 
        postId: post.id, 
        forumId: postData.forum_id 
      });

      return {
        ...post,
        tags: JSON.parse(post.tags as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create forum post', { error, postData });
      throw new AppError('Failed to create forum post', 500);
    }
  }

  /**
   * Get posts for a forum
   */
  async getPostsByForum(forumId: string, options?: { page?: number; limit?: number; sortBy?: string }) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;
      const sortBy = options?.sortBy || 'created_at';

      let orderClause = 'fp.created_at DESC';
      if (sortBy === 'popular') {
        orderClause = 'fp.upvotes DESC, fp.views DESC';
      } else if (sortBy === 'recent') {
        orderClause = 'fp.updated_at DESC';
      }

      const posts = await this.db.queryMany(
        `SELECT fp.*, 
                u.first_name || ' ' || u.last_name as author_name,
                u.email as author_email,
                COUNT(DISTINCT fr.id) as reply_count
         FROM forum_posts fp
         LEFT JOIN users u ON fp.user_id = u.id
         LEFT JOIN forum_replies fr ON fp.id = fr.post_id
         WHERE fp.forum_id = $1
         GROUP BY fp.id, u.first_name, u.last_name, u.email
         ORDER BY fp.is_pinned DESC, ${orderClause}
         LIMIT $2 OFFSET $3`,
        [forumId, limit, offset]
      );

      const totalResult = await this.db.queryOne(
        'SELECT COUNT(*) as total FROM forum_posts WHERE forum_id = $1',
        [forumId]
      );

      return {
        posts: posts.map(post => ({
          ...post,
          tags: JSON.parse(post.tags as string),
        })),
        pagination: {
          page,
          limit,
          total: parseInt(totalResult.total),
          totalPages: Math.ceil(parseInt(totalResult.total) / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get posts by forum', { error, forumId });
      throw new AppError('Failed to retrieve forum posts', 500);
    }
  }

  /**
   * Get a single post by ID
   */
  async getPostById(postId: string) {
    try {
      const post = await this.db.queryOne(
        `SELECT fp.*, 
                u.first_name || ' ' || u.last_name as author_name,
                u.email as author_email,
                COUNT(DISTINCT fr.id) as reply_count
         FROM forum_posts fp
         LEFT JOIN users u ON fp.user_id = u.id
         LEFT JOIN forum_replies fr ON fp.id = fr.post_id
         WHERE fp.id = $1
         GROUP BY fp.id, u.first_name, u.last_name, u.email`,
        [postId]
      );

      if (!post) {
        throw new AppError('Post not found', 404);
      }

      // Increment view count
      await this.db.query(
        'UPDATE forum_posts SET views = views + 1 WHERE id = $1',
        [postId]
      );

      return {
        ...post,
        tags: JSON.parse(post.tags as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get post by ID', { error, postId });
      throw new AppError('Failed to retrieve post', 500);
    }
  }

  /**
   * Create a reply to a post
   */
  async createReply(replyData: ReplyData) {
    try {
      if (!replyData.content || replyData.content.trim().length === 0) {
        throw new AppError('Reply content is required', 400);
      }

      // Verify post exists and is not locked
      const post = await this.db.queryOne(
        `SELECT fp.is_locked, f.is_locked as forum_locked
         FROM forum_posts fp
         JOIN forums f ON fp.forum_id = f.id
         WHERE fp.id = $1`,
        [replyData.post_id]
      );

      if (!post) {
        throw new AppError('Post not found', 404);
      }

      if (post.is_locked || post.forum_locked) {
        throw new AppError('Post or forum is locked', 403);
      }

      const reply = await this.db.insert('forum_replies', {
        post_id: replyData.post_id,
        user_id: replyData.user_id,
        content: replyData.content.trim(),
      });

      // Update post's updated_at timestamp
      await this.db.query(
        'UPDATE forum_posts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [replyData.post_id]
      );

      logger.info('Forum reply created successfully', { 
        replyId: reply.id, 
        postId: replyData.post_id 
      });

      return reply;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create forum reply', { error, replyData });
      throw new AppError('Failed to create forum reply', 500);
    }
  }

  /**
   * Get replies for a post
   */
  async getRepliesByPost(postId: string) {
    try {
      const replies = await this.db.queryMany(
        `SELECT fr.*, 
                u.first_name || ' ' || u.last_name as author_name,
                u.email as author_email
         FROM forum_replies fr
         LEFT JOIN users u ON fr.user_id = u.id
         WHERE fr.post_id = $1
         ORDER BY fr.is_solution DESC, fr.upvotes DESC, fr.created_at ASC`,
        [postId]
      );

      return replies;
    } catch (error) {
      logger.error('Failed to get replies by post', { error, postId });
      throw new AppError('Failed to retrieve replies', 500);
    }
  }

  /**
   * Mark a reply as solution
   */
  async markReplyAsSolution(replyId: string, userId: string) {
    try {
      // Get the reply and verify the user is the post author
      const reply = await this.db.queryOne(
        `SELECT fr.post_id, fp.user_id as post_author_id
         FROM forum_replies fr
         JOIN forum_posts fp ON fr.post_id = fp.id
         WHERE fr.id = $1`,
        [replyId]
      );

      if (!reply) {
        throw new AppError('Reply not found', 404);
      }

      if (reply.post_author_id !== userId) {
        throw new AppError('Only the post author can mark a solution', 403);
      }

      // Unmark any existing solutions for this post
      await this.db.query(
        'UPDATE forum_replies SET is_solution = FALSE WHERE post_id = $1',
        [reply.post_id]
      );

      // Mark this reply as solution
      await this.db.query(
        'UPDATE forum_replies SET is_solution = TRUE WHERE id = $1',
        [replyId]
      );

      logger.info('Reply marked as solution', { replyId, postId: reply.post_id });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to mark reply as solution', { error, replyId });
      throw new AppError('Failed to mark reply as solution', 500);
    }
  }

  /**
   * Upvote a post
   */
  async upvotePost(postId: string) {
    try {
      await this.db.query(
        'UPDATE forum_posts SET upvotes = upvotes + 1 WHERE id = $1',
        [postId]
      );

      return { success: true };
    } catch (error) {
      logger.error('Failed to upvote post', { error, postId });
      throw new AppError('Failed to upvote post', 500);
    }
  }

  /**
   * Upvote a reply
   */
  async upvoteReply(replyId: string) {
    try {
      await this.db.query(
        'UPDATE forum_replies SET upvotes = upvotes + 1 WHERE id = $1',
        [replyId]
      );

      return { success: true };
    } catch (error) {
      logger.error('Failed to upvote reply', { error, replyId });
      throw new AppError('Failed to upvote reply', 500);
    }
  }

  /**
   * Update a post
   */
  async updatePost(postId: string, userId: string, updates: { title?: string; content?: string; tags?: string[] }) {
    try {
      // Verify ownership
      const post = await this.db.queryOne(
        'SELECT user_id FROM forum_posts WHERE id = $1',
        [postId]
      );

      if (!post) {
        throw new AppError('Post not found', 404);
      }

      if (post.user_id !== userId) {
        throw new AppError('You can only edit your own posts', 403);
      }

      const updateData: any = {};
      if (updates.title) updateData.title = updates.title.trim();
      if (updates.content) updateData.content = updates.content.trim();
      if (updates.tags) updateData.tags = JSON.stringify(updates.tags);

      if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid updates provided', 400);
      }

      await this.db.update('forum_posts', postId, updateData);

      logger.info('Forum post updated', { postId, userId });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update post', { error, postId });
      throw new AppError('Failed to update post', 500);
    }
  }

  /**
   * Delete a post
   */
  async deletePost(postId: string, userId: string, isAdmin: boolean = false) {
    try {
      const post = await this.db.queryOne(
        'SELECT user_id FROM forum_posts WHERE id = $1',
        [postId]
      );

      if (!post) {
        throw new AppError('Post not found', 404);
      }

      if (!isAdmin && post.user_id !== userId) {
        throw new AppError('You can only delete your own posts', 403);
      }

      await this.db.delete('forum_posts', postId);

      logger.info('Forum post deleted', { postId, userId, isAdmin });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete post', { error, postId });
      throw new AppError('Failed to delete post', 500);
    }
  }
}
