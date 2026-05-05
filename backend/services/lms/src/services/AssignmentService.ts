import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface AssignmentData {
  course_id: string;
  title: string;
  description: string;
  instructions: string;
  due_date: Date;
  max_score?: number;
  allow_late_submission?: boolean;
  peer_review_required?: boolean;
  peer_review_count?: number;
  created_by: string;
}

interface SubmissionData {
  assignment_id: string;
  user_id: string;
  content: string;
  attachments?: string[];
}

interface PeerReviewData {
  submission_id: string;
  reviewer_id: string;
  score: number;
  feedback: string;
  criteria: Record<string, number>;
}

export class AssignmentService {
  private db = getDatabase();

  /**
   * Create a new assignment
   */
  async createAssignment(assignmentData: AssignmentData) {
    try {
      if (!assignmentData.title || assignmentData.title.trim().length === 0) {
        throw new AppError('Assignment title is required', 400);
      }

      if (!assignmentData.description || assignmentData.description.trim().length === 0) {
        throw new AppError('Assignment description is required', 400);
      }

      if (!assignmentData.instructions || assignmentData.instructions.trim().length === 0) {
        throw new AppError('Assignment instructions are required', 400);
      }

      if (!assignmentData.due_date) {
        throw new AppError('Due date is required', 400);
      }

      const dueDate = new Date(assignmentData.due_date);
      if (dueDate <= new Date()) {
        throw new AppError('Due date must be in the future', 400);
      }

      const assignment = await this.db.insert('assignments', {
        course_id: assignmentData.course_id,
        title: assignmentData.title.trim(),
        description: assignmentData.description.trim(),
        instructions: assignmentData.instructions.trim(),
        due_date: dueDate,
        max_score: assignmentData.max_score || 100,
        allow_late_submission: assignmentData.allow_late_submission !== false,
        peer_review_required: assignmentData.peer_review_required || false,
        peer_review_count: assignmentData.peer_review_count || 2,
        created_by: assignmentData.created_by,
      });

      logger.info('Assignment created successfully', { 
        assignmentId: assignment.id, 
        courseId: assignmentData.course_id 
      });

      return assignment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create assignment', { error, assignmentData });
      throw new AppError('Failed to create assignment', 500);
    }
  }

  /**
   * Get assignments for a course
   */
  async getAssignmentsByCourse(courseId: string, userId?: string) {
    try {
      let query = `
        SELECT a.*, 
               u.first_name || ' ' || u.last_name as creator_name
      `;

      if (userId) {
        query += `,
               CASE WHEN asub.id IS NOT NULL THEN true ELSE false END as has_submitted,
               asub.submitted_at,
               asub.score as user_score,
               asub.is_late as user_is_late
        `;
      }

      query += `
        FROM assignments a
        LEFT JOIN users u ON a.created_by = u.id
      `;

      if (userId) {
        query += `
          LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.user_id = $2
        `;
      }

      query += `
        WHERE a.course_id = $1
        ORDER BY a.due_date ASC
      `;

      const params = userId ? [courseId, userId] : [courseId];
      const assignments = await this.db.queryMany(query, params);

      return assignments;
    } catch (error) {
      logger.error('Failed to get assignments by course', { error, courseId });
      throw new AppError('Failed to retrieve assignments', 500);
    }
  }

