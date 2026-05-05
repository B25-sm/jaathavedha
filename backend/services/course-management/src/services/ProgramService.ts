/**
 * Program Service
 * Handles CRUD operations for programs and courses
 */

import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import {
  Program,
  Course,
  CourseModule,
  ProgramWithCourses,
  CourseWithModules,
  CreateProgramRequest,
  UpdateProgramRequest,
  CreateCourseRequest,
  UpdateCourseRequest,
  CreateModuleRequest,
  UpdateModuleRequest,
  ProgramFilters,
  PaginationOptions,
  PaginatedResponse,
} from '../types';

export class ProgramService {
  private db = getDatabase();

  // Program CRUD operations
  async createProgram(data: CreateProgramRequest): Promise<Program> {
    try {
      const program = await this.db.insert<Program>('programs', {
        ...data,
        currency: data.currency || 'INR',
        is_active: true,
      });

      logger.info('Program created successfully', { programId: program.id });
      return program;
    } catch (error) {
      logger.error('Failed to create program', { error, data });
      throw new AppError('Failed to create program', 500);
    }
  }

  async getProgramById(id: string): Promise<Program | null> {
    try {
      return await this.db.queryOne<Program>(
        'SELECT * FROM programs WHERE id = $1',
        [id]
      );
    } catch (error) {
      logger.error('Failed to get program by ID', { error, id });
      throw new AppError('Failed to retrieve program', 500);
    }
  }

  async getProgramWithCourses(id: string): Promise<ProgramWithCourses | null> {
    try {
      const program = await this.getProgramById(id);
      if (!program) return null;

      const courses = await this.getCoursesByProgramId(id);
      
      return {
        ...program,
        courses,
      };
    } catch (error) {
      logger.error('Failed to get program with courses', { error, id });
      throw new AppError('Failed to retrieve program details', 500);
    }
  }

