import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';
import GoogleCalendarService from '../services/GoogleCalendarService';
import OutlookCalendarService from '../services/OutlookCalendarService';
import CalendarConnectionService from '../services/CalendarConnectionService';
import CalendarEventService from '../services/CalendarEventService';
import CalendarSyncService from '../services/CalendarSyncService';
import logger from '../utils/logger';
import { CalendarProvider } from '../types';

const router = express.Router();

const googleService = new GoogleCalendarService();
const outlookService = new OutlookCalendarService();
const connectionService = new CalendarConnectionService();
const eventService = new CalendarEventService();
const syncService = new CalendarSyncService();

/**
 * GET /api/calendar/google/auth
 * Get Google Calendar authorization URL
 */
router.get('/google/auth', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const authUrl = googleService.getAuthorizationUrl();
    res.json({ authUrl });
  } catch (error) {
    logger.error('Error getting Google auth URL:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'AUTH_URL_FAILED',
        message: 'Failed to generate authorization URL',
      },
    });
  }
});

/**
 * GET /api/calendar/google/callback
 * Handle Google Calendar OAuth callback
 */
router.get('/google/callback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_CODE',
          message: 'Authorization code is required',
        },
      });
      return;
    }

    const tokens = await googleService.getTokensFromCode(code);
    await connectionService.createConnection(
      req.user!.id,
      CalendarProvider.GOOGLE,
      tokens
    );

    res.json({
      success: true,
      message: 'Google Calendar connected successfully',
    });
  } catch (error) {
    logger.error('Error handling Google callback:', error);
    res.status(500).json({
      error: {
        type: 'EXTERNAL_SERVICE_ERROR',
        code: 'GOOGLE_AUTH_FAILED',
        message: 'Failed to connect Google Calendar',
      },
    });
  }
});

/**
 * GET /api/calendar/outlook/auth
 * Get Outlook Calendar authorization URL
 */
router.get('/outlook/auth', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const authUrl = outlookService.getAuthorizationUrl();
    res.json({ authUrl });
  } catch (error) {
    logger.error('Error getting Outlook auth URL:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'AUTH_URL_FAILED',
        message: 'Failed to generate authorization URL',
      },
    });
  }
});

/**
 * GET /api/calendar/outlook/callback
 * Handle Outlook Calendar OAuth callback
 */
router.get('/outlook/callback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          code: 'MISSING_CODE',
          message: 'Authorization code is required',
        },
      });
      return;
    }

    const tokens = await outlookService.getTokensFromCode(code);
    await connectionService.createConnection(
      req.user!.id,
      CalendarProvider.OUTLOOK,
      tokens
    );

    res.json({
      success: true,
      message: 'Outlook Calendar connected successfully',
    });
  } catch (error) {
    logger.error('Error handling Outlook callback:', error);
    res.status(500).json({
      error: {
        type: 'EXTERNAL_SERVICE_ERROR',
        code: 'OUTLOOK_AUTH_FAILED',
        message: 'Failed to connect Outlook Calendar',
      },
    });
  }
});

/**
 * GET /api/calendar/connections
 * Get user's calendar connections
 */
router.get('/connections', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const connections = await connectionService.getUserConnections(req.user!.id);

    // Remove sensitive token data
    const sanitizedConnections = connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      calendarId: conn.calendarId,
      isActive: conn.isActive,
      lastSyncAt: conn.lastSyncAt,
      createdAt: conn.createdAt,
    }));

    res.json({ connections: sanitizedConnections });
  } catch (error) {
    logger.error('Error fetching connections:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'FETCH_FAILED',
        message: 'Failed to fetch calendar connections',
      },
    });
  }
});

/**
 * DELETE /api/calendar/connections/:provider
 * Disconnect a calendar
 */
router.delete('/connections/:provider', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params;

    if (provider !== 'google' && provider !== 'outlook') {
      res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          code: 'INVALID_PROVIDER',
          message: 'Invalid calendar provider',
        },
      });
      return;
    }

    await connectionService.deleteConnection(req.user!.id, provider as CalendarProvider);

    res.json({
      success: true,
      message: 'Calendar disconnected successfully',
    });
  } catch (error) {
    logger.error('Error disconnecting calendar:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'DISCONNECT_FAILED',
        message: 'Failed to disconnect calendar',
      },
    });
  }
});

/**
 * GET /api/calendar/events
 * Get user's calendar events
 */
router.get('/events', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { provider, status, upcoming } = req.query;

    let events;

    if (upcoming === 'true') {
      events = await eventService.getUpcomingEvents(req.user!.id);
    } else {
      events = await eventService.getUserEvents(
        req.user!.id,
        provider as CalendarProvider | undefined,
        status as any
      );
    }

    res.json({ events });
  } catch (error) {
    logger.error('Error fetching events:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'FETCH_FAILED',
        message: 'Failed to fetch calendar events',
      },
    });
  }
});

/**
 * GET /api/calendar/stats
 * Get calendar statistics
 */
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await eventService.getCalendarStats(req.user!.id);
    res.json({ stats });
  } catch (error) {
    logger.error('Error fetching calendar stats:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'FETCH_FAILED',
        message: 'Failed to fetch calendar statistics',
      },
    });
  }
});

/**
 * POST /api/calendar/sync/enrollment
 * Sync all sessions for an enrollment
 */
router.post(
  '/sync/enrollment',
  authenticate,
  validate(schemas.syncEnrollment),
  async (req: AuthRequest, res: Response) => {
    try {
      const { enrollmentId } = req.body;

      const result = await syncService.syncEnrollmentSessions(req.user!.id, enrollmentId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Enrollment sessions synced successfully',
          eventsCreated: result.eventsCreated,
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to sync some events',
          eventsCreated: result.eventsCreated,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error('Error syncing enrollment:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'SYNC_FAILED',
          message: 'Failed to sync enrollment sessions',
        },
      });
    }
  }
);

/**
 * GET /api/calendar/preferences
 * Get sync preferences
 */
router.get('/preferences', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const preferences = await connectionService.getSyncPreferences(req.user!.id);
    res.json({ preferences });
  } catch (error) {
    logger.error('Error fetching preferences:', error);
    res.status(500).json({
      error: {
        type: 'SYSTEM_ERROR',
        code: 'FETCH_FAILED',
        message: 'Failed to fetch sync preferences',
      },
    });
  }
});

/**
 * PUT /api/calendar/preferences
 * Update sync preferences
 */
router.put(
  '/preferences',
  authenticate,
  validate(schemas.syncPreferences),
  async (req: AuthRequest, res: Response) => {
    try {
      await connectionService.updateSyncPreferences(req.user!.id, req.body);

      res.json({
        success: true,
        message: 'Sync preferences updated successfully',
      });
    } catch (error) {
      logger.error('Error updating preferences:', error);
      res.status(500).json({
        error: {
          type: 'SYSTEM_ERROR',
          code: 'UPDATE_FAILED',
          message: 'Failed to update sync preferences',
        },
      });
    }
  }
);

/**
 * GET /api/calendar/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'calendar-integration',
    timestamp: new Date().toISOString(),
  });
});

export default router;
