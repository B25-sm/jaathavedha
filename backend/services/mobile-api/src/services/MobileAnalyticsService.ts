import { Pool } from 'pg';
import Redis from 'ioredis';

interface LearningSession {
  id: string;
  userId: string;
  deviceId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  coursesAccessed: string[];
  videosWatched: string[];
  notesCreated: number;
  assignmentsCompleted: number;
  interactionCount: number;
}

interface ProgressSync {
  userId: string;
  courseId: string;
  lessonId?: string;
  videoId?: string;
  progress: number;
  lastPosition?: number;
  completedAt?: Date;
  deviceId: string;
  syncedAt: Date;
}

interface EngagementMetrics {
  userId: string;
  dailyActiveStreak: number;
  weeklyActiveStreak: number;
  totalLearningTime: number;
  averageSessionDuration: number;
  coursesInProgress: number;
  coursesCompleted: number;
  engagementScore: number;
  lastActiveDate: Date;
}

interface LearningHabit {
  userId: string;
  preferredLearningTime: string;
  averageSessionsPerDay: number;
  preferredDuration: number;
  mostActiveDay: string;
  consistencyScore: number;
  reminderPreferences: {
    enabled: boolean;
    frequency: string;
    time: string;
    days: string[];
  };
}

export class MobileAnalyticsService {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  // ==================== Learning Session Tracking ====================

