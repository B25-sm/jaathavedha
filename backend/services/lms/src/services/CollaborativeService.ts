/**
 * Collaborative Learning Service
 * Handles forums, study groups, assignments, and peer reviews
 */

import { getPostgresPool } from '@sai-mahendra/database';
import crypto from 'crypto';
import {
  Forum,
  ForumPost,
  ForumReply,
  StudyGroup,
  StudyGroupMember,
  Assignment,
  AssignmentSubmission,
  PeerReview,
  PaginationParams,
  PaginatedResponse
} from '../types';

export class CollaborativeService {
  /**
   * Create a new forum
   */
  async createForum(forumData: Partial<Forum>, createdBy: string): Promise<Forum> {
    const pool = getPostgresPool();
    const forumId = crypto.randomUUID();

    const query = `
      INSERT INTO forums (
        id, course_id, title, description, category, is_locked, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, false, $6, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      forumId,
      forumData.courseId,
      forumData.title,
      forumData.description,
      forumData.category,
      createdBy
    ];

    const result = await pool.query(query, values);
    return this.mapForumRow(result.rows[0]);
  }

  /**
   * Get forums for a course
   */
  async getCourseForums(courseId: string): Promise<Forum[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM forums
      WHERE course_id = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [courseId]);
    return result.rows.map(row => this.mapForumRow(row));
  }

  /**
   * Create a forum post
   */
  async createForumPost(
    forumId: string,
    userId: string,
    postData: Partial<ForumPost>
  ): Promise<ForumPost> {
    const pool = getPostgresPool();
    const postId = crypto.randomUUID();

    const query = `
      INSERT INTO forum_posts (
        id, forum_id, user_id, title, content, is_pinned, is_locked, views, upvotes, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, false, false, 0, 0, $6, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      postId,
      forumId,
      userId,
      postData.title,
      postData.content,
      JSON.stringify(postData.tags || [])
    ];

    const result = await pool.query(query, values);
    return this.mapForumPostRow(result.rows[0]);
  }