  /**
   * Get a single assignment by ID
   */
  async getAssignmentById(assignmentId: string, userId?: string) {
    try {
      let query = `
        SELECT a.*, 
               u.first_name || ' ' || u.last_name as creator_name,
               COUNT(DISTINCT asub.id) as submission_count
      `;

      if (userId) {
        query += `,
               CASE WHEN user_sub.id IS NOT NULL THEN true ELSE false END as has_submitted,
               user_sub.submitted_at as user_submitted_at,
               user_sub.score as user_score,
               user_sub.is_late as user_is_late
        `;
      }

      query += `
        FROM assignments a
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id
      `;

      if (userId) {
        query += `
          LEFT JOIN assignment_submissions user_sub ON a.id = user_sub.assignment_id AND user_sub.user_id = $2
        `;
      }

      query += `
        WHERE a.id = $1
        GROUP BY a.id, u.first_name, u.last_name
      `;

      if (userId) {
        query += ', user_sub.id, user_sub.submitted_at, user_sub.score, user_sub.is_late';
      }

      const params = userId ? [assignmentId, userId] : [assignmentId];
      const assignment = await this.db.queryOne(query, params);

      if (!assignment) {
        throw new AppError('Assignment not found', 404);
      }

      return assignment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get assignment by ID', { error, assignmentId });
      throw new AppError('Failed to retrieve assignment', 500);
    }
  }

