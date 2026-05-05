/**
 * Course Management Service Types
 */

export interface Program {
  id: string;
  name: string;
  description: string;
  category: 'starter' | 'membership' | 'accelerator' | 'pro_developer';
  price: number;
  currency: string;
  duration_weeks: number;
  features: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Course {
  id: string;
  program_id: string;
  name: string;
  description: string;
  order_index: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CourseModule {
  id: string;
  course_id: string;
  name: string;
  description: string;
  content_url?: string;
  order_index: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Enrollment {
  id: string;
  user_id: string;
  program_id: string;
  status: 'active' | 'completed' | 'cancelled' | 'suspended';
  progress_percentage: number;
  enrolled_at: Date;
  completed_at?: Date;
}

export interface UserProgress {
  id: string;
  user_id: string;
  course_id: string;
  module_id: string;
  completed: boolean;
  completion_percentage: number;
  time_spent_minutes: number;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ProgramWithCourses extends Program {
  courses: Course[];
}

export interface CourseWithModules extends Course {
  modules: CourseModule[];
}

export interface EnrollmentWithProgram extends Enrollment {
  program: Program;
}

export interface CreateProgramRequest {
  name: string;
  description: string;
  category: Program['category'];
  price: number;
  currency?: string;
  duration_weeks: number;
  features: Record<string, any>;
}

export interface UpdateProgramRequest extends Partial<CreateProgramRequest> {
  is_active?: boolean;
}

export interface CreateCourseRequest {
  program_id: string;
  name: string;
  description: string;
  order_index: number;
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
  is_active?: boolean;
}

export interface CreateModuleRequest {
  course_id: string;
  name: string;
  description: string;
  content_url?: string;
  order_index: number;
  duration_minutes: number;
}

export interface UpdateModuleRequest extends Partial<CreateModuleRequest> {
  is_active?: boolean;
}

export interface EnrollmentRequest {
  user_id: string;
  program_id: string;
}

export interface UpdateProgressRequest {
  module_id: string;
  completed: boolean;
  completion_percentage: number;
  time_spent_minutes: number;
}

export interface ProgramFilters {
  category?: Program['category'];
  is_active?: boolean;
  min_price?: number;
  max_price?: number;
}

export interface EnrollmentFilters {
  user_id?: string;
  program_id?: string;
  status?: Enrollment['status'];
}

export interface ProgressFilters {
  user_id?: string;
  course_id?: string;
  completed?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DashboardStats {
  total_programs: number;
  active_programs: number;
  total_enrollments: number;
  active_enrollments: number;
  completion_rate: number;
  popular_programs: Array<{
    program_id: string;
    program_name: string;
    enrollment_count: number;
  }>;
}

export interface StudentDashboard {
  user_id: string;
  enrollments: Array<{
    enrollment: Enrollment;
    program: Program;
    progress: {
      completed_modules: number;
      total_modules: number;
      completion_percentage: number;
      time_spent_hours: number;
    };
    next_module?: {
      course_name: string;
      module_name: string;
      module_id: string;
    };
  }>;
  achievements: Array<{
    type: 'course_completion' | 'program_completion' | 'milestone';
    title: string;
    description: string;
    earned_at: Date;
  }>;
}