  /**
   * Get forum posts with pagination
   */
  async getForumPosts(
    forumId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<ForumPost>> {
    const pool = getPostgresPool();
    const offset = (pagination.page - 1) * pagination.limit;

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM forum_posts WHERE forum_id = $1',
      [forumId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get posts
    const query = `
      SELECT * FROM forum_posts
      WHERE forum_id = $1
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [forumId, pagination.limit, offset]);

    return {
      data: result.rows.map(row => this.mapForumPostRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  /**
   * Create a forum reply
   */
  async createForumReply(
    postId: string,
    userId: string,
    content: string
  ): Promise<ForumReply> {
    const pool = getPostgresPool();
    const replyId = crypto.randomUUID();

    const query = `
      INSERT INTO forum_replies (
        id, post_id, user_id, content, upvotes, is_solution, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 0, false, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [replyId, postId, userId, content]);
    return this.mapForumReplyRow(result.rows[0]);
  }

  /**
   * Get replies for a post
   */
  async getPostReplies(postId: string): Promise<ForumReply[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM forum_replies
      WHERE post_id = $1
      ORDER BY is_solution DESC, upvotes DESC, created_at ASC
    `;

    const result = await pool.query(query, [postId]);
    return result.rows.map(row => this.mapForumReplyRow(row));
  }

  /**
   * Mark reply as solution
   */
  async markAsSolution(replyId: string, postId: string): Promise<ForumReply> {
    const pool = getPostgresPool();

    // Unmark other solutions
    await pool.query(
      'UPDATE forum_replies SET is_solution = false WHERE post_id = $1',
      [postId]
    );

    // Mark this as solution
    const query = `
      UPDATE forum_replies
      SET is_solution = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [replyId]);
    return this.mapForumReplyRow(result.rows[0]);
  }

  /**
   * Create a study group
   */
  async createStudyGroup(
    groupData: Partial<StudyGroup>,
    createdBy: string
  ): Promise<StudyGroup> {
    const pool = getPostgresPool();
    const groupId = crypto.randomUUID();

    const query = `
      INSERT INTO study_groups (
        id, course_id, name, description, max_members, current_members, is_private, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      groupId,
      groupData.courseId,
      groupData.name,
      groupData.description,
      groupData.maxMembers || 10,
      groupData.isPrivate || false,
      createdBy
    ];

    const result = await pool.query(query, values);

    // Add creator as owner
    await pool.query(
      `INSERT INTO study_group_members (id, group_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'owner', NOW())`,
      [crypto.randomUUID(), groupId, createdBy]
    );

    return this.mapStudyGroupRow(result.rows[0]);
  }

  /**
   * Get study groups for a course
   */
  async getCourseStudyGroups(courseId: string): Promise<StudyGroup[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM study_groups
      WHERE course_id = $1 AND is_private = false
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [courseId]);
    return result.rows.map(row => this.mapStudyGroupRow(row));
  }

  /**
   * Join a study group
   */
  async joinStudyGroup(groupId: string, userId: string): Promise<StudyGroupMember> {
    const pool = getPostgresPool();

    // Check if group is full
    const groupResult = await pool.query(
      'SELECT max_members, current_members FROM study_groups WHERE id = $1',
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      throw new Error('Study group not found');
    }

    const { max_members, current_members } = groupResult.rows[0];

    if (current_members >= max_members) {
      throw new Error('Study group is full');
    }

    // Check if already a member
    const existingMember = await pool.query(
      'SELECT id FROM study_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (existingMember.rows.length > 0) {
      throw new Error('Already a member of this group');
    }

    // Add member
    const memberId = crypto.randomUUID();
    const query = `
      INSERT INTO study_group_members (id, group_id, user_id, role, joined_at)
      VALUES ($1, $2, $3, 'member', NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [memberId, groupId, userId]);

    // Update member count
    await pool.query(
      'UPDATE study_groups SET current_members = current_members + 1 WHERE id = $1',
      [groupId]
    );

    return this.mapStudyGroupMemberRow(result.rows[0]);
  }

  /**
   * Create an assignment
   */
  async createAssignment(
    assignmentData: Partial<Assignment>,
    createdBy: string
  ): Promise<Assignment> {
    const pool = getPostgresPool();
    const assignmentId = crypto.randomUUID();

    const query = `
      INSERT INTO assignments (
        id, course_id, title, description, instructions, due_date, max_score,
        allow_late_submission, peer_review_required, peer_review_count,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      assignmentId,
      assignmentData.courseId,
      assignmentData.title,
      assignmentData.description,
      assignmentData.instructions,
      assignmentData.dueDate,
      assignmentData.maxScore || 100,
      assignmentData.allowLateSubmission !== false,
      assignmentData.peerReviewRequired || false,
      assignmentData.peerReviewCount || 2,
      createdBy
    ];

    const result = await pool.query(query, values);
    return this.mapAssignmentRow(result.rows[0]);
  }

  /**
   * Get assignments for a course
   */
  async getCourseAssignments(courseId: string): Promise<Assignment[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM assignments
      WHERE course_id = $1
      ORDER BY due_date ASC
    `;

    const result = await pool.query(query, [courseId]);
    return result.rows.map(row => this.mapAssignmentRow(row));
  }

  /**
   * Submit an assignment
   */
  async submitAssignment(
    assignmentId: string,
    userId: string,
    submissionData: Partial<AssignmentSubmission>
  ): Promise<AssignmentSubmission> {
    const pool = getPostgresPool();

    // Get assignment details
    const assignmentResult = await pool.query(
      'SELECT due_date, allow_late_submission FROM assignments WHERE id = $1',
      [assignmentId]
    );

    if (assignmentResult.rows.length === 0) {
      throw new Error('Assignment not found');
    }

    const { due_date, allow_late_submission } = assignmentResult.rows[0];
    const isLate = new Date() > new Date(due_date);

    if (isLate && !allow_late_submission) {
      throw new Error('Late submissions are not allowed for this assignment');
    }

    const submissionId = crypto.randomUUID();
    const query = `
      INSERT INTO assignment_submissions (
        id, assignment_id, user_id, content, attachments, submitted_at, is_late
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING *
    `;

    const values = [
      submissionId,
      assignmentId,
      userId,
      submissionData.content,
      JSON.stringify(submissionData.attachments || []),
      isLate
    ];

    const result = await pool.query(query, values);
    return this.mapSubmissionRow(result.rows[0]);
  }

  /**
   * Grade a submission
   */
  async gradeSubmission(
    submissionId: string,
    gradedBy: string,
    score: number,
    feedback: string
  ): Promise<AssignmentSubmission> {
    const pool = getPostgresPool();

    const query = `
      UPDATE assignment_submissions
      SET score = $1, feedback = $2, graded_by = $3, graded_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [score, feedback, gradedBy, submissionId]);

    if (result.rows.length === 0) {
      throw new Error('Submission not found');
    }

    return this.mapSubmissionRow(result.rows[0]);
  }

  /**
   * Submit a peer review
   */
  async submitPeerReview(
    submissionId: string,
    reviewerId: string,
    reviewData: Partial<PeerReview>
  ): Promise<PeerReview> {
    const pool = getPostgresPool();

    // Check if already reviewed
    const existing = await pool.query(
      'SELECT id FROM peer_reviews WHERE submission_id = $1 AND reviewer_id = $2',
      [submissionId, reviewerId]
    );

    if (existing.rows.length > 0) {
      throw new Error('You have already reviewed this submission');
    }

    const reviewId = crypto.randomUUID();
    const query = `
      INSERT INTO peer_reviews (
        id, submission_id, reviewer_id, score, feedback, criteria, submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const values = [
      reviewId,
      submissionId,
      reviewerId,
      reviewData.score,
      reviewData.feedback,
      JSON.stringify(reviewData.criteria)
    ];

    const result = await pool.query(query, values);
    return this.mapPeerReviewRow(result.rows[0]);
  }

  /**
   * Get peer reviews for a submission
   */
  async getSubmissionReviews(submissionId: string): Promise<PeerReview[]> {
    const pool = getPostgresPool();

    const query = `
      SELECT * FROM peer_reviews
      WHERE submission_id = $1
      ORDER BY submitted_at DESC
    `;

    const result = await pool.query(query, [submissionId]);
    return result.rows.map(row => this.mapPeerReviewRow(row));
  }

  // Mapping functions
  private mapForumRow(row: any): Forum {
    return {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      description: row.description,
      category: row.category,
      isLocked: row.is_locked,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapForumPostRow(row: any): ForumPost {
    return {
      id: row.id,
      forumId: row.forum_id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      isPinned: row.is_pinned,
      isLocked: row.is_locked,
      views: row.views,
      upvotes: row.upvotes,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapForumReplyRow(row: any): ForumReply {
    return {
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      content: row.content,
      upvotes: row.upvotes,
      isSolution: row.is_solution,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapStudyGroupRow(row: any): StudyGroup {
    return {
      id: row.id,
      courseId: row.course_id,
      name: row.name,
      description: row.description,
      maxMembers: row.max_members,
      currentMembers: row.current_members,
      isPrivate: row.is_private,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapStudyGroupMemberRow(row: any): StudyGroupMember {
    return {
      id: row.id,
      groupId: row.group_id,
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at
    };
  }

  private mapAssignmentRow(row: any): Assignment {
    return {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      description: row.description,
      instructions: row.instructions,
      dueDate: row.due_date,
      maxScore: row.max_score,
      allowLateSubmission: row.allow_late_submission,
      peerReviewRequired: row.peer_review_required,
      peerReviewCount: row.peer_review_count,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapSubmissionRow(row: any): AssignmentSubmission {
    return {
      id: row.id,
      assignmentId: row.assignment_id,
      userId: row.user_id,
      content: row.content,
      attachments: JSON.parse(row.attachments || '[]'),
      submittedAt: row.submitted_at,
      isLate: row.is_late,
      score: row.score,
      feedback: row.feedback,
      gradedBy: row.graded_by,
      gradedAt: row.graded_at
    };
  }

  private mapPeerReviewRow(row: any): PeerReview {
    return {
      id: row.id,
      submissionId: row.submission_id,
      reviewerId: row.reviewer_id,
      score: row.score,
      feedback: row.feedback,
      criteria: JSON.parse(row.criteria),
      submittedAt: row.submitted_at
    };
  }
}
