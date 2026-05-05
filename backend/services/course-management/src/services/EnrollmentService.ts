/**
 * Enrollment Service
 * Handles enrollment management and progress tracking
 */

import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import {
  Enrollment,
  UserProgress,
  EnrollmentWithProgram,
  EnrollmentRequest,
  UpdateProgressRequest,
  EnrollmentFilters,
  ProgressFilters,
  PaginationOptions,
  PaginatedResponse,
  DashboardStats,
  StudentDashboard,
} from '../types';
import { ProgramService } from './ProgramService';

export class EnrollmentService {
  private db = getDatabase();
  private cache = getCache();
  private programService = new ProgramService();

  // Enrollment operations
  async createEnrollment(data: EnrollmentRequest): Promise<Enrollment> {
    try {
      // Check if user is already enrolled
      const existingEnrollment = await this.db.queryOne<Enrollment>(
        'SELECT * FROM enrollments WHERE user_id = $1 AND program_id = $2',
        [data.user_id, data.program_id]
      );

      if (existingEnrollment) {
        throw new AppError('User is already enrolled in this program', 400);
      }

      // Verify program exists and is active
      const program = await this.programService.getProgramById(data.program_id);
      if (!program) {
        throw new AppError('Program not found', 404);
      }

      if (!program.is_active) {
        throw new AppError('Program is not available for enrollment', 400);
      }

      const enrollment = await this.db.insert<Enrollment>('enrollments', {
        ...data,
        status: 'active',
        progress_percentage: 0,
      });

      // Clear user dashboard cache
      await this.cache.del(`dashboard:${data.user_id}`);

      logger.info('Enrollment created successfully', { 
        enrollmentId: enrollment.id,
        userId: data.user_id,
        programId: data.program_id 
      });

      return enrollment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create enrollment', { error, data });
      throw new AppError('Failed to create enrollment', 500);
    }
  }

  async getEnrollmentById(id: string): Promise<Enrollment | null> {
    try {
      return await this.db.queryOne<Enrollment>(
        'SELECT * FROM enrollments WHERE id = $1',
        [id]
      );
    } catch (error) {
      logger.error('Failed to get enrollment by ID', { error, id });
      throw new AppError('Failed to retrieve enrollment', 500);
    }
  }

  async getEnrollmentWithProgram(id: string): Promise<EnrollmentWithProgram | null> {
    try {
      const result = await this.db.queryOne<EnrollmentWithProgram>(`
        SELECT 
          e.*,
          p.id as program_id,
          p.name as program_name,
          p.description as program_description,
          p.category as program_category,
          p.price as program_price,
          p.currency as program_currency,
          p.duration_weeks as program_duration_weeks,
          p.features as program_features,
          p.is_active as program_is_active,
          p.created_at as program_created_at,
          p.updated_at as program_updated_at
        FROM enrollments e
        JOIN programs p ON e.program_id = p.id
        WHERE e.id = $1
      `, [id]);

      if (!result) return null;

      // Transform the flat result into nested structure
      return {
        id: result.id,
        user_id: result.user_id,
        program_id: result.program_id,
        status: result.status,
        progress_percentage: result.progress_percentage,
        enrolled_at: result.enrolled_at,
        completed_at: result.completed_at,
        program: {
          id: result.program_id,
          name: (result as any).program_name,
          description: (result as any).program_description,
          category: (result as any).program_category,
          price: (result as any).program_price,
          currency: (result as any).program_currency,
          duration_weeks: (result as any).program_duration_weeks,
          features: (result as any).program_features,
          is_active: (result as any).program_is_active,
          created_at: (result as any).program_created_at,
          updated_at: (result as any).program_updated_at,
        },
      };
    } catch (error) {
      logger.error('Failed to get enrollment with program', { error, id });
      throw new AppError('Failed to retrieve enrollment details', 500);
    }
  }