  async startSession(userId: string, deviceId: string): Promise<LearningSession> {
    const sessionId = `session:${userId}:${deviceId}:${Date.now()}`;
    
    const session: LearningSession = {
      id: sessionId,
      userId,
      deviceId,
      startTime: new Date(),
      coursesAccessed: [],
      videosWatched: [],
      notesCreated: 0,
      assignmentsCompleted: 0,
      interactionCount: 0
    };

    // Store in Redis for real-time tracking
    await this.redis.setex(
      `mobile:session:${sessionId}`,
      3600, // 1 hour expiry
      JSON.stringify(session)
    );

    // Track in database
    await this.db.query(
      `INSERT INTO mobile_learning_sessions 
       (id, user_id, device_id, start_time, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [sessionId, userId, deviceId, session.startTime]
    );

    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    const sessionKey = `mobile:session:${sessionId}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const session: LearningSession = JSON.parse(sessionData);
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

    // Update database
    await this.db.query(
      `UPDATE mobile_learning_sessions 
       SET end_time = $1, duration = $2, status = 'completed',
           courses_accessed = $3, videos_watched = $4,
           notes_created = $5, assignments_completed = $6,
           interaction_count = $7
       WHERE id = $8`,
      [
        endTime,
        duration,
        session.coursesAccessed,
        session.videosWatched,
        session.notesCreated,
        session.assignmentsCompleted,
        session.interactionCount,
        sessionId
      ]
    );

    // Remove from Redis
    await this.redis.del(sessionKey);

    // Update engagement metrics
    await this.updateEngagementMetrics(session.userId);
  }

  async trackSessionActivity(
    sessionId: string,
    activityType: string,
    entityId: string
  ): Promise<void> {
    const sessionKey = `mobile:session:${sessionId}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      return;
    }

    const session: LearningSession = JSON.parse(sessionData);
    session.interactionCount++;

    switch (activityType) {
      case 'course_access':
        if (!session.coursesAccessed.includes(entityId)) {
          session.coursesAccessed.push(entityId);
        }
        break;
      case 'video_watch':
        if (!session.videosWatched.includes(entityId)) {
          session.videosWatched.push(entityId);
        }
        break;
      case 'note_create':
        session.notesCreated++;
        break;
      case 'assignment_complete':
        session.assignmentsCompleted++;
        break;
    }

    await this.redis.setex(sessionKey, 3600, JSON.stringify(session));
  }

  // ==================== Progress Synchronization ====================

  async syncProgress(progressData: ProgressSync): Promise<void> {
    const { userId, courseId, lessonId, videoId, progress, lastPosition, completedAt, deviceId } = progressData;

    // Check for conflicts
    const existingProgress = await this.db.query(
      `SELECT * FROM mobile_progress_sync 
       WHERE user_id = $1 AND course_id = $2 
       AND (lesson_id = $3 OR lesson_id IS NULL)
       AND (video_id = $4 OR video_id IS NULL)
       ORDER BY synced_at DESC LIMIT 1`,
      [userId, courseId, lessonId || null, videoId || null]
    );

    if (existingProgress.rows.length > 0) {
      const existing = existingProgress.rows[0];
      
      // Resolve conflict: use the most recent progress
      if (new Date(existing.synced_at) > new Date(progressData.syncedAt)) {
        // Existing is newer, return conflict
        throw new Error('CONFLICT: Newer progress exists on server');
      }
    }

    // Upsert progress
    await this.db.query(
      `INSERT INTO mobile_progress_sync 
       (user_id, course_id, lesson_id, video_id, progress, last_position, completed_at, device_id, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, course_id, COALESCE(lesson_id, '00000000-0000-0000-0000-000000000000'), COALESCE(video_id, '00000000-0000-0000-0000-000000000000'))
       DO UPDATE SET 
         progress = EXCLUDED.progress,
         last_position = EXCLUDED.last_position,
         completed_at = EXCLUDED.completed_at,
         device_id = EXCLUDED.device_id,
         synced_at = EXCLUDED.synced_at`,
      [userId, courseId, lessonId, videoId, progress, lastPosition, completedAt, deviceId, progressData.syncedAt]
    );

    // Cache in Redis for fast access
    const cacheKey = `mobile:progress:${userId}:${courseId}:${lessonId || 'all'}:${videoId || 'all'}`;
    await this.redis.setex(cacheKey, 3600, JSON.stringify(progressData));
  }

  async getProgress(
    userId: string,
    courseId: string,
    lessonId?: string,
    videoId?: string
  ): Promise<ProgressSync | null> {
    // Try cache first
    const cacheKey = `mobile:progress:${userId}:${courseId}:${lessonId || 'all'}:${videoId || 'all'}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const result = await this.db.query(
      `SELECT * FROM mobile_progress_sync 
       WHERE user_id = $1 AND course_id = $2 
       AND (lesson_id = $3 OR $3 IS NULL)
       AND (video_id = $4 OR $4 IS NULL)
       ORDER BY synced_at DESC LIMIT 1`,
      [userId, courseId, lessonId || null, videoId || null]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const progress: ProgressSync = {
      userId: result.rows[0].user_id,
      courseId: result.rows[0].course_id,
      lessonId: result.rows[0].lesson_id,
      videoId: result.rows[0].video_id,
      progress: result.rows[0].progress,
      lastPosition: result.rows[0].last_position,
      completedAt: result.rows[0].completed_at,
      deviceId: result.rows[0].device_id,
      syncedAt: result.rows[0].synced_at
    };

    // Cache for future requests
    await this.redis.setex(cacheKey, 3600, JSON.stringify(progress));

    return progress;
  }

  async getAllProgress(userId: string): Promise<ProgressSync[]> {
    const result = await this.db.query(
      `SELECT DISTINCT ON (course_id, lesson_id, video_id) *
       FROM mobile_progress_sync 
       WHERE user_id = $1 
       ORDER BY course_id, lesson_id, video_id, synced_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      userId: row.user_id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      videoId: row.video_id,
      progress: row.progress,
      lastPosition: row.last_position,
      completedAt: row.completed_at,
      deviceId: row.device_id,
      syncedAt: row.synced_at
    }));
  }

  // ==================== Engagement Tracking ====================

  async trackEngagement(
    userId: string,
    engagementType: string,
    metadata: any
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO mobile_engagement_events 
       (user_id, engagement_type, metadata, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [userId, engagementType, JSON.stringify(metadata)]
    );

    // Update real-time engagement score
    await this.updateEngagementScore(userId);
  }

  async getEngagementMetrics(userId: string): Promise<EngagementMetrics> {
    // Check cache first
    const cacheKey = `mobile:engagement:${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Calculate metrics from database
    const [streakResult, timeResult, coursesResult] = await Promise.all([
      // Daily and weekly streaks
      this.db.query(
        `WITH daily_activity AS (
          SELECT DISTINCT DATE(timestamp) as activity_date
          FROM mobile_engagement_events
          WHERE user_id = $1
          ORDER BY activity_date DESC
        ),
        streak_calc AS (
          SELECT 
            activity_date,
            activity_date - ROW_NUMBER() OVER (ORDER BY activity_date DESC)::integer AS streak_group
          FROM daily_activity
        )
        SELECT 
          COUNT(*) as daily_streak,
          COUNT(*) / 7 as weekly_streak
        FROM streak_calc
        WHERE streak_group = (SELECT MAX(streak_group) FROM streak_calc)`,
        [userId]
      ),
      
      // Total learning time
      this.db.query(
        `SELECT 
          COALESCE(SUM(duration), 0) as total_time,
          COALESCE(AVG(duration), 0) as avg_duration
         FROM mobile_learning_sessions
         WHERE user_id = $1 AND status = 'completed'`,
        [userId]
      ),
      
      // Course progress
      this.db.query(
        `SELECT 
          COUNT(DISTINCT CASE WHEN progress < 100 THEN course_id END) as in_progress,
          COUNT(DISTINCT CASE WHEN progress = 100 THEN course_id END) as completed
         FROM mobile_progress_sync
         WHERE user_id = $1`,
        [userId]
      )
    ]);

    const lastActiveResult = await this.db.query(
      `SELECT MAX(timestamp) as last_active
       FROM mobile_engagement_events
       WHERE user_id = $1`,
      [userId]
    );

    const metrics: EngagementMetrics = {
      userId,
      dailyActiveStreak: parseInt(streakResult.rows[0]?.daily_streak || '0'),
      weeklyActiveStreak: parseInt(streakResult.rows[0]?.weekly_streak || '0'),
      totalLearningTime: parseInt(timeResult.rows[0]?.total_time || '0'),
      averageSessionDuration: parseInt(timeResult.rows[0]?.avg_duration || '0'),
      coursesInProgress: parseInt(coursesResult.rows[0]?.in_progress || '0'),
      coursesCompleted: parseInt(coursesResult.rows[0]?.completed || '0'),
      engagementScore: 0, // Will be calculated
      lastActiveDate: lastActiveResult.rows[0]?.last_active || new Date()
    };

    // Calculate engagement score (0-100)
    metrics.engagementScore = this.calculateEngagementScore(metrics);

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(metrics));

    return metrics;
  }

  private calculateEngagementScore(metrics: EngagementMetrics): number {
    let score = 0;
    
    // Daily streak (max 30 points)
    score += Math.min(metrics.dailyActiveStreak * 2, 30);
    
    // Learning time (max 25 points)
    const hoursLearned = metrics.totalLearningTime / 3600;
    score += Math.min(hoursLearned / 10, 25);
    
    // Course completion (max 25 points)
    score += Math.min(metrics.coursesCompleted * 5, 25);
    
    // Active courses (max 20 points)
    score += Math.min(metrics.coursesInProgress * 4, 20);
    
    return Math.min(Math.round(score), 100);
  }

  private async updateEngagementScore(userId: string): Promise<void> {
    // Invalidate cache to force recalculation
    await this.redis.del(`mobile:engagement:${userId}`);
  }

  private async updateEngagementMetrics(userId: string): Promise<void> {
    // Invalidate cache
    await this.redis.del(`mobile:engagement:${userId}`);
  }

  // ==================== Learning Habit Tracking ====================

  async analyzeLearningHabits(userId: string): Promise<LearningHabit> {
    // Check cache
    const cacheKey = `mobile:habits:${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Analyze learning patterns
    const [timeResult, dayResult, consistencyResult] = await Promise.all([
      // Preferred learning time
      this.db.query(
        `SELECT 
          EXTRACT(HOUR FROM start_time) as hour,
          COUNT(*) as session_count
         FROM mobile_learning_sessions
         WHERE user_id = $1 AND status = 'completed'
         GROUP BY hour
         ORDER BY session_count DESC
         LIMIT 1`,
        [userId]
      ),
      
      // Most active day
      this.db.query(
        `SELECT 
          TO_CHAR(start_time, 'Day') as day_name,
          COUNT(*) as session_count
         FROM mobile_learning_sessions
         WHERE user_id = $1 AND status = 'completed'
         GROUP BY day_name
         ORDER BY session_count DESC
         LIMIT 1`,
        [userId]
      ),
      
      // Consistency score
      this.db.query(
        `WITH daily_sessions AS (
          SELECT 
            DATE(start_time) as session_date,
            COUNT(*) as sessions_per_day
          FROM mobile_learning_sessions
          WHERE user_id = $1 AND status = 'completed'
            AND start_time >= NOW() - INTERVAL '30 days'
          GROUP BY session_date
        )
        SELECT 
          COUNT(*) as active_days,
          AVG(sessions_per_day) as avg_sessions,
          STDDEV(sessions_per_day) as stddev_sessions
        FROM daily_sessions`,
        [userId]
      )
    ]);

    const avgDurationResult = await this.db.query(
      `SELECT AVG(duration) as avg_duration
       FROM mobile_learning_sessions
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );

    // Get reminder preferences
    const reminderResult = await this.db.query(
      `SELECT * FROM mobile_learning_reminders
       WHERE user_id = $1`,
      [userId]
    );

    const preferredHour = parseInt(timeResult.rows[0]?.hour || '18');
    const preferredTime = `${preferredHour.toString().padStart(2, '0')}:00`;
    
    const activeDays = parseInt(consistencyResult.rows[0]?.active_days || '0');
    const consistencyScore = Math.min((activeDays / 30) * 100, 100);

    const habit: LearningHabit = {
      userId,
      preferredLearningTime: preferredTime,
      averageSessionsPerDay: parseFloat(consistencyResult.rows[0]?.avg_sessions || '0'),
      preferredDuration: parseInt(avgDurationResult.rows[0]?.avg_duration || '1800'),
      mostActiveDay: dayResult.rows[0]?.day_name?.trim() || 'Monday',
      consistencyScore: Math.round(consistencyScore),
      reminderPreferences: reminderResult.rows[0] ? {
        enabled: reminderResult.rows[0].enabled,
        frequency: reminderResult.rows[0].frequency,
        time: reminderResult.rows[0].reminder_time,
        days: reminderResult.rows[0].reminder_days
      } : {
        enabled: false,
        frequency: 'daily',
        time: preferredTime,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      }
    };

    // Cache for 1 hour
    await this.redis.setex(cacheKey, 3600, JSON.stringify(habit));

    return habit;
  }

  async setReminderPreferences(
    userId: string,
    preferences: LearningHabit['reminderPreferences']
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO mobile_learning_reminders 
       (user_id, enabled, frequency, reminder_time, reminder_days)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET 
         enabled = EXCLUDED.enabled,
         frequency = EXCLUDED.frequency,
         reminder_time = EXCLUDED.reminder_time,
         reminder_days = EXCLUDED.reminder_days,
         updated_at = NOW()`,
      [userId, preferences.enabled, preferences.frequency, preferences.time, preferences.days]
    );

    // Invalidate cache
    await this.redis.del(`mobile:habits:${userId}`);
  }

  async getUpcomingReminders(userId: string): Promise<any[]> {
    const habits = await this.analyzeLearningHabits(userId);
    
    if (!habits.reminderPreferences.enabled) {
      return [];
    }

    const now = new Date();
    const reminders = [];

    // Generate reminders based on preferences
    for (const day of habits.reminderPreferences.days) {
      const [hours, minutes] = habits.reminderPreferences.time.split(':').map(Number);
      const reminderDate = new Date(now);
      
      // Find next occurrence of this day
      const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
      const daysUntil = (dayIndex - now.getDay() + 7) % 7 || 7;
      
      reminderDate.setDate(now.getDate() + daysUntil);
      reminderDate.setHours(hours, minutes, 0, 0);

      if (reminderDate > now) {
        reminders.push({
          userId,
          scheduledFor: reminderDate,
          message: `Time for your ${habits.preferredDuration / 60} minute learning session!`,
          type: 'learning_reminder'
        });
      }
    }

    return reminders.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  // ==================== Analytics Reports ====================

  async getMobileAnalyticsReport(userId: string, period: string = '7d'): Promise<any> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    
    const [sessionsResult, progressResult, engagementResult] = await Promise.all([
      // Session analytics
      this.db.query(
        `SELECT 
          DATE(start_time) as date,
          COUNT(*) as session_count,
          SUM(duration) as total_duration,
          AVG(duration) as avg_duration,
          SUM(interaction_count) as total_interactions
         FROM mobile_learning_sessions
         WHERE user_id = $1 AND status = 'completed'
           AND start_time >= NOW() - INTERVAL '${days} days'
         GROUP BY DATE(start_time)
         ORDER BY date DESC`,
        [userId]
      ),
      
      // Progress analytics
      this.db.query(
        `SELECT 
          course_id,
          MAX(progress) as current_progress,
          COUNT(*) as sync_count,
          MAX(synced_at) as last_synced
         FROM mobile_progress_sync
         WHERE user_id = $1
         GROUP BY course_id`,
        [userId]
      ),
      
      // Engagement analytics
      this.db.query(
        `SELECT 
          engagement_type,
          COUNT(*) as event_count,
          DATE(timestamp) as date
         FROM mobile_engagement_events
         WHERE user_id = $1
           AND timestamp >= NOW() - INTERVAL '${days} days'
         GROUP BY engagement_type, DATE(timestamp)
         ORDER BY date DESC`,
        [userId]
      )
    ]);

    const metrics = await this.getEngagementMetrics(userId);
    const habits = await this.analyzeLearningHabits(userId);

    return {
      period,
      userId,
      summary: {
        totalSessions: sessionsResult.rows.reduce((sum, row) => sum + parseInt(row.session_count), 0),
        totalLearningTime: sessionsResult.rows.reduce((sum, row) => sum + parseInt(row.total_duration || '0'), 0),
        averageSessionDuration: metrics.averageSessionDuration,
        engagementScore: metrics.engagementScore,
        consistencyScore: habits.consistencyScore
      },
      dailySessions: sessionsResult.rows,
      courseProgress: progressResult.rows,
      engagementEvents: engagementResult.rows,
      streaks: {
        daily: metrics.dailyActiveStreak,
        weekly: metrics.weeklyActiveStreak
      },
      learningHabits: habits
    };
  }

  // ==================== Mobile-Specific Analytics ====================

  async getMobileDeviceAnalytics(userId: string): Promise<any> {
    // Get device usage statistics
    const devicesResult = await this.db.query(
      `SELECT 
        device_id,
        device_name,
        device_type,
        os_version,
        app_version,
        last_active_at,
        registered_at,
        COUNT(DISTINCT mls.id) as session_count,
        SUM(mls.duration) as total_duration
       FROM mobile_devices md
       LEFT JOIN mobile_learning_sessions mls ON md.device_id = mls.device_id
       WHERE md.user_id = $1 AND md.is_active = true
       GROUP BY md.device_id, md.device_name, md.device_type, md.os_version, md.app_version, md.last_active_at, md.registered_at
       ORDER BY md.last_active_at DESC`,
      [userId]
    );

    // Get sync statistics per device
    const syncStatsResult = await this.db.query(
      `SELECT 
        device_id,
        COUNT(*) as sync_count,
        MAX(synced_at) as last_sync,
        COUNT(DISTINCT course_id) as courses_synced
       FROM mobile_progress_sync
       WHERE user_id = $1
       GROUP BY device_id`,
      [userId]
    );

    const syncStatsByDevice = syncStatsResult.rows.reduce((acc, row) => {
      acc[row.device_id] = {
        syncCount: parseInt(row.sync_count),
        lastSync: row.last_sync,
        coursesSynced: parseInt(row.courses_synced)
      };
      return acc;
    }, {} as any);

    return {
      devices: devicesResult.rows.map(device => ({
        deviceId: device.device_id,
        deviceName: device.device_name,
        deviceType: device.device_type,
        osVersion: device.os_version,
        appVersion: device.app_version,
        lastActive: device.last_active_at,
        registeredAt: device.registered_at,
        sessionCount: parseInt(device.session_count || '0'),
        totalDuration: parseInt(device.total_duration || '0'),
        syncStats: syncStatsByDevice[device.device_id] || {
          syncCount: 0,
          lastSync: null,
          coursesSynced: 0
        }
      })),
      totalDevices: devicesResult.rows.length,
      mostUsedDevice: devicesResult.rows[0]?.device_id || null
    };
  }

  async getFeatureUsageAnalytics(userId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        feature_name,
        usage_count,
        last_used_at,
        first_used_at
       FROM mobile_feature_usage
       WHERE user_id = $1
       ORDER BY usage_count DESC`,
      [userId]
    );

    const totalUsage = result.rows.reduce((sum, row) => sum + parseInt(row.usage_count), 0);

    return {
      features: result.rows.map(row => ({
        name: row.feature_name,
        usageCount: parseInt(row.usage_count),
        lastUsed: row.last_used_at,
        firstUsed: row.first_used_at,
        usagePercentage: totalUsage > 0 ? Math.round((parseInt(row.usage_count) / totalUsage) * 100) : 0
      })),
      totalFeatures: result.rows.length,
      totalUsage,
      mostUsedFeature: result.rows[0]?.feature_name || null
    };
  }

  async trackFeatureUsage(userId: string, featureName: string): Promise<void> {
    await this.db.query(
      `INSERT INTO mobile_feature_usage (user_id, feature_name, usage_count, last_used_at, first_used_at)
       VALUES ($1, $2, 1, NOW(), NOW())
       ON CONFLICT (user_id, feature_name)
       DO UPDATE SET
         usage_count = mobile_feature_usage.usage_count + 1,
         last_used_at = NOW()`,
      [userId, featureName]
    );
  }

  async getPerformanceMetrics(userId: string, deviceId?: string): Promise<any> {
    const query = deviceId
      ? `SELECT 
          metric_type,
          AVG(metric_value) as avg_value,
          MIN(metric_value) as min_value,
          MAX(metric_value) as max_value,
          COUNT(*) as sample_count
         FROM mobile_performance_metrics
         WHERE user_id = $1 AND device_id = $2
           AND timestamp >= NOW() - INTERVAL '7 days'
         GROUP BY metric_type`
      : `SELECT 
          metric_type,
          AVG(metric_value) as avg_value,
          MIN(metric_value) as min_value,
          MAX(metric_value) as max_value,
          COUNT(*) as sample_count
         FROM mobile_performance_metrics
         WHERE user_id = $1
           AND timestamp >= NOW() - INTERVAL '7 days'
         GROUP BY metric_type`;

    const params = deviceId ? [userId, deviceId] : [userId];
    const result = await this.db.query(query, params);

    return {
      metrics: result.rows.map(row => ({
        type: row.metric_type,
        average: parseFloat(row.avg_value),
        min: parseFloat(row.min_value),
        max: parseFloat(row.max_value),
        sampleCount: parseInt(row.sample_count)
      })),
      deviceId: deviceId || 'all'
    };
  }

  async trackPerformanceMetric(
    userId: string,
    deviceId: string,
    metricType: string,
    metricValue: number,
    metadata?: any
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO mobile_performance_metrics (user_id, device_id, metric_type, metric_value, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, deviceId, metricType, metricValue, JSON.stringify(metadata || {})]
    );
  }

