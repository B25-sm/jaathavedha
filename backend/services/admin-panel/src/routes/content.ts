import { Router, Request, Response, NextFunction } from 'express';
import { ContentManagementService } from '../services/ContentManagementService';
import { authenticateAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';
import { AdminAction } from '../types';

export function createContentRoutes(contentService: ContentManagementService): Router {
  const router = Router();

  // All routes require admin authentication
  router.use(authenticateAdmin);

  /**
   * Get all content with filtering
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, status, page, limit } = req.query;

      const result = await contentService.getContent(
        type as string,
        status as string,
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
   * Create new content
   */
  router.post(
    '/',
    auditLog(AdminAction.CONTENT_CREATED, 'content'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const result = await contentService.createContent(req.body, token);

        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Content created successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Update content
   */
  router.put(
    '/:id',
    auditLog(AdminAction.CONTENT_UPDATED, 'content'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const result = await contentService.updateContent(req.params.id, req.body, token);

        res.json({
          success: true,
          data: result.data,
          message: 'Content updated successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Delete content
   */
  router.delete(
    '/:id',
    auditLog(AdminAction.CONTENT_DELETED, 'content'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        await contentService.deleteContent(req.params.id, token);

        res.json({
          success: true,
          message: 'Content deleted successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Approve content for publishing
   */
  router.post(
    '/:id/approve',
    auditLog(AdminAction.CONTENT_PUBLISHED, 'content'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { comments } = req.body;
        const result = await contentService.approveContent(
          req.params.id,
          req.admin!.userId,
          comments
        );

        res.json({
          success: true,
          data: result,
          message: 'Content approved and published'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Reject content
   */
  router.post(
    '/:id/reject',
    auditLog(AdminAction.CONTENT_UNPUBLISHED, 'content'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason } = req.body;

        if (!reason) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              code: 'REASON_REQUIRED',
              message: 'Rejection reason is required'
            }
          });
        }

        const result = await contentService.rejectContent(
          req.params.id,
          req.admin!.userId,
          reason
        );

        res.json({
          success: true,
          data: result,
          message: 'Content rejected'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Bulk publish content
   */
  router.post(
    '/bulk/publish',
    auditLog(AdminAction.CONTENT_BULK_OPERATION, 'content'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { contentIds } = req.body;

        if (!Array.isArray(contentIds) || contentIds.length === 0) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              code: 'INVALID_INPUT',
              message: 'contentIds must be a non-empty array'
            }
          });
        }

        const results = await contentService.bulkPublish(contentIds, req.admin!.userId);

        res.json({
          success: true,
          data: results,
          message: `Bulk publish completed: ${results.successful.length} successful, ${results.failed.length} failed`
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Bulk unpublish content
   */
  router.post(
    '/bulk/unpublish',
    auditLog(AdminAction.CONTENT_BULK_OPERATION, 'content'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { contentIds } = req.body;

        if (!Array.isArray(contentIds) || contentIds.length === 0) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              code: 'INVALID_INPUT',
              message: 'contentIds must be a non-empty array'
            }
          });
        }

        const result = await contentService.bulkUnpublish(contentIds);

        res.json({
          success: true,
          data: result,
          message: result.message
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get content statistics
   */
  router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await contentService.getContentStatistics();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get pending approvals
   */
  router.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit } = req.query;
      const pending = await contentService.getPendingApprovals(
        parseInt(limit as string) || 20
      );

      res.json({
        success: true,
        data: pending
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
