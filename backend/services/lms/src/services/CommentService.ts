import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface CommentData {
  user_id: string;
  content: string;
  timestamp?: number;
  parent_id?: string;
}

interface VoteData {
  user_id: string;
  vote_type: 'upvote' | 'downvote';
}

export class CommentService {
  private db = getDatabase();

  async createComment(videoId: string, commentData: CommentData) {
    try {
      // Validate comment data
      if (!commentData.content || commentData.content.trim().length === 0) {
        throw new AppError('Comment content cannot be empty', 400);
      }

      if (commentData.timestamp !== undefined && commentData.timestamp < 0) {
        throw new AppError('Timestamp must be non-negative', 400);
      }

      // If parent_id is provided, verify it exists
      if (commentData.parent_id) {
        const parentComment = await this.getCommentById(commentData.parent_id);
        if (parentComment.video_id !== videoId) {
          throw new AppError('Parent comment does not belong to this video', 400);
        }
      }

      const comment = await this.db.insert('video_comments', {
        video_id: videoId,
        user_id: commentData.user_id,
        content: commentData.content,
        timestamp: commentData.timestamp || null,
        parent_id: commentData.parent_id || null,
        upvotes: 0,
        downvotes: 0,
      });

      logger.info('Comment created successfully', { 
        commentId: comment.id, 
        videoId, 
        userId: commentData.user_id,
        isReply: !!commentData.parent_id
      });

      return comment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create comment', { error, videoId, commentData });
      throw new AppError('Failed to create comment', 500);
    }
  }

  async getCommentsByVideo(videoId: string, userId?: string, limit: number = 50, offset: number = 0) {
    try {
      // Get top-level comments with user info and vote status
      const query = `
        SELECT 
          vc.*,
          u.first_name,
          u.last_name,
          ${userId ? `cv.vote_type as user_vote` : 'NULL as user_vote'},
          (SELECT COUNT(*) FROM video_comments WHERE parent_id = vc.id) as reply_count
        FROM video_comments vc
        LEFT JOIN users u ON vc.user_id = u.id
        ${userId ? `LEFT JOIN comment_votes cv ON vc.id = cv.comment_id AND cv.user_id = $2` : ''}
        WHERE vc.video_id = $1 AND vc.parent_id IS NULL
        ORDER BY vc.created_at DESC
        LIMIT ${userId ? '$3' : '$2'} OFFSET ${userId ? '$4' : '$3'}
      `;

      const params = userId 
        ? [videoId, userId, limit, offset]
        : [videoId, limit, offset];

      const comments = await this.db.queryMany(query, params);

      return comments.map(comment => ({
        ...comment,
        author: comment.first_name && comment.last_name ? {
          first_name: comment.first_name,
          last_name: comment.last_name,
        } : null,
        reply_count: parseInt(comment.reply_count as string, 10),
      }));
    } catch (error) {
      logger.error('Failed to get comments by video', { error, videoId });
      throw new AppError('Failed to retrieve comments', 500);
    }
  }

  async getCommentReplies(commentId: string, userId?: string) {
    try {
      const query = `
        SELECT 
          vc.*,
          u.first_name,
          u.last_name
          ${userId ? `, cv.vote_type as user_vote` : ''}
        FROM video_comments vc
        LEFT JOIN users u ON vc.user_id = u.id
        ${userId ? `LEFT JOIN comment_votes cv ON vc.id = cv.comment_id AND cv.user_id = $2` : ''}
        WHERE vc.parent_id = $1
        ORDER BY vc.created_at ASC
      `;

      const params = userId ? [commentId, userId] : [commentId];
      const replies = await this.db.queryMany(query, params);

      return replies.map(reply => ({
        ...reply,
        author: reply.first_name && reply.last_name ? {
          first_name: reply.first_name,
          last_name: reply.last_name,
        } : null,
      }));
    } catch (error) {
      logger.error('Failed to get comment replies', { error, commentId });
      throw new AppError('Failed to retrieve comment replies', 500);
    }
  }

  async getCommentById(commentId: string) {
    try {
      const comment = await this.db.queryOne(
        'SELECT * FROM video_comments WHERE id = $1',
        [commentId]
      );

      if (!comment) {
        throw new AppError('Comment not found', 404);
      }

      return comment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get comment by ID', { error, commentId });
      throw new AppError('Failed to retrieve comment', 500);
    }
  }