  async getPrograms(
    filters: ProgramFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<Program>> {
    try {
      const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (filters.category) {
        whereConditions.push(`category = $${paramIndex++}`);
        queryParams.push(filters.category);
      }

      if (filters.is_active !== undefined) {
        whereConditions.push(`is_active = $${paramIndex++}`);
        queryParams.push(filters.is_active);
      }

      if (filters.min_price !== undefined) {
        whereConditions.push(`price >= $${paramIndex++}`);
        queryParams.push(filters.min_price);
      }

      if (filters.max_price !== undefined) {
        whereConditions.push(`price <= $${paramIndex++}`);
        queryParams.push(filters.max_price);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM programs ${whereClause}`;
      const countResult = await this.db.queryOne<{ count: string }>(countQuery, queryParams);
      const total = parseInt(countResult?.count || '0', 10);

      // Get paginated data
      const dataQuery = `
        SELECT * FROM programs 
        ${whereClause}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      const data = await this.db.queryMany<Program>(dataQuery, [
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
      logger.error('Failed to get programs', { error, filters, pagination });
      throw new AppError('Failed to retrieve programs', 500);
    }
  }

  async updateProgram(id: string, data: UpdateProgramRequest): Promise<Program | null> {
    try {
      const program = await this.db.update<Program>(
        'programs',
        data,
        { id }
      );

      if (program) {
        logger.info('Program updated successfully', { programId: id });
      }

      return program;
    } catch (error) {
      logger.error('Failed to update program', { error, id, data });
      throw new AppError('Failed to update program', 500);
    }
  }

  async deleteProgram(id: string): Promise<boolean> {
    try {
      // Check if program has enrollments
      const enrollmentCount = await this.db.count('enrollments', { program_id: id });
      if (enrollmentCount > 0) {
        throw new AppError('Cannot delete program with active enrollments', 400);
      }

      const deletedCount = await this.db.delete('programs', { id });
      
      if (deletedCount > 0) {
        logger.info('Program deleted successfully', { programId: id });
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete program', { error, id });
      throw new AppError('Failed to delete program', 500);
    }
  }

  // Course CRUD operations
  async createCourse(data: CreateCourseRequest): Promise<Course> {
    try {
      // Verify program exists
      const program = await this.getProgramById(data.program_id);
      if (!program) {
        throw new AppError('Program not found', 404);
      }

      const course = await this.db.insert<Course>('courses', {
        ...data,
        is_active: true,
      });

      logger.info('Course created successfully', { courseId: course.id });
      return course;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create course', { error, data });
      throw new AppError('Failed to create course', 500);
    }
  }

  async getCourseById(id: string): Promise<Course | null> {
    try {
      return await this.db.queryOne<Course>(
        'SELECT * FROM courses WHERE id = $1',
        [id]
      );
    } catch (error) {
      logger.error('Failed to get course by ID', { error, id });
      throw new AppError('Failed to retrieve course', 500);
    }
  }

  async getCourseWithModules(id: string): Promise<CourseWithModules | null> {
    try {
      const course = await this.getCourseById(id);
      if (!course) return null;

      const modules = await this.getModulesByCourseId(id);
      
      return {
        ...course,
        modules,
      };
    } catch (error) {
      logger.error('Failed to get course with modules', { error, id });
      throw new AppError('Failed to retrieve course details', 500);
    }
  }

  async getCoursesByProgramId(programId: string): Promise<Course[]> {
    try {
      return await this.db.queryMany<Course>(
        'SELECT * FROM courses WHERE program_id = $1 AND is_active = true ORDER BY order_index ASC',
        [programId]
      );
    } catch (error) {
      logger.error('Failed to get courses by program ID', { error, programId });
      throw new AppError('Failed to retrieve courses', 500);
    }
  }

  async updateCourse(id: string, data: UpdateCourseRequest): Promise<Course | null> {
    try {
      const course = await this.db.update<Course>(
        'courses',
        data,
        { id }
      );

      if (course) {
        logger.info('Course updated successfully', { courseId: id });
      }

      return course;
    } catch (error) {
      logger.error('Failed to update course', { error, id, data });
      throw new AppError('Failed to update course', 500);
    }
  }

  async deleteCourse(id: string): Promise<boolean> {
    try {
      // Check if course has user progress
      const progressCount = await this.db.count('user_progress', { course_id: id });
      if (progressCount > 0) {
        throw new AppError('Cannot delete course with user progress', 400);
      }

      const deletedCount = await this.db.delete('courses', { id });
      
      if (deletedCount > 0) {
        logger.info('Course deleted successfully', { courseId: id });
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete course', { error, id });
      throw new AppError('Failed to delete course', 500);
    }
  }

  // Module CRUD operations
  async createModule(data: CreateModuleRequest): Promise<CourseModule> {
    try {
      // Verify course exists
      const course = await this.getCourseById(data.course_id);
      if (!course) {
        throw new AppError('Course not found', 404);
      }

      const module = await this.db.insert<CourseModule>('course_modules', {
        ...data,
        is_active: true,
      });

      logger.info('Module created successfully', { moduleId: module.id });
      return module;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create module', { error, data });
      throw new AppError('Failed to create module', 500);
    }
  }

  async getModuleById(id: string): Promise<CourseModule | null> {
    try {
      return await this.db.queryOne<CourseModule>(
        'SELECT * FROM course_modules WHERE id = $1',
        [id]
      );
    } catch (error) {
      logger.error('Failed to get module by ID', { error, id });
      throw new AppError('Failed to retrieve module', 500);
    }
  }

  async getModulesByCourseId(courseId: string): Promise<CourseModule[]> {
    try {
      return await this.db.queryMany<CourseModule>(
        'SELECT * FROM course_modules WHERE course_id = $1 AND is_active = true ORDER BY order_index ASC',
        [courseId]
      );
    } catch (error) {
      logger.error('Failed to get modules by course ID', { error, courseId });
      throw new AppError('Failed to retrieve modules', 500);
    }
  }

  async updateModule(id: string, data: UpdateModuleRequest): Promise<CourseModule | null> {
    try {
      const module = await this.db.update<CourseModule>(
        'course_modules',
        data,
        { id }
      );

      if (module) {
        logger.info('Module updated successfully', { moduleId: id });
      }

      return module;
    } catch (error) {
      logger.error('Failed to update module', { error, id, data });
      throw new AppError('Failed to update module', 500);
    }
  }

  async deleteModule(id: string): Promise<boolean> {
    try {
      // Check if module has user progress
      const progressCount = await this.db.count('user_progress', { module_id: id });
      if (progressCount > 0) {
        throw new AppError('Cannot delete module with user progress', 400);
      }

      const deletedCount = await this.db.delete('course_modules', { id });
      
      if (deletedCount > 0) {
        logger.info('Module deleted successfully', { moduleId: id });
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to delete module', { error, id });
      throw new AppError('Failed to delete module', 500);
    }
  }

  // Utility methods
  async getProgramStats(programId: string): Promise<{
    total_courses: number;
    total_modules: number;
    total_enrollments: number;
    active_enrollments: number;
    completion_rate: number;
  }> {
    try {
      const [coursesResult, modulesResult, enrollmentsResult, completedResult] = await Promise.all([
        this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM courses WHERE program_id = $1', [programId]),
        this.db.queryOne<{ count: string }>(`
          SELECT COUNT(*) as count FROM course_modules cm
          JOIN courses c ON cm.course_id = c.id
          WHERE c.program_id = $1
        `, [programId]),
        this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM enrollments WHERE program_id = $1', [programId]),
        this.db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM enrollments WHERE program_id = $1 AND status = $2', [programId, 'completed']),
      ]);

      const totalCourses = parseInt(coursesResult?.count || '0', 10);
      const totalModules = parseInt(modulesResult?.count || '0', 10);
      const totalEnrollments = parseInt(enrollmentsResult?.count || '0', 10);
      const completedEnrollments = parseInt(completedResult?.count || '0', 10);

      return {
        total_courses: totalCourses,
        total_modules: totalModules,
        total_enrollments: totalEnrollments,
        active_enrollments: totalEnrollments - completedEnrollments,
        completion_rate: totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0,
      };
    } catch (error) {
      logger.error('Failed to get program stats', { error, programId });
      throw new AppError('Failed to retrieve program statistics', 500);
    }
  }
}