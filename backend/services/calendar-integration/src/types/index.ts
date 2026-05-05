export enum CalendarProvider {
  GOOGLE = 'google',
  OUTLOOK = 'outlook'
}

export enum EventStatus {
  SCHEDULED = 'scheduled',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  RESCHEDULED = 'rescheduled'
}

export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum ReminderType {
  EMAIL = 'email',
  POPUP = 'popup',
  NOTIFICATION = 'notification'
}

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: CalendarProvider;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
  calendarId?: string;
  isActive: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  sessionId?: string;
  enrollmentId?: string;
  provider: CalendarProvider;
  providerEventId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  status: EventStatus;
  meetingUrl?: string;
  attendees?: string[];
  reminders?: EventReminder[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventReminder {
  type: ReminderType;
  minutesBefore: number;
}

export interface LiveSession {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  meetingUrl?: string;
  maxAttendees?: number;
  createdAt: Date;
}

export interface Enrollment {
  id: string;
  userId: string;
  programId: string;
  courseId?: string;
  status: string;
  enrolledAt: Date;
}

export interface SyncLog {
  id: string;
  userId: string;
  provider: CalendarProvider;
  status: SyncStatus;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface CalendarEventRequest {
  sessionId?: string;
  enrollmentId?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  meetingUrl?: string;
  attendees?: string[];
  reminders?: EventReminder[];
}

export interface CalendarEventUpdate {
  title?: string;
  description?: string;
  location?: string;
  startTime?: Date;
  endTime?: Date;
  timezone?: string;
  meetingUrl?: string;
  attendees?: string[];
  reminders?: EventReminder[];
  status?: EventStatus;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope?: string;
}

export interface CalendarPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export interface SyncPreferences {
  userId: string;
  autoSyncEnabled: boolean;
  syncInterval: number; // minutes
  providers: CalendarProvider[];
  syncPastEvents: boolean;
  syncFutureEvents: boolean;
  daysInPast: number;
  daysInFuture: number;
  updatedAt: Date;
}

export interface CalendarAvailability {
  date: Date;
  slots: TimeSlot[];
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
}

export interface BulkEventOperation {
  operation: 'create' | 'update' | 'delete';
  events: CalendarEventRequest[];
}

export interface CalendarStats {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
}

export interface WebhookSubscription {
  id: string;
  userId: string;
  provider: CalendarProvider;
  resourceId: string;
  channelId: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}
