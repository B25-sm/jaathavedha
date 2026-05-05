/**
 * Social Learning Service
 * Manages social learning features, study groups, and peer interactions
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import { SocialLearning, StudyGroup, PeerConnection, DiscussionParticipation, MentorshipInfo, LeaderboardEntry, CollaborativeProject } from '../types';

export class SocialLearningService {
  private db = getDatabase();
  private cache = getCache();

  /**
   * Get comprehensive social learning data for student
   */
  async getSocialLearning(studentId: string): Promise<SocialLearning> {
    try {
      const cacheKey = `social_learning:${studentId}`;
      const cached = await this.cache.get<SocialLearning>(cacheKey);
      if (cached) return cached;

      const [
        studyGroups,
        peerConnections,
        discussionParticipation,
        mentorshipInfo,
        leaderboards,
        collaborativeProjects
      ] = await Promise.all([
        this.getStudyGroups(studentId),
        this.getPeerConnections(studentId),
        this.getDiscussionParticipation(studentId),
        this.getMentorshipInfo(studentId),
        this.getLeaderboards(studentId),
        this.getCollaborativeProjects(studentId)
      ]);

      const socialLearning: SocialLearning = {
        study_groups: studyGroups,
        peer_connections: peerConnections,
        discussion_participation: discussionParticipation,
        mentorship: mentorshipInfo,
        leaderboards: leaderboards,
        collaborative_projects: collaborativeProjects
      };

      // Cache for 20 minutes
      await this.cache.set(cacheKey, socialLearning, { ttl: 1200 });

      return socialLearning;
    } catch (error) {
      logger.error('Failed to get social learning data', { error, studentId });
      throw new AppError('Failed to retrieve social learning data', 500);
    }
  }

  /**
   * Join a study group
   */
  async joinStudyGroup(studentId: string, groupId: string): Promise<void> {
    try {
      // Check if already a member
      const existingMembership = await this.db.queryOne<any>(
        'SELECT id FROM study_group_members WHERE group_id = $1 AND student_id = $2',
        [groupId, studentId]
      );

      if (existingMembership) {
        throw new AppError('Already a member of this study group', 400);
      }

      // Check group capacity
      const group = await this.db.queryOne<any>(
        'SELECT * FROM study_groups WHERE id = $1',
        [groupId]
      );

      if (!group) {
        throw new AppError('Study group not found', 404);
      }

      const memberCount = await this.db.queryOne<any>(
        'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1',
        [groupId]
      );

      if (parseInt(memberCount.count) >= group.max_members) {
        throw new AppError('Study group is full', 400);
      }

      // Add member to group
      await this.db.insert('study_group_members', {
        id: uuidv4(),
        group_id: groupId,
        student_id: studentId,
        joined_at: new Date(),
        role: 'member'
      });

      // Update group member count
      await this.db.update('study_groups', {
        member_count: parseInt(memberCount.count) + 1
      }, { id: groupId });

      // Invalidate cache
      await this.cache.del(`social_learning:${studentId}`);

      logger.info('Student joined study group', { studentId, groupId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to join study group', { error, studentId, groupId });
      throw new AppError('Failed to join study group', 500);
    }
  }

  /**
   * Create a new study group
   */
  async createStudyGroup(
    creatorId: string,
    name: string,
    description: string,
    courseId: string,
    maxMembers: number = 10
  ): Promise<StudyGroup> {
    try {
      const groupId = uuidv4();

      const group = await this.db.insert<any>('study_groups', {
        id: groupId,
        name,
        description,
        course_id: courseId,
        creator_id: creatorId,
        max_members: maxMembers,
        member_count: 1,
        activity_level: 'medium',
        created_at: new Date()
      });

      // Add creator as first member
      await this.db.insert('study_group_members', {
        id: uuidv4(),
        group_id: groupId,
        student_id: creatorId,
        joined_at: new Date(),
        role: 'admin'
      });

      // Invalidate cache
      await this.cache.del(`social_learning:${creatorId}`);

      logger.info('Study group created', { creatorId, groupId, name });

      return {
        id: groupId,
        name,
        description,
        course_id: courseId,
        member_count: 1,
        is_member: true,
        activity_level: 'medium' as any,
        next_session: new Date(),
        group_avatar: ''
      };
    } catch (error) {
      logger.error('Failed to create study group', { error, creatorId, name });
      throw new AppError('Failed to create study group', 500);
    }
  }

  /**
   * Connect with a peer
   */
  async connectWithPeer(
    studentId: string,
    peerId: string,
    connectionType: string
  ): Promise<void> {
    try {
      // Check if connection already exists
      const existingConnection = await this.db.queryOne<any>(`
        SELECT id FROM peer_connections 
        WHERE (student_id = $1 AND peer_id = $2) OR (student_id = $2 AND peer_id = $1)
      `, [studentId, peerId]);

      if (existingConnection) {
        throw new AppError('Connection already exists', 400);
      }

      // Create bidirectional connection
      await Promise.all([
        this.db.insert('peer_connections', {
          id: uuidv4(),
          student_id: studentId,
          peer_id: peerId,
          connection_type: connectionType,
          status: 'pending',
          created_at: new Date()
        }),
        this.db.insert('peer_connections', {
          id: uuidv4(),
          student_id: peerId,
          peer_id: studentId,
          connection_type: connectionType,
          status: 'pending',
          created_at: new Date()
        })
      ]);

      // Send notification to peer
      await this.sendConnectionRequest(studentId, peerId, connectionType);

      // Invalidate caches
      await Promise.all([
        this.cache.del(`social_learning:${studentId}`),
        this.cache.del(`social_learning:${peerId}`)
      ]);

      logger.info('Peer connection request sent', { studentId, peerId, connectionType });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to connect with peer', { error, studentId, peerId });
      throw new AppError('Failed to connect with peer', 500);
    }
  }

  /**
   * Accept peer connection
   */
  async acceptPeerConnection(studentId: string, connectionId: string): Promise<void> {
    try {
      // Update connection status
      await this.db.update('peer_connections', {
        status: 'accepted',
        accepted_at: new Date()
      }, { id: connectionId, peer_id: studentId });

      // Find and update the reverse connection
      const connection = await this.db.queryOne<any>(
        'SELECT * FROM peer_connections WHERE id = $1',
        [connectionId]
      );

      if (connection) {
        await this.db.update('peer_connections', {
          status: 'accepted',
          accepted_at: new Date()
        }, { 
          student_id: connection.peer_id, 
          peer_id: connection.student_id 
        });

        // Invalidate caches
        await Promise.all([
          this.cache.del(`social_learning:${studentId}`),
          this.cache.del(`social_learning:${connection.student_id}`)
        ]);
      }

      logger.info('Peer connection accepted', { studentId, connectionId });
    } catch (error) {
      logger.error('Failed to accept peer connection', { error, studentId, connectionId });
      throw new AppError('Failed to accept peer connection', 500);
    }
  }

  /**
   * Post in discussion forum
   */
  async postInDiscussion(
    studentId: string,
    discussionId: string,
    content: string,
    parentPostId?: string
  ): Promise<void> {
    try {
      const postId = uuidv4();

      await this.db.insert('discussion_posts', {
        id: postId,
        discussion_id: discussionId,
        student_id: studentId,
        content,
        parent_post_id: parentPostId,
        created_at: new Date()
      });

      // Update discussion participation
      await this.updateDiscussionParticipation(studentId, discussionId, 'post');

      // Invalidate cache
      await this.cache.del(`social_learning:${studentId}`);

      logger.info('Discussion post created', { studentId, discussionId, postId });
    } catch (error) {
      logger.error('Failed to post in discussion', { error, studentId, discussionId });
      throw new AppError('Failed to post in discussion', 500);
    }
  }

  /**
   * Request mentorship
   */
  async requestMentorship(
    menteeId: string,
    mentorId: string,
    message: string
  ): Promise<void> {
    try {
      const requestId = uuidv4();

      await this.db.insert('mentorship_requests', {
        id: requestId,
        mentee_id: menteeId,
        mentor_id: mentorId,
        message,
        status: 'pending',
        created_at: new Date()
      });

      // Send notification to potential mentor
      await this.sendMentorshipRequest(menteeId, mentorId, message);

      logger.info('Mentorship request sent', { menteeId, mentorId, requestId });
    } catch (error) {
      logger.error('Failed to request mentorship', { error, menteeId, mentorId });
      throw new AppError('Failed to request mentorship', 500);
    }
  }

  // Private helper methods

  private async getStudyGroups(studentId: string): Promise<StudyGroup[]> {
    try {
      const groups = await this.db.queryMany<any>(`
        SELECT 
          sg.*,
          CASE WHEN sgm.student_id IS NOT NULL THEN true ELSE false END as is_member
        FROM study_groups sg
        LEFT JOIN study_group_members sgm ON sg.id = sgm.group_id AND sgm.student_id = $1
        WHERE sg.is_active = true
        ORDER BY 
          CASE WHEN sgm.student_id IS NOT NULL THEN 0 ELSE 1 END,
          sg.activity_level DESC,
          sg.created_at DESC
        LIMIT 20
      `, [studentId]);

      return groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        course_id: group.course_id,
        member_count: group.member_count,
        is_member: group.is_member,
        activity_level: group.activity_level,
        next_session: group.next_session || new Date(),
        group_avatar: group.group_avatar || ''
      }));
    } catch (error) {
      logger.error('Failed to get study groups', { error, studentId });
      return [];
    }
  }

  private async getPeerConnections(studentId: string): Promise<PeerConnection[]> {
    try {
      const connections = await this.db.queryMany<any>(`
        SELECT 
          pc.*,
          u.first_name || ' ' || u.last_name as peer_name,
          u.avatar_url as peer_avatar,
          COUNT(DISTINCT e1.program_id) as shared_courses,
          pc.last_interaction
        FROM peer_connections pc
        JOIN users u ON pc.peer_id = u.id
        LEFT JOIN enrollments e1 ON pc.peer_id = e1.user_id
        LEFT JOIN enrollments e2 ON pc.student_id = e2.user_id AND e1.program_id = e2.program_id
        WHERE pc.student_id = $1 AND pc.status = 'accepted'
        GROUP BY pc.id, u.first_name, u.last_name, u.avatar_url, pc.last_interaction
        ORDER BY pc.last_interaction DESC
        LIMIT 20
      `, [studentId]);

      return connections.map(conn => ({
        peer_id: conn.peer_id,
        peer_name: conn.peer_name,
        peer_avatar: conn.peer_avatar || '',
        connection_type: conn.connection_type,
        shared_courses: parseInt(conn.shared_courses || '0', 10),
        study_compatibility: this.calculateStudyCompatibility(conn),
        last_interaction: conn.last_interaction
      }));
    } catch (error) {
      logger.error('Failed to get peer connections', { error, studentId });
      return [];
    }
  }

  private async getDiscussionParticipation(studentId: string): Promise<DiscussionParticipation> {
    try {
      const stats = await this.db.queryOne<any>(`
        SELECT 
          COUNT(DISTINCT dp.id) as total_posts,
          COUNT(DISTINCT CASE WHEN dp.is_helpful THEN dp.id END) as helpful_answers,
          COUNT(DISTINCT CASE WHEN dp.parent_post_id IS NULL THEN dp.id END) as questions_asked,
          COALESCE(AVG(dp.reputation_score), 0) as reputation_score
        FROM discussion_posts dp
        WHERE dp.student_id = $1
      `, [studentId]);

      const activeDiscussions = await this.db.queryMany<any>(`
        SELECT DISTINCT
          d.id as discussion_id,
          d.title,
          c.name as course_name,
          d.last_activity,
          COUNT(CASE WHEN dp.is_read = false AND dp.student_id != $1 THEN 1 END) as unread_messages,
          CASE 
            WHEN d.creator_id = $1 THEN 'creator'
            WHEN COUNT(dp.id) > 5 THEN 'active_participant'
            WHEN COUNT(dp.id) > 0 THEN 'observer'
            ELSE 'observer'
          END as your_participation
        FROM discussions d
        JOIN programs c ON d.course_id = c.id
        LEFT JOIN discussion_posts dp ON d.id = dp.discussion_id
        WHERE d.id IN (
          SELECT DISTINCT discussion_id 
          FROM discussion_posts 
          WHERE student_id = $1
        )
        GROUP BY d.id, d.title, c.name, d.last_activity, d.creator_id
        ORDER BY d.last_activity DESC
        LIMIT 10
      `, [studentId]);

      return {
        total_posts: parseInt(stats?.total_posts || '0', 10),
        helpful_answers: parseInt(stats?.helpful_answers || '0', 10),
        questions_asked: parseInt(stats?.questions_asked || '0', 10),
        reputation_score: parseFloat(stats?.reputation_score || '0'),
        active_discussions: activeDiscussions.map(disc => ({
          discussion_id: disc.discussion_id,
          title: disc.title,
          course_name: disc.course_name,
          last_activity: disc.last_activity,
          unread_messages: parseInt(disc.unread_messages || '0', 10),
          your_participation: disc.your_participation
        }))
      };
    } catch (error) {
      logger.error('Failed to get discussion participation', { error, studentId });
      return {
        total_posts: 0,
        helpful_answers: 0,
        questions_asked: 0,
        reputation_score: 0,
        active_discussions: []
      };
    }
  }

  private async getMentorshipInfo(studentId: string): Promise<MentorshipInfo> {
    try {
      // Check if student is a mentor
      const mentorInfo = await this.db.queryOne<any>(
        'SELECT * FROM mentors WHERE student_id = $1',
        [studentId]
      );

      // Check if student has a mentor
      const menteeInfo = await this.db.queryOne<any>(`
        SELECT 
          m.*,
          u.first_name || ' ' || u.last_name as mentor_name,
          u.avatar_url as mentor_avatar
        FROM mentorships m
        JOIN users u ON m.mentor_id = u.id
        WHERE m.mentee_id = $1 AND m.status = 'active'
      `, [studentId]);

      // Get mentorship requests
      const requests = await this.db.queryMany<any>(`
        SELECT * FROM mentorship_requests 
        WHERE (mentor_id = $1 OR mentee_id = $1) AND status = 'pending'
        ORDER BY created_at DESC
      `, [studentId]);

      return {
        is_mentor: !!mentorInfo,
        is_mentee: !!menteeInfo,
        mentor_details: menteeInfo ? {
          mentor_id: menteeInfo.mentor_id,
          mentor_name: menteeInfo.mentor_name,
          mentor_avatar: menteeInfo.mentor_avatar || '',
          expertise_areas: menteeInfo.expertise_areas || [],
          mentorship_start_date: menteeInfo.start_date,
          next_session: menteeInfo.next_session,
          total_sessions: menteeInfo.total_sessions || 0
        } : undefined,
        mentee_details: mentorInfo ? {
          mentee_count: mentorInfo.mentee_count || 0,
          active_mentees: [], // Would populate with actual mentees
          mentorship_rating: mentorInfo.rating || 0,
          total_mentorship_hours: mentorInfo.total_hours || 0
        } : undefined,
        mentorship_requests: requests.map(req => ({
          id: req.id,
          requester_id: req.mentee_id === studentId ? req.mentor_id : req.mentee_id,
          requester_name: '', // Would populate with actual name
          request_type: req.mentee_id === studentId ? 'find_mentor' : 'become_mentor',
          message: req.message,
          status: req.status,
          created_at: req.created_at
        }))
      };
    } catch (error) {
      logger.error('Failed to get mentorship info', { error, studentId });
      return {
        is_mentor: false,
        is_mentee: false,
        mentorship_requests: []
      };
    }
  }

  private async getLeaderboards(studentId: string): Promise<LeaderboardEntry[]> {
    try {
      const leaderboards: LeaderboardEntry[] = [];

      // Course completion leaderboard
      const completionLeaderboard = await this.getCompletionLeaderboard(studentId);
      leaderboards.push(completionLeaderboard);

      // Study streak leaderboard
      const streakLeaderboard = await this.getStreakLeaderboard(studentId);
      leaderboards.push(streakLeaderboard);

      // Quiz scores leaderboard
      const quizLeaderboard = await this.getQuizLeaderboard(studentId);
      leaderboards.push(quizLeaderboard);

      return leaderboards;
    } catch (error) {
      logger.error('Failed to get leaderboards', { error, studentId });
      return [];
    }
  }

  private async getCollaborativeProjects(studentId: string): Promise<CollaborativeProject[]> {
    try {
      const projects = await this.db.queryMany<any>(`
        SELECT 
          cp.*,
          c.name as course_name,
          COUNT(cpm.student_id) as team_size
        FROM collaborative_projects cp
        JOIN programs c ON cp.course_id = c.id
        JOIN collaborative_project_members cpm ON cp.id = cpm.project_id
        WHERE cp.id IN (
          SELECT project_id 
          FROM collaborative_project_members 
          WHERE student_id = $1
        )
        GROUP BY cp.id, c.name
        ORDER BY cp.created_at DESC
      `, [studentId]);

      const collaborativeProjects: CollaborativeProject[] = [];

      for (const project of projects) {
        const teamMembers = await this.getProjectTeamMembers(project.id);
        const userRole = await this.getUserProjectRole(studentId, project.id);

        collaborativeProjects.push({
          id: project.id,
          title: project.title,
          description: project.description,
          course_id: project.course_id,
          team_members: teamMembers,
          project_status: project.status,
          deadline: project.deadline,
          progress_percentage: project.progress_percentage || 0,
          your_role: userRole
        });
      }

      return collaborativeProjects;
    } catch (error) {
      logger.error('Failed to get collaborative projects', { error, studentId });
      return [];
    }
  }

  // Additional helper methods

  private calculateStudyCompatibility(connection: any): number {
    // Implementation would calculate compatibility score based on:
    // - Shared courses
    // - Study times
    // - Learning styles
    // - Performance levels
    return Math.floor(Math.random() * 40) + 60; // Placeholder: 60-100
  }

  private async sendConnectionRequest(studentId: string, peerId: string, connectionType: string): Promise<void> {
    // Implementation would send notification to peer
    logger.debug('Connection request notification sent', { studentId, peerId, connectionType });
  }

  private async updateDiscussionParticipation(
    studentId: string,
    discussionId: string,
    actionType: string
  ): Promise<void> {
    // Implementation would update participation metrics
    logger.debug('Discussion participation updated', { studentId, discussionId, actionType });
  }

  private async sendMentorshipRequest(menteeId: string, mentorId: string, message: string): Promise<void> {
    // Implementation would send mentorship request notification
    logger.debug('Mentorship request notification sent', { menteeId, mentorId });
  }

  private async getCompletionLeaderboard(studentId: string): Promise<LeaderboardEntry> {
    // Implementation would get course completion leaderboard
    return {
      leaderboard_type: 'course_completion' as any,
      student_rank: 15,
      total_participants: 100,
      score: 85,
      score_type: 'completion_percentage',
      time_period: 'monthly' as any,
      top_performers: []
    };
  }

  private async getStreakLeaderboard(studentId: string): Promise<LeaderboardEntry> {
    // Implementation would get study streak leaderboard
    return {
      leaderboard_type: 'study_streak' as any,
      student_rank: 8,
      total_participants: 100,
      score: 25,
      score_type: 'days',
      time_period: 'all_time' as any,
      top_performers: []
    };
  }

  private async getQuizLeaderboard(studentId: string): Promise<LeaderboardEntry> {
    // Implementation would get quiz scores leaderboard
    return {
      leaderboard_type: 'quiz_scores' as any,
      student_rank: 12,
      total_participants: 100,
      score: 92,
      score_type: 'average_score',
      time_period: 'weekly' as any,
      top_performers: []
    };
  }

  private async getProjectTeamMembers(projectId: string): Promise<any[]> {
    return await this.db.queryMany<any>(`
      SELECT 
        cpm.*,
        u.first_name || ' ' || u.last_name as student_name,
        u.avatar_url as student_avatar
      FROM collaborative_project_members cpm
      JOIN users u ON cpm.student_id = u.id
      WHERE cpm.project_id = $1
    `, [projectId]);
  }

  private async getUserProjectRole(studentId: string, projectId: string): Promise<any> {
    const member = await this.db.queryOne<any>(
      'SELECT role FROM collaborative_project_members WHERE student_id = $1 AND project_id = $2',
      [studentId, projectId]
    );
    return member?.role || 'developer';
  }
}