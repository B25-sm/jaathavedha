import { SessionManagementService } from '../services/SessionManagementService';
import { SessionAnalyticsDashboardService } from '../services/SessionAnalyticsDashboardService';
import { CalendarIntegrationService } from '../services/CalendarIntegrationService';
import { NotificationSchedulerService } from '../services/NotificationSchedulerService';
import { SessionStatus, NotificationType, NotificationChannel, CalendarProvider } from '../types';

// Mock the database pool
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  return {
    Pool: jest.fn(() => ({
      query: mockQuery
    }))
  };
});

describe('SessionManagementService', () => {
  let service: SessionManagementService;
  let mockPool: any;

  beforeEach(() => {
    service = new SessionManagementService();
    mockPool = (service as any).pool;
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with valid data', async () => {
      const sessionData = {
        courseId: 'course-123',
        instructorId: 'instructor-456',
        title: 'Introduction to AI',
        description: 'Learn the basics of AI',
        scheduledStart: new Date('2024-12-01T10:00:00Z'),
        scheduledEnd: new Date('2024-12-01T11:00:00Z'),
        maxParticipants: 100
      };

      const mockSession = {
        id: 'session-789',
        course_id: sessionData.courseId,
        instructor_id: sessionData.instructorId,
        title: sessionData.title,
        description: sessionData.description,
        start_time: sessionData.scheduledStart,
        end_time: sessionData.scheduledEnd,
        max_attendees: sessionData.maxParticipants,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockSession] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] }) // Schedule notifications
        .mockResolvedValueOnce({ rows: [] }); // Initialize analytics

      const result = await service.createSession(sessionData);

      expect(result.id).toBe('session-789');
      expect(result.title).toBe(sessionData.title);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('should set default values for optional fields', async () => {
      const sessionData = {
        courseId: 'course-123',
        instructorId: 'instructor-456',
        title: 'Test Session',
        scheduledStart: new Date('2024-12-01T10:00:00Z'),
        scheduledEnd: new Date('2024-12-01T11:00:00Z')
      };

      const mockSession = {
        id: 'session-789',
        course_id: sessionData.courseId,
        instructor_id: sessionData.instructorId,
        title: sessionData.title,
        start_time: sessionData.scheduledStart,
        end_time: sessionData.scheduledEnd,
        timezone: 'Asia/Kolkata',
        max_attendees: 1000,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockSession] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.createSession(sessionData);

      expect(result.maxParticipants).toBe(1000);
    });
  });

  describe('updateSession', () => {
    it('should update session with valid data', async () => {
      const sessionId = 'session-789';
      const updates = {
        title: 'Updated Title',
        description: 'Updated Description'
      };

      const mockUpdatedSession = {
        id: sessionId,
        title: updates.title,
        description: updates.description,
        updated_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockUpdatedSession] });

      const result = await service.updateSession(sessionId, updates);

      expect(result.title).toBe(updates.title);
      expect(result.description).toBe(updates.description);
    });

    it('should throw error if session not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateSession('invalid-id', { title: 'Test' }))
        .rejects.toThrow('Session not found');
    });
  });

  describe('recordAttendance', () => {
    it('should record attendance with all details', async () => {
      const attendanceData = {
        sessionId: 'session-789',
        userId: 'user-123',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        deviceType: 'desktop',
        browser: 'Chrome',
        ipAddress: '192.168.1.1',
        locationCountry: 'India',
        locationCity: 'Mumbai'
      };

      const mockAttendance = {
        id: 'attendance-456',
        session_id: attendanceData.sessionId,
        user_id: attendanceData.userId,
        user_name: attendanceData.userName,
        user_email: attendanceData.userEmail,
        joined_at: new Date(),
        device_type: attendanceData.deviceType,
        browser: attendanceData.browser,
        ip_address: attendanceData.ipAddress,
        location_country: attendanceData.locationCountry,
        location_city: attendanceData.locationCity,
        duration_seconds: 0,
        engagement_score: 0,
        chat_messages_sent: 0,
        qa_questions_asked: 0,
        polls_participated: 0,
        hand_raises: 0,
        is_present: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockAttendance] });

      const result = await service.recordAttendance(attendanceData);

      expect(result.userId).toBe(attendanceData.userId);
      expect(result.deviceType).toBe(attendanceData.deviceType);
      expect(result.isPresent).toBe(true);
    });
  });

  describe('updateEngagementMetrics', () => {
    it('should update engagement metrics correctly', async () => {
      const attendanceId = 'attendance-456';
      const metrics = {
        chatMessagesSent: 5,
        qaQuestionsAsked: 2,
        pollsParticipated: 3,
        engagementScore: 85.5
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.updateEngagementMetrics(attendanceId, metrics);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE session_attendance'),
        expect.arrayContaining([5, 2, 3, 85.5, attendanceId])
      );
    });

    it('should handle partial metric updates', async () => {
      const attendanceId = 'attendance-456';
      const metrics = {
        chatMessagesSent: 1
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.updateEngagementMetrics(attendanceId, metrics);

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('scheduleSessionNotifications', () => {
    it('should schedule all reminder notifications', async () => {
      const sessionId = 'session-789';
      const instructorId = 'instructor-456';

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);

      const mockSession = {
        id: sessionId,
        title: 'Test Session',
        start_time: futureDate,
        end_time: new Date(futureDate.getTime() + 3600000),
        is_active: true
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockSession] }) // Get session
        .mockResolvedValue({ rows: [{ id: 'notification-123' }] }); // Create notifications

      await service.scheduleSessionNotifications(sessionId, instructorId);

      // Should create 3 notifications (24h, 1h, 15m)
      expect(mockPool.query).toHaveBeenCalledTimes(4); // 1 get + 3 create
    });
  });

  describe('calculateAttendanceSummary', () => {
    it('should calculate attendance summary correctly', async () => {
      const sessionId = 'session-789';

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing summary
        .mockResolvedValueOnce({ rows: [{ id: 'summary-123', session_id: sessionId }] }) // Create summary
        .mockResolvedValueOnce({ // Calculate metrics
          rows: [{
            total_attended: '50',
            peak_concurrent: '45',
            avg_duration: '3600',
            total_watch_time: '180000',
            on_time: '40',
            late: '10',
            early_leavers: '5',
            desktop_count: '30',
            mobile_count: '15',
            tablet_count: '5'
          }]
        })
        .mockResolvedValueOnce({ // Geographic distribution
          rows: [
            { country: 'India', count: '30' },
            { country: 'USA', count: '15' },
            { country: 'UK', count: '5' }
          ]
        })
        .mockResolvedValueOnce({ // Update summary
          rows: [{
            id: 'summary-123',
            session_id: sessionId,
            total_attended: 50,
            peak_concurrent_viewers: 45,
            average_duration_seconds: 3600,
            total_watch_time_seconds: 180000,
            on_time_arrivals: 40,
            late_arrivals: 10,
            early_leavers: 5,
            device_breakdown: JSON.stringify({ desktop: 30, mobile: 15, tablet: 5 }),
            geographic_distribution: JSON.stringify([]),
            created_at: new Date(),
            updated_at: new Date()
          }]
        });

      const result = await service.calculateAttendanceSummary(sessionId);

      expect(result.totalAttended).toBe(50);
      expect(result.peakConcurrentViewers).toBe(45);
      expect(result.onTimeArrivals).toBe(40);
      expect(result.deviceBreakdown.desktop).toBe(30);
    });
  });
});