  // ==================== Cross-Device Optimization ====================

  async optimizeSyncStrategy(userId: string): Promise<any> {
    // Analyze sync patterns to optimize strategy
    const syncPatternsResult = await this.db.query(
      `SELECT 
        device_id,
        COUNT(*) as sync_count,
        AVG(EXTRACT(EPOCH FROM (synced_at - LAG(synced_at) OVER (PARTITION BY device_id ORDER BY synced_at)))) as avg_sync_interval,
        COUNT(DISTINCT course_id) as courses_synced
       FROM mobile_progress_sync
       WHERE user_id = $1
         AND synced_at >= NOW() - INTERVAL '7 days'
       GROUP BY device_id`,
      [userId]
    );

    // Check for conflicts
    const conflictsResult = await this.db.query(
      `SELECT COUNT(*) as conflict_count
       FROM mobile_progress_conflicts
       WHERE user_id = $1 AND resolution_status = 'pending'`,
      [userId]
    );

    const recommendations = [];
    
    for (const pattern of syncPatternsResult.rows) {
      const avgInterval = parseFloat(pattern.avg_sync_interval || '0');
      
      if (avgInterval > 3600) {
        recommendations.push({
          deviceId: pattern.device_id,
          recommendation: 'increase_sync_frequency',
          reason: 'Long intervals between syncs detected',
          suggestedInterval: 1800 // 30 minutes
        });
      }
      
      if (parseInt(pattern.sync_count) < 5) {
        recommendations.push({
          deviceId: pattern.device_id,
          recommendation: 'enable_auto_sync',
          reason: 'Low sync frequency detected',
          suggestedInterval: 900 // 15 minutes
        });
      }
    }

    return {
      syncPatterns: syncPatternsResult.rows.map(row => ({
        deviceId: row.device_id,
        syncCount: parseInt(row.sync_count),
        avgSyncInterval: parseFloat(row.avg_sync_interval || '0'),
        coursesSynced: parseInt(row.courses_synced)
      })),
      pendingConflicts: parseInt(conflictsResult.rows[0]?.conflict_count || '0'),
      recommendations,
      optimizationScore: this.calculateSyncOptimizationScore(syncPatternsResult.rows, parseInt(conflictsResult.rows[0]?.conflict_count || '0'))
    };
  }

