/**
 * Mobile Analytics and Progress Tracking Tests
 * Tests for Task 26.3: Mobile analytics, cross-device sync, engagement tracking, and habit tracking
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { MobileAnalyticsService } from '../services/MobileAnalyticsService';

// Mock database and Redis
jest.mock('pg');
jest.mock('ioredis');

describe('MobileAnalyticsService - Task 26.3', () => {
  let analyticsService: MobileAnalyticsService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    } as any;

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    } as any;

    analyticsService = new MobileAnalyticsService(mockDb, mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Sub-task 1: Mobile-Specific Learning Analytics ====================

  describe('Mobile-Specific Learning Analytics', () => {
    it('should track mobile learning sessions with device information', async () => {
      const userId = 'user-123';
      const deviceId = 'device-456';

      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      const session = await analyticsService.startSession(userId, deviceId);

      expect(session).toHaveProperty('id');
      expect(session.userId).toBe(userId);
      expect(session.deviceId).toBe(deviceId);
      expect(session.startTime).toBeInstanceOf(Date);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mobile_learning_sessions'),
        expect.arrayContaining([expect.any(String), userId, deviceId, expect.any(Date)])
      );
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should get mobile device analytics', async () => {
      const userId = 'user-123';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              device_id: 'device-1',
              device_name: 'iPhone 13',
              device_type: 'ios',
              os_version: '16.0',
              app_version: '1.2.0',
              last_active_at: new Date(),
              registered_at: new Date(),
              session_count: '10',
              total_duration: '3600'
            }
          ]
        } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              device_id: 'device-1',
              sync_count: '25',
              last_sync: new Date(),
              courses_synced: '3'
            }
          ]
        } as any);

      const analytics = await analyticsService.getMobileDeviceAnalytics(userId);

      expect(analytics).toHaveProperty('devices');
      expect(analytics).toHaveProperty('totalDevices');
      expect(analytics.devices).toHaveLength(1);
      expect(analytics.devices[0]).toMatchObject({
        deviceId: 'device-1',
        deviceName: 'iPhone 13',
        deviceType: 'ios',
        sessionCount: 10,
        totalDuration: 3600
      });
      expect(analytics.devices[0].syncStats).toMatchObject({
        syncCount: 25,
        coursesSynced: 3
      });
    });

    it('should track feature usage analytics', async () => {
      const userId = 'user-123';
      const featureName = 'offline_download';

      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await analyticsService.trackFeatureUsage(userId, featureName);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mobile_feature_usage'),
        [userId, featureName]
      );
    });

    it('should get feature usage analytics', async () => {
      const userId = 'user-123';

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            feature_name: 'offline_download',
            usage_count: '50',
            last_used_at: new Date(),
            first_used_at: new Date()
          },
          {
            feature_name: 'voice_notes',
            usage_count: '30',
            last_used_at: new Date(),
            first_used_at: new Date()
          }
        ]
      } as any);

      const analytics = await analyticsService.getFeatureUsageAnalytics(userId);

      expect(analytics).toHaveProperty('features');
      expect(analytics).toHaveProperty('totalUsage', 80);
      expect(analytics).toHaveProperty('mostUsedFeature', 'offline_download');
      expect(analytics.features[0]).toMatchObject({
        name: 'offline_download',
        usageCount: 50,
        usagePercentage: 62 // 50/80 * 100
      });
    });

    it('should track performance metrics', async () => {
      const userId = 'user-123';
      const deviceId = 'device-456';
      const metricType = 'api_latency';
      const metricValue = 150.5;
      const metadata = { endpoint: '/api/courses' };

      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await analyticsService.trackPerformanceMetric(
        userId,
        deviceId,
        metricType,
        metricValue,
        metadata
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mobile_performance_metrics'),
        [userId, deviceId, metricType, metricValue, JSON.stringify(metadata)]
      );
    });

    it('should get performance metrics', async () => {
      const userId = 'user-123';

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            metric_type: 'api_latency',
            avg_value: '150.5',
            min_value: '100.0',
            max_value: '250.0',
            sample_count: '100'
          },
          {
            metric_type: 'video_load_time',
            avg_value: '2.5',
            min_value: '1.0',
            max_value: '5.0',
            sample_count: '50'
          }
        ]
      } as any);

      const metrics = await analyticsService.getPerformanceMetrics(userId);

      expect(metrics).toHaveProperty('metrics');
      expect(metrics.metrics).toHaveLength(2);
      expect(metrics.metrics[0]).toMatchObject({
        type: 'api_latency',
        average: 150.5,
        min: 100.0,
        max: 250.0,
        sampleCount: 100
      });
    });
  });

  // ==================== Sub-task 2: Cross-Device Progress Synchronization ====================

  describe('Cross-Device Progress Synchronization', () => {
    it('should synchronize progress across devices', async () => {
      const progressData = {
        userId: 'user-123',
        courseId: 'course-456',
        lessonId: 'lesson-789',
        videoId: 'video-012',
        progress: 75,
        lastPosition: 1800,
        deviceId: 'device-1',
        syncedAt: new Date()
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any) // Check for conflicts
        .mockResolvedValueOnce({ rows: [] } as any); // Upsert progress

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      await analyticsService.syncProgress(progressData);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mobile_progress_sync'),
        expect.arrayContaining([
          progressData.userId,
          progressData.courseId,
          progressData.lessonId,
          progressData.videoId,
          progressData.progress,
          progressData.lastPosition,
          undefined,
          progressData.deviceId,
          progressData.syncedAt
        ])
      );
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should detect and handle progress conflicts', async () => {
      const progressData = {
        userId: 'user-123',
        courseId: 'course-456',
        progress: 50,
        deviceId: 'device-2',
        syncedAt: new Date('2024-01-01T10:00:00Z')
      };

      // Mock existing progress with newer timestamp
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-123',
            course_id: 'course-456',
            progress: 75,
            device_id: 'device-1',
            synced_at: new Date('2024-01-01T12:00:00Z')
          }
        ]
      } as any);

      await expect(analyticsService.syncProgress(progressData)).rejects.toThrow(
        'CONFLICT: Newer progress exists on server'
      );
    });

    it('should get progress for a specific course', async () => {
      const userId = 'user-123';
      const courseId = 'course-456';

      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: userId,
            course_id: courseId,
            lesson_id: 'lesson-789',
            video_id: 'video-012',
            progress: 75,
            last_position: 1800,
            device_id: 'device-1',
            synced_at: new Date()
          }
        ]
      } as any);
      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      const progress = await analyticsService.getProgress(userId, courseId);

      expect(progress).not.toBeNull();
      expect(progress?.progress).toBe(75);
      expect(progress?.lastPosition).toBe(1800);
    });

    it('should optimize sync strategy', async () => {
      const userId = 'user-123';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              device_id: 'device-1',
              sync_count: '3',
              avg_sync_interval: '4000', // Long interval
              courses_synced: '2'
            }
          ]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ conflict_count: '2' }]
        } as any);

      const optimization = await analyticsService.optimizeSyncStrategy(userId);

      expect(optimization).toHaveProperty('syncPatterns');
      expect(optimization).toHaveProperty('pendingConflicts', 2);
      expect(optimization).toHaveProperty('recommendations');
      expect(optimization).toHaveProperty('optimizationScore');
      expect(optimization.recommendations.length).toBeGreaterThan(0);
      expect(optimization.recommendations[0]).toMatchObject({
        deviceId: 'device-1',
        recommendation: 'increase_sync_frequency'
      });
    });

    it('should resolve progress conflicts', async () => {
      const conflictId = 'conflict-123';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: conflictId,
              user_id: 'user-123',
              course_id: 'course-456',
              lesson_id: 'lesson-789',
              video_id: 'video-012',
              device1_id: 'device-1',
              device1_progress: 50,
              device1_synced_at: new Date(),
              device2_id: 'device-2',
              device2_progress: 75,
              device2_synced_at: new Date()
            }
          ]
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // Check for conflicts in syncProgress
        .mockResolvedValueOnce({ rows: [] } as any) // Upsert in syncProgress
        .mockResolvedValueOnce({ rows: [] } as any); // Update conflict status

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      await analyticsService.resolveProgressConflict(conflictId, 'device2');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE mobile_progress_conflicts'),
        ['auto', conflictId]
      );
    });
  });

  // ==================== Sub-task 3: Mobile Engagement Tracking ====================

  describe('Mobile Engagement Tracking and Optimization', () => {
    it('should track engagement events', async () => {
      const userId = 'user-123';
      const engagementType = 'video_watch';
      const metadata = { videoId: 'video-456', duration: 300 };

      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockRedis.del.mockResolvedValueOnce(1);

      await analyticsService.trackEngagement(userId, engagementType, metadata);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mobile_engagement_events'),
        [userId, engagementType, JSON.stringify(metadata)]
      );
    });

    it('should get engagement metrics', async () => {
      const userId = 'user-123';

      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ daily_streak: '7', weekly_streak: '1' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ total_time: '7200', avg_duration: '1800' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ in_progress: '3', completed: '2' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ last_active: new Date() }]
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      const metrics = await analyticsService.getEngagementMetrics(userId);

      expect(metrics).toMatchObject({
        userId,
        dailyActiveStreak: 7,
        weeklyActiveStreak: 1,
        totalLearningTime: 7200,
        averageSessionDuration: 1800,
        coursesInProgress: 3,
        coursesCompleted: 2
      });
      expect(metrics.engagementScore).toBeGreaterThan(0);
      expect(metrics.engagementScore).toBeLessThanOrEqual(100);
    });

    it('should calculate engagement score correctly', async () => {
      const userId = 'user-123';

      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ daily_streak: '15', weekly_streak: '2' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ total_time: '36000', avg_duration: '1800' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ in_progress: '5', completed: '10' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ last_active: new Date() }]
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      const metrics = await analyticsService.getEngagementMetrics(userId);

      // High engagement should result in high score
      expect(metrics.engagementScore).toBeGreaterThan(70);
    });

    it('should get engagement insights', async () => {
      const userId = 'user-123';

      // Mock engagement metrics
      mockRedis.get
        .mockResolvedValueOnce(null) // For getEngagementMetrics
        .mockResolvedValueOnce(null); // For analyzeLearningHabits

      mockDb.query
        // For getEngagementMetrics
        .mockResolvedValueOnce({
          rows: [{ daily_streak: '0', weekly_streak: '0' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ total_time: '1800', avg_duration: '900' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ in_progress: '1', completed: '0' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ last_active: new Date() }]
        } as any)
        // For analyzeLearningHabits
        .mockResolvedValueOnce({
          rows: [{ hour: '18', session_count: '5' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ day_name: 'Monday', session_count: '10' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ active_days: '5', avg_sessions: '0.5', stddev_sessions: '0.2' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ avg_duration: '900' }]
        } as any)
        .mockResolvedValueOnce({
          rows: []
        } as any);

      mockRedis.setex.mockResolvedValue('OK' as any);

      const insights = await analyticsService.getEngagementInsights(userId);

      expect(insights).toHaveProperty('insights');
      expect(insights).toHaveProperty('overallHealth');
      expect(insights).toHaveProperty('recommendations');
      expect(insights.insights.length).toBeGreaterThan(0);
      
      // Should have streak broken insight
      const streakInsight = insights.insights.find((i: any) => i.type === 'streak_broken');
      expect(streakInsight).toBeDefined();
      expect(streakInsight.severity).toBe('high');
    });
  });

  // ==================== Sub-task 4: Learning Habit Tracking and Reminders ====================

  describe('Learning Habit Tracking and Reminders', () => {
    it('should analyze learning habits', async () => {
      const userId = 'user-123';

      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ hour: '18', session_count: '15' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ day_name: 'Monday   ', session_count: '20' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ active_days: '25', avg_sessions: '1.5', stddev_sessions: '0.3' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ avg_duration: '1800' }]
        } as any)
        .mockResolvedValueOnce({
          rows: []
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      const habits = await analyticsService.analyzeLearningHabits(userId);

      expect(habits).toMatchObject({
        userId,
        preferredLearningTime: '18:00',
        averageSessionsPerDay: 1.5,
        preferredDuration: 1800,
        mostActiveDay: 'Monday'
      });
      expect(habits.consistencyScore).toBeGreaterThan(0);
      expect(habits.consistencyScore).toBeLessThanOrEqual(100);
    });

    it('should set reminder preferences', async () => {
      const userId = 'user-123';
      const preferences = {
        enabled: true,
        frequency: 'daily',
        time: '18:00',
        days: ['Monday', 'Wednesday', 'Friday']
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockRedis.del.mockResolvedValueOnce(1);

      await analyticsService.setReminderPreferences(userId, preferences);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mobile_learning_reminders'),
        [userId, preferences.enabled, preferences.frequency, preferences.time, preferences.days]
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`mobile:habits:${userId}`);
    });

    it('should get upcoming reminders', async () => {
      const userId = 'user-123';

      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ hour: '18', session_count: '10' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ day_name: 'Monday   ', session_count: '15' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ active_days: '20', avg_sessions: '1.2', stddev_sessions: '0.2' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ avg_duration: '1800' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              enabled: true,
              frequency: 'daily',
              reminder_time: '18:00:00',
              reminder_days: ['Monday', 'Wednesday', 'Friday']
            }
          ]
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      const reminders = await analyticsService.getUpcomingReminders(userId);

      expect(Array.isArray(reminders)).toBe(true);
      expect(reminders.length).toBeGreaterThan(0);
      expect(reminders[0]).toMatchObject({
        userId,
        type: 'learning_reminder'
      });
      expect(reminders[0]).toHaveProperty('scheduledFor');
      expect(reminders[0]).toHaveProperty('message');
    });

    it('should not return reminders when disabled', async () => {
      const userId = 'user-123';

      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ hour: '18', session_count: '10' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ day_name: 'Monday   ', session_count: '15' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ active_days: '20', avg_sessions: '1.2', stddev_sessions: '0.2' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ avg_duration: '1800' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              enabled: false,
              frequency: 'daily',
              reminder_time: '18:00:00',
              reminder_days: ['Monday', 'Wednesday', 'Friday']
            }
          ]
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      const reminders = await analyticsService.getUpcomingReminders(userId);

      expect(reminders).toEqual([]);
    });
  });

  // ==================== Integration Tests ====================

  describe('Mobile Analytics Integration', () => {
    it('should generate comprehensive mobile analytics report', async () => {
      const userId = 'user-123';
      const period = '7d';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              date: new Date(),
              session_count: '5',
              total_duration: '3600',
              avg_duration: '720',
              total_interactions: '50'
            }
          ]
        } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              course_id: 'course-1',
              current_progress: '75',
              sync_count: '10',
              last_synced: new Date()
            }
          ]
        } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              engagement_type: 'video_watch',
              event_count: '20',
              date: new Date()
            }
          ]
        } as any);

      // Mock for getEngagementMetrics
      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ daily_streak: '7', weekly_streak: '1' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ total_time: '7200', avg_duration: '1800' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ in_progress: '3', completed: '2' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ last_active: new Date() }]
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      // Mock for analyzeLearningHabits
      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ hour: '18', session_count: '10' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ day_name: 'Monday   ', session_count: '15' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ active_days: '20', avg_sessions: '1.2', stddev_sessions: '0.2' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ avg_duration: '1800' }]
        } as any)
        .mockResolvedValueOnce({
          rows: []
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      const report = await analyticsService.getMobileAnalyticsReport(userId, period);

      expect(report).toHaveProperty('period', period);
      expect(report).toHaveProperty('userId', userId);
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('dailySessions');
      expect(report).toHaveProperty('courseProgress');
      expect(report).toHaveProperty('engagementEvents');
      expect(report).toHaveProperty('streaks');
      expect(report).toHaveProperty('learningHabits');
      expect(report.summary).toHaveProperty('totalSessions');
      expect(report.summary).toHaveProperty('engagementScore');
      expect(report.summary).toHaveProperty('consistencyScore');
    });

    it('should provide dashboard summary with all key metrics', async () => {
      const userId = 'user-123';

      // Mock for getEngagementMetrics
      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ daily_streak: '10', weekly_streak: '2' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ total_time: '14400', avg_duration: '1800' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ in_progress: '4', completed: '5' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ last_active: new Date() }]
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      // Mock for analyzeLearningHabits
      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ hour: '19', session_count: '12' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ day_name: 'Tuesday  ', session_count: '18' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ active_days: '28', avg_sessions: '1.8', stddev_sessions: '0.25' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [{ avg_duration: '2100' }]
        } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              enabled: true,
              frequency: 'daily',
              reminder_time: '19:00:00',
              reminder_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            }
          ]
        } as any);

      mockRedis.setex.mockResolvedValueOnce('OK' as any);

      // Mock for getAllProgress
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { user_id: userId, course_id: 'course-1', progress: 50 },
          { user_id: userId, course_id: 'course-2', progress: 100 },
          { user_id: userId, course_id: 'course-3', progress: 75 }
        ]
      } as any);

      const engagement = await analyticsService.getEngagementMetrics(userId);
      const habits = await analyticsService.analyzeLearningHabits(userId);
      const progress = await analyticsService.getAllProgress(userId);

      expect(engagement).toBeDefined();
      expect(habits).toBeDefined();
      expect(progress).toBeDefined();
      expect(progress.length).toBe(3);
    });
  });
});
