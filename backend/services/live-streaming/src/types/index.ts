import { Request } from 'express';

// Extend Express Request with user info
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Live Session Types
export interface LiveSession {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  description: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  maxParticipants: number;
  recordingUrl?: string;
  status: SessionStatus;
  settings: SessionSettings;
  createdAt: Date;
  updatedAt: Date;
}

export enum SessionStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
  RECORDING = 'recording'
}

export interface SessionSettings {
  enableChat: boolean;
  enableQA: boolean;
  enablePolls: boolean;
  enableHandRaise: boolean;
  enableScreenShare: boolean;
  enableRecording: boolean;
  autoRecord: boolean;
  chatModeration: boolean;
  requireApproval: boolean;
}

// Participant Types
export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: ParticipantRole;
  joinedAt: Date;
  leftAt?: Date;
  durationSeconds: number;
  engagementScore: number;
  isMuted: boolean;
  isVideoOn: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
}

export enum ParticipantRole {
  INSTRUCTOR = 'instructor',
  CO_HOST = 'co_host',
  STUDENT = 'student',
  GUEST = 'guest'
}

// Chat Types
export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  message: string;
  messageType: ChatMessageType;
  isPinned: boolean;
  isDeleted: boolean;
  timestamp: Date;
}

export enum ChatMessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  POLL = 'poll',
  QA = 'qa',
  ANNOUNCEMENT = 'announcement'
}

// Q&A Types
export interface QAQuestion {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  question: string;
  answer?: string;
  answeredBy?: string;
  answeredAt?: Date;
  upvotes: number;
  upvotedBy: string[];
  isAnswered: boolean;
  isHighlighted: boolean;
  timestamp: Date;
}

// Poll Types
export interface Poll {
  id: string;
  sessionId: string;
  createdBy: string;
  question: string;
  options: PollOption[];
  pollType: PollType;
  isActive: boolean;
  isAnonymous: boolean;
  allowMultiple: boolean;
  totalVotes: number;
  createdAt: Date;
  closedAt?: Date;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

export enum PollType {
  MULTIPLE_CHOICE = 'multiple_choice',
  YES_NO = 'yes_no',
  RATING = 'rating',
  TEXT = 'text'
}

export interface PollVote {
  pollId: string;
  userId: string;
  optionIds: string[];
  timestamp: Date;
}

// Hand Raise Types
export interface HandRaise {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  raisedAt: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  status: HandRaiseStatus;
  queuePosition: number;
}

export enum HandRaiseStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled'
}

// Recording Types
export interface SessionRecording {
  id: string;
  sessionId: string;
  fileName: string;
  fileSize: number;
  duration: number;
  quality: string;
  format: string;
  s3Key: string;
  s3Url: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  status: RecordingStatus;
  startedAt: Date;
  completedAt?: Date;
  processedAt?: Date;
}

export enum RecordingStatus {
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Analytics Types
export interface SessionAnalytics {
  sessionId: string;
  totalParticipants: number;
  peakConcurrentViewers: number;
  averageWatchTime: number;
  totalWatchTime: number;
  chatMessages: number;
  qaQuestions: number;
  pollsCreated: number;
  pollResponses: number;
  handRaises: number;
  engagementRate: number;
  attendanceRate: number;
  dropOffRate: number;
  deviceBreakdown: DeviceBreakdown;
  geographicDistribution: GeographicData[];
  engagementTimeline: EngagementPoint[];
}

export interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
}

export interface GeographicData {
  country: string;
  count: number;
  percentage: number;
}

export interface EngagementPoint {
  timestamp: Date;
  viewers: number;
  chatActivity: number;
  qaActivity: number;
}

// WebRTC Types
export interface WebRTCPeer {
  id: string;
  userId: string;
  sessionId: string;
  transportId: string;
  producerId?: string;
  consumerIds: string[];
  rtpCapabilities: any;
}

export interface MediaServerConfig {
  listenIp: string;
  announcedIp: string;
  minPort: number;
  maxPort: number;
}

// Socket.IO Event Types
export interface SocketEvents {
  // Connection
  'connection': () => void;
  'disconnect': () => void;
  
  // Session
  'join-session': (data: { sessionId: string; userId: string }) => void;
  'leave-session': (data: { sessionId: string; userId: string }) => void;
  
  // Chat
  'chat-message': (message: ChatMessage) => void;
  'chat-deleted': (messageId: string) => void;
  
  // Q&A
  'qa-question': (question: QAQuestion) => void;
  'qa-answer': (data: { questionId: string; answer: string }) => void;
  'qa-upvote': (questionId: string) => void;
  
  // Polls
  'poll-created': (poll: Poll) => void;
  'poll-vote': (vote: PollVote) => void;
  'poll-closed': (pollId: string) => void;
  
  // Hand Raise
  'hand-raise': (data: HandRaise) => void;
  'hand-lower': (userId: string) => void;
  'hand-accept': (userId: string) => void;
  'hand-decline': (userId: string) => void;
  
  // WebRTC
  'webrtc-offer': (data: any) => void;
  'webrtc-answer': (data: any) => void;
  'webrtc-ice-candidate': (data: any) => void;
  
  // Screen Share
  'screen-share-start': () => void;
  'screen-share-stop': () => void;
  
