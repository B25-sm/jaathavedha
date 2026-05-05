/**
 * Social Learning Service
 * Handles mobile social learning and peer interaction features
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '@sai-mahendra/utils';
import {
  StudyGroup,
  StudyGroupMember,
  PeerChat,
  PeerInteraction,
  StudySession,
  PeerHelpRequest,
  ResourceShare,
  CollaborativeNote,
  PeerRecommendation,
  CreateStudyGroupRequest,
  JoinStudyGroupRequest,
  SendChatMessageRequest,
  CreateHelpRequestRequest,
  ShareResourceRequest,
  ScheduleStudySessionRequest,
} from '../types/mobileFeatures';
import { v4 as uuidv4 } from 'uuid';

export class SocialLearningService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    private db: Pool,
    private redis: Redis
  ) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'sai-mahendra-social';
  }

  // ==================== Study Groups ====================

  /**
   * Create study group
   */
  async createStudyGroup(
    userId: string,
    request: CreateStudyGroupRequest
  ): Promise<StudyGroup> {
    try {
      const inviteCode = request.isPrivate ? this.generateInviteCode() : null;

      const result = await this.db.query(
        `INSERT INTO study_groups 
         (name, description, course_id, creator_id, max_members, 
          is_private, invite_code, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          request.name,
          request.description,
          request.courseId,
          userId,
          request.maxMembers || 50,
          request.isPrivate || false,
          inviteCode,
          JSON.stringify(request.tags || []),
        ]
      );

      const groupId = result.rows[0].id;

      // Add creator as admin member
      await this.db.query(
        `INSERT INTO study_group_members (group_id, user_id, role)
         VALUES ($1, $2, 'creator')`,
        [groupId, userId]
      );

      logger.info(`Study group created: ${groupId}`);
      return this.mapStudyGroupRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating study group:', error);
      throw new Error('Failed to create study group');
    }
  }

  /**
   * Join study group
   */
  async joinStudyGroup(
    userId: string,
    request: JoinStudyGroupRequest
  ): Promise<StudyGroupMember> {
    try {
      // Check if group exists and has space
      const groupResult = await this.db.query(
        `SELECT g.*, COUNT(m.user_id) as member_count
         FROM study_groups g
         LEFT JOIN study_group_members m ON m.group_id = g.id
         WHERE g.id = $1
         GROUP BY g.id`,
        [request.groupId]
      );

      if (groupResult.rows.length === 0) {
        throw new Error('Study group not found');
      }

      const group = groupResult.rows[0];

      if (group.member_count >= group.max_members) {
        throw new Error('Study group is full');
      }

      if (group.is_private && group.invite_code !== request.inviteCode) {
        throw new Error('Invalid invite code');
      }

      // Check if already a member
      const existingMember = await this.db.query(
        `SELECT * FROM study_group_members WHERE group_id = $1 AND user_id = $2`,
        [request.groupId, userId]
      );

      if (existingMember.rows.length > 0) {
        throw new Error('Already a member of this group');
      }

      // Add member
      const result = await this.db.query(
        `INSERT INTO study_group_members (group_id, user_id, role)
         VALUES ($1, $2, 'member')
         RETURNING *`,
        [request.groupId, userId]
      );

      // Update group activity
      await this.db.query(
        `UPDATE study_groups SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [request.groupId]
      );

      logger.info(`User ${userId} joined study group ${request.groupId}`);
      return this.mapStudyGroupMemberRow(result.rows[0]);
    } catch (error) {
      logger.error('Error joining study group:', error);
      throw new Error('Failed to join study group');
    }
  }

  /**
   * Get user's study groups
   */
  async getUserStudyGroups(userId: string, courseId?: string): Promise<StudyGroup[]> {
    try {
      let query = `
        SELECT g.*, COUNT(m.user_id) as member_count
        FROM study_groups g
        JOIN study_group_members sgm ON sgm.group_id = g.id
        LEFT JOIN study_group_members m ON m.group_id = g.id
        WHERE sgm.user_id = $1
      `;
      const params: any[] = [userId];

      if (courseId) {
        query += ` AND g.course_id = $2`;
        params.push(courseId);
      }

      query += ` GROUP BY g.id ORDER BY g.last_activity_at DESC`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapStudyGroupRow);
    } catch (error) {
      logger.error('Error getting user study groups:', error);
      throw new Error('Failed to get user study groups');
    }
  }

  /**
   * Search study groups
   */
  async searchStudyGroups(
    courseId: string,
    searchQuery?: string,
    tags?: string[]
  ): Promise<StudyGroup[]> {
    try {
      let query = `
        SELECT g.*, COUNT(m.user_id) as member_count
        FROM study_groups g
        LEFT JOIN study_group_members m ON m.group_id = g.id
        WHERE g.course_id = $1 AND g.is_private = false
      `;
      const params: any[] = [courseId];
      let paramIndex = 2;

      if (searchQuery) {
        query += ` AND (g.name ILIKE $${paramIndex} OR g.description ILIKE $${paramIndex})`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
      }

      if (tags && tags.length > 0) {
        query += ` AND g.tags ?| $${paramIndex}`;
        params.push(tags);
        paramIndex++;
      }

      query += ` GROUP BY g.id ORDER BY g.last_activity_at DESC LIMIT 50`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapStudyGroupRow);
    } catch (error) {
      logger.error('Error searching study groups:', error);
      throw new Error('Failed to search study groups');
    }
  }

  // ==================== Peer Chat ====================

  /**
   * Send chat message
   */
  async sendChatMessage(
    userId: string,
    request: SendChatMessageRequest
  ): Promise<PeerChat> {
    try {
      // Verify user is member of group (if group chat)
      if (request.groupId) {
        const memberCheck = await this.db.query(
          `SELECT * FROM study_group_members WHERE group_id = $1 AND user_id = $2`,
          [request.groupId, userId]
        );

        if (memberCheck.rows.length === 0) {
          throw new Error('Not a member of this group');
        }
      }

      const result = await this.db.query(
        `INSERT INTO peer_chats 
         (group_id, sender_id, recipient_id, message_type, content, 
          attachment_url, reply_to_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          request.groupId,
          userId,
          request.recipientId,
          request.messageType,
          request.content,
          request.attachmentUrl,
          request.replyToId,
        ]
      );

      // Update group activity
      if (request.groupId) {
        await this.db.query(
          `UPDATE study_groups SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [request.groupId]
        );
      }

      // Send real-time notification via Redis pub/sub
      await this.redis.publish(
        `chat:${request.groupId || request.recipientId}`,
        JSON.stringify(result.rows[0])
      );

      logger.info(`Chat message sent: ${result.rows[0].id}`);
      return this.mapPeerChatRow(result.rows[0]);
    } catch (error) {
      logger.error('Error sending chat message:', error);
      throw new Error('Failed to send chat message');
    }
  }

  /**
   * Get chat messages
   */
  async getChatMessages(
    userId: string,
    groupId?: string,
    recipientId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PeerChat[]> {
    try {
      let query = `SELECT * FROM peer_chats WHERE `;
      const params: any[] = [];
      let paramIndex = 1;

      if (groupId) {
        query += `group_id = $${paramIndex}`;
        params.push(groupId);
      } else if (recipientId) {
        query += `(sender_id = $${paramIndex} AND recipient_id = $${paramIndex + 1}) 
                  OR (sender_id = $${paramIndex + 1} AND recipient_id = $${paramIndex})`;
        params.push(userId, recipientId);
        paramIndex += 2;
      } else {
        throw new Error('Either groupId or recipientId must be provided');
      }

      query += ` AND is_deleted = false ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapPeerChatRow).reverse();
    } catch (error) {
      logger.error('Error getting chat messages:', error);
      throw new Error('Failed to get chat messages');
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(userId: string, messageIds: string[]): Promise<void> {
    try {
      await this.db.query(
        `UPDATE peer_chats 
         SET read_by = array_append(read_by, $1)
         WHERE id = ANY($2) AND NOT ($1 = ANY(read_by))`,
        [userId, messageIds]
      );

      logger.info(`Messages marked as read by user ${userId}`);
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      throw new Error('Failed to mark messages as read');
    }
  }

  // ==================== Help Requests ====================

  /**
   * Create help request
   */
  async createHelpRequest(
    userId: string,
    request: CreateHelpRequestRequest
  ): Promise<PeerHelpRequest> {
    try {
      const result = await this.db.query(
        `INSERT INTO peer_help_requests 
         (user_id, course_id, lesson_id, title, description, tags, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          userId,
          request.courseId,
          request.lessonId,
          request.title,
          request.description,
          JSON.stringify(request.tags || []),
          request.priority || 'medium',
        ]
      );

      logger.info(`Help request created: ${result.rows[0].id}`);
      return this.mapHelpRequestRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating help request:', error);
      throw new Error('Failed to create help request');
    }
  }

  /**
   * Get help requests
   */
  async getHelpRequests(
    courseId: string,
    status?: string,
    userId?: string
  ): Promise<PeerHelpRequest[]> {
    try {
      let query = `SELECT * FROM peer_help_requests WHERE course_id = $1`;
      const params: any[] = [courseId];
      let paramIndex = 2;

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (userId) {
        query += ` AND user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT 100`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapHelpRequestRow);
    } catch (error) {
      logger.error('Error getting help requests:', error);
      throw new Error('Failed to get help requests');
    }
  }

  /**
   * Respond to help request
   */
  async respondToHelpRequest(
    requestId: string,
    userId: string,
    content: string
  ): Promise<PeerHelpRequest> {
    try {
      const result = await this.db.query(
        `UPDATE peer_help_requests 
         SET responses = responses || $1::jsonb,
             status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [
          JSON.stringify({
            userId,
            content,
            isHelpful: false,
            votes: 0,
            timestamp: new Date(),
          }),
          requestId,
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Help request not found');
      }

      logger.info(`Response added to help request: ${requestId}`);
      return this.mapHelpRequestRow(result.rows[0]);
    } catch (error) {
      logger.error('Error responding to help request:', error);
      throw new Error('Failed to respond to help request');
    }
  }

  // ==================== Resource Sharing ====================

  /**
   * Share resource
   */
  async shareResource(
    userId: string,
    request: ShareResourceRequest
  ): Promise<ResourceShare> {
    try {
      let fileUrl: string | undefined;

      // Upload file if provided
      if (request.fileData) {
        const fileBuffer = Buffer.from(request.fileData, 'base64');
        const fileKey = `resources/${userId}/${uuidv4()}`;

        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            Body: fileBuffer,
          })
        );

        fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${fileKey}`;
      }

      const result = await this.db.query(
        `INSERT INTO resource_shares 
         (user_id, group_id, course_id, lesson_id, resource_type, 
          title, description, resource_url, file_url, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId,
          request.groupId,
          request.courseId,
          request.lessonId,
          request.resourceType,
          request.title,
          request.description,
          request.resourceUrl,
          fileUrl,
          JSON.stringify(request.tags || []),
        ]
      );

      logger.info(`Resource shared: ${result.rows[0].id}`);
      return this.mapResourceShareRow(result.rows[0]);
    } catch (error) {
      logger.error('Error sharing resource:', error);
      throw new Error('Failed to share resource');
    }
  }

  /**
   * Get shared resources
   */
  async getSharedResources(
    courseId: string,
    groupId?: string,
    resourceType?: string
  ): Promise<ResourceShare[]> {
    try {
      let query = `SELECT * FROM resource_shares WHERE course_id = $1`;
      const params: any[] = [courseId];
      let paramIndex = 2;

      if (groupId) {
        query += ` AND group_id = $${paramIndex}`;
        params.push(groupId);
        paramIndex++;
      }

      if (resourceType) {
        query += ` AND resource_type = $${paramIndex}`;
        params.push(resourceType);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT 100`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapResourceShareRow);
    } catch (error) {
      logger.error('Error getting shared resources:', error);
      throw new Error('Failed to get shared resources');
    }
  }

  // ==================== Study Sessions ====================

  /**
   * Schedule study session
   */
  async scheduleStudySession(
    userId: string,
    request: ScheduleStudySessionRequest
  ): Promise<StudySession> {
    try {
      const result = await this.db.query(
        `INSERT INTO study_sessions 
         (group_id, host_id, title, description, course_id, lesson_id, 
          scheduled_at, duration, participant_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          request.groupId,
          userId,
          request.title,
          request.description,
          request.courseId,
          request.lessonId,
          request.scheduledAt,
          request.duration,
          JSON.stringify(request.participantIds || []),
        ]
      );

      logger.info(`Study session scheduled: ${result.rows[0].id}`);
      return this.mapStudySessionRow(result.rows[0]);
    } catch (error) {
      logger.error('Error scheduling study session:', error);
      throw new Error('Failed to schedule study session');
    }
  }

  /**
   * Get study sessions
   */
  async getStudySessions(
    userId: string,
    groupId?: string,
    status?: string
  ): Promise<StudySession[]> {
    try {
      let query = `
        SELECT * FROM study_sessions 
        WHERE (host_id = $1 OR $1 = ANY(participant_ids))
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (groupId) {
        query += ` AND group_id = $${paramIndex}`;
        params.push(groupId);
        paramIndex++;
      }

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      query += ` ORDER BY scheduled_at DESC`;

      const result = await this.db.query(query, params);
      return result.rows.map(this.mapStudySessionRow);
    } catch (error) {
      logger.error('Error getting study sessions:', error);
      throw new Error('Failed to get study sessions');
    }
  }

  // ==================== Peer Recommendations ====================

  /**
   * Get peer recommendations
   */
  async getPeerRecommendations(userId: string, courseId: string): Promise<PeerRecommendation[]> {
    try {
      // Find peers with similar progress in the same course
      const result = await this.db.query(
        `SELECT 
           u.id as recommended_peer_id,
           'similar_progress' as reason,
           0.8 as score,
           ARRAY[$1] as common_courses
         FROM users u
         JOIN enrollments e ON e.user_id = u.id
         WHERE e.course_id = $1 
           AND u.id != $2
           AND u.id NOT IN (
             SELECT peer_id FROM peer_interactions 
             WHERE user_id = $2 AND interaction_type = 'message'
           )
         LIMIT 10`,
        [courseId, userId]
      );

      return result.rows.map((row) => ({
        userId,
        recommendedPeerId: row.recommended_peer_id,
        reason: row.reason,
        score: parseFloat(row.score),
        commonCourses: row.common_courses,
      }));
    } catch (error) {
      logger.error('Error getting peer recommendations:', error);
      throw new Error('Failed to get peer recommendations');
    }
  }

  // ==================== Helper Methods ====================

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  private mapStudyGroupRow(row: any): StudyGroup {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      courseId: row.course_id,
      creatorId: row.creator_id,
      memberIds: [], // Populated separately if needed
      maxMembers: row.max_members,
      isPrivate: row.is_private,
      inviteCode: row.invite_code,
      tags: row.tags || [],
      activityLevel: 'medium', // Calculated based on activity
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastActivityAt: row.last_activity_at,
    };
  }

  private mapStudyGroupMemberRow(row: any): StudyGroupMember {
    return {
      groupId: row.group_id,
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      lastActiveAt: row.last_active_at,
      contributionScore: row.contribution_score || 0,
      isMuted: row.is_muted || false,
    };
  }

  private mapPeerChatRow(row: any): PeerChat {
    return {
      id: row.id,
      groupId: row.group_id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      messageType: row.message_type,
      content: row.content,
      attachmentUrl: row.attachment_url,
      replyToId: row.reply_to_id,
      isEdited: row.is_edited || false,
      isDeleted: row.is_deleted || false,
      readBy: row.read_by || [],
      reactions: row.reactions || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapHelpRequestRow(row: any): PeerHelpRequest {
    return {
      id: row.id,
      userId: row.user_id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      title: row.title,
      description: row.description,
      tags: row.tags || [],
      status: row.status,
      priority: row.priority,
      helperId: row.helper_id,
      responses: row.responses || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
    };
  }

  private mapResourceShareRow(row: any): ResourceShare {
    return {
      id: row.id,
      userId: row.user_id,
      groupId: row.group_id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      resourceType: row.resource_type,
      title: row.title,
      description: row.description,
      resourceUrl: row.resource_url,
      fileUrl: row.file_url,
      tags: row.tags || [],
      likes: row.likes || 0,
      views: row.views || 0,
      comments: row.comments || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapStudySessionRow(row: any): StudySession {
    return {
      id: row.id,
      groupId: row.group_id,
      hostId: row.host_id,
      title: row.title,
      description: row.description,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      scheduledAt: row.scheduled_at,
      duration: row.duration,
      participantIds: row.participant_ids || [],
      status: row.status,
      meetingUrl: row.meeting_url,
      recordingUrl: row.recording_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
