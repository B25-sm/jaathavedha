import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { AdminAction } from '../types';

let dbPool: Pool;

export function initializeAuditLogger(pool: Pool): void {
  dbPool = pool;
}

export interface AuditLogData {
  action: AdminAction;
  resource: string;
  resourceId?: string;
  changes?: any;
  status?: 'success' | 'failure';
  errorMessage?: string;
}

/**
 * Log admin action to audit trail
 */
export async function logAdminAction(
  req: Request,
  data: AuditLogData
): Promise<void> {
  try {
    if (!req.admin) {
      return;
    }

    const query = `
      INSERT INTO admin_audit_logs (
        admin_id,
        admin_email,
        action,
        resource,
        resource_id,
        changes,
        ip_address,
        user_agent,
        status,
        error_message,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    `;

    const values = [
      req.admin.userId,
      req.admin.email,
      data.action,
      data.resource,
      data.resourceId || null,
      data.changes ? JSON.stringify(data.changes) : null,
      req.ip,
      req.get('User-Agent') || 'Unknown',
      data.status || 'success',
      data.errorMessage || null
    ];

    await dbPool.query(query, values);
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw error to prevent disrupting the main operation
  }
}

/**
 * Middleware to automatically log successful operations
 */
export function auditLog(action: AdminAction, resource: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to capture response
    res.json = function (body: any): Response {
      // Log if operation was successful
      if (body.success) {
        logAdminAction(req, {
          action,
          resource,
          resourceId: req.params.id || body.data?.id,
          changes: req.body,
          status: 'success'
        }).catch(console.error);
      } else {
        logAdminAction(req, {
          action,
          resource,
          resourceId: req.params.id,
          changes: req.body,
          status: 'failure',
          errorMessage: body.error?.message
        }).catch(console.error);
      }

      return originalJson(body);
    };

    next();
  };
}