  // Participant
  'participant-joined': (participant: SessionParticipant) => void;
  'participant-left': (userId: string) => void;
  'participant-muted': (userId: string) => void;
  'participant-unmuted': (userId: string) => void;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Notification Types
export interface SessionNotification {
  type: NotificationType;
  sessionId: string;
  userId?: string;
  title: string;
  message: string;
  scheduledFor?: Date;
}

export enum NotificationType {
  SESSION_REMINDER_24H = 'session_reminder_24h',
  SESSION_REMINDER_1H = 'session_reminder_1h',
  SESSION_REMINDER_15M = 'session_reminder_15m',
  SESSION_STARTING = 'session_starting',
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended',
  RECORDING_AVAILABLE = 'recording_available',
  HAND_RAISE_ACCEPTED = 'hand_raise_accepted',
  QA_ANSWERED = 'qa_answered'
}

// Session Attendance Types
export interface SessionAttendance {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: Date;
  leftAt?: Date;
  durationSeconds: number;
  deviceType?: string;
  browser?: string;
  ipAddress?: string;
  locationCountry?: string;
  locationCity?: string;
  engagementScore: number;
  chatMessagesSent: number;
  qaQuestionsAsked: number;
  pollsParticipated: number;
  handRaises: number;
  isPresent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionAttendanceSummary {
  id: string;
  sessionId: string;
  totalRegistered: number;
  totalAttended: number;
  attendanceRate: number;
  peakConcurrentViewers: number;
  averageDurationSeconds: number;
  totalWatchTimeSeconds: number;
  onTimeArrivals: number;
  lateArrivals: number;
  earlyLeavers: number;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  geographicDistribution: GeographicData[];
  createdAt: Date;
  updatedAt: Date;
}

// Session Notification Types
export interface SessionNotificationRecord {
  id: string;
  sessionId: string;
  userId?: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
  scheduledFor: Date;
  sentAt?: Date;
  status: NotificationStatus;
  errorMessage?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  WHATSAPP = 'whatsapp'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SessionNotificationPreferences {
  id: string;
  userId: string;
  reminder24hEnabled: boolean;
  reminder1hEnabled: boolean;
  reminder15mEnabled: boolean;
  sessionStartedEnabled: boolean;
  sessionEndedEnabled: boolean;
  recordingAvailableEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced Session Analytics Types
export interface SessionAnalyticsDetailed extends SessionAnalytics {
  qualityRating?: number;
  totalRatings: number;
  technicalIssuesReported: number;
  qaAnswered: number;
  screenShares: number;
  averageEngagementScore: number;
}

export interface SessionEngagementTimeline {
  id: string;
  sessionId: string;
  timestamp: Date;
  concurrentViewers: number;
  chatActivity: number;
  qaActivity: number;
  pollActivity: number;
  handRaiseActivity: number;
  averageAttentionScore: number;
  createdAt: Date;
}

export interface SessionQualityMetrics {
  id: string;
  sessionId: string;
  userId?: string;
  videoQuality?: string;
  audioQuality?: string;
  connectionQuality?: string;
  bufferingEvents: number;
  disconnections: number;
  averageBitrate?: number;
  packetLossPercentage?: number;
  latencyMs?: number;
  createdAt: Date;
}

// Calendar Integration Types
export interface SessionCalendarReminder {
  id: string;
  sessionId: string;
  userId: string;
  calendarProvider: CalendarProvider;
  calendarEventId?: string;
  reminderMinutesBefore: number[];
  isSynced: boolean;
  syncError?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum CalendarProvider {
  GOOGLE = 'google',
  OUTLOOK = 'outlook',
  APPLE = 'apple'
}

// Recording Metadata Types
export interface SessionRecordingMetadata {
  id: string;
  sessionId: string;
  recordingId?: string;
  fileName: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  format?: string;
  resolution?: string;
  bitrate?: number;
  codec?: string;
  s3Bucket?: string;
  s3Key?: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  transcriptUrl?: string;
  chapters: RecordingChapter[];
  status: RecordingMetadataStatus;
  views: number;
  downloads: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingChapter {
  time: number;
  title: string;
}

export enum RecordingMetadataStatus {
  PROCESSING = 'processing',
  AVAILABLE = 'available',
  FAILED = 'failed'
}

// Session Feedback Types
export interface SessionFeedback {
  id: string;
  sessionId: string;
  userId: string;
  overallRating: number;
  contentQuality: number;
  instructorRating: number;
  technicalQuality: number;
  engagementRating: number;
  wouldRecommend: boolean;
  feedbackText?: string;
  improvementsSuggested?: string;
  favoriteAspects?: string;
  technicalIssues?: string;
  createdAt: Date;
}

// Dashboard Types
export interface SessionDashboardData {
  session: LiveSession;
  analytics: SessionAnalyticsDetailed;
  attendanceSummary: SessionAttendanceSummary;
  engagementTimeline: SessionEngagementTimeline[];
  qualityMetrics: SessionQualityMetrics[];
  recentFeedback: SessionFeedback[];
  topParticipants: SessionAttendance[];
}

export interface InstructorDashboardData {
  upcomingSessions: LiveSession[];
  liveSessions: LiveSession[];
  recentSessions: LiveSession[];
  overallStats: {
    totalSessions: number;
    totalParticipants: number;
    averageAttendanceRate: number;
    averageRating: number;
    totalWatchTime: number;
  };
}