  private calculateSyncOptimizationScore(patterns: any[], conflictCount: number): number {
    let score = 100;
    
    // Penalize for conflicts
    score -= conflictCount * 10;
    
    // Penalize for poor sync patterns
    for (const pattern of patterns) {
      const avgInterval = parseFloat(pattern.avg_sync_interval || '0');
      if (avgInterval > 3600) {
        score -= 5;
      }
      if (parseInt(pattern.sync_count) < 5) {
        score -= 5;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  async resolveProgressConflict(
    conflictId: string,
    resolution: 'device1' | 'device2' | 'manual',
    manualProgress?: number
  ): Promise<void> {
    const conflictResult = await this.db.query(
      `SELECT * FROM mobile_progress_conflicts WHERE id = $1`,
      [conflictId]
    );

    if (conflictResult.rows.length === 0) {
      throw new Error('Conflict not found');
    }

    const conflict = conflictResult.rows[0];
    let resolvedProgress: number;
    let resolvedDeviceId: string;

    if (resolution === 'device1') {
      resolvedProgress = conflict.device1_progress;
      resolvedDeviceId = conflict.device1_id;
    } else if (resolution === 'device2') {
      resolvedProgress = conflict.device2_progress;
      resolvedDeviceId = conflict.device2_id;
    } else {
      resolvedProgress = manualProgress!;
      resolvedDeviceId = conflict.device1_id; // Use first device as reference
    }

    // Update progress with resolved value
    await this.syncProgress({
      userId: conflict.user_id,
      courseId: conflict.course_id,
      lessonId: conflict.lesson_id,
      videoId: conflict.video_id,
      progress: resolvedProgress,
      deviceId: resolvedDeviceId,
      syncedAt: new Date()
    });

    // Mark conflict as resolved
    await this.db.query(
      `UPDATE mobile_progress_conflicts
       SET resolution_status = 'resolved',
           resolved_at = NOW(),
           resolved_by = $1
       WHERE id = $2`,
      [resolution === 'manual' ? 'user' : 'auto', conflictId]
    );
  }

  // ==================== Engagement Optimization ====================

  async getEngagementInsights(userId: string): Promise<any> {
    const metrics = await this.getEngagementMetrics(userId);
    const habits = await this.analyzeLearningHabits(userId);
    
    const insights = [];
    
    // Streak insights
    if (metrics.dailyActiveStreak === 0) {
      insights.push({
        type: 'streak_broken',
        severity: 'high',
        message: 'Your learning streak has been broken. Start a new session today!',
        action: 'start_session'
      });
    } else if (metrics.dailyActiveStreak >= 7) {
      insights.push({
        type: 'streak_milestone',
        severity: 'positive',
        message: `Amazing! You've maintained a ${metrics.dailyActiveStreak}-day learning streak!`,
        action: 'celebrate'
      });
    }
    
    // Engagement score insights
    if (metrics.engagementScore < 30) {
      insights.push({
        type: 'low_engagement',
        severity: 'medium',
        message: 'Your engagement is lower than usual. Try setting a daily learning goal.',
        action: 'set_goal'
      });
    } else if (metrics.engagementScore >= 80) {
      insights.push({
        type: 'high_engagement',
        severity: 'positive',
        message: 'Excellent engagement! You\'re in the top tier of learners.',
        action: 'share_achievement'
      });
    }
    
    // Consistency insights
    if (habits.consistencyScore < 50) {
      insights.push({
        type: 'inconsistent_learning',
        severity: 'medium',
        message: 'Try to maintain a more consistent learning schedule for better results.',
        action: 'enable_reminders'
      });
    }
    
    // Time optimization
    if (habits.averageSessionsPerDay < 1) {
      insights.push({
        type: 'low_frequency',
        severity: 'medium',
        message: 'Consider increasing your learning frequency to at least once per day.',
        action: 'schedule_session'
      });
    }

    return {
      insights,
      overallHealth: this.calculateEngagementHealth(metrics, habits),
      recommendations: this.generateEngagementRecommendations(metrics, habits)
    };
  }

  private calculateEngagementHealth(metrics: EngagementMetrics, habits: LearningHabit): string {
    const score = (metrics.engagementScore + habits.consistencyScore) / 2;
    
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'needs_improvement';
  }

  private generateEngagementRecommendations(metrics: EngagementMetrics, habits: LearningHabit): any[] {
    const recommendations = [];
    
    if (metrics.dailyActiveStreak < 3) {
      recommendations.push({
        title: 'Build a Learning Streak',
        description: 'Try to learn for at least 15 minutes every day',
        priority: 'high'
      });
    }
    
    if (habits.consistencyScore < 60) {
      recommendations.push({
        title: 'Establish a Routine',
        description: `Learn at ${habits.preferredLearningTime} on ${habits.mostActiveDay}s`,
        priority: 'medium'
      });
    }
    
    if (metrics.averageSessionDuration < 900) {
      recommendations.push({
        title: 'Extend Session Duration',
        description: 'Aim for at least 15-20 minute sessions for better retention',
        priority: 'medium'
      });
    }
    
    if (metrics.coursesInProgress > 3) {
      recommendations.push({
        title: 'Focus Your Learning',
        description: 'Consider focusing on 1-2 courses at a time for better completion rates',
        priority: 'low'
      });
    }
    
    return recommendations;
  }
}
