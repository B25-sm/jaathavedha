// Notification Types and Interfaces

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  WHATSAPP = 'whatsapp'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum NotificationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced'
}

export enum NotificationType {
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  ENGAGEMENT = 'engagement',
  SYSTEM = 'system'
}

export interface Notification {
  id?: string;
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  subject?: string;
  content: string;
  templateId?: string;
  templateData?: Record<string, any>;
  metadata?: Record<string, any>;
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id?: string;
  name: string;
  channel: NotificationChannel;
  type: NotificationType;
  subject?: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  userId: string;
  email: {
    transactional: boolean;
    marketing: boolean;
    engagement: boolean;
  };
  push: {
    enabled: boolean;
    quietHours: {
      start: string; // HH:mm format
      end: string;   // HH:mm format
    };
  };
  sms: {
    enabled: boolean;
    emergencyOnly: boolean;
  };
  whatsapp: {
    enabled: boolean;
  };
  updatedAt: Date;
}

export interface EmailNotification {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: EmailAttachment[];
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface PushNotification {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  badge?: number;
  sound?: string;
}

export interface BulkNotification {
  recipients: Array<{
    userId: string;
    email?: string;
    phone?: string;
    pushToken?: string;
    data?: Record<string, any>;
  }>;
  channel: NotificationChannel;
  type: NotificationType;
  subject?: string;
  content?: string;
  templateId?: string;
  scheduledFor?: Date;
}

export interface NotificationEvent {
  eventType: string;
  userId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface NotificationRule {
  id?: string;
  eventType: string;
  channel: NotificationChannel;
  templateId: string;
  conditions?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
}

export interface DeliveryTracking {
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  bounceReason?: string;
  metadata?: Record<string, any>;
}

export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  opened?: number;
  clicked?: number;
  deliveryRate: number;
  openRate?: number;
  clickRate?: number;
}