describe('SessionAnalyticsDashboardService', () => {
  let service: SessionAnalyticsDashboardService;
  let mockPool: any;

  beforeEach(() => {
    service = new SessionAnalyticsDashboardService();
    mockPool = (service as any).pool;
    jest.clearAllMocks();
  });

  describe('updateSessionAnalytics', () => {
    it('should update analytics with provided metrics', async () => {
      const sessionId = 'session-789';
      const updates = {
        totalParticipants: 50,
        peakConcurrentViewers: 45,
        chatMessages: 120,
        qaQuestions: 15,
        engagementRate: 78.5
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.updateSessionAnalytics(sessionId, updates);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE session_analytics'),
        expect.arrayContaining([50, 45, 120, 15, 78.5, sessionId])
      );
    });
  });

  describe('submitFeedback', () => {
    it('should submit feedback with all ratings', async () => {
      const feedbackData = {
        sessionId: 'session-789',
        userId: 'user-123',
        overallRating: 5,
        contentQuality: 5,
        instructorRating: 5,
        technicalQuality: 4,
        engagementRating: 5,
        wouldRecommend: true,
        feedbackText: 'Great session!'
      };

      const mockFeedback = {
        id: 'feedback-456',
        ...feedbackData,
        session_id: feedbackData.sessionId,
        user_id: feedbackData.userId,
        overall_rating: feedbackData.overallRating,
        content_quality: feedbackData.contentQuality,
        instructor_rating: feedbackData.instructorRating,
        technical_quality: feedbackData.technicalQuality,
        engagement_rating: feedbackData.engagementRating,
        would_recommend: feedbackData.wouldRecommend,
        feedback_text: feedbackData.feedbackText,
        created_at: new Date()
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockFeedback] }) // Insert feedback
        .mockResolvedValueOnce({ rows: [] }); // Update ratings

      const result = await service.submitFeedback(feedbackData);

      expect(result.overallRating).toBe(5);
      expect(result.wouldRecommend).toBe(true);
    });

    it('should validate rating ranges', async () => {
      const feedbackData = {
        sessionId: 'session-789',
        userId: 'user-123',
        overallRating: 5,
        contentQuality: 5,
        instructorRating: 5,
        technicalQuality: 5,
        engagementRating: 5,
        wouldRecommend: true
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'feedback-456', ...feedbackData }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.submitFeedback(feedbackData);

      expect(result.overallRating).toBeGreaterThanOrEqual(1);
      expect(result.overallRating).toBeLessThanOrEqual(5);
    });
  });

  describe('getInstructorDashboard', () => {
    it('should return comprehensive instructor dashboard', async () => {
      const instructorId = 'instructor-456';
      const now = new Date();

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Upcoming sessions
        .mockResolvedValueOnce({ rows: [] }) // Live sessions
        .mockResolvedValueOnce({ rows: [] }) // Recent sessions
        .mockResolvedValueOnce({ // Overall stats
          rows: [{
            total_sessions: '10',
            total_participants: '500',
            avg_attendance_rate: '85.5',
            avg_rating: '4.5',
            total_watch_time: '36000'
          }]
        });

      const result = await service.getInstructorDashboard(instructorId);

      expect(result.overallStats.totalSessions).toBe(10);
      expect(result.overallStats.totalParticipants).toBe(500);
      expect(result.overallStats.averageAttendanceRate).toBe(85.5);
      expect(result.overallStats.averageRating).toBe(4.5);
    });
  });
});

