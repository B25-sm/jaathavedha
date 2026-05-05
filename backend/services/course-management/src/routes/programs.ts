/**
 * Program Routes
 * Handles program and course management endpoints
 */

import { Router } from 'express';
import Joi from 'joi';
import { ProgramService } from '../services/ProgramService';
import { validateRequest, authenticate, authorize } from '@sai-mahendra/utils';

const router = Router();
const programService = new ProgramService();

// Validation schemas
const createProgramSchema = Joi.object({
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().min(10).max(2000).required(),
  category: Joi.string().valid('starter', 'membership', 'accelerator', 'pro_developer').required(),
  price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('INR'),
  duration_weeks: Joi.number().integer().min(1).max(104).required(),
  features: Joi.object().required(),
});

const updateProgramSchema = Joi.object({
  name: Joi.string().min(3).max(255),
  description: Joi.string().min(10).max(2000),
  category: Joi.string().valid('starter', 'membership', 'accelerator', 'pro_developer'),
  price: Joi.number().min(0),
  currency: Joi.string().length(3),
  duration_weeks: Joi.number().integer().min(1).max(104),
  features: Joi.object(),
  is_active: Joi.boolean(),
});

const createCourseSchema = Joi.object({
  program_id: Joi.string().uuid().required(),
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().min(10).max(2000).required(),
  order_index: Joi.number().integer().min(1).required(),
});

const updateCourseSchema = Joi.object({
  program_id: Joi.string().uuid(),
  name: Joi.string().min(3).max(255),
  description: Joi.string().min(10).max(2000),
  order_index: Joi.number().integer().min(1),
  is_active: Joi.boolean(),
});

const createModuleSchema = Joi.object({
  course_id: Joi.string().uuid().required(),
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().min(10).max(2000).required(),
  content_url: Joi.string().uri().allow(''),
  order_index: Joi.number().integer().min(1).required(),
  duration_minutes: Joi.number().integer().min(1).required(),
});

const updateModuleSchema = Joi.object({
  course_id: Joi.string().uuid(),
  name: Joi.string().min(3).max(255),
  description: Joi.string().min(10).max(2000),
  content_url: Joi.string().uri().allow(''),
  order_index: Joi.number().integer().min(1),
  duration_minutes: Joi.number().integer().min(1),
  is_active: Joi.boolean(),
});

const querySchema = Joi.object({
  category: Joi.string().valid('starter', 'membership', 'accelerator', 'pro_developer'),
  is_active: Joi.boolean(),
  min_price: Joi.number().min(0),
  max_price: Joi.number().min(0),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort_by: Joi.string().valid('name', 'price', 'created_at', 'updated_at').default('created_at'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
});

// Program routes
router.get('/', validateRequest({ query: querySchema }), async (req, res, next) => {
  try {
    const { category, is_active, min_price, max_price, page, limit, sort_by, sort_order } = req.query;
    
    const filters = {
      ...(category && { category: category as string }),
      ...(is_active !== undefined && { is_active: is_active === 'true' }),
      ...(min_price !== undefined && { min_price: Number(min_price) }),
      ...(max_price !== undefined && { max_price: Number(max_price) }),
    };

    const pagination = {
      page: Number(page),
      limit: Number(limit),
      sort_by: sort_by as string,
      sort_order: sort_order as 'asc' | 'desc',
    };

    const result = await programService.getPrograms(filters, pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const program = await programService.getProgramById(id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(program);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/details', async (req, res, next) => {
  try {
    const { id } = req.params;
    const program = await programService.getProgramWithCourses(id);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(program);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/stats', authenticate, authorize(['admin', 'instructor']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const stats = await programService.getProgramStats(id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize(['admin']), validateRequest({ body: createProgramSchema }), async (req, res, next) => {
  try {
    const program = await programService.createProgram(req.body);
    res.status(201).json(program);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, authorize(['admin']), validateRequest({ body: updateProgramSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const program = await programService.updateProgram(id, req.body);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(program);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await programService.deleteProgram(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Course routes
router.get('/:programId/courses', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const courses = await programService.getCoursesByProgramId(programId);
    res.json(courses);
  } catch (error) {
    next(error);
  }
});

router.get('/courses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await programService.getCourseById(id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    next(error);
  }
});

router.get('/courses/:id/details', async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await programService.getCourseWithModules(id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    next(error);
  }
});

router.post('/courses', authenticate, authorize(['admin', 'instructor']), validateRequest({ body: createCourseSchema }), async (req, res, next) => {
  try {
    const course = await programService.createCourse(req.body);
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
});

router.put('/courses/:id', authenticate, authorize(['admin', 'instructor']), validateRequest({ body: updateCourseSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await programService.updateCourse(id, req.body);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    next(error);
  }
});

router.delete('/courses/:id', authenticate, authorize(['admin', 'instructor']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await programService.deleteCourse(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Module routes
router.get('/courses/:courseId/modules', async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const modules = await programService.getModulesByCourseId(courseId);
    res.json(modules);
  } catch (error) {
    next(error);
  }
});

router.get('/modules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const module = await programService.getModuleById(id);
    
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.json(module);
  } catch (error) {
    next(error);
  }
});

router.post('/modules', authenticate, authorize(['admin', 'instructor']), validateRequest({ body: createModuleSchema }), async (req, res, next) => {
  try {
    const module = await programService.createModule(req.body);
    res.status(201).json(module);
  } catch (error) {
    next(error);
  }
});

router.put('/modules/:id', authenticate, authorize(['admin', 'instructor']), validateRequest({ body: updateModuleSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const module = await programService.updateModule(id, req.body);
    
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.json(module);
  } catch (error) {
    next(error);
  }
});

router.delete('/modules/:id', authenticate, authorize(['admin', 'instructor']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await programService.deleteModule(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;