  /**
   * Submit an assignment
   */
  async submitAssignment(submissionData: SubmissionData) {
    try {
      if (!submissionData.content || submissionData.content.trim().length === 0) {
        throw new AppError('Submission content is required', 400);
      }

      // Get assignment details
      const assignment = await this.db.queryOne(
        'SELECT due_date, allow_late_submission FROM assignments WHERE id = $1',
        [submissionData.assignment_id]
      );

      if (!assignment) {
        throw new AppError('Assignment not found', 404);
      }

      // Check if already submitted
      const existingSubmission = await this.db.queryOne(
        'SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND user_id = $2',
        [submissionData.assignment_id, submissionData.user_id]
      );

      if (existingSubmission) {
        throw new AppError('Assignment already submitted', 400);
      }

      // Check if late
      const now = new Date();
      const dueDate = new Date(assignment.due_date);
      const isLate = now > dueDate;

      if (isLate && !assignment.allow_late_submission) {
        throw new AppError('Late submissions are not allowed for this assignment', 403);
      }

      // Create submission
      const submission = await this.db.insert('assignment_submissions', {
        assignment_id: submissionData.assignment_id,
        user_id: submissionData.user_id,
        content: submissionData.content.trim(),
        attachments: submissionData.attachments ? JSON.stringify(submissionData.attachments) : '[]',
        is_late: isLate,
      });

      logger.info('Assignment submitted successfully', { 
        submissionId: submission.id, 
        assignmentId: submissionData.assignment_id,
        userId: submissionData.user_id,
        isLate 
      });

      return {
        ...submission,
        attachments: JSON.parse(submission.attachments as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to submit assignment', { error, submissionData });
      throw new AppError('Failed to submit assignment', 500);
    }
  }

  /**
   * Get submissions for an assignment
   */
  async getSubmissions(assignmentId: string, options?: { userId?: string; includeGraded?: boolean }) {
    try {
      let query = `
        SELECT asub.*, 
               u.first_name || ' ' || u.last_name as student_name,
               u.email as student_email,
               COUNT(DISTINCT pr.id) as peer_review_count
        FROM assignment_submissions asub
        LEFT JOIN users u ON asub.user_id = u.id
        LEFT JOIN peer_reviews pr ON asub.id = pr.submission_id
        WHERE asub.assignment_id = $1
      `;

      const params: any[] = [assignmentId];

      if (options?.userId) {
        query += ' AND asub.user_id = $2';
        params.push(options.userId);
      }

      if (options?.includeGraded === false) {
        query += ' AND asub.graded_at IS NULL';
      }

      query += ' GROUP BY asub.id, u.first_name, u.last_name, u.email ORDER BY asub.submitted_at DESC';

      const submissions = await this.db.queryMany(query, params);

      return submissions.map(sub => ({
        ...sub,
        attachments: JSON.parse(sub.attachments as string),
      }));
    } catch (error) {
      logger.error('Failed to get submissions', { error, assignmentId });
      throw new AppError('Failed to retrieve submissions', 500);
    }
  }

  /**
   * Get a single submission by ID
   */
  async getSubmissionById(submissionId: string) {
    try {
      const submission = await this.db.queryOne(
        `SELECT asub.*, 
                u.first_name || ' ' || u.last_name as student_name,
                u.email as student_email,
                a.title as assignment_title,
                a.max_score
         FROM assignment_submissions asub
         LEFT JOIN users u ON asub.user_id = u.id
         LEFT JOIN assignments a ON asub.assignment_id = a.id
         WHERE asub.id = $1`,
        [submissionId]
      );

      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      return {
        ...submission,
        attachments: JSON.parse(submission.attachments as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get submission by ID', { error, submissionId });
      throw new AppError('Failed to retrieve submission', 500);
    }
  }

  /**
   * Grade a submission
   */
  async gradeSubmission(submissionId: string, graderId: string, score: number, feedback?: string) {
    try {
      // Get submission and assignment details
      const submission = await this.db.queryOne(
        `SELECT asub.*, a.max_score
         FROM assignment_submissions asub
         JOIN assignments a ON asub.assignment_id = a.id
         WHERE asub.id = $1`,
        [submissionId]
      );

      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      if (score < 0 || score > submission.max_score) {
        throw new AppError(`Score must be between 0 and ${submission.max_score}`, 400);
      }

      // Update submission with grade
      await this.db.update('assignment_submissions', submissionId, {
        score,
        feedback: feedback || null,
        graded_by: graderId,
        graded_at: new Date(),
      });

      logger.info('Submission graded', { submissionId, graderId, score });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to grade submission', { error, submissionId });
      throw new AppError('Failed to grade submission', 500);
    }
  }

  /**
   * Submit a peer review
   */
  async submitPeerReview(reviewData: PeerReviewData) {
    try {
      if (!reviewData.feedback || reviewData.feedback.trim().length === 0) {
        throw new AppError('Review feedback is required', 400);
      }

      // Get submission details
      const submission = await this.db.queryOne(
        `SELECT asub.user_id, asub.assignment_id, a.max_score, a.peer_review_required
         FROM assignment_submissions asub
         JOIN assignments a ON asub.assignment_id = a.id
         WHERE asub.id = $1`,
        [reviewData.submission_id]
      );

      if (!submission) {
        throw new AppError('Submission not found', 404);
      }

      if (!submission.peer_review_required) {
        throw new AppError('Peer review is not required for this assignment', 400);
      }

      // Cannot review own submission
      if (submission.user_id === reviewData.reviewer_id) {
        throw new AppError('Cannot review your own submission', 403);
      }

      // Check if already reviewed
      const existingReview = await this.db.queryOne(
        'SELECT id FROM peer_reviews WHERE submission_id = $1 AND reviewer_id = $2',
        [reviewData.submission_id, reviewData.reviewer_id]
      );

      if (existingReview) {
        throw new AppError('You have already reviewed this submission', 400);
      }

      // Validate score
      if (reviewData.score < 0 || reviewData.score > submission.max_score) {
        throw new AppError(`Score must be between 0 and ${submission.max_score}`, 400);
      }

      // Create peer review
      const review = await this.db.insert('peer_reviews', {
        submission_id: reviewData.submission_id,
        reviewer_id: reviewData.reviewer_id,
        score: reviewData.score,
        feedback: reviewData.feedback.trim(),
        criteria: JSON.stringify(reviewData.criteria || {}),
      });

      logger.info('Peer review submitted', { 
        reviewId: review.id, 
        submissionId: reviewData.submission_id,
        reviewerId: reviewData.reviewer_id 
      });

      return {
        ...review,
        criteria: JSON.parse(review.criteria as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to submit peer review', { error, reviewData });
      throw new AppError('Failed to submit peer review', 500);
    }
  }

  /**
   * Get peer reviews for a submission
   */
  async getPeerReviews(submissionId: string) {
    try {
      const reviews = await this.db.queryMany(
        `SELECT pr.*, 
                u.first_name || ' ' || u.last_name as reviewer_name
         FROM peer_reviews pr
         LEFT JOIN users u ON pr.reviewer_id = u.id
         WHERE pr.submission_id = $1
         ORDER BY pr.submitted_at DESC`,
        [submissionId]
      );

      return reviews.map(review => ({
        ...review,
        criteria: JSON.parse(review.criteria as string),
      }));
    } catch (error) {
      logger.error('Failed to get peer reviews', { error, submissionId });
      throw new AppError('Failed to retrieve peer reviews', 500);
    }
  }

  /**
   * Get submissions assigned for peer review to a user
   */
  async getSubmissionsForPeerReview(assignmentId: string, reviewerId: string, count: number = 2) {
    try {
      // Get assignment details
      const assignment = await this.db.queryOne(
        'SELECT peer_review_required, peer_review_count FROM assignments WHERE id = $1',
        [assignmentId]
      );

      if (!assignment || !assignment.peer_review_required) {
        throw new AppError('Peer review is not required for this assignment', 400);
      }

      // Get submissions that need review (excluding reviewer's own submission)
      // and that the reviewer hasn't reviewed yet
      const submissions = await this.db.queryMany(
        `SELECT asub.*, 
                u.first_name || ' ' || u.last_name as student_name,
                COUNT(pr.id) as review_count
         FROM assignment_submissions asub
         LEFT JOIN users u ON asub.user_id = u.id
         LEFT JOIN peer_reviews pr ON asub.id = pr.submission_id
         WHERE asub.assignment_id = $1 
           AND asub.user_id != $2
           AND NOT EXISTS (
             SELECT 1 FROM peer_reviews 
             WHERE submission_id = asub.id AND reviewer_id = $2
           )
         GROUP BY asub.id, u.first_name, u.last_name
         HAVING COUNT(pr.id) < $3
         ORDER BY COUNT(pr.id) ASC, asub.submitted_at ASC
         LIMIT $4`,
        [assignmentId, reviewerId, assignment.peer_review_count, count]
      );

      return submissions.map(sub => ({
        ...sub,
        attachments: JSON.parse(sub.attachments as string),
      }));
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get submissions for peer review', { error, assignmentId, reviewerId });
      throw new AppError('Failed to retrieve submissions for peer review', 500);
    }
  }

  /**
   * Update an assignment
   */
  async updateAssignment(assignmentId: string, userId: string, updates: Partial<AssignmentData>) {
    try {
      // Verify user is the creator
      const assignment = await this.db.queryOne(
        'SELECT created_by FROM assignments WHERE id = $1',
        [assignmentId]
      );

      if (!assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (assignment.created_by !== userId) {
        throw new AppError('Only the assignment creator can update it', 403);
      }

      const updateData: any = {};
      if (updates.title) updateData.title = updates.title.trim();
      if (updates.description) updateData.description = updates.description.trim();
      if (updates.instructions) updateData.instructions = updates.instructions.trim();
      if (updates.due_date) updateData.due_date = new Date(updates.due_date);
      if (updates.max_score !== undefined) updateData.max_score = updates.max_score;
      if (updates.allow_late_submission !== undefined) updateData.allow_late_submission = updates.allow_late_submission;

      if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid updates provided', 400);
      }

      await this.db.update('assignments', assignmentId, updateData);

      logger.info('Assignment updated', { assignmentId, userId });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update assignment', { error, assignmentId });
      throw new AppError('Failed to update assignment', 500);
    }
  }

  /**
   * Delete an assignment
   */
  async deleteAssignment(assignmentId: string, userId: string, isAdmin: boolean = false) {
    try {
      const assignment = await this.db.queryOne(
        'SELECT created_by FROM assignments WHERE id = $1',
        [assignmentId]
      );

      if (!assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (!isAdmin && assignment.created_by !== userId) {
        throw new AppError('Only the assignment creator can delete it', 403);
      }

      await this.db.delete('assignments', assignmentId);

      logger.info('Assignment deleted', { assignmentId, userId, isAdmin });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete assignment', { error, assignmentId });
      throw new AppError('Failed to delete assignment', 500);
    }
  }
}
