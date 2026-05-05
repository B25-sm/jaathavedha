// Analytics Event Types
export interface AnalyticsEvent {
  id?: string;
  eventType: EventType;
  userId?: string;
  sessionId: string;
  properties: Record<string, any>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  createdAt?: Date;
}

export enum EventType {
  // User Events
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  PROFILE_UPDATED = 'profile_updated',
  
  // Course Events
  COURSE_VIEWED = 'course_viewed',
  ENROLLMENT_STARTED = 'enrollment_started',
  ENROLLMENT_COMPLETED = 'enrollment_completed',
  MODULE_STARTED = 'module_started',
  MODULE_COMPLETED = 'module_completed',
  COURSE_COMPLETED = 'course_completed',
  
  // Payment Events
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  
  // Content Events
  PAGE_VIEW = 'page_view',
  VIDEO_STARTED = 'video_started',
  VIDEO_COMPLETED = 'video_completed',
  RESOURCE_DOWNLOADED = 'resource_downloaded',
  
  // Engagement Events
  CONTACT_FORM_SUBMITTED = 'contact_form_submitted',
  NEWSLETTER_SUBSCRIBED = 'newsletter_subscribed',
  REFERRAL_SHARED = 'referral_shared',
  
  // Custom Events
  CUSTOM = 'custom'
}

// User Metrics
export interface UserMetrics {
  userId: string;
  totalSessions: number;
  totalPageViews: number;
  totalTimeSpent: number; // in seconds
  lastActiveAt: Date;
  enrollmentCount: number;
  completionCount: number;
  totalRevenue: number;
  engagementScore: number;
  retentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}

// Enrollment Metrics
export interface EnrollmentMetrics {
  programId: string;
  programName: string;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  averageCompletionTime: number; // in days
  completionRate: number; // percentage
  period: DateRange;
}

// Revenue Metrics
export interface RevenueMetrics {
  totalRevenue: number;
  transactionCount: number;
  averageOrderValue: number;
  revenueByProgram: ProgramRevenue[];
  revenueByGateway: GatewayRevenue[];
  period: DateRange;
}

export interface ProgramRevenue {
  programId: string;
  programName: string;
  revenue: number;
  enrollments: number;
}

export interface GatewayRevenue {
  gateway: string;
  revenue: number;
  transactionCount: number;
  successRate: number;
}

// Engagement Metrics
export interface EngagementMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  averagePageViewsPerSession: number;
  bounceRate: number;
  topPages: PageMetric[];
  period: DateRange;
}

export interface PageMetric {
  page: string;
  views: number;
  uniqueVisitors: number;
  averageTimeOnPage: number;
}

// Retention Metrics
export interface RetentionMetrics {
  cohortDate: Date;
  totalUsers: number;
  retentionByDay: RetentionData[];
  retentionByWeek: RetentionData[];
  retentionByMonth: RetentionData[];
}

export interface RetentionData {
  period: number;
  activeUsers: number;
  retentionRate: number;
}

// Conversion Funnel
export interface ConversionFunnel {
  visitors: number;
  signups: number;
  enrollmentStarts: number;
  paymentInitiated: number;
  paymentCompleted: number;
  conversionRates: {
    visitorToSignup: number;
    signupToEnrollment: number;
    enrollmentToPayment: number;
    paymentSuccess: number;
    overallConversion: number;
  };
  period: DateRange;
}

// Dashboard Data
export interface DashboardData {
  realTime: RealTimeMetrics;
  trends: TrendMetrics;
  topPages: PageMetric[];
  alerts: Alert[];
}

export interface RealTimeMetrics {
  activeUsers: number;
  todayPageViews: number;
  todayEvents: number;
  todayRevenue: number;
  todayEnrollments: number;
}

export interface TrendMetrics {
  pageViews: {
    today: number;
    week: number;
    month: number;
  };
  events: {
    today: number;
    week: number;
    month: number;
  };
  revenue: {
    today: number;
    week: number;
    month: number;
  };
  enrollments: {
    today: number;
    week: number;
    month: number;
  };
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
}

export enum AlertType {
  METRIC_THRESHOLD = 'metric_threshold',
  SYSTEM_ERROR = 'system_error',
  BUSINESS_ANOMALY = 'business_anomaly'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

// Utility Types
export interface DateRange {
  start: Date;
  end: Date;
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

// Report Export Types
export interface ReportExportRequest {
  reportType: ReportType;
  format: ExportFormat;
  startDate: Date;
  endDate: Date;
  filters?: Record<string, any>;
}

export enum ReportType {
  ENROLLMENT = 'enrollment',
  REVENUE = 'revenue',
  USER_ENGAGEMENT = 'user_engagement',
  RETENTION = 'retention',
  CONVERSION_FUNNEL = 'conversion_funnel',
  CUSTOM = 'custom'
}

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
  PDF = 'pdf'
}

// Report Scheduling Types
export enum ReportFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export interface ReportSchedule {
  id: string;
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  recipients: string[];
  format: ExportFormat;
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdAt: Date;
  updatedAt: Date;
}
