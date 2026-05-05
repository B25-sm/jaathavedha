import { Pool } from 'pg';
import {
  SessionAnalyticsDetailed,
  SessionEngagementTimeline,
  SessionQualityMetrics,
  SessionFeedback,
  SessionDashboardData,
  InstructorDashboardData,
  LiveSession
} from '../types';

export class SessionAnalyticsDashboardService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });
  }

  // ==================== REAL-TIME ANALYTICS ====================

  async updateSessionAnalytics(sessionId: string, updates: Partial<SessionAnalyticsDetailed>): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.totalParticipants !== undefined) {
      setClauses.push(`total_participants = $${paramIndex++}`);
      values.push(updates.totalParticipants);
    }
    if (updates.peakConcurrentViewers !== undefined) {
      setClauses.push(`peak_concurrent_viewers = $${paramIndex++}`);
      values.push(updates.peakConcurrentViewers);
    }
    if (updates.chatMessages !== undefined) {
      setClauses.push(`chat_messages = $${paramIndex++}`);
      values.push(updates.chatMessages);
    }
    if (updates.qaQuestions !== undefined) {
      setClauses.push(`qa_questions = $${paramIndex++}`);
      values.push(updates.qaQuestions);
    }
    if (updates.qaAnswered !== undefined) {
      setClauses.push(`qa_answered = $${paramIndex++}`);
      values.push(updates.qaAnswered);
    }
    if (updates.pollsCreated !== undefined) {
      setClauses.push(`polls_created = $${paramIndex++}`);
      values.push(updates.pollsCreated);
    }
    if (updates.pollResponses !== undefined) {
      setClauses.push(`poll_responses = $${paramIndex++}`);
      values.push(updates.pollResponses);
    }
    if (updates.handRaises !== undefined) {
      setClauses.push(`hand_raises = $${paramIndex++}`);
      values.push(updates.handRaises);
    }
    if (updates.screenShares !== undefined) {
      setClauses.push(`screen_shares = $${paramIndex++}`);
      values.push(updates.screenShares);
    }
    if (updates.engagementRate !== undefined) {
      setClauses.push(`engagement_rate = $${paramIndex++}`);
      values.push(updates.engagementRate);
    }
    if (updates.attendanceRate !== undefined) {
      setClauses.push(`attendance_rate = $${paramIndex++}`);
      values.push(updates.attendanceRate);
    }
    if (updates.dropOffRate !== undefined) {
      setClauses.push(`drop_off_rate = $${paramIndex++}`);
      values.push(updates.dropOffRate);
    }
    if (updates.averageEngagementScore !== undefined) {
      setClauses.push(`average_engagement_score = $${paramIndex++}`);
      values.push(updates.averageEngagementScore);
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = NOW()`);
    values.push(sessionId);

    const query = `
      UPDATE session_analytics
      SET ${setClauses.join(', ')}
      WHERE session_id = $${paramIndex}
    `;

    await this.pool.query(query, values);
  }

  async getSessionAnalytics(sessionId: string): Promise<SessionAnalyticsDetailed | null> {
    const query = 'SELECT * FROM session_analytics WHERE session_id = $1';
    const result = await this.pool.query(query, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapAnalyticsFromDb(result.rows[0]);
  }

  async recordEngagementTimeline(timelineData: {
    sessionId: string;
    concurrentViewers: number;
    chatActivity: number;
    qaActivity: number;
    pollActivity: number;
    handRaiseActivity: number;
    averageAttentionScore: number;
  }): Promise<void> {
    const query = `
      INSERT INTO session_engagement_timeline (
        session_id, timestamp, concurrent_viewers, chat_activity,
        qa_activity, poll_activity, hand_raise_activity, average_attention_score
      ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      timelineData.sessionId,
      timelineData.concurrentViewers,
      timelineData.chatActivity,
      timelineData.qaActivity,
      timelineData.pollActivity,
      timelineData.handRaiseActivity,
      timelineData.averageAttentionScore
    ];

    await this.pool.query(query, values);
  }

  async getEngagementTimeline(sessionId: string, intervalMinutes: number = 5): Promise<SessionEngagementTimeline[]> {
    const query = `
      SELECT
        id,
        session_id,
        date_trunc('minute', timestamp) + 
          (EXTRACT(minute FROM timestamp)::int / $2) * INTERVAL '1 minute' * $2 as timestamp,
        AVG(concurrent_viewers)::int as concurrent_viewers,
        SUM(chat_activity)::int as chat_activity,
        SUM(qa_activity)::int as qa_activity,
        SUM(poll_activity)::int as poll_activity,
        SUM(hand_raise_activity)::int as hand_raise_activity,
        AVG(average_attention_score) as average_attention_score,
        MIN(created_at) as created_at
      FROM session_engagement_timeline
      WHERE session_id = $1
      GROUP BY session_id, date_trunc('minute', timestamp) + 
        (EXTRACT(minute FROM timestamp)::int / $2) * INTERVAL '1 minute' * $2
      ORDER BY timestamp ASC
    `;

    const result = await this.pool.query(query, [sessionId, intervalMinutes]);
    return result.rows.map(row => this.mapTimelineFromDb(row));
  }

  // ==================== QUALITY METRICS ====================

  async recordQualityMetrics(metricsData: {
    sessionId: string;
    userId?: string;
    videoQuality?: string;
    audioQuality?: string;
    connectionQuality?: string;
    bufferingEvents?: number;
    disconnections?: number;
    averageBitrate?: number;
    packetLossPercentage?: number;
    latencyMs?: number;
  }): Promise<void> {
    const query = `
      INSERT INTO session_quality_metrics (
        session_id, user_id, video_quality, audio_quality, connection_quality,
        buffering_events, disconnections, average_bitrate, packet_loss_percentage, latency_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    const values = [
      metricsData.sessionId,
      metricsData.userId || null,
      metricsData.videoQuality || null,
      metricsData.audioQuality || null,
      metricsData.connectionQuality || null,
      metricsData.bufferingEvents || 0,
      metricsData.disconnections || 0,
      metricsData.averageBitrate || null,
      metricsData.packetLossPercentage || null,
      metricsData.latencyMs || null
    ];

    await this.pool.query(query, values);
  }

  async getQualityMetrics(sessionId: string): Promise<SessionQualityMetrics[]> {
    const query = 'SELECT * FROM session_quality_metrics WHERE session_id = $1';
    const result = await this.pool.query(query, [sessionId]);
    return result.rows.map(row => this.mapQualityMetricsFromDb(row));
  }

  async getAggregatedQualityMetrics(sessionId: string): Promise<{
    averageVideoQuality: string;
    averageAudioQuality: string;
    averageConnectionQuality: string;
    totalBufferingEvents: number;
    totalDisconnections: number;
    averageBitrate: number;
    averagePacketLoss: number;
    averageLatency: number;
  }> {
    const query = `
      SELECT
        MODE() WITHIN GROUP (ORDER BY video_quality) as avg_video_quality,
        MODE() WITHIN GROUP (ORDER BY audio_quality) as avg_audio_quality,
        MODE() WITHIN GROUP (ORDER BY connection_quality) as avg_connection_quality,
        SUM(buffering_events)::int as total_buffering,
        SUM(disconnections)::int as total_disconnections,
        AVG(average_bitrate)::int as avg_bitrate,
        AVG(packet_loss_percentage) as avg_packet_loss,
        AVG(latency_ms)::int as avg_latency
      FROM session_quality_metrics
      WHERE session_id = $1
    `;

    const result = await this.pool.query(query, [sessionId]);
    const row = result.rows[0];

    return {
      averageVideoQuality: row.avg_video_quality || 'unknown',
      averageAudioQuality: row.avg_audio_quality || 'unknown',
      averageConnectionQuality: row.avg_connection_quality || 'unknown',
      totalBufferingEvents: parseInt(row.total_buffering) || 0,
      totalDisconnections: parseInt(row.total_disconnections) || 0,
      averageBitrate: parseInt(row.avg_bitrate) || 0,
      averagePacketLoss: parseFloat(row.avg_packet_loss) || 0,
      averageLatency: parseInt(row.avg_latency) || 0
    };
  }

  // ==================== FEEDBACK ====================

  async submitFeedback(feedbackData: {
    sessionId: string;
    userId: string;
    overallRating: number;
    contentQuality: number;
    instructorRating: number;
    technicalQuality: number;
    engagementRating: number;
    wouldRecommend: boolean;
    feedbackText?: string;
    improvementsSuggested?: string;
    favoriteAspects?: string;
    technicalIssues?: string;
  }): Promise<SessionFeedback> {
    const query = `
      INSERT INTO session_feedback (
        session_id, user_id, overall_rating, content_quality, instructor_rating,
        technical_quality, engagement_rating, would_recommend, feedback_text,
        improvements_suggested, favorite_aspects, technical_issues
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (session_id, user_id) 
      DO UPDATE SET
        overall_rating = EXCLUDED.overall_rating,
        content_quality = EXCLUDED.content_quality,
        instructor_rating = EXCLUDED.instructor_rating,
        technical_quality = EXCLUDED.technical_quality,
        engagement_rating = EXCLUDED.engagement_rating,
        would_recommend = EXCLUDED.would_recommend,
        feedback_text = EXCLUDED.feedback_text,
        improvements_suggested = EXCLUDED.improvements_suggested,
        favorite_aspects = EXCLUDED.favorite_aspects,
        technical_issues = EXCLUDED.technical_issues
      RETURNING *
    `;

    const values = [
      feedbackData.sessionId,
      feedbackData.userId,
      feedbackData.overallRating,
      feedbackData.contentQuality,
      feedbackData.instructorRating,
      feedbackData.technicalQuality,
      feedbackData.engagementRating,
      feedbackData.wouldRecommend,
      feedbackData.feedbackText || null,
      feedbackData.improvementsSuggested || null,
      feedbackData.favoriteAspects || null,
      feedbackData.technicalIssues || null
    ];

    const result = await this.pool.query(query, values);
    
    // Update session analytics with new rating
    await this.updateSessionRatings(feedbackData.sessionId);
    
    return this.mapFeedbackFromDb(result.rows[0]);
  }

  async getSessionFeedback(sessionId: string): Promise<SessionFeedback[]> {
    const query = `
      SELECT * FROM session_feedback
      WHERE session_id = $1
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows.map(row => this.mapFeedbackFromDb(row));
  }

  private async updateSessionRatings(sessionId: string): Promise<void> {
    const query = `
      UPDATE session_analytics
      SET
        quality_rating = (SELECT AVG(overall_rating) FROM session_feedback WHERE session_id = $1),
        total_ratings = (SELECT COUNT(*) FROM session_feedback WHERE session_id = $1),
        updated_at = NOW()
      WHERE session_id = $1
    `;
    await this.pool.query(query, [sessionId]);
  }

  // ==================== DASHBOARD DATA ====================

  async getSessionDashboard(sessionId: string): Promise<SessionDashboardData | null> {
    // Get session details
    const sessionQuery = 'SELECT * FROM live_sessions WHERE id = $1';
    const sessionResult = await this.pool.query(sessionQuery, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return null;
    }

    const session = this.mapSessionFromDb(sessionResult.rows[0]);

    // Get analytics
    const analytics = await this.getSessionAnalytics(sessionId);
    if (!analytics) {
      throw new Error('Analytics not found for session');
    }

    // Get attendance summary
    const attendanceQuery = 'SELECT * FROM session_attendance_summary WHERE session_id = $1';
    const attendanceResult = await this.pool.query(attendanceQuery, [sessionId]);
    const attendanceSummary = attendanceResult.rows.length > 0 
      ? this.mapAttendanceSummaryFromDb(attendanceResult.rows[0])
      : null;

    // Get engagement timeline
    const engagementTimeline = await this.getEngagementTimeline(sessionId);

    // Get quality metrics
    const qualityMetrics = await this.getQualityMetrics(sessionId);

    // Get recent feedback
    const feedbackQuery = `
      SELECT * FROM session_feedback
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const feedbackResult = await this.pool.query(feedbackQuery, [sessionId]);
    const recentFeedback = feedbackResult.rows.map(row => this.mapFeedbackFromDb(row));

    // Get top participants
    const topParticipantsQuery = `
      SELECT * FROM session_attendance
      WHERE session_id = $1
      ORDER BY engagement_score DESC, duration_seconds DESC
      LIMIT 10
    `;
    const topParticipantsResult = await this.pool.query(topParticipantsQuery, [sessionId]);
    const topParticipants = topParticipantsResult.rows.map(row => this.mapAttendanceFromDb(row));

    return {
      session,
      analytics,
      attendanceSummary: attendanceSummary!,
      engagementTimeline,
      qualityMetrics,
      recentFeedback,
      topParticipants
    };
  }

  async getInstructorDashboard(instructorId: string): Promise<InstructorDashboardData> {
    const now = new Date();

    // Upcoming sessions
    const upcomingQuery = `
      SELECT * FROM live_sessions
      WHERE instructor_id = $1 AND start_time > $2 AND is_active = true
      ORDER BY start_time ASC
      LIMIT 10
    `;
    const upcomingResult = await this.pool.query(upcomingQuery, [instructorId, now]);
    const upcomingSessions = upcomingResult.rows.map(row => this.mapSessionFromDb(row));

    // Live sessions
    const liveQuery = `
      SELECT * FROM live_sessions
      WHERE instructor_id = $1 AND start_time <= $2 AND end_time >= $2 AND is_active = true
      ORDER BY start_time ASC
    `;
    const liveResult = await this.pool.query(liveQuery, [instructorId, now]);
    const liveSessions = liveResult.rows.map(row => this.mapSessionFromDb(row));

    // Recent sessions
    const recentQuery = `
      SELECT * FROM live_sessions
      WHERE instructor_id = $1 AND end_time < $2 AND is_active = true
      ORDER BY end_time DESC
      LIMIT 10
    `;
    const recentResult = await this.pool.query(recentQuery, [instructorId, now]);
    const recentSessions = recentResult.rows.map(row => this.mapSessionFromDb(row));

    // Overall stats
    const statsQuery = `
      SELECT
        COUNT(DISTINCT ls.id) as total_sessions,
        COALESCE(SUM(sa.total_participants), 0) as total_participants,
        COALESCE(AVG(sa.attendance_rate), 0) as avg_attendance_rate,
        COALESCE(AVG(sa.quality_rating), 0) as avg_rating,
        COALESCE(SUM(sa.total_watch_time_seconds), 0) as total_watch_time
      FROM live_sessions ls
      LEFT JOIN session_analytics sa ON ls.id = sa.session_id
      WHERE ls.instructor_id = $1 AND ls.is_active = true
    `;
    const statsResult = await this.pool.query(statsQuery, [instructorId]);
    const stats = statsResult.rows[0];

    return {
      upcomingSessions,
      liveSessions,
      recentSessions,
      overallStats: {
        totalSessions: parseInt(stats.total_sessions) || 0,
        totalParticipants: parseInt(stats.total_participants) || 0,
        averageAttendanceRate: parseFloat(stats.avg_attendance_rate) || 0,
        averageRating: parseFloat(stats.avg_rating) || 0,
        totalWatchTime: parseInt(stats.total_watch_time) || 0
      }
    };
  }

  // ==================== HELPER METHODS ====================

  private mapAnalyticsFromDb(row: any): SessionAnalyticsDetailed {
    return {
      sessionId: row.session_id,
      totalParticipants: row.total_participants,
      peakConcurrentViewers: row.peak_concurrent_viewers,
      averageWatchTime: row.average_watch_time_seconds,
      totalWatchTime: parseInt(row.total_watch_time_seconds),
      chatMessages: row.chat_messages,
      qaQuestions: row.qa_questions,
      qaAnswered: row.qa_answered,
      pollsCreated: row.polls_created,
      pollResponses: row.poll_responses,
      handRaises: row.hand_raises,
      screenShares: row.screen_shares,
      engagementRate: parseFloat(row.engagement_rate),
      attendanceRate: parseFloat(row.attendance_rate),
      dropOffRate: parseFloat(row.drop_off_rate),
      averageEngagementScore: parseFloat(row.average_engagement_score),
      qualityRating: row.quality_rating ? parseFloat(row.quality_rating) : undefined,
      totalRatings: row.total_ratings,
      technicalIssuesReported: row.technical_issues_reported,
      deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
      geographicDistribution: []
    };
  }

  private mapTimelineFromDb(row: any): SessionEngagementTimeline {
    return {
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      concurrentViewers: row.concurrent_viewers,
      chatActivity: row.chat_activity,
      qaActivity: row.qa_activity,
      pollActivity: row.poll_activity,
      handRaiseActivity: row.hand_raise_activity,
      averageAttentionScore: parseFloat(row.average_attention_score),
      createdAt: row.created_at
    };
  }

  private mapQualityMetricsFromDb(row: any): SessionQualityMetrics {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      videoQuality: row.video_quality,
      audioQuality: row.audio_quality,
      connectionQuality: row.connection_quality,
      bufferingEvents: row.buffering_events,
      disconnections: row.disconnections,
      averageBitrate: row.average_bitrate,
      packetLossPercentage: row.packet_loss_percentage ? parseFloat(row.packet_loss_percentage) : undefined,
      latencyMs: row.latency_ms,
      createdAt: row.created_at
    };
  }

  private mapFeedbackFromDb(row: any): SessionFeedback {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      overallRating: row.overall_rating,
      contentQuality: row.content_quality,
      instructorRating: row.instructor_rating,
      technicalQuality: row.technical_quality,
      engagementRating: row.engagement_rating,
      wouldRecommend: row.would_recommend,
      feedbackText: row.feedback_text,
      improvementsSuggested: row.improvements_suggested,
      favoriteAspects: row.favorite_aspects,
      technicalIssues: row.technical_issues,
      createdAt: row.created_at
    };
  }

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
      status: row.status,
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

  private mapAttendanceSummaryFromDb(row: any): any {
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

  private mapAttendanceFromDb(row: any): any {
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
}
