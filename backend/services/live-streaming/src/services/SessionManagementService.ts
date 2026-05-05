import { Pool } from 'pg';
import {
  LiveSession,
  SessionStatus,
  SessionAttendance,
  SessionAttendanceSummary,
  SessionNotificationRecord,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  SessionCalendarReminder,
  CalendarProvider
} from '../types';

export class SessionManagementService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });
  }

  // ==================== SESSION SCHEDULING ====================

  async createSession(sessionData: Partial<LiveSession>): Promise<LiveSession> {
    const query = `
      INSERT INTO live_sessions (
        course_id, program_id, instructor_id, title, description,
        start_time, end_time, timezone, max_attendees, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      sessionData.courseId,
      sessionData.programId || null,
      sessionData.instructorId,
      sessionData.title,
      sessionData.description || null,
      sessionData.scheduledStart,
      sessionData.scheduledEnd,
      sessionData.timezone || 'Asia/Kolkata',
      sessionData.maxParticipants || 1000,
      true
    ];

    const result = await this.pool.query(query, values);
    const session = this.mapSessionFromDb(result.rows[0]);

    // Schedule notifications for this session
    await this.scheduleSessionNotifications(session.id, sessionData.instructorId!);

    // Initialize analytics record
    await this.initializeSessionAnalytics(session.id);

    return session;
  }

  async updateSession(sessionId: string, updates: Partial<LiveSession>): Promise<LiveSession> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.scheduledStart !== undefined) {
      setClauses.push(`start_time = $${paramIndex++}`);
      values.push(updates.scheduledStart);
    }
    if (updates.scheduledEnd !== undefined) {
      setClauses.push(`end_time = $${paramIndex++}`);
      values.push(updates.scheduledEnd);
    }
    if (updates.maxParticipants !== undefined) {
      setClauses.push(`max_attendees = $${paramIndex++}`);
      values.push(updates.maxParticipants);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(sessionId);

    const query = `
      UPDATE live_sessions
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    return this.mapSessionFromDb(result.rows[0]);
  }

  async getSession(sessionId: string): Promise<LiveSession | null> {
    const query = 'SELECT * FROM live_sessions WHERE id = $1';
    const result = await this.pool.query(query, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapSessionFromDb(result.rows[0]);
  }

  async listSessions(filters: {
    instructorId?: string;
    courseId?: string;
    programId?: string;
    status?: SessionStatus;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<{ sessions: LiveSession[]; total: number }> {
    const whereClauses: string[] = ['is_active = true'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.instructorId) {
      whereClauses.push(`instructor_id = $${paramIndex++}`);
      values.push(filters.instructorId);
    }
    if (filters.courseId) {
      whereClauses.push(`course_id = $${paramIndex++}`);
      values.push(filters.courseId);
    }
    if (filters.programId) {
      whereClauses.push(`program_id = $${paramIndex++}`);
      values.push(filters.programId);
    }
    if (filters.startDate) {
      whereClauses.push(`start_time >= $${paramIndex++}`);
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClauses.push(`start_time <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countQuery = `
      SELECT COUNT(*) FROM live_sessions
      WHERE ${whereClauses.join(' AND ')}
    `;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT * FROM live_sessions
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY start_time ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    values.push(pageSize, offset);

    const result = await this.pool.query(query, values);
    const sessions = result.rows.map(row => this.mapSessionFromDb(row));

    return { sessions, total };
  }

  async cancelSession(sessionId: string): Promise<void> {
    const query = `
      UPDATE live_sessions
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
    await this.pool.query(query, [sessionId]);

    // Cancel all pending notifications
    await this.cancelSessionNotifications(sessionId);
  }

  // ==================== ATTENDANCE TRACKING ====================

  async recordAttendance(attendanceData: {
    sessionId: string;
    userId: string;
    userName: string;
    userEmail: string;
    deviceType?: string;
    browser?: string;
    ipAddress?: string;
    locationCountry?: string;
    locationCity?: string;
  }): Promise<SessionAttendance> {
    const query = `
      INSERT INTO session_attendance (
        session_id, user_id, user_name, user_email, joined_at,
        device_type, browser, ip_address, location_country, location_city
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      attendanceData.sessionId,
      attendanceData.userId,
      attendanceData.userName,
      attendanceData.userEmail,
      attendanceData.deviceType || null,
      attendanceData.browser || null,
      attendanceData.ipAddress || null,
      attendanceData.locationCountry || null,
      attendanceData.locationCity || null
    ];

    const result = await this.pool.query(query, values);
    return this.mapAttendanceFromDb(result.rows[0]);
  }

  async updateAttendanceOnLeave(attendanceId: string): Promise<void> {
    const query = `
      UPDATE session_attendance
      SET left_at = NOW(), is_present = false
      WHERE id = $1
    `;
    await this.pool.query(query, [attendanceId]);
  }

  async updateEngagementMetrics(attendanceId: string, metrics: {
    chatMessagesSent?: number;
    qaQuestionsAsked?: number;
    pollsParticipated?: number;
    handRaises?: number;
    engagementScore?: number;
  }): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (metrics.chatMessagesSent !== undefined) {
      setClauses.push(`chat_messages_sent = chat_messages_sent + $${paramIndex++}`);
      values.push(metrics.chatMessagesSent);
    }
    if (metrics.qaQuestionsAsked !== undefined) {
      setClauses.push(`qa_questions_asked = qa_questions_asked + $${paramIndex++}`);
      values.push(metrics.qaQuestionsAsked);
    }
    if (metrics.pollsParticipated !== undefined) {
      setClauses.push(`polls_participated = polls_participated + $${paramIndex++}`);
      values.push(metrics.pollsParticipated);
    }
    if (metrics.handRaises !== undefined) {
      setClauses.push(`hand_raises = hand_raises + $${paramIndex++}`);
      values.push(metrics.handRaises);
    }
    if (metrics.engagementScore !== undefined) {
      setClauses.push(`engagement_score = $${paramIndex++}`);
      values.push(metrics.engagementScore);
    }

    if (setClauses.length === 0) return;

    values.push(attendanceId);

    const query = `
      UPDATE session_attendance
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `;

    await this.pool.query(query, values);
  }

  async getSessionAttendance(sessionId: string): Promise<SessionAttendance[]> {
    const query = `
      SELECT * FROM session_attendance
      WHERE session_id = $1
      ORDER BY joined_at ASC
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows.map(row => this.mapAttendanceFromDb(row));
  }

  async getUserAttendanceRecord(sessionId: string, userId: string): Promise<SessionAttendance | null> {
    const query = `
      SELECT * FROM session_attendance
      WHERE session_id = $1 AND user_id = $2
      ORDER BY joined_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [sessionId, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapAttendanceFromDb(result.rows[0]);
  }

  async calculateAttendanceSummary(sessionId: string): Promise<SessionAttendanceSummary> {
    // Get or create summary record
    let summaryQuery = 'SELECT * FROM session_attendance_summary WHERE session_id = $1';
    let result = await this.pool.query(summaryQuery, [sessionId]);

    if (result.rows.length === 0) {
      // Create new summary
      const insertQuery = `
        INSERT INTO session_attendance_summary (session_id)
        VALUES ($1)
        RETURNING *
      `;
      result = await this.pool.query(insertQuery, [sessionId]);
    }

    // Calculate metrics
    const metricsQuery = `
      SELECT
        COUNT(DISTINCT user_id) as total_attended,
        MAX(concurrent_viewers) as peak_concurrent,
        AVG(duration_seconds)::INTEGER as avg_duration,
        SUM(duration_seconds)::BIGINT as total_watch_time,
        COUNT(*) FILTER (WHERE joined_at <= (SELECT start_time + INTERVAL '5 minutes' FROM live_sessions WHERE id = $1)) as on_time,
        COUNT(*) FILTER (WHERE joined_at > (SELECT start_time + INTERVAL '5 minutes' FROM live_sessions WHERE id = $1)) as late,
        COUNT(*) FILTER (WHERE left_at < (SELECT start_time + (end_time - start_time) * 0.8 FROM live_sessions WHERE id = $1)) as early_leavers,
        COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop_count,
        COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile_count,
        COUNT(*) FILTER (WHERE device_type = 'tablet') as tablet_count
      FROM session_attendance
      WHERE session_id = $1
    `;
    const metricsResult = await this.pool.query(metricsQuery, [sessionId]);
    const metrics = metricsResult.rows[0];

    // Get geographic distribution
    const geoQuery = `
      SELECT location_country as country, COUNT(*) as count
      FROM session_attendance
      WHERE session_id = $1 AND location_country IS NOT NULL
      GROUP BY location_country
      ORDER BY count DESC
    `;
    const geoResult = await this.pool.query(geoQuery, [sessionId]);
    const geographicDistribution = geoResult.rows.map(row => ({
      country: row.country,
      count: parseInt(row.count),
      percentage: 0 // Will be calculated
    }));

    const totalGeo = geographicDistribution.reduce((sum, item) => sum + item.count, 0);
    geographicDistribution.forEach(item => {
      item.percentage = totalGeo > 0 ? (item.count / totalGeo) * 100 : 0;
    });

    // Update summary
    const updateQuery = `
      UPDATE session_attendance_summary
      SET
        total_attended = $2,
        peak_concurrent_viewers = $3,
        average_duration_seconds = $4,
        total_watch_time_seconds = $5,
        on_time_arrivals = $6,
        late_arrivals = $7,
        early_leavers = $8,
        device_breakdown = $9,
        geographic_distribution = $10,
        updated_at = NOW()
      WHERE session_id = $1
      RETURNING *
    `;

    const deviceBreakdown = {
      desktop: parseInt(metrics.desktop_count) || 0,
      mobile: parseInt(metrics.mobile_count) || 0,
      tablet: parseInt(metrics.tablet_count) || 0
    };

    const updateResult = await this.pool.query(updateQuery, [
      sessionId,
      parseInt(metrics.total_attended) || 0,
      parseInt(metrics.peak_concurrent) || 0,
      parseInt(metrics.avg_duration) || 0,
      parseInt(metrics.total_watch_time) || 0,
      parseInt(metrics.on_time) || 0,
      parseInt(metrics.late) || 0,
      parseInt(metrics.early_leavers) || 0,
      JSON.stringify(deviceBreakdown),
      JSON.stringify(geographicDistribution)
    ]);

    return this.mapAttendanceSummaryFromDb(updateResult.rows[0]);
  }

  // ==================== NOTIFICATION MANAGEMENT ====================

  async scheduleSessionNotifications(sessionId: string, instructorId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const scheduledStart = new Date(session.scheduledStart);
    const notifications: Array<{
      type: NotificationType;
      scheduledFor: Date;
      title: string;
      message: string;
    }> = [];

    // 24-hour reminder
    const reminder24h = new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > new Date()) {
      notifications.push({
        type: NotificationType.SESSION_REMINDER_24H,
        scheduledFor: reminder24h,
        title: 'Session Tomorrow',
        message: `Reminder: "${session.title}" starts in 24 hours`
      });
    }

    // 1-hour reminder
    const reminder1h = new Date(scheduledStart.getTime() - 60 * 60 * 1000);
    if (reminder1h > new Date()) {
      notifications.push({
        type: NotificationType.SESSION_REMINDER_1H,
        scheduledFor: reminder1h,
        title: 'Session Starting Soon',
        message: `Reminder: "${session.title}" starts in 1 hour`
      });
    }

    // 15-minute reminder
    const reminder15m = new Date(scheduledStart.getTime() - 15 * 60 * 1000);
    if (reminder15m > new Date()) {
      notifications.push({
        type: NotificationType.SESSION_REMINDER_15M,
        scheduledFor: reminder15m,
        title: 'Session Starting Very Soon',
        message: `Reminder: "${session.title}" starts in 15 minutes`
      });
    }

    // Get enrolled users (this would typically query enrollments table)
    // For now, we'll just schedule for the instructor
    const userIds = [instructorId];

    for (const notification of notifications) {
      for (const userId of userIds) {
        await this.createNotification({
          sessionId,
          userId,
          notificationType: notification.type,
          title: notification.title,
          message: notification.message,
          channel: NotificationChannel.EMAIL,
          scheduledFor: notification.scheduledFor
        });
      }
    }
  }

  async createNotification(notificationData: {
    sessionId: string;
    userId?: string;
    notificationType: NotificationType;
    title: string;
    message: string;
    channel: NotificationChannel;
    scheduledFor: Date;
    metadata?: Record<string, any>;
  }): Promise<SessionNotificationRecord> {
    const query = `
      INSERT INTO session_notifications (
        session_id, user_id, notification_type, title, message,
        channel, scheduled_for, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      notificationData.sessionId,
      notificationData.userId || null,
      notificationData.notificationType,
      notificationData.title,
      notificationData.message,
      notificationData.channel,
      notificationData.scheduledFor,
      JSON.stringify(notificationData.metadata || {})
    ];

    const result = await this.pool.query(query, values);
    return this.mapNotificationFromDb(result.rows[0]);
  }

  async getPendingNotifications(limit: number = 100): Promise<SessionNotificationRecord[]> {
    const query = `
      SELECT * FROM session_notifications
      WHERE status = 'pending' AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows.map(row => this.mapNotificationFromDb(row));
  }

  async markNotificationSent(notificationId: string): Promise<void> {
    const query = `
      UPDATE session_notifications
      SET status = 'sent', sent_at = NOW()
      WHERE id = $1
    `;
    await this.pool.query(query, [notificationId]);
  }

  async markNotificationFailed(notificationId: string, errorMessage: string): Promise<void> {
    const query = `
      UPDATE session_notifications
      SET status = 'failed', error_message = $2
      WHERE id = $1
    `;
    await this.pool.query(query, [notificationId, errorMessage]);
  }

  async cancelSessionNotifications(sessionId: string): Promise<void> {
    const query = `
      UPDATE session_notifications
      SET status = 'cancelled'
      WHERE session_id = $1 AND status = 'pending'
    `;
    await this.pool.query(query, [sessionId]);
  }

  // ==================== CALENDAR INTEGRATION ====================

  async createCalendarReminder(reminderData: {
    sessionId: string;
    userId: string;
    calendarProvider: CalendarProvider;
    calendarEventId?: string;
    reminderMinutesBefore?: number[];
  }): Promise<SessionCalendarReminder> {
    const query = `
      INSERT INTO session_calendar_reminders (
        session_id, user_id, calendar_provider, calendar_event_id, reminder_minutes_before
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      reminderData.sessionId,
      reminderData.userId,
      reminderData.calendarProvider,
      reminderData.calendarEventId || null,
      reminderData.reminderMinutesBefore || [15, 60, 1440]
    ];

    const result = await this.pool.query(query, values);
    return this.mapCalendarReminderFromDb(result.rows[0]);
  }

  async syncCalendarReminder(reminderId: string, calendarEventId: string): Promise<void> {
    const query = `
      UPDATE session_calendar_reminders
      SET calendar_event_id = $2, is_synced = true, last_synced_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `;
    await this.pool.query(query, [reminderId, calendarEventId]);
  }

  async getCalendarReminders(sessionId: string): Promise<SessionCalendarReminder[]> {
    const query = `
      SELECT * FROM session_calendar_reminders
      WHERE session_id = $1
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows.map(row => this.mapCalendarReminderFromDb(row));
  }

  // ==================== ANALYTICS INITIALIZATION ====================

  private async initializeSessionAnalytics(sessionId: string): Promise<void> {
    const query = `
      INSERT INTO session_analytics (session_id)
      VALUES ($1)
      ON CONFLICT (session_id) DO NOTHING
    `;
    await this.pool.query(query, [sessionId]);
  }

  // ==================== HELPER METHODS ====================

  private mapSessionFromDb(row: any): LiveSession {
    return {
      id: row.id,
      courseId: row.course_id,
      programId: row.program_id,
      instructorId: row.instructor_id,
      title: row.title,
      description: row.description,
      scheduledStart: row.start_time,
      scheduledEnd: row.end_time,
      actualStart: row.actual_start,
      actualEnd: row.actual_end,
      maxParticipants: row.max_attendees,
      recordingUrl: row.recording_url,
      status: this.determineSessionStatus(row),
      settings: {
        enableChat: true,
        enableQA: true,
        enablePolls: true,
        enableHandRaise: true,
        enableScreenShare: true,
        enableRecording: true,
        autoRecord: true,
        chatModeration: false,
        requireApproval: false
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private determineSessionStatus(row: any): SessionStatus {
    const now = new Date();
    const start = new Date(row.start_time);
    const end = new Date(row.end_time);

    if (!row.is_active) {
      return SessionStatus.CANCELLED;
    }
    if (now < start) {
      return SessionStatus.SCHEDULED;
    }
    if (now >= start && now <= end) {
      return SessionStatus.LIVE;
    }
    return SessionStatus.ENDED;
  }

  private mapAttendanceFromDb(row: any): SessionAttendance {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      joinedAt: row.joined_at,
      leftAt: row.left_at,
      durationSeconds: row.duration_seconds,
      deviceType: row.device_type,
      browser: row.browser,
      ipAddress: row.ip_address,
      locationCountry: row.location_country,
      locationCity: row.location_city,
      engagementScore: parseFloat(row.engagement_score),
      chatMessagesSent: row.chat_messages_sent,
      qaQuestionsAsked: row.qa_questions_asked,
      pollsParticipated: row.polls_participated,
      handRaises: row.hand_raises,
      isPresent: row.is_present,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapAttendanceSummaryFromDb(row: any): SessionAttendanceSummary {
    return {
      id: row.id,
      sessionId: row.session_id,
      totalRegistered: row.total_registered,
      totalAttended: row.total_attended,
      attendanceRate: parseFloat(row.attendance_rate),
      peakConcurrentViewers: row.peak_concurrent_viewers,
      averageDurationSeconds: row.average_duration_seconds,
      totalWatchTimeSeconds: parseInt(row.total_watch_time_seconds),
      onTimeArrivals: row.on_time_arrivals,
      lateArrivals: row.late_arrivals,
      earlyLeavers: row.early_leavers,
      deviceBreakdown: typeof row.device_breakdown === 'string' 
        ? JSON.parse(row.device_breakdown) 
        : row.device_breakdown,
      geographicDistribution: typeof row.geographic_distribution === 'string'
        ? JSON.parse(row.geographic_distribution)
        : row.geographic_distribution,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapNotificationFromDb(row: any): SessionNotificationRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      notificationType: row.notification_type,
      title: row.title,
      message: row.message,
      channel: row.channel,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      status: row.status,
      errorMessage: row.error_message,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at
    };
  }

  private mapCalendarReminderFromDb(row: any): SessionCalendarReminder {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      calendarProvider: row.calendar_provider,
      calendarEventId: row.calendar_event_id,
      reminderMinutesBefore: row.reminder_minutes_before,
      isSynced: row.is_synced,
      syncError: row.sync_error,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