  async updateComment(commentId: string, userId: string, content: string) {
    try {
      // Verify comment exists and belongs to user
      const existingComment = await this.getCommentById(commentId);
      
      if (existingComment.user_id !== userId) {
        throw new AppError('Unauthorized to update this comment', 403);
      }

      if (!content || content.trim().length === 0) {
        throw new AppError('Comment content cannot be empty', 400);
      }

      const comment = await this.db.update('video_comments', 
        { content }, 
        { id: commentId }
      );

      logger.info('Comment updated successfully', { commentId, userId });

      return comment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update comment', { error, commentId, userId });
      throw new AppError('Failed to update comment', 500);
    }
  }

  async deleteComment(commentId: string, userId: string, isAdmin: boolean = false) {
    try {
      // Verify comment exists
      const existingComment = await this.getCommentById(commentId);
      
      // Only allow deletion by comment owner or admin
      if (!isAdmin && existingComment.user_id !== userId) {
        throw new AppError('Unauthorized to delete this comment', 403);
      }

      // Delete comment and all its replies (CASCADE)
      await this.db.delete('video_comments', { id: commentId });

      logger.info('Comment deleted successfully', { commentId, userId, isAdmin });

      return { deleted: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete comment', { error, commentId, userId });
      throw new AppError('Failed to delete comment', 500);
    }
  }

  async voteComment(commentId: string, voteData: VoteData) {
    try {
      // Verify comment exists
      await this.getCommentById(commentId);

      // Check if user has already voted
      const existingVote = await this.db.queryOne(
        'SELECT * FROM comment_votes WHERE comment_id = $1 AND user_id = $2',
        [commentId, voteData.user_id]
      );

      if (existingVote) {
        // If same vote type, remove the vote (toggle)
        if (existingVote.vote_type === voteData.vote_type) {
          await this.db.delete('comment_votes', { 
            comment_id: commentId, 
            user_id: voteData.user_id 
          });

          // Decrement vote count
          await this.updateVoteCount(commentId, voteData.vote_type, -1);

          logger.info('Vote removed', { commentId, userId: voteData.user_id, voteType: voteData.vote_type });

          return { action: 'removed', vote_type: voteData.vote_type };
        } else {
          // Change vote type
          await this.db.update('comment_votes', 
            { vote_type: voteData.vote_type },
            { comment_id: commentId, user_id: voteData.user_id }
          );

          // Update vote counts (decrement old, increment new)
          await this.updateVoteCount(commentId, existingVote.vote_type, -1);
          await this.updateVoteCount(commentId, voteData.vote_type, 1);

          logger.info('Vote changed', { 
            commentId, 
            userId: voteData.user_id, 
            from: existingVote.vote_type,
            to: voteData.vote_type 
          });

          return { action: 'changed', vote_type: voteData.vote_type };
        }
      } else {
        // Create new vote
        await this.db.insert('comment_votes', {
          comment_id: commentId,
          user_id: voteData.user_id,
          vote_type: voteData.vote_type,
        });

        // Increment vote count
        await this.updateVoteCount(commentId, voteData.vote_type, 1);

        logger.info('Vote added', { commentId, userId: voteData.user_id, voteType: voteData.vote_type });

        return { action: 'added', vote_type: voteData.vote_type };
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to vote on comment', { error, commentId, voteData });
      throw new AppError('Failed to vote on comment', 500);
    }
  }

  private async updateVoteCount(commentId: string, voteType: 'upvote' | 'downvote', delta: number) {
    const column = voteType === 'upvote' ? 'upvotes' : 'downvotes';
    await this.db.query(
      `UPDATE video_comments SET ${column} = ${column} + $1 WHERE id = $2`,
      [delta, commentId]
    );
  }

  async getCommentsByTimestamp(videoId: string, timestamp: number, range: number = 30) {
    try {
      // Get comments within a time range (e.g., ±30 seconds)
      const comments = await this.db.queryMany(
        `SELECT 
          vc.*,
          u.first_name,
          u.last_name
        FROM video_comments vc
        LEFT JOIN users u ON vc.user_id = u.id
        WHERE vc.video_id = $1 
          AND vc.timestamp IS NOT NULL
          AND vc.timestamp BETWEEN $2 AND $3
          AND vc.parent_id IS NULL
        ORDER BY vc.timestamp ASC`,
        [videoId, timestamp - range, timestamp + range]
      );

      return comments.map(comment => ({
        ...comment,
        author: comment.first_name && comment.last_name ? {
          first_name: comment.first_name,
          last_name: comment.last_name,
        } : null,
      }));
    } catch (error) {
      logger.error('Failed to get comments by timestamp', { error, videoId, timestamp });
      throw new AppError('Failed to retrieve comments', 500);
    }
  }
}
