/**
 * Instructor Portal Service
 * Core service for instructor content management and analytics
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import {
  InstructorDashboard,
  ContentUploadBatch,
  BatchStatus,
  BatchFile,
  FileUploadStatus,
  FileProcessingStatus,
  StudentAnalytics,
  ContentSchedule,
  InstructorNotification,
  NotificationType,
  NotificationPriority,
  BulkOperation,
  BulkOperationType,
  BulkOperationStatus,
  InstructorSettings,
  ContentRecommendation,
  RecommendationType
} from '../types';

export class InstructorPortalService {
  private db = getDatabase();
  private cache = getCache();

  /**
   * Get instructor dashboard data
   */
  async getInstructorDashboard(instructorId: string, dateRange: string = '30d'): Promise<InstructorDashboard> {
    try {
      const cacheKey = `instructor_dashboard:${instructorId}:${dateRange}`;
      const cached = await this.cache.get<InstructorDashboard>(cacheKey);
      if (cached) return cached;

      const dateFilter = this.getDateFilter(dateRange);

      const [
        courseStats,
        studentStats,
        revenueStats,
        videoStats,
        recentEnrollments,
        coursePerformance,
        upcomingSessions
      ] = await Promise.all([
        this.getCourseStats(instructorId),
        this.getStudentStats(instructorId),
        this.getRevenueStats(instructorId, dateFilter),
        this.getVideoStats(instructorId),
        this.getRecentEnrollments(instructorId, 10),
        this.getCoursePerformance(instructorId),
        this.getUpcomingSessions(instructorId)
      ]);

      const dashboard: InstructorDashboard = {
        instructor_id: instructorId,
        total_courses: courseStats.total_courses,
        total_students: studentStats.total_students,
        total_revenue: revenueStats.total_revenue,
        total_videos: videoStats.total_videos,
        total_watch_time: videoStats.total_watch_time,
        average_rating: courseStats.average_rating,
        recent_enrollments: recentEnrollments,
        course_performance: coursePerformance,
        revenue_analytics: revenueStats,
        engagement_metrics: await this.getEngagementMetrics(instructorId, dateFilter),
        upcoming_sessions: upcomingSessions
      };

      // Cache for 10 minutes
      await this.cache.set(cacheKey, dashboard, { ttl: 600 });

      return dashboard;
    } catch (error) {
      logger.error('Failed to get instructor dashboard', { error, instructorId });
      throw new AppError('Failed to retrieve dashboard data', 500);
    }
  }

  /**
   * Create bulk upload batch
   */
  async createUploadBatch(
    instructorId: string,
    courseId: string,
    batchName: string,
    files: { filename: string; size: number; type: string }[]
  ): Promise<ContentUploadBatch> {
    try {
      const batchId = uuidv4();

      const batch = await this.db.insert<ContentUploadBatch>('content_upload_batches', {
        id: batchId,
        instructor_id: instructorId,
        course_id: courseId,
        batch_name: batchName,
        total_files: files.length,
        processed_files: 0,
        failed_files: 0,
        status: BatchStatus.UPLOADING,
        upload_progress: 0,
        processing_progress: 0,
        created_at: new Date(),
        files: []
      });

      // Create batch file records
      const batchFiles: BatchFile[] = [];
      for (const file of files) {
        const batchFile = await this.db.insert<BatchFile>('batch_files', {
          id: uuidv4(),
          batch_id: batchId,
          original_filename: file.filename,
          file_size: file.size,
          content_type: file.type,
          upload_status: FileUploadStatus.PENDING,
          processing_status: FileProcessingStatus.PENDING,
          upload_progress: 0,
          processing_progress: 0
        });
        batchFiles.push(batchFile);
      }

      batch.files = batchFiles;

      logger.info('Upload batch created', { batchId, instructorId, totalFiles: files.length });
      return batch;
    } catch (error) {
      logger.error('Failed to create upload batch', { error, instructorId, courseId });
      throw new AppError('Failed to create upload batch', 500);
    }
  }

  /**
   * Update batch file upload progress
   */
  async updateFileUploadProgress(
    batchId: string,
    fileId: string,
    progress: number,
    status?: FileUploadStatus
  ): Promise<void> {
    try {
      const updateData: any = { upload_progress: progress };
      if (status) {
        updateData.upload_status = status;
      }

      await this.db.update('batch_files', updateData, { id: fileId });

      // Update batch progress
      await this.updateBatchProgress(batchId);

      logger.debug('File upload progress updated', { batchId, fileId, progress, status });
    } catch (error) {
      logger.error('Failed to update file upload progress', { error, batchId, fileId });
    }
  }

  /**
   * Get student analytics for instructor
   */
  async getStudentAnalytics(
    instructorId: string,
    courseId?: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<{ students: StudentAnalytics[]; total: number; pagination: any }> {
    try {
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;

      let courseFilter = '';
      const params: any[] = [instructorId];
      let paramIndex = 2;

      if (courseId) {
        courseFilter = 'AND c.id = $2';
        params.push(courseId);
        paramIndex = 3;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT e.user_id) as count
        FROM enrollments e
        JOIN programs c ON e.program_id = c.id
        WHERE c.instructor_id = $1 ${courseFilter}
      `;
      const countResult = await this.db.queryOne<{ count: string }>(countQuery, params.slice(0, courseId ? 2 : 1));
      const total = parseInt(countResult?.count || '0', 10);

      // Get student data
      const studentsQuery = `
        SELECT DISTINCT
          u.id as student_id,
          u.first_name || ' ' || u.last_name as student_name,
          u.email as student_email,
          MIN(e.enrolled_at) as enrollment_date,
          COUNT(DISTINCT e.program_id) as total_courses,
          COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.program_id END) as completed_courses,
          COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.program_id END) as in_progress_courses,
          COALESCE(AVG(e.progress_percentage), 0) as average_progress,
          MAX(va.created_at) as last_activity
        FROM users u
        JOIN enrollments e ON u.id = e.user_id
        JOIN programs c ON e.program_id = c.id
        LEFT JOIN video_analytics va ON u.id = va.user_id
        WHERE c.instructor_id = $1 ${courseFilter}
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY enrollment_date DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const students = await this.db.queryMany<any>(studentsQuery, [
        ...params,
        limit,
        offset
      ]);

      const studentAnalytics: StudentAnalytics[] = [];

      for (const student of students) {
        const courseDetails = await this.getStudentCourseDetails(student.student_id, instructorId, courseId);
        const engagementScore = await this.calculateEngagementScore(student.student_id, instructorId);
        const totalWatchTime = await this.getStudentWatchTime(student.student_id, instructorId);

        studentAnalytics.push({
          student_id: student.student_id,
          student_name: student.student_name,
          student_email: student.student_email,
          enrollment_date: student.enrollment_date,
          total_courses: parseInt(student.total_courses, 10),
          completed_courses: parseInt(student.completed_courses, 10),
          in_progress_courses: parseInt(student.in_progress_courses, 10),
          total_watch_time: totalWatchTime,
          average_progress: parseFloat(student.average_progress),
          engagement_score: engagementScore,
          last_activity: student.last_activity,
          course_details: courseDetails
        });
      }

      return {
        students: studentAnalytics,
        total,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get student analytics', { error, instructorId, courseId });
      throw new AppError('Failed to retrieve student analytics', 500);
    }
  }

  /**
   * Schedule content release
   */
  async scheduleContentRelease(
    instructorId: string,
    courseId: string,
    contentId: string,
    contentType: string,
    scheduledRelease: Date,
    releaseConditions?: any[]
  ): Promise<ContentSchedule> {
    try {
      const schedule = await this.db.insert<ContentSchedule>('content_schedules', {
        id: uuidv4(),
        instructor_id: instructorId,
        course_id: courseId,
        content_id: contentId,
        content_type: contentType as any,
        title: `Scheduled ${contentType}`,
        scheduled_release: scheduledRelease,
        release_conditions: releaseConditions || [],
        status: 'scheduled' as any,
        created_at: new Date()
      });

      logger.info('Content release scheduled', { scheduleId: schedule.id, contentId, scheduledRelease });
      return schedule;
    } catch (error) {
      logger.error('Failed to schedule content release', { error, instructorId, contentId });
      throw new AppError('Failed to schedule content release', 500);
    }
  }

  /**
   * Send notification to instructor
   */
  async sendNotification(
    instructorId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ): Promise<InstructorNotification> {
    try {
      const notification = await this.db.insert<InstructorNotification>('instructor_notifications', {
        id: uuidv4(),
        instructor_id: instructorId,
        type,
        title,
        message,
        data,
        is_read: false,
        priority,
        created_at: new Date()
      });

      // Send real-time notification via WebSocket if connected
      await this.sendRealTimeNotification(instructorId, notification);

      logger.info('Notification sent to instructor', { instructorId, type, title });
      return notification;
    } catch (error) {
      logger.error('Failed to send notification', { error, instructorId, type });
      throw new AppError('Failed to send notification', 500);
    }
  }

  /**
   * Create bulk operation
   */
  async createBulkOperation(
    instructorId: string,
    operationType: BulkOperationType,
    targetType: 'students' | 'content' | 'courses',
    targetIds: string[],
    parameters: any
  ): Promise<BulkOperation> {
    try {
      const operation = await this.db.insert<BulkOperation>('bulk_operations', {
        id: uuidv4(),
        instructor_id: instructorId,
        operation_type: operationType,
        target_type: targetType,
        target_ids: targetIds,
        parameters,
        status: BulkOperationStatus.PENDING,
        progress: 0,
        results: [],
        created_at: new Date()
      });

      // Start processing the bulk operation asynchronously
      this.processBulkOperation(operation.id).catch(error => {
        logger.error('Bulk operation processing failed', { error, operationId: operation.id });
      });

      logger.info('Bulk operation created', { operationId: operation.id, type: operationType });
      return operation;
    } catch (error) {
      logger.error('Failed to create bulk operation', { error, instructorId, operationType });
      throw new AppError('Failed to create bulk operation', 500);
    }
  }

  /**
   * Get instructor settings
   */
  async getInstructorSettings(instructorId: string): Promise<InstructorSettings> {
    try {
      let settings = await this.db.queryOne<InstructorSettings>(
        'SELECT * FROM instructor_settings WHERE instructor_id = $1',
        [instructorId]
      );

      if (!settings) {
        // Create default settings
        settings = await this.createDefaultSettings(instructorId);
      }

      return settings;
    } catch (error) {
      logger.error('Failed to get instructor settings', { error, instructorId });
      throw new AppError('Failed to retrieve settings', 500);
    }
  }

  /**
   * Update instructor settings
   */
  async updateInstructorSettings(
    instructorId: string,
    settings: Partial<InstructorSettings>
  ): Promise<InstructorSettings> {
    try {
      const updatedSettings = await this.db.update<InstructorSettings>(
        'instructor_settings',
        { ...settings, updated_at: new Date() },
        { instructor_id: instructorId }
      );

      if (!updatedSettings) {
        throw new AppError('Settings not found', 404);
      }

      logger.info('Instructor settings updated', { instructorId });
      return updatedSettings;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update instructor settings', { error, instructorId });
      throw new AppError('Failed to update settings', 500);
    }
  }

  /**
   * Generate content recommendations
   */
  async generateContentRecommendations(instructorId: string): Promise<ContentRecommendation[]> {
    try {
      const recommendations: ContentRecommendation[] = [];

      // Analyze course performance and generate recommendations
      const coursePerformance = await this.getCoursePerformance(instructorId);
      
      for (const course of coursePerformance) {
        // Low completion rate recommendation
        if (course.completion_rate < 50) {
          recommendations.push({
            id: uuidv4(),
            instructor_id: instructorId,
            recommendation_type: RecommendationType.CONTENT_OPTIMIZATION,
            title: 'Improve Course Completion Rate',
            description: `Course "${course.course_name}" has a low completion rate of ${course.completion_rate}%`,
            suggested_action: 'Consider breaking down long videos, adding more interactive elements, or reviewing content difficulty',
            priority: 8,
            data: { course_id: course.course_id, completion_rate: course.completion_rate },
            is_dismissed: false,
            created_at: new Date()
          });
        }

        // Low engagement recommendation
        if (course.average_progress < 30) {
          recommendations.push({
            id: uuidv4(),
            instructor_id: instructorId,
            recommendation_type: RecommendationType.STUDENT_ENGAGEMENT,
            title: 'Boost Student Engagement',
            description: `Students in "${course.course_name}" show low engagement with average progress of ${course.average_progress}%`,
            suggested_action: 'Add quizzes, assignments, or discussion forums to increase interaction',
            priority: 7,
            data: { course_id: course.course_id, average_progress: course.average_progress },
            is_dismissed: false,
            created_at: new Date()
          });
        }
      }

      // Revenue optimization recommendations
      const revenueStats = await this.getRevenueStats(instructorId, this.getDateFilter('30d'));
      if (revenueStats.growth_rate < 0) {
        recommendations.push({
          id: uuidv4(),
          instructor_id: instructorId,
          recommendation_type: RecommendationType.REVENUE_OPTIMIZATION,
          title: 'Revenue Decline Detected',
          description: `Your revenue has declined by ${Math.abs(revenueStats.growth_rate)}% this month`,
          suggested_action: 'Consider creating promotional campaigns, updating course content, or launching new courses',
          priority: 9,
          data: { growth_rate: revenueStats.growth_rate },
          is_dismissed: false,
          created_at: new Date()
        });
      }

      // Sort by priority (highest first)
      recommendations.sort((a, b) => b.priority - a.priority);

      return recommendations.slice(0, 10); // Return top 10 recommendations
    } catch (error) {
      logger.error('Failed to generate content recommendations', { error, instructorId });
      return [];
    }
  }

  // Private helper methods

  private async getCourseStats(instructorId: string): Promise<any> {
    const result = await this.db.queryOne<any>(`
      SELECT 
        COUNT(*) as total_courses,
        COALESCE(AVG(rating), 0) as average_rating
      FROM programs 
      WHERE instructor_id = $1 AND is_active = true
    `, [instructorId]);

    return {
      total_courses: parseInt(result?.total_courses || '0', 10),
      average_rating: parseFloat(result?.average_rating || '0')
    };
  }

  private async getStudentStats(instructorId: string): Promise<any> {
    const result = await this.db.queryOne<any>(`
      SELECT COUNT(DISTINCT e.user_id) as total_students
      FROM enrollments e
      JOIN programs p ON e.program_id = p.id
      WHERE p.instructor_id = $1 AND e.status = 'active'
    `, [instructorId]);

    return {
      total_students: parseInt(result?.total_students || '0', 10)
    };
  }

  private async getRevenueStats(instructorId: string, dateFilter: { start: Date; end: Date }): Promise<any> {
    const result = await this.db.queryOne<any>(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(*) as total_payments
      FROM payments pay
      JOIN programs p ON pay.program_id = p.id
      WHERE p.instructor_id = $1 
        AND pay.status = 'completed'
        AND pay.created_at >= $2 
        AND pay.created_at <= $3
    `, [instructorId, dateFilter.start, dateFilter.end]);

    // Calculate growth rate (simplified)
    const previousPeriod = await this.db.queryOne<any>(`
      SELECT COALESCE(SUM(amount), 0) as previous_revenue
      FROM payments pay
      JOIN programs p ON pay.program_id = p.id
      WHERE p.instructor_id = $1 
        AND pay.status = 'completed'
        AND pay.created_at >= $2 
        AND pay.created_at < $3
    `, [instructorId, new Date(dateFilter.start.getTime() - (dateFilter.end.getTime() - dateFilter.start.getTime())), dateFilter.start]);

    const currentRevenue = parseFloat(result?.total_revenue || '0');
    const previousRevenue = parseFloat(previousPeriod?.previous_revenue || '0');
    const growthRate = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return {
      total_revenue: currentRevenue,
      growth_rate: growthRate,
      monthly_revenue: [], // Would implement detailed monthly breakdown
      revenue_by_course: [], // Would implement course-wise revenue
      projected_revenue: currentRevenue * 1.1 // Simple projection
    };
  }

  private async getVideoStats(instructorId: string): Promise<any> {
    const result = await this.db.queryOne<any>(`
      SELECT 
        COUNT(*) as total_videos,
        COALESCE(SUM(duration), 0) as total_duration
      FROM videos v
      WHERE v.instructor_id = $1 AND v.status = 'ready'
    `, [instructorId]);

    const watchTimeResult = await this.db.queryOne<any>(`
      SELECT COALESCE(SUM(va.watch_time), 0) as total_watch_time
      FROM video_analytics va
      JOIN videos v ON va.video_id = v.id
      WHERE v.instructor_id = $1
    `, [instructorId]);

    return {
      total_videos: parseInt(result?.total_videos || '0', 10),
      total_duration: parseInt(result?.total_duration || '0', 10),
      total_watch_time: parseInt(watchTimeResult?.total_watch_time || '0', 10)
    };
  }

  private async getRecentEnrollments(instructorId: string, limit: number): Promise<any[]> {
    return await this.db.queryMany<any>(`
      SELECT 
        e.id,
        u.first_name || ' ' || u.last_name as student_name,
        u.email as student_email,
        p.name as course_name,
        e.enrolled_at,
        e.progress_percentage
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN programs p ON e.program_id = p.id
      WHERE p.instructor_id = $1
      ORDER BY e.enrolled_at DESC
      LIMIT $2
    `, [instructorId, limit]);
  }

  private async getCoursePerformance(instructorId: string): Promise<any[]> {
    return await this.db.queryMany<any>(`
      SELECT 
        p.id as course_id,
        p.name as course_name,
        COUNT(DISTINCT e.user_id) as total_students,
        COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.user_id END) * 100.0 / NULLIF(COUNT(DISTINCT e.user_id), 0) as completion_rate,
        COALESCE(AVG(e.progress_percentage), 0) as average_progress,
        COALESCE(SUM(pay.amount), 0) as total_revenue,
        COALESCE(p.rating, 0) as rating,
        COUNT(DISTINCT v.id) as total_videos,
        COALESCE(SUM(v.duration), 0) as total_duration,
        p.updated_at as last_updated
      FROM programs p
      LEFT JOIN enrollments e ON p.id = e.program_id
      LEFT JOIN payments pay ON p.id = pay.program_id AND pay.status = 'completed'
      LEFT JOIN videos v ON p.id = v.course_id AND v.status = 'ready'
      WHERE p.instructor_id = $1 AND p.is_active = true
      GROUP BY p.id, p.name, p.rating, p.updated_at
      ORDER BY total_students DESC
    `, [instructorId]);
  }

  private async getUpcomingSessions(instructorId: string): Promise<any[]> {
    return await this.db.queryMany<any>(`
      SELECT 
        ls.id,
        ls.title,
        p.name as course_name,
        ls.scheduled_start,
        ls.scheduled_end,
        COUNT(DISTINCT e.user_id) as registered_students,
        'live_class' as session_type
      FROM live_streams ls
      LEFT JOIN programs p ON ls.course_id = p.id
      LEFT JOIN enrollments e ON p.id = e.program_id AND e.status = 'active'
      WHERE ls.instructor_id = $1 
        AND ls.scheduled_start > NOW()
        AND ls.status = 'scheduled'
      GROUP BY ls.id, ls.title, p.name, ls.scheduled_start, ls.scheduled_end
      ORDER BY ls.scheduled_start ASC
      LIMIT 10
    `, [instructorId]);
  }

  private async getEngagementMetrics(instructorId: string, dateFilter: { start: Date; end: Date }): Promise<any> {
    // Implementation would calculate detailed engagement metrics
    return {
      total_watch_time: 0,
      average_session_duration: 0,
      completion_rate: 0,
      interaction_rate: 0,
      retention_rate: 0,
      popular_content: []
    };
  }

  private getDateFilter(range: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }

    return { start, end };
  }

  private async updateBatchProgress(batchId: string): Promise<void> {
    const files = await this.db.queryMany<BatchFile>(
      'SELECT * FROM batch_files WHERE batch_id = $1',
      [batchId]
    );

    const totalFiles = files.length;
    const uploadedFiles = files.filter(f => f.upload_status === FileUploadStatus.UPLOADED).length;
    const processedFiles = files.filter(f => f.processing_status === FileProcessingStatus.COMPLETED).length;
    const failedFiles = files.filter(f => 
      f.upload_status === FileUploadStatus.FAILED || 
      f.processing_status === FileProcessingStatus.FAILED
    ).length;

    const uploadProgress = totalFiles > 0 ? (uploadedFiles / totalFiles) * 100 : 0;
    const processingProgress = totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;

    let status = BatchStatus.UPLOADING;
    if (uploadedFiles === totalFiles) {
      status = processedFiles === totalFiles ? BatchStatus.COMPLETED : BatchStatus.PROCESSING;
    }
    if (failedFiles > 0 && (uploadedFiles + failedFiles) === totalFiles) {
      status = BatchStatus.FAILED;
    }

    await this.db.update('content_upload_batches', {
      processed_files: processedFiles,
      failed_files: failedFiles,
      status,
      upload_progress: uploadProgress,
      processing_progress: processingProgress,
      completed_at: status === BatchStatus.COMPLETED ? new Date() : null
    }, { id: batchId });
  }

  private async getStudentCourseDetails(studentId: string, instructorId: string, courseId?: string): Promise<any[]> {
    // Implementation would return detailed course information for the student
    return [];
  }

  private async calculateEngagementScore(studentId: string, instructorId: string): Promise<number> {
    // Implementation would calculate engagement score based on various metrics
    return 75; // Placeholder
  }

  private async getStudentWatchTime(studentId: string, instructorId: string): Promise<number> {
    const result = await this.db.queryOne<{ total_time: string }>(`
      SELECT COALESCE(SUM(va.watch_time), 0) as total_time
      FROM video_analytics va
      JOIN videos v ON va.video_id = v.id
      WHERE va.user_id = $1 AND v.instructor_id = $2
    `, [studentId, instructorId]);

    return parseInt(result?.total_time || '0', 10);
  }

  private async sendRealTimeNotification(instructorId: string, notification: InstructorNotification): Promise<void> {
    // Implementation would send WebSocket notification
    logger.debug('Real-time notification sent', { instructorId, notificationId: notification.id });
  }

  private async processBulkOperation(operationId: string): Promise<void> {
    // Implementation would process bulk operations asynchronously
    logger.info('Processing bulk operation', { operationId });
  }

  private async createDefaultSettings(instructorId: string): Promise<InstructorSettings> {
    const defaultSettings: InstructorSettings = {
      instructor_id: instructorId,
      notification_preferences: {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
        notification_types: {
          enrollment: true,
          completion: true,
          question: true,
          review: true,
          system: true,
          revenue: true,
          content_processed: true,
          live_session: true
        },
        quiet_hours: {
          enabled: false,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'UTC'
        }
      },
      dashboard_preferences: {
        default_view: 'overview',
        widgets: [],
        refresh_interval: 300,
        date_range_default: '30d'
      },
      content_preferences: {
        auto_save_interval: 30,
        default_video_quality: '720p',
        enable_auto_transcription: true,
        enable_auto_captions: true,
        default_content_visibility: 'enrolled',
        watermark_settings: {
          enabled: false,
          position: 'bottom-right',
          opacity: 0.7
        }
      },
      privacy_settings: {
        profile_visibility: 'public',
        show_student_progress: true,
        show_revenue_data: false,
        allow_student_contact: true,
        data_retention_days: 365
      },
      updated_at: new Date()
    };

    return await this.db.insert<InstructorSettings>('instructor_settings', defaultSettings);
  }
}