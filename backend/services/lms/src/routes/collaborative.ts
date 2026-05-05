import { Router } from 'express';
import { ForumService } from '../services/ForumService';
import { StudyGroupService } from '../services/StudyGroupService';
import { AssignmentService } from '../services/AssignmentService';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { collaborativeSchemas } from '../schemas/collaborativeSchemas';

const router = Router();
const forumService = new ForumService();
const studyGroupService = new StudyGroupService();
const assignmentService = new AssignmentService();

// ============================================================================
// Forum Routes
// ============================================================================

/**
 * Create a new forum (instructors and admins only)
 */
router.post(
  '/forums',
  authenticate,
  requireRole('instructor', 'admin'),
  validate(collaborativeSchemas.createForum),
  async (req, res, next) => {
    try {
      const forumData = {
        course_id: req.body.courseId,
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        created_by: req.user!.id,
      };
      const result = await forumService.createForum(forumData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get forums for a course
 */
router.get('/forums', authenticate, async (req, res, next) => {
  try {
    const { courseId, category } = req.query;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: { message: 'courseId query parameter is required' },
      });
    }
    const forums = await forumService.getForumsByCourse(
      courseId as string,
      category as string
    );
    res.json({ success: true, data: forums });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a single forum by ID
 */
router.get('/forums/:forumId', authenticate, async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const forum = await forumService.getForumById(forumId);
    res.json({ success: true, data: forum });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a post in a forum
 */
router.post(
  '/forums/:forumId/posts',
  authenticate,
  validate(collaborativeSchemas.createPost),
  async (req, res, next) => {
    try {
      const { forumId } = req.params;
      const postData = {
        forum_id: forumId,
        user_id: req.user!.id,
        title: req.body.title,
        content: req.body.content,
        tags: req.body.tags,
      };
      const result = await forumService.createPost(postData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get posts for a forum
 */
router.get('/forums/:forumId/posts', authenticate, async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const { page, limit, sortBy } = req.query;
    const result = await forumService.getPostsByForum(forumId, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      sortBy: sortBy as string,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a single post by ID
 */
router.get('/posts/:postId', authenticate, async (req, res, next) => {
  try {
    const { postId } = req.params;
    const post = await forumService.getPostById(postId);
    res.json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a post
 */
router.put(
  '/posts/:postId',
  authenticate,
  validate(collaborativeSchemas.updatePost),
  async (req, res, next) => {
    try {
      const { postId } = req.params;
      const result = await forumService.updatePost(
        postId,
        req.user!.id,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a post
 */
router.delete('/posts/:postId', authenticate, async (req, res, next) => {
  try {
    const { postId } = req.params;
    const isAdmin = req.user!.role === 'admin';
    const result = await forumService.deletePost(postId, req.user!.id, isAdmin);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Upvote a post
 */
router.post('/posts/:postId/upvote', authenticate, async (req, res, next) => {
  try {
    const { postId } = req.params;
    const result = await forumService.upvotePost(postId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a reply to a post
 */
router.post(
  '/posts/:postId/replies',
  authenticate,
  validate(collaborativeSchemas.createReply),
  async (req, res, next) => {
    try {
      const { postId } = req.params;
      const replyData = {
        post_id: postId,
        user_id: req.user!.id,
        content: req.body.content,
      };
      const result = await forumService.createReply(replyData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get replies for a post
 */
router.get('/posts/:postId/replies', authenticate, async (req, res, next) => {
  try {
    const { postId } = req.params;
    const replies = await forumService.getRepliesByPost(postId);
    res.json({ success: true, data: replies });
  } catch (error) {
    next(error);
  }
});

/**
 * Mark a reply as solution
 */
router.post(
  '/replies/:replyId/mark-solution',
  authenticate,
  async (req, res, next) => {
    try {
      const { replyId } = req.params;
      const result = await forumService.markReplyAsSolution(
        replyId,
        req.user!.id
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upvote a reply
 */
router.post('/replies/:replyId/upvote', authenticate, async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const result = await forumService.upvoteReply(replyId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Study Group Routes
// ============================================================================

/**
 * Create a new study group
 */
router.post(
  '/study-groups',
  authenticate,
  validate(collaborativeSchemas.createStudyGroup),
  async (req, res, next) => {
    try {
      const groupData = {
        course_id: req.body.courseId,
        name: req.body.name,
        description: req.body.description,
        max_members: req.body.maxMembers,
        is_private: req.body.isPrivate,
        created_by: req.user!.id,
      };
      const result = await studyGroupService.createGroup(groupData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get study groups for a course
 */
router.get('/study-groups', authenticate, async (req, res, next) => {
  try {
    const { courseId, includePrivate } = req.query;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: { message: 'courseId query parameter is required' },
      });
    }
    const groups = await studyGroupService.getGroups(courseId as string, {
      includePrivate: includePrivate === 'true',
      userId: req.user!.id,
    });
    res.json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a single study group by ID
 */
router.get('/study-groups/:groupId', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await studyGroupService.getGroupById(groupId, req.user!.id);
    res.json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a study group
 */
router.put(
  '/study-groups/:groupId',
  authenticate,
  validate(collaborativeSchemas.updateStudyGroup),
  async (req, res, next) => {
    try {
      const { groupId } = req.params;
      const result = await studyGroupService.updateGroup(
        groupId,
        req.user!.id,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Join a study group
 */
router.post(
  '/study-groups/:groupId/join',
  authenticate,
  async (req, res, next) => {
    try {
      const { groupId } = req.params;
      const result = await studyGroupService.joinGroup(groupId, req.user!.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Leave a study group
 */
router.post(
  '/study-groups/:groupId/leave',
  authenticate,
  async (req, res, next) => {
    try {
      const { groupId } = req.params;
      const result = await studyGroupService.leaveGroup(groupId, req.user!.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get members of a study group
 */
router.get(
  '/study-groups/:groupId/members',
  authenticate,
  async (req, res, next) => {
    try {
      const { groupId } = req.params;
      const members = await studyGroupService.getGroupMembers(groupId);
      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update member role
 */
router.put(
  '/study-groups/:groupId/members/:userId/role',
  authenticate,
  async (req, res, next) => {
    try {
      const { groupId, userId } = req.params;
      const { role } = req.body;
      if (!role || !['moderator', 'member'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Valid role (moderator or member) is required' },
        });
      }
      const result = await studyGroupService.updateMemberRole(
        groupId,
        userId,
        role,
        req.user!.id
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Remove a member from a study group
 */
router.delete(
  '/study-groups/:groupId/members/:userId',
  authenticate,
  async (req, res, next) => {
    try {
      const { groupId, userId } = req.params;
      const result = await studyGroupService.removeMember(
        groupId,
        userId,
        req.user!.id
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// Assignment Routes
// ============================================================================

/**
 * Create a new assignment (instructors and admins only)
 */
router.post(
  '/assignments',
  authenticate,
  requireRole('instructor', 'admin'),
  validate(collaborativeSchemas.createAssignment),
  async (req, res, next) => {
    try {
      const assignmentData = {
        course_id: req.body.courseId,
        title: req.body.title,
        description: req.body.description,
        instructions: req.body.instructions,
        due_date: new Date(req.body.dueDate),
        max_score: req.body.maxScore,
        allow_late_submission: req.body.allowLateSubmission,
        peer_review_required: req.body.peerReviewRequired,
        peer_review_count: req.body.peerReviewCount,
        created_by: req.user!.id,
      };
      const result = await assignmentService.createAssignment(assignmentData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get assignments for a course
 */
router.get('/assignments', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.query;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: { message: 'courseId query parameter is required' },
      });
    }
    const assignments = await assignmentService.getAssignmentsByCourse(
      courseId as string,
      req.user!.id
    );
    res.json({ success: true, data: assignments });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a single assignment by ID
 */
router.get('/assignments/:assignmentId', authenticate, async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await assignmentService.getAssignmentById(
      assignmentId,
      req.user!.id
    );
    res.json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
});

/**
 * Update an assignment
 */
router.put(
  '/assignments/:assignmentId',
  authenticate,
  requireRole('instructor', 'admin'),
  validate(collaborativeSchemas.updateAssignment),
  async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      const result = await assignmentService.updateAssignment(
        assignmentId,
        req.user!.id,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete an assignment
 */
router.delete(
  '/assignments/:assignmentId',
  authenticate,
  requireRole('instructor', 'admin'),
  async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      const isAdmin = req.user!.role === 'admin';
      const result = await assignmentService.deleteAssignment(
        assignmentId,
        req.user!.id,
        isAdmin
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Submit an assignment
 */
router.post(
  '/assignments/:assignmentId/submit',
  authenticate,
  validate(collaborativeSchemas.submitAssignment),
  async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      const submissionData = {
        assignment_id: assignmentId,
        user_id: req.user!.id,
        content: req.body.content,
        attachments: req.body.attachments,
      };
      const result = await assignmentService.submitAssignment(submissionData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get submissions for an assignment
 */
router.get(
  '/assignments/:assignmentId/submissions',
  authenticate,
  async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      const { userId, includeGraded } = req.query;
      
      // Students can only see their own submissions
      const isInstructorOrAdmin = ['instructor', 'admin'].includes(req.user!.role);
      const targetUserId = isInstructorOrAdmin ? (userId as string) : req.user!.id;
      
      const submissions = await assignmentService.getSubmissions(assignmentId, {
        userId: targetUserId,
        includeGraded: includeGraded !== 'false',
      });
      res.json({ success: true, data: submissions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get a single submission by ID
 */
router.get('/submissions/:submissionId', authenticate, async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const submission = await assignmentService.getSubmissionById(submissionId);
    
    // Students can only view their own submissions
    if (req.user!.role === 'student' && submission.user_id !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: { message: 'You can only view your own submissions' },
      });
    }
    
    res.json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
});

/**
 * Grade a submission (instructors and admins only)
 */
router.post(
  '/submissions/:submissionId/grade',
  authenticate,
  requireRole('instructor', 'admin'),
  validate(collaborativeSchemas.gradeSubmission),
  async (req, res, next) => {
    try {
      const { submissionId } = req.params;
      const { score, feedback } = req.body;
      const result = await assignmentService.gradeSubmission(
        submissionId,
        req.user!.id,
        score,
        feedback
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Submit a peer review
 */
router.post(
  '/submissions/:submissionId/peer-review',
  authenticate,
  validate(collaborativeSchemas.submitPeerReview),
  async (req, res, next) => {
    try {
      const { submissionId } = req.params;
      const reviewData = {
        submission_id: submissionId,
        reviewer_id: req.user!.id,
        score: req.body.score,
        feedback: req.body.feedback,
        criteria: req.body.criteria,
      };
      const result = await assignmentService.submitPeerReview(reviewData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get peer reviews for a submission
 */
router.get(
  '/submissions/:submissionId/peer-reviews',
  authenticate,
  async (req, res, next) => {
    try {
      const { submissionId } = req.params;
      const reviews = await assignmentService.getPeerReviews(submissionId);
      res.json({ success: true, data: reviews });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get submissions assigned for peer review
 */
router.get(
  '/assignments/:assignmentId/peer-review-queue',
  authenticate,
  async (req, res, next) => {
    try {
      const { assignmentId } = req.params;
      const { count } = req.query;
      const submissions = await assignmentService.getSubmissionsForPeerReview(
        assignmentId,
        req.user!.id,
        count ? parseInt(count as string) : 2
      );
      res.json({ success: true, data: submissions });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
