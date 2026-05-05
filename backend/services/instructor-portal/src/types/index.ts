/**
 * Instructor Portal Types
 */

export interface InstructorDashboard {
  instructor_id: string;
  total_courses: number;
  total_students: number;
  total_revenue: number;
  total_videos: number;
  total_watch_time: number; // seconds
  average_rating: number;
  recent_enrollments: RecentEnrollment[];
  course_performance: CoursePerformance[];
  revenue_analytics: RevenueAnalytics;
  engagement_metrics: EngagementMetrics;
  upcoming_sessions: UpcomingSession[];
}

export interface RecentEnrollment {
  id: string;
  student_name: string;
  student_email: string;
  course_name: string;
  enrolled_at: Date;
  progress_percentage: number;
}

export interface CoursePerformance {
  course_id: string;
  course_name: string;
  total_students: number;
  completion_rate: number;
  average_progress: number;
  total_revenue: number;
  rating: number;
  total_videos: number;
  total_duration: number; // seconds
  last_updated: Date;
}

export interface RevenueAnalytics {
  total_revenue: number;
  monthly_revenue: MonthlyRevenue[];
  revenue_by_course: CourseRevenue[];
  projected_revenue: number;
  growth_rate: number; // percentage
}

export interface MonthlyRevenue {
  month: string;
  year: number;
  revenue: number;
  enrollments: number;
}

export interface CourseRevenue {
  course_id: string;
  course_name: string;
  revenue: number;
  enrollments: number;
  average_price: number;
}

export interface EngagementMetrics {
  total_watch_time: number; // seconds
  average_session_duration: number; // seconds
  completion_rate: number; // percentage
  interaction_rate: number; // percentage
  retention_rate: number; // percentage
  popular_content: PopularContent[];
}

export interface PopularContent {
  content_id: string;
  content_title: string;
  content_type: 'video' | 'quiz' | 'assignment';
  views: number;
  engagement_score: number;
  completion_rate: number;
}

export interface UpcomingSession {
  id: string;
  title: string;
  course_name: string;
  scheduled_start: Date;
  scheduled_end: Date;
  registered_students: number;
  session_type: 'live_class' | 'webinar' | 'office_hours';
}

export interface ContentUploadBatch {
  id: string;
  instructor_id: string;
  course_id: string;
  batch_name: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  status: BatchStatus;
  upload_progress: number; // percentage
  processing_progress: number; // percentage
  created_at: Date;
  completed_at?: Date;
  files: BatchFile[];
}

export enum BatchStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface BatchFile {
  id: string;
  batch_id: string;
  original_filename: string;
  file_size: number;
  content_type: string;
  upload_status: FileUploadStatus;
  processing_status: FileProcessingStatus;
  video_id?: string;
  error_message?: string;
  upload_progress: number; // percentage
  processing_progress: number; // percentage
}

export enum FileUploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  UPLOADED = 'uploaded',
  FAILED = 'failed'
}

export enum FileProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ContentTemplate {
  id: string;
  instructor_id: string;
  name: string;
  description?: string;
  template_type: TemplateType;
  content_structure: ContentStructure;
  is_public: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export enum TemplateType {
  COURSE = 'course',
  MODULE = 'module',
  LESSON = 'lesson',
  QUIZ = 'quiz',
  ASSIGNMENT = 'assignment'
}

export interface ContentStructure {
  sections: ContentSection[];
  settings: TemplateSettings;
}

export interface ContentSection {
  id: string;
  title: string;
  type: SectionType;
  order: number;
  required: boolean;
  content?: any;
  validation_rules?: ValidationRule[];
}

export enum SectionType {
  TEXT = 'text',
  VIDEO = 'video',
  QUIZ = 'quiz',
  ASSIGNMENT = 'assignment',
  RESOURCE = 'resource',
  DISCUSSION = 'discussion'
}

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
}

export interface TemplateSettings {
  auto_publish: boolean;
  require_approval: boolean;
  enable_comments: boolean;
  enable_ratings: boolean;
  drip_feed: boolean;
  drip_interval_days?: number;
}

export interface StudentAnalytics {
  student_id: string;
  student_name: string;
  student_email: string;
  enrollment_date: Date;
  total_courses: number;
  completed_courses: number;
  in_progress_courses: number;
  total_watch_time: number; // seconds
  average_progress: number; // percentage
  engagement_score: number;
  last_activity: Date;
  course_details: StudentCourseDetail[];
}

export interface StudentCourseDetail {
  course_id: string;
  course_name: string;
  enrollment_date: Date;
  progress_percentage: number;
  completion_date?: Date;
  total_watch_time: number; // seconds
  quiz_scores: QuizScore[];
  assignment_scores: AssignmentScore[];
  engagement_metrics: StudentEngagementMetrics;
}

export interface QuizScore {
  quiz_id: string;
  quiz_title: string;
  score: number;
  max_score: number;
  attempts: number;
  completed_at: Date;
}

export interface AssignmentScore {
  assignment_id: string;
  assignment_title: string;
  score: number;
  max_score: number;
  submitted_at: Date;
  graded_at?: Date;
  feedback?: string;
}

