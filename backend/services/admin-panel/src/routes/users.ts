import { Router, Request, Response, NextFunction } from 'express';
import { UserManagementService } from '../services/UserManagementService';
import { authenticateAdmin } from '../middleware/auth';
import { auditLog, logAdminAction } from '../middleware/auditLogger';
import { AdminAction } from '../types';

export function createUserRoutes(userService: UserManagementService): Router {
  const router = Router();

  // All routes require admin authentication
  router.use(authenticateAdmin);

  /**
   * Search and filter users
   */
  router.get(
    '/',
    auditLog(AdminAction.USER_DATA_EXPORTED, 'users'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { search, role, status, emailVerified, page, limit } = req.query;

        const filters = {
          search: search as string,
          role: role as string,
          status: status as string,
          emailVerified: emailVerified === 'true' ? true : emailVerified === 'false' ? false : undefined
        };

        const result = await userService.searchUsers(
          filters,
          parseInt(page as string) || 1,
          parseInt(limit as string) || 20
        );

        res.json({
          success: true,
          data: result.data
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get user details with activity
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userDetails = await userService.getUserDetails(req.params.id);

      res.json({
        success: true,
        data: userDetails
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Update user role
   */
  router.put(
    '/:id/role',
    auditLog(AdminAction.USER_ROLE_CHANGED, 'users'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { role } = req.body;
        const token = req.headers.authorization?.split(' ')[1] || '';

        const result = await userService.updateUserRole(req.params.id, role, token);

        res.json({
          success: true,
          data: result.data,
          message: `User role updated to ${role}`
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Update user status
   */
  router.put(
    '/:id/status',
    auditLog(AdminAction.USER_STATUS_CHANGED, 'users'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status } = req.body;
        const token = req.headers.authorization?.split(' ')[1] || '';

        const result = await userService.updateUserStatus(req.params.id, status, token);

        res.json({
          success: true,
          data: result.data,
          message: `User status updated to ${status}`
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Bulk operations on users
   */
  router.post(
    '/bulk',
    auditLog(AdminAction.USER_BULK_UPDATE, 'users'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const operation = req.body;
        const token = req.headers.authorization?.split(' ')[1] || '';

        const results = await userService.bulkOperation(operation, token);

        res.json({
          success: true,
          data: results,
          message: `Bulk operation completed: ${results.successful.length} successful, ${results.failed.length} failed`
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Export user data
   */
  router.post(
    '/export',
    auditLog(AdminAction.USER_DATA_EXPORTED, 'users'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { filters, format, fields } = req.body;

        const exportData = await userService.exportUsers(filters || {}, {
          format: format || 'csv',
          fields
        });

        const contentType = format === 'json' ? 'application/json' : 'text/csv';
        const filename = `users_export_${new Date().toISOString().split('T')[0]}.${format || 'csv'}`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exportData);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get user statistics
   */
  router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await userService.getUserStatistics();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