describe('CalendarIntegrationService', () => {
  let service: CalendarIntegrationService;

  beforeEach(() => {
    service = new CalendarIntegrationService();
    jest.clearAllMocks();
  });

  describe('generateICalFile', () => {
    it('should generate valid iCal format', async () => {
      const sessionId = 'session-789';
      const mockSession = {
        id: sessionId,
        title: 'Test Session',
        description: 'Test Description',
        scheduledStart: new Date('2024-12-01T10:00:00Z'),
        scheduledEnd: new Date('2024-12-01T11:00:00Z')
      };

      // Mock the session retrieval
      const sessionManagement = (service as any).sessionManagement;
      sessionManagement.getSession = jest.fn().mockResolvedValue(mockSession);

      const ical = await service.generateICalFile(sessionId);

      expect(ical).toContain('BEGIN:VCALENDAR');
      expect(ical).toContain('BEGIN:VEVENT');
      expect(ical).toContain('SUMMARY:Test Session');
      expect(ical).toContain('BEGIN:VALARM');
      expect(ical).toContain('END:VCALENDAR');
    });
  });
});

describe('NotificationSchedulerService', () => {
  let service: NotificationSchedulerService;

  beforeEach(() => {
    service = new NotificationSchedulerService();
    jest.clearAllMocks();
  });

  describe('start and stop', () => {
    it('should start the scheduler', () => {
      service.start(1);
      expect((service as any).isRunning).toBe(true);
    });

    it('should stop the scheduler', () => {
      service.start(1);
      service.stop();
      expect((service as any).isRunning).toBe(false);
    });

    it('should not start if already running', () => {
      service.start(1);
      const consoleSpy = jest.spyOn(console, 'log');
      service.start(1);
      expect(consoleSpy).toHaveBeenCalledWith('Notification scheduler is already running');
      service.stop();
    });
  });
});