export interface StudentEngagementMetrics {
  video_completion_rate: number; // percentage
  quiz_participation_rate: number; // percentage
  assignment_submission_rate: number; // percentage
  discussion_participation: number;
  average_session_duration: number; // seconds
  login_frequency: number; // logins per week
}

export interface ContentSchedule {
  id: string;
  instructor_id: string;
  course_id: string;
  content_id: string;
  content_type: 'video' | 'quiz' | 'assignment' | 'resource';
  title: string;
  scheduled_release: Date;
  release_conditions?: ReleaseCondition[];
  status: ScheduleStatus;
  created_at: Date;
}

export interface ReleaseCondition {
  type: 'prerequisite' | 'date' | 'progress' | 'quiz_score';
  value: any;
  description: string;
}

export enum ScheduleStatus {
  SCHEDULED = 'scheduled',
  RELEASED = 'released',
  CANCELLED = 'cancelled'
}

export interface InstructorNotification {
  id: string;
  instructor_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  priority: NotificationPriority;
  created_at: Date;
  expires_at?: Date;
}

export enum NotificationType {
  ENROLLMENT = 'enrollment',
  COMPLETION = 'completion',
  QUESTION = 'question',
  REVIEW = 'review',
  SYSTEM = 'system',
  REVENUE = 'revenue',
  CONTENT_PROCESSED = 'content_processed',
  LIVE_SESSION = 'live_session'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface BulkOperation {
  id: string;
  instructor_id: string;
  operation_type: BulkOperationType;
  target_type: 'students' | 'content' | 'courses';
  target_ids: string[];
  parameters: any;
  status: BulkOperationStatus;
  progress: number; // percentage
  results: BulkOperationResult[];
  created_at: Date;
  completed_at?: Date;
}

export enum BulkOperationType {
  SEND_MESSAGE = 'send_message',
  UPDATE_GRADES = 'update_grades',
  ENROLL_STUDENTS = 'enroll_students',
  UNENROLL_STUDENTS = 'unenroll_students',
  PUBLISH_CONTENT = 'publish_content',
  UNPUBLISH_CONTENT = 'unpublish_content',
  DELETE_CONTENT = 'delete_content'
}

export enum BulkOperationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface BulkOperationResult {
  target_id: string;
  success: boolean;
  error_message?: string;
  data?: any;
}

export interface InstructorSettings {
  instructor_id: string;
  notification_preferences: NotificationPreferences;
  dashboard_preferences: DashboardPreferences;
  content_preferences: ContentPreferences;
  privacy_settings: PrivacySettings;
  updated_at: Date;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  notification_types: {
    [key in NotificationType]: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    timezone: string;
  };
}

export interface DashboardPreferences {
  default_view: 'overview' | 'analytics' | 'content' | 'students';
  widgets: DashboardWidget[];
  refresh_interval: number; // seconds
  date_range_default: '7d' | '30d' | '90d' | '1y';
}

export interface DashboardWidget {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  settings: any;
  enabled: boolean;
}

export interface ContentPreferences {
  auto_save_interval: number; // seconds
  default_video_quality: string;
  enable_auto_transcription: boolean;
  enable_auto_captions: boolean;
  default_content_visibility: 'public' | 'enrolled' | 'private';
  watermark_settings: WatermarkSettings;
}

export interface WatermarkSettings {
  enabled: boolean;
  text?: string;
  image_url?: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number;
}

export interface PrivacySettings {
  profile_visibility: 'public' | 'students' | 'private';
  show_student_progress: boolean;
  show_revenue_data: boolean;
  allow_student_contact: boolean;
  data_retention_days: number;
}

export interface ContentRecommendation {
  id: string;
  instructor_id: string;
  recommendation_type: RecommendationType;
  title: string;
  description: string;
  suggested_action: string;
  priority: number;
  data: any;
  is_dismissed: boolean;
  created_at: Date;
  expires_at?: Date;
}

export enum RecommendationType {
  CONTENT_OPTIMIZATION = 'content_optimization',
  STUDENT_ENGAGEMENT = 'student_engagement',
  REVENUE_OPTIMIZATION = 'revenue_optimization',
  TECHNICAL_IMPROVEMENT = 'technical_improvement',
  MARKETING_SUGGESTION = 'marketing_suggestion'
}

export interface InstructorCollaboration {
  id: string;
  course_id: string;
  primary_instructor_id: string;
  collaborator_id: string;
  role: CollaboratorRole;
  permissions: CollaboratorPermission[];
  status: CollaborationStatus;
  invited_at: Date;
  accepted_at?: Date;
  expires_at?: Date;
}

export enum CollaboratorRole {
  CO_INSTRUCTOR = 'co_instructor',
  TEACHING_ASSISTANT = 'teaching_assistant',
  CONTENT_REVIEWER = 'content_reviewer',
  GUEST_LECTURER = 'guest_lecturer'
}

export enum CollaboratorPermission {
  VIEW_CONTENT = 'view_content',
  EDIT_CONTENT = 'edit_content',
  PUBLISH_CONTENT = 'publish_content',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_STUDENTS = 'manage_students',
  GRADE_ASSIGNMENTS = 'grade_assignments',
  CONDUCT_SESSIONS = 'conduct_sessions',
  MANAGE_DISCUSSIONS = 'manage_discussions'
}

export enum CollaborationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
  DECLINED = 'declined'
}