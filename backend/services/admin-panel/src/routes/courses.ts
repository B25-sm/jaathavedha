import { Router, Request, Response, NextFunction } from 'express';
import { CourseManagementService } from '../services/CourseManagementService';
import { authenticateAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';
import { AdminAction } from '../types';

export function createCourseRoutes(courseService: CourseManagementService): Router {
  const router = Router();

  // All routes require admin authentication
  router.use(authenticateAdmin);

  /**
   * Get all programs with analytics
   */
  router.get('/programs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query;

      const result = await courseService.getPrograms(
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Create new program
   */
  router.post(
    '/programs',
    auditLog(AdminAction.PROGRAM_CREATED, 'programs'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const result = await courseService.createProgram(req.body, token);

        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Program created successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Update program
   */
  router.put(
    '/programs/:id',
    auditLog(AdminAction.PROGRAM_UPDATED, 'programs'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const result = await courseService.updateProgram(req.params.id, req.body, token);

        res.json({
          success: true,
          data: result.data,
          message: 'Program updated successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Delete program
   */
  router.delete(
    '/programs/:id',
    auditLog(AdminAction.PROGRAM_DELETED, 'programs'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        await courseService.deleteProgram(req.params.id, token);

        res.json({
          success: true,
          message: 'Program deleted successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get course analytics
   */
  router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { programId } = req.query;
      const analytics = await courseService.getCourseAnalytics(programId as string);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get enrollments with filtering
   */
  router.get('/enrollments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { programId, userId, status, page, limit } = req.query;

      const filters = {
        programId: programId as string,
        userId: userId as string,
        status: status as string
      };

      const result = await courseService.getEnrollments(
        filters,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Update enrollment status
   */
  router.put(
    '/enrollments/:id/status',
    auditLog(AdminAction.ENROLLMENT_MODIFIED, 'enrollments'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status } = req.body;

        if (!status) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              code: 'STATUS_REQUIRED',
              message: 'Status is required'
            }
          });
        }

        const result = await courseService.updateEnrollmentStatus(req.params.id, status);

        res.json({
          success: true,
          data: result,
          message: `Enrollment status updated to ${status}`
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get enrollment statistics
   */
  router.get('/stats/enrollments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await courseService.getEnrollmentStatistics();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get top performing courses
   */
  router.get('/top-courses', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit } = req.query;
      const topCourses = await courseService.getTopCourses(
        parseInt(limit as string) || 10
      );

      res.json({
        success: true,
        data: topCourses
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
