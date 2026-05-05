import { Router } from 'express';
import { LiveSessionService } from '../services/LiveSessionService';
import { SessionManagementService } from '../services/SessionManagementService';
import { SessionAnalyticsDashboardService } from '../services/SessionAnalyticsDashboardService';
import { CalendarIntegrationService } from '../services/CalendarIntegrationService';
import { NotificationSchedulerService } from '../services/NotificationSchedulerService';
import { CalendarProvider, NotificationChannel } from '../types';

const router = Router();
const sessionService = new LiveSessionService();
const sessionManagement = new SessionManagementService();
const analyticsDashboard = new SessionAnalyticsDashboardService();
const calendarIntegration = new CalendarIntegrationService();
const notificationScheduler = new NotificationSchedulerService();

// ==================== SESSION CRUD ====================

router.post('/create', async (req, res, next) => {
  try {
    const sessionData = req.body;
    const result = await sessionManagement.createSession(sessionData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.put('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;
    const result = await sessionManagement.updateSession(sessionId, updates);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionManagement.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      instructorId: req.query.instructorId as string,
      courseId: req.query.courseId as string,
      programId: req.query.programId as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20
    };
    const result = await sessionManagement.listSessions(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.delete('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await sessionManagement.cancelSession(sessionId);
    res.json({ success: true, message: 'Session cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// ==================== SESSION CONTROL ====================

router.post('/:sessionId/start', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const result = await sessionService.startSession(sessionId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/stop', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const result = await sessionService.stopSession(sessionId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/status', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const status = await sessionService.getSessionStatus(sessionId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

// ==================== ATTENDANCE TRACKING ====================

router.post('/:sessionId/join', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { userId, userName, userEmail, deviceType, browser, ipAddress, locationCountry, locationCity } = req.body;
    
    const attendance = await sessionManagement.recordAttendance({
      sessionId,
      userId,
      userName,
      userEmail,
      deviceType,
      browser,
      ipAddress,
      locationCountry,
      locationCity
    });
    
    res.json({ success: true, data: attendance });
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/leave', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;
    
    const attendance = await sessionManagement.getUserAttendanceRecord(sessionId, userId);
    if (attendance) {
      await sessionManagement.updateAttendanceOnLeave(attendance.id);
    }
    
    res.json({ success: true, message: 'Attendance updated' });
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/attendance', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const attendance = await sessionManagement.getSessionAttendance(sessionId);
    res.json({ success: true, data: attendance });
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/attendance/summary', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const summary = await sessionManagement.calculateAttendanceSummary(sessionId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/attendance/:attendanceId/engagement', async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const metrics = req.body;
    await sessionManagement.updateEngagementMetrics(attendanceId, metrics);
    res.json({ success: true, message: 'Engagement metrics updated' });
  } catch (error) {
    next(error);
  }
});

// ==================== ANALYTICS ====================

router.get('/:sessionId/analytics', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const analytics = await analyticsDashboard.getSessionAnalytics(sessionId);
    if (!analytics) {
      return res.status(404).json({ success: false, error: 'Analytics not found' });
    }
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/analytics/timeline', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const intervalMinutes = req.query.interval ? parseInt(req.query.interval as string) : 5;
    const timeline = await analyticsDashboard.getEngagementTimeline(sessionId, intervalMinutes);
    res.json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/analytics/timeline', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const timelineData = { sessionId, ...req.body };
    await analyticsDashboard.recordEngagementTimeline(timelineData);
    res.json({ success: true, message: 'Timeline data recorded' });
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/analytics/quality', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const metrics = await analyticsDashboard.getQualityMetrics(sessionId);
    const aggregated = await analyticsDashboard.getAggregatedQualityMetrics(sessionId);
    res.json({ success: true, data: { metrics, aggregated } });
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/analytics/quality', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const metricsData = { sessionId, ...req.body };
    await analyticsDashboard.recordQualityMetrics(metricsData);
    res.json({ success: true, message: 'Quality metrics recorded' });
  } catch (error) {
    next(error);
  }
});

// ==================== DASHBOARD ====================

router.get('/:sessionId/dashboard', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const dashboard = await analyticsDashboard.getSessionDashboard(sessionId);
    if (!dashboard) {
      return res.status(404).json({ success: false, error: 'Dashboard data not found' });
    }
    res.json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
});

router.get('/instructor/:instructorId/dashboard', async (req, res, next) => {
  try {
    const { instructorId } = req.params;
    const dashboard = await analyticsDashboard.getInstructorDashboard(instructorId);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
});

// ==================== FEEDBACK ====================

router.post('/:sessionId/feedback', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const feedbackData = { sessionId, ...req.body };
    const feedback = await analyticsDashboard.submitFeedback(feedbackData);
    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/feedback', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const feedback = await analyticsDashboard.getSessionFeedback(sessionId);
    res.json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
});

// ==================== NOTIFICATIONS ====================

router.post('/:sessionId/notifications/schedule', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { instructorId } = req.body;
    await sessionManagement.scheduleSessionNotifications(sessionId, instructorId);
    res.json({ success: true, message: 'Notifications scheduled' });
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/notifications/send', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { userId, title, message, channel } = req.body;
    await notificationScheduler.sendImmediateNotification(
      sessionId,
      userId,
      title,
      message,
      channel as NotificationChannel
    );
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/notifications/broadcast', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { title, message, channel } = req.body;
    await notificationScheduler.broadcastToSession(
      sessionId,
      title,
      message,
      channel as NotificationChannel
    );
    res.json({ success: true, message: 'Broadcast sent' });
  } catch (error) {
    next(error);
  }
});

// ==================== CALENDAR INTEGRATION ====================

router.post('/:sessionId/calendar/google', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { userId, accessToken } = req.body;
    const eventId = await calendarIntegration.addToGoogleCalendar(sessionId, userId, accessToken);
    res.json({ success: true, data: { eventId } });
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/calendar/outlook', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { userId, accessToken } = req.body;
    const eventId = await calendarIntegration.addToOutlookCalendar(sessionId, userId, accessToken);
    res.json({ success: true, data: { eventId } });
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/calendar/ical', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const ical = await calendarIntegration.generateICalFile(sessionId);
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}.ics"`);
    res.send(ical);
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/calendar/sync', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { userIds, provider } = req.body;
    const result = await calendarIntegration.syncSessionToCalendars(
      sessionId,
      userIds,
      provider as CalendarProvider
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
