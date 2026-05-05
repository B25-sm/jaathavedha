export interface AdminSession {
  id: string;
  adminId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: AdminAction;
  resource: string;
  resourceId?: string;
  changes?: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  status: 'success' | 'failure';
  errorMessage?: string;
}

export enum AdminAction {
  // User Management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED = 'USER_STATUS_CHANGED',
  USER_BULK_UPDATE = 'USER_BULK_UPDATE',
  USER_DATA_EXPORTED = 'USER_DATA_EXPORTED',
  
  // Content Management
  CONTENT_CREATED = 'CONTENT_CREATED',
  CONTENT_UPDATED = 'CONTENT_UPDATED',
  CONTENT_DELETED = 'CONTENT_DELETED',
  CONTENT_PUBLISHED = 'CONTENT_PUBLISHED',
  CONTENT_UNPUBLISHED = 'CONTENT_UNPUBLISHED',
  CONTENT_BULK_OPERATION = 'CONTENT_BULK_OPERATION',
  
  // Course Management
  PROGRAM_CREATED = 'PROGRAM_CREATED',
  PROGRAM_UPDATED = 'PROGRAM_UPDATED',
  PROGRAM_DELETED = 'PROGRAM_DELETED',
  COURSE_CREATED = 'COURSE_CREATED',
  COURSE_UPDATED = 'COURSE_UPDATED',
  COURSE_DELETED = 'COURSE_DELETED',
  ENROLLMENT_MODIFIED = 'ENROLLMENT_MODIFIED',
  
  // Payment Management
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  PAYMENT_GATEWAY_CONFIGURED = 'PAYMENT_GATEWAY_CONFIGURED',
  
  // System Management
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_LOGOUT = 'ADMIN_LOGOUT',
  REPORT_GENERATED = 'REPORT_GENERATED',
  DATA_EXPORTED = 'DATA_EXPORTED'
}

export interface UserSearchFilters {
  search?: string;
  role?: string;
  status?: string;
  emailVerified?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface UserBulkOperation {
  userIds: string[];
  operation: 'update_status' | 'update_role' | 'delete' | 'export';
  data?: any;
}

export interface ContentApprovalWorkflow {
  contentId: string;
  contentType: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  comments?: string;
}

export interface PaymentRefundRequest {
  paymentId: string;
  amount: number;
  reason: string;
  adminId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

export interface FinancialReport {
  reportType: 'revenue' | 'refunds' | 'subscriptions' | 'transactions';
  startDate: Date;
  endDate: Date;
  data: any;
  generatedAt: Date;
  generatedBy: string;
}

export interface DashboardMetrics {
  users: {
    total: number;
    active: number;
    new: number;
    byRole: Record<string, number>;
  };
  enrollments: {
    total: number;
    active: number;
    completed: number;
    recent: number;
  };
  revenue: {
    total: number;
    today: number;
    thisMonth: number;
    lastMonth: number;
  };
  content: {
    total: number;
    published: number;
    pending: number;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'down';
    services: Record<string, boolean>;
  };
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  fields?: string[];
  filters?: any;
}

export interface CourseAnalytics {
  courseId: string;
  courseName: string;
  enrollmentCount: number;
  completionRate: number;
  averageProgress: number;
  revenue: number;
  rating?: number;
  activeStudents: number;
}

export interface UserActivityReport {
  userId: string;
  email: string;
  lastLogin: Date;
  totalSessions: number;
  totalPageViews: number;
  enrolledCourses: number;
  completedCourses: number;
  totalSpent: number;
}