  async getEnrollments(
    filters: EnrollmentFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<EnrollmentWithProgram>> {
    try {
      const { page = 1, limit = 10, sort_by = 'enrolled_at', sort_order = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (filters.user_id) {
        whereConditions.push(`e.user_id = $${paramIndex++}`);
        queryParams.push(filters.user_id);
      }

      if (filters.program_id) {
        whereConditions.push(`e.program_id = $${paramIndex++}`);
        queryParams.push(filters.program_id);
      }

      if (filters.status) {
        whereConditions.push(`e.status = $${paramIndex++}`);
        queryParams.push(filters.status);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM enrollments e
        JOIN programs p ON e.program_id = p.id
        ${whereClause}
      `;
      const countResult = await this.db.queryOne<{ count: string }>(countQuery, queryParams);
      const total = parseInt(countResult?.count || '0', 10);

      // Get paginated data
      const dataQuery = `
        SELECT 
          e.*,
          p.id as program_id,
          p.name as program_name,
          p.description as program_description,
          p.category as program_category,
          p.price as program_price,
          p.currency as program_currency,
          p.duration_weeks as program_duration_weeks,
          p.features as program_features,
          p.is_active as program_is_active,
          p.created_at as program_created_at,
          p.updated_at as program_updated_at
        FROM enrollments e
        JOIN programs p ON e.program_id = p.id
        ${whereClause}
        ORDER BY e.${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      const results = await this.db.queryMany<any>(dataQuery, [
        ...queryParams,
        limit,
        offset,
      ]);

      // Transform results
      const data = results.map(result => ({
        id: result.id,
        user_id: result.user_id,
        program_id: result.program_id,
        status: result.status,
        progress_percentage: result.progress_percentage,
        enrolled_at: result.enrolled_at,
        completed_at: result.completed_at,
        program: {
          id: result.program_id,
          name: result.program_name,
          description: result.program_description,
          category: result.program_category,
          price: result.program_price,
          currency: result.program_currency,
          duration_weeks: result.program_duration_weeks,
          features: result.program_features,
          is_active: result.program_is_active,
          created_at: result.program_created_at,
          updated_at: result.program_updated_at,
        },
      }));

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get enrollments', { error, filters, pagination });
      throw new AppError('Failed to retrieve enrollments', 500);
    }
  }

  async updateEnrollmentStatus(
    id: string, 
    status: Enrollment['status']
  ): Promise<Enrollment | null> {
    try {
      const updateData: any = { status };
      
      if (status === 'completed') {
        updateData.completed_at = new Date();
        updateData.progress_percentage = 100;
      }

      const enrollment = await this.db.update<Enrollment>(
        'enrollments',
        updateData,
        { id }
      );

      if (enrollment) {
        // Clear user dashboard cache
        await this.cache.del(`dashboard:${enrollment.user_id}`);
        logger.info('Enrollment status updated', { enrollmentId: id, status });
      }

      return enrollment;
    } catch (error) {
      logger.error('Failed to update enrollment status', { error, id, status });
      throw new AppError('Failed to update enrollment status', 500);
    }
  }

  // Progress tracking operations
  async updateProgress(
    userId: string,
    data: UpdateProgressRequest
  ): Promise<UserProgress> {
    try {
      // Get module and course information
      const module = await this.programService.getModuleById(data.module_id);
      if (!module) {
        throw new AppError('Module not found', 404);
      }

      const course = await this.programService.getCourseById(module.course_id);
      if (!course) {
        throw new AppError('Course not found', 404);
      }

      // Check if user is enrolled in the program
      const enrollment = await this.db.queryOne<Enrollment>(
        'SELECT * FROM enrollments WHERE user_id = $1 AND program_id = $2 AND status = $3',
        [userId, course.program_id, 'active']
      );

      if (!enrollment) {
        throw new AppError('User is not enrolled in this program', 403);
      }

      // Update or create progress record
      const existingProgress = await this.db.queryOne<UserProgress>(
        'SELECT * FROM user_progress WHERE user_id = $1 AND module_id = $2',
        [userId, data.module_id]
      );

      let progress: UserProgress;

      if (existingProgress) {
        const updateData: any = {
          completed: data.completed,
          completion_percentage: data.completion_percentage,
          time_spent_minutes: data.time_spent_minutes,
        };

        if (data.completed && !existingProgress.completed) {
          updateData.completed_at = new Date();
        }

        progress = await this.db.update<UserProgress>(
          'user_progress',
          updateData,
          { id: existingProgress.id }
        ) as UserProgress;
      } else {
        progress = await this.db.insert<UserProgress>('user_progress', {
          user_id: userId,
          course_id: course.id,
          module_id: data.module_id,
          completed: data.completed,
          completion_percentage: data.completion_percentage,
          time_spent_minutes: data.time_spent_minutes,
          completed_at: data.completed ? new Date() : null,
        });
      }

      // Update enrollment progress
      await this.updateEnrollmentProgress(enrollment.id);

      // Clear user dashboard cache
      await this.cache.del(`dashboard:${userId}`);

      logger.info('Progress updated successfully', { 
        userId, 
        moduleId: data.module_id,
        completed: data.completed 
      });

      return progress;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update progress', { error, userId, data });
      throw new AppError('Failed to update progress', 500);
    }
  }

  async getUserProgress(
    filters: ProgressFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<UserProgress>> {
    try {
      const { page = 1, limit = 10, sort_by = 'updated_at', sort_order = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (filters.user_id) {
        whereConditions.push(`user_id = $${paramIndex++}`);
        queryParams.push(filters.user_id);
      }

      if (filters.course_id) {
        whereConditions.push(`course_id = $${paramIndex++}`);
        queryParams.push(filters.course_id);
      }

      if (filters.completed !== undefined) {
        whereConditions.push(`completed = $${paramIndex++}`);
        queryParams.push(filters.completed);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM user_progress ${whereClause}`;
      const countResult = await this.db.queryOne<{ count: string }>(countQuery, queryParams);
      const total = parseInt(countResult?.count || '0', 10);

      // Get paginated data
      const dataQuery = `
        SELECT * FROM user_progress 
        ${whereClause}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      const data = await this.db.queryMany<UserProgress>(dataQuery, [
        ...queryParams,
        limit,
        offset,
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get user progress', { error, filters, pagination });
      throw new AppError('Failed to retrieve user progress', 500);
    }
  }

  // Dashboard and analytics
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const cacheKey = 'dashboard:stats';
      const cached = await this.cache.get<DashboardStats>(cacheKey);
      if (cached) return cached;

      const [
        totalProgramsResult,
        activeProgramsResult,
        totalEnrollmentsResult,
        activeEnrollmentsResult,
        completedEnrollmentsResult,
        popularProgramsResult,
      ] = await Promise.all([
        this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM programs'),
        this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM programs WHERE is_active = true'),
        this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM enrollments'),
        this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM enrollments WHERE status = $1', ['active']),
        this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM enrollments WHERE status = $1', ['completed']),
        this.db.queryMany<{ program_id: string; program_name: string; enrollment_count: string }>(`
          SELECT 
            p.id as program_id,
            p.name as program_name,
            COUNT(e.id) as enrollment_count
          FROM programs p
          LEFT JOIN enrollments e ON p.id = e.program_id
          WHERE p.is_active = true
          GROUP BY p.id, p.name
          ORDER BY enrollment_count DESC
          LIMIT 5
        `),
      ]);

      const totalPrograms = parseInt(totalProgramsResult?.count || '0', 10);
      const activePrograms = parseInt(activeProgramsResult?.count || '0', 10);
      const totalEnrollments = parseInt(totalEnrollmentsResult?.count || '0', 10);
      const activeEnrollments = parseInt(activeEnrollmentsResult?.count || '0', 10);
      const completedEnrollments = parseInt(completedEnrollmentsResult?.count || '0', 10);

      const stats: DashboardStats = {
        total_programs: totalPrograms,
        active_programs: activePrograms,
        total_enrollments: totalEnrollments,
        active_enrollments: activeEnrollments,
        completion_rate: totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0,
        popular_programs: popularProgramsResult.map(row => ({
          program_id: row.program_id,
          program_name: row.program_name,
          enrollment_count: parseInt(row.enrollment_count, 10),
        })),
      };

      // Cache for 5 minutes
      await this.cache.set(cacheKey, stats, { ttl: 300 });

      return stats;
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error });
      throw new AppError('Failed to retrieve dashboard statistics', 500);
    }
  }

  async getStudentDashboard(userId: string): Promise<StudentDashboard> {
    try {
      const cacheKey = `dashboard:${userId}`;
      const cached = await this.cache.get<StudentDashboard>(cacheKey);
      if (cached) return cached;

      // Get user enrollments with progress
      const enrollments = await this.getEnrollments({ user_id: userId });
      
      const dashboardEnrollments = await Promise.all(
        enrollments.data.map(async (enrollment) => {
          // Get progress stats for this enrollment
          const progressStats = await this.getEnrollmentProgressStats(enrollment.id);
          
          // Get next module
          const nextModule = await this.getNextModule(userId, enrollment.program_id);

          return {
            enrollment,
            program: enrollment.program,
            progress: progressStats,
            next_module: nextModule,
          };
        })
      );

      // Get achievements (simplified for now)
      const achievements = await this.getUserAchievements(userId);

      const dashboard: StudentDashboard = {
        user_id: userId,
        enrollments: dashboardEnrollments,
        achievements,
      };

      // Cache for 10 minutes
      await this.cache.set(cacheKey, dashboard, { ttl: 600 });

      return dashboard;
    } catch (error) {
      logger.error('Failed to get student dashboard', { error, userId });
      throw new AppError('Failed to retrieve student dashboard', 500);
    }
  }

  // Private helper methods
  private async updateEnrollmentProgress(enrollmentId: string): Promise<void> {
    try {
      const enrollment = await this.getEnrollmentById(enrollmentId);
      if (!enrollment) return;

      // Calculate overall progress
      const progressStats = await this.getEnrollmentProgressStats(enrollmentId);
      
      await this.db.update(
        'enrollments',
        { 
          progress_percentage: progressStats.completion_percentage,
          ...(progressStats.completion_percentage === 100 ? { 
            status: 'completed',
            completed_at: new Date() 
          } : {})
        },
        { id: enrollmentId }
      );
    } catch (error) {
      logger.error('Failed to update enrollment progress', { error, enrollmentId });
    }
  }

  private async getEnrollmentProgressStats(enrollmentId: string): Promise<{
    completed_modules: number;
    total_modules: number;
    completion_percentage: number;
    time_spent_hours: number;
  }> {
    const enrollment = await this.getEnrollmentById(enrollmentId);
    if (!enrollment) {
      return { completed_modules: 0, total_modules: 0, completion_percentage: 0, time_spent_hours: 0 };
    }

    const [completedResult, totalResult, timeResult] = await Promise.all([
      this.db.queryOne<{ count: string }>(`
        SELECT COUNT(*) as count
        FROM user_progress up
        JOIN course_modules cm ON up.module_id = cm.id
        JOIN courses c ON cm.course_id = c.id
        WHERE up.user_id = $1 AND c.program_id = $2 AND up.completed = true
      `, [enrollment.user_id, enrollment.program_id]),
      
      this.db.queryOne<{ count: string }>(`
        SELECT COUNT(*) as count
        FROM course_modules cm
        JOIN courses c ON cm.course_id = c.id
        WHERE c.program_id = $1 AND cm.is_active = true
      `, [enrollment.program_id]),
      
      this.db.queryOne<{ total_time: string }>(`
        SELECT COALESCE(SUM(up.time_spent_minutes), 0) as total_time
        FROM user_progress up
        JOIN course_modules cm ON up.module_id = cm.id
        JOIN courses c ON cm.course_id = c.id
        WHERE up.user_id = $1 AND c.program_id = $2
      `, [enrollment.user_id, enrollment.program_id]),
    ]);

    const completedModules = parseInt(completedResult?.count || '0', 10);
    const totalModules = parseInt(totalResult?.count || '0', 10);
    const totalMinutes = parseInt(timeResult?.total_time || '0', 10);

    return {
      completed_modules: completedModules,
      total_modules: totalModules,
      completion_percentage: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
      time_spent_hours: Math.round(totalMinutes / 60 * 100) / 100, // Round to 2 decimal places
    };
  }

  private async getNextModule(userId: string, programId: string): Promise<{
    course_name: string;
    module_name: string;
    module_id: string;
  } | undefined> {
    try {
      const result = await this.db.queryOne<{
        course_name: string;
        module_name: string;
        module_id: string;
      }>(`
        SELECT 
          c.name as course_name,
          cm.name as module_name,
          cm.id as module_id
        FROM course_modules cm
        JOIN courses c ON cm.course_id = c.id
        LEFT JOIN user_progress up ON cm.id = up.module_id AND up.user_id = $1
        WHERE c.program_id = $2 
          AND cm.is_active = true 
          AND (up.id IS NULL OR up.completed = false)
        ORDER BY c.order_index ASC, cm.order_index ASC
        LIMIT 1
      `, [userId, programId]);

      return result || undefined;
    } catch (error) {
      logger.error('Failed to get next module', { error, userId, programId });
      return undefined;
    }
  }

  private async getUserAchievements(userId: string): Promise<Array<{
    type: 'course_completion' | 'program_completion' | 'milestone';
    title: string;
    description: string;
    earned_at: Date;
  }>> {
    // Simplified achievements - in a real implementation, this would be more sophisticated
    try {
      const completedPrograms = await this.db.queryMany<{
        program_name: string;
        completed_at: Date;
      }>(`
        SELECT p.name as program_name, e.completed_at
        FROM enrollments e
        JOIN programs p ON e.program_id = p.id
        WHERE e.user_id = $1 AND e.status = 'completed'
        ORDER BY e.completed_at DESC
      `, [userId]);

      return completedPrograms.map(program => ({
        type: 'program_completion' as const,
        title: `${program.program_name} Completed`,
        description: `Successfully completed the ${program.program_name}`,
        earned_at: program.completed_at,
      }));
    } catch (error) {
      logger.error('Failed to get user achievements', { error, userId });
      return [];
    }
  }
}