// Core Entity Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  STUDENT = 'student',
  INSTRUCTOR = 'instructor',
  ADMIN = 'admin'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export interface Program {
  id: string;
  name: string;
  description: string;
  category: ProgramCategory;
  price: number;
  durationWeeks: number;
  features: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
}

export enum ProgramCategory {
  STARTER = 'starter',
  MEMBERSHIP = 'membership',
  ACCELERATOR = 'accelerator',
  PRO_DEVELOPER = 'pro_developer'
}

export interface Enrollment {
  id: string;
  userId: string;
  programId: string;
  status: EnrollmentStatus;
  progressPercentage: number;
  enrolledAt: Date;
  completedAt?: Date;
}

export enum EnrollmentStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended'
}

export interface Payment {
  id: string;
  userId: string;
  programId: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  gatewayPaymentId?: string;
  status: PaymentStatus;
  paymentMethod?: string;
  createdAt: Date;
  completedAt?: Date;
}

export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  STRIPE = 'stripe'
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category: InquiryCategory;
  status: InquiryStatus;
  createdAt: Date;
  respondedAt?: Date;
}

export enum InquiryCategory {
  GENERAL = 'general',
  ENROLLMENT = 'enrollment',
  TECHNICAL_SUPPORT = 'technical_support',
  BILLING = 'billing'
}

export enum InquiryStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface ApiError {
  type: ErrorType;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId: string;
}

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// Configuration Types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface ServiceConfig {
  port: number;
  environment: 'development' | 'staging' | 'production';
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: {
    secret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  };
}