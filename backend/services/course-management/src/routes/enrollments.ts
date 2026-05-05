/**
 * Enrollment Routes
 * Handles enrollment and progress tracking endpoints
 */

import { Router } from 'express';
import Joi from 'joi';
import { EnrollmentService } from '../services/EnrollmentService';
import { validateRequest, authenticate, authorize } from '@sai-mahendra/utils';

const router = Router();
const enrollmentService = new EnrollmentService();

// Validation schemas
const createEnrollmentSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  program_id: Joi.string().uuid().required(),
});

const updateProgressSchema = Joi.object({
  module_id: Joi.string().uuid().required(),
  completed: Joi.boolean().required(),
  completion_percentage: Joi.number().integer().min(0).max(100).required(),
  time_spent_minutes: Joi.number().integer().min(0).required(),
});

const enrollmentQuerySchema = Joi.object({
  user_id: Joi.string().uuid(),
  program_id: Joi.string().uuid(),
  status: Joi.string().valid('active', 'completed', 'cancelled', 'suspended'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort_by: Joi.string().valid('enrolled_at', 'progress_percentage', 'status').default('enrolled_at'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
});

const progressQuerySchema = Joi.object({
  user_id: Joi.string().uuid(),
  course_id: Joi.string().uuid(),
  completed: Joi.boolean(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort_by: Joi.string().valid('updated_at', 'completion_percentage', 'time_spent_minutes').default('updated_at'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'completed', 'cancelled', 'suspended').required(),
});

// Enrollment routes
router.get('/', authenticate, validateRequest({ query: enrollmentQuerySchema }), async (req, res, next) => {
  try {
    const { user_id, program_id, status, page, limit, sort_by, sort_order } = req.query;
    const user = req.user!;
    
    // Students can only see their own enrollments
    const filters: any = {};
    if (user.role === 'student') {
      filters.user_id = user.id;
    } else {
      if (user_id) filters.user_id = user_id as string;
    }
    
    if (program_id) filters.program_id = program_id as string;
    if (status) filters.status = status as string;

    const pagination = {
      page: Number(page),
      limit: Number(limit),
      sort_by: sort_by as string,
      sort_order: sort_order as 'asc' | 'desc',
    };

    const result = await enrollmentService.getEnrollments(filters, pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    
    const enrollment = await enrollmentService.getEnrollmentWithProgram(id);
    
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Students can only see their own enrollments
    if (user.role === 'student' && enrollment.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(enrollment);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, validateRequest({ body: createEnrollmentSchema }), async (req, res, next) => {
  try {
    const user = req.user!;
    const { user_id, program_id } = req.body;
    
    // Students can only enroll themselves
    if (user.role === 'student' && user_id !== user.id) {
      return res.status(403).json({ error: 'Students can only enroll themselves' });
    }

    const enrollment = await enrollmentService.createEnrollment({ user_id, program_id });
    res.status(201).json(enrollment);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/status', authenticate, authorize(['admin', 'instructor']), validateRequest({ body: updateStatusSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const enrollment = await enrollmentService.updateEnrollmentStatus(id, status);
    
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json(enrollment);
  } catch (error) {
    next(error);
  }
});

// Progress tracking routes
router.get('/progress', authenticate, validateRequest({ query: progressQuerySchema }), async (req, res, next) => {
  try {
    const { user_id, course_id, completed, page, limit, sort_by, sort_order } = req.query;
    const user = req.user!;
    
    // Students can only see their own progress
    const filters: any = {};
    if (user.role === 'student') {
      filters.user_id = user.id;
    } else {
      if (user_id) filters.user_id = user_id as string;
    }
    
    if (course_id) filters.course_id = course_id as string;
    if (completed !== undefined) filters.completed = completed === 'true';

    const pagination = {
      page: Number(page),
      limit: Number(limit),
      sort_by: sort_by as string,
      sort_order: sort_order as 'asc' | 'desc',
    };

    const result = await enrollmentService.getUserProgress(filters, pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/progress', authenticate, validateRequest({ body: updateProgressSchema }), async (req, res, next) => {
  try {
    const user = req.user!;
    const progress = await enrollmentService.updateProgress(user.id, req.body);
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

// Dashboard routes
router.get('/dashboard/stats', authenticate, authorize(['admin', 'instructor']), async (req, res, next) => {
  try {
    const stats = await enrollmentService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard/student', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    let userId = user.id;
    
    // Admins and instructors can view other users' dashboards
    if ((user.role === 'admin' || user.role === 'instructor') && req.query.user_id) {
      userId = req.query.user_id as string;
    }
    
    const dashboard = await enrollmentService.getStudentDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

export default router;