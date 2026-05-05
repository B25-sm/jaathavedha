/**
 * Mobile Learning Features Types
 * TypeScript interfaces for mobile-specific learning features
 */

// Video Player Types
export interface VideoPlayerGesture {
  id: string;
  userId: string;
  videoId: string;
  gestureType: 'swipe_up' | 'swipe_down' | 'swipe_left' | 'swipe_right' | 'double_tap' | 'pinch' | 'long_press';
  action: 'volume_up' | 'volume_down' | 'seek_forward' | 'seek_backward' | 'play_pause' | 'zoom' | 'speed_control';
  timestamp: Date;
  position: number; // Video position in seconds
  metadata?: Record<string, any>;
}

export interface VideoPlayerState {
  userId: string;
  videoId: string;
  deviceId: string;
  position: number;
  duration: number;
  playbackSpeed: number;
  volume: number;
  quality: string;
  isPlaying: boolean;
  isFullscreen: boolean;
  brightness?: number;
  lastGesture?: string;
  updatedAt: Date;
}

export interface GestureControlSettings {
  userId: string;
  deviceId: string;
  swipeEnabled: boolean;
  doubleTapEnabled: boolean;
  volumeGestureEnabled: boolean;
  brightnessGestureEnabled: boolean;
  seekGestureSensitivity: 'low' | 'medium' | 'high';
  customGestures?: Array<{
    gesture: string;
    action: string;
  }>;
}

// Voice-to-Text Note Types
export interface VoiceNote {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  videoId?: string;
  videoPosition?: number;
  audioUrl: string;
  transcription?: string;
  transcriptionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  language: string;
  duration: number;
  confidence?: number;
  createdAt: Date;
  updatedAt: Date;
  deviceId: string;
  syncStatus: 'local' | 'synced' | 'conflict';
}

export interface VoiceTranscriptionRequest {
  audioData: string; // Base64 encoded audio
  audioFormat: 'wav' | 'mp3' | 'ogg' | 'webm';
  language: string;
  videoId?: string;
  videoPosition?: number;
  courseId: string;
  lessonId: string;
}

export interface VoiceTranscriptionResponse {
  transcription: string;
  confidence: number;
  language: string;
  duration: number;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
  noteId: string;
}

export interface TextNote {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  videoId?: string;
  videoPosition?: number;
  content: string;
  noteType: 'text' | 'voice' | 'mixed';
  tags?: string[];
  isBookmarked: boolean;
  createdAt: Date;
  updatedAt: Date;
  deviceId: string;
  syncStatus: 'local' | 'synced' | 'conflict';
}

// Camera Assignment Submission Types
export interface AssignmentSubmission {
  id: string;
  userId: string;
  assignmentId: string;
  courseId: string;
  submissionType: 'camera' | 'gallery' | 'document' | 'text' | 'mixed';
  status: 'draft' | 'submitted' | 'graded' | 'returned';
  submittedAt?: Date;
  gradedAt?: Date;
  grade?: number;
  feedback?: string;
  deviceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CameraCapture {
  id: string;
  submissionId: string;
  userId: string;
  captureType: 'photo' | 'video' | 'scan';
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  metadata?: {
    deviceModel?: string;
    location?: string;
    timestamp: Date;
    orientation?: string;
  };
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  ocrText?: string; // For scanned documents
  createdAt: Date;
}

export interface CameraUploadRequest {
  assignmentId: string;
  courseId: string;
  captureType: 'photo' | 'video' | 'scan';
  fileData: string; // Base64 encoded
  fileName: string;
  mimeType: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    location?: string;
  };
}

export interface AssignmentSubmissionRequest {
  assignmentId: string;
  courseId: string;
  submissionType: 'camera' | 'gallery' | 'document' | 'text' | 'mixed';
  captureIds?: string[];
  textContent?: string;
  attachments?: string[];
}

// Social Learning Types
export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  courseId: string;
  creatorId: string;
  memberIds: string[];
  maxMembers: number;
  isPrivate: boolean;
  inviteCode?: string;
  tags?: string[];
  activityLevel: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface StudyGroupMember {
  groupId: string;
  userId: string;
  role: 'creator' | 'admin' | 'member';
  joinedAt: Date;
  lastActiveAt: Date;
  contributionScore: number;
  isMuted: boolean;
}

export interface PeerChat {
  id: string;
  groupId?: string;
  senderId: string;
  recipientId?: string;
  messageType: 'text' | 'voice' | 'image' | 'video' | 'file' | 'link';
  content: string;
  attachmentUrl?: string;
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  readBy: string[];
  reactions?: Array<{
    userId: string;
    emoji: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PeerInteraction {
  id: string;
  userId: string;
  peerId: string;
  interactionType: 'message' | 'help_request' | 'study_session' | 'resource_share' | 'collaboration';
  courseId?: string;
  lessonId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface StudySession {
  id: string;
  groupId?: string;
  hostId: string;
  title: string;
  description?: string;
  courseId: string;
  lessonId?: string;
  scheduledAt: Date;
  duration: number;
  participantIds: string[];
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  meetingUrl?: string;
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PeerHelpRequest {
  id: string;
  userId: string;
  courseId: string;
  lessonId?: string;
  title: string;
  description: string;
  tags?: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  helperId?: string;
  responses: Array<{
    userId: string;
    content: string;
    isHelpful: boolean;
    votes: number;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface ResourceShare {
  id: string;
  userId: string;
  groupId?: string;
  courseId: string;
  lessonId?: string;
  resourceType: 'note' | 'link' | 'file' | 'video' | 'article';
  title: string;
  description?: string;
  resourceUrl?: string;
  fileUrl?: string;
  tags?: string[];
  likes: number;
  views: number;
  comments: Array<{
    userId: string;
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborativeNote {
  id: string;
  groupId: string;
  courseId: string;
  lessonId?: string;
  title: string;
  content: string;
  contributors: Array<{
    userId: string;
    contributionCount: number;
    lastEditAt: Date;
  }>;
  version: number;
  isLocked: boolean;
  lockedBy?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLearningActivity {
  id: string;
  userId: string;
  activityType: 'group_join' | 'message_sent' | 'help_given' | 'resource_shared' | 'session_attended' | 'note_collaborated';
  entityId: string;
  entityType: string;
  points: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PeerRecommendation {
  userId: string;
  recommendedPeerId: string;
  reason: 'similar_progress' | 'same_course' | 'complementary_skills' | 'active_helper' | 'study_buddy';
  score: number;
  commonCourses: string[];
  metadata?: Record<string, any>;
}

// Request/Response Types
export interface CreateStudyGroupRequest {
  name: string;
  description: string;
  courseId: string;
  maxMembers?: number;
  isPrivate?: boolean;
  tags?: string[];
}

export interface JoinStudyGroupRequest {
  groupId: string;
  inviteCode?: string;
}

export interface SendChatMessageRequest {
  groupId?: string;
  recipientId?: string;
  messageType: 'text' | 'voice' | 'image' | 'video' | 'file' | 'link';
  content: string;
  attachmentUrl?: string;
  replyToId?: string;
}

export interface CreateHelpRequestRequest {
  courseId: string;
  lessonId?: string;
  title: string;
  description: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
}

export interface ShareResourceRequest {
  groupId?: string;
  courseId: string;
  lessonId?: string;
  resourceType: 'note' | 'link' | 'file' | 'video' | 'article';
  title: string;
  description?: string;
  resourceUrl?: string;
  fileData?: string;
  tags?: string[];
}

export interface ScheduleStudySessionRequest {
  groupId?: string;
  title: string;
  description?: string;
  courseId: string;
  lessonId?: string;
  scheduledAt: Date;
  duration: number;
  participantIds?: string[];
}

// Analytics Types
export interface MobileLearningMetrics {
  userId: string;
  deviceId: string;
  period: 'day' | 'week' | 'month';
  videoWatchTime: number;
  gestureInteractions: number;
  voiceNotesCreated: number;
  assignmentsSubmitted: number;
  socialInteractions: number;
  studyGroupsJoined: number;
  helpRequestsCreated: number;
  helpRequestsAnswered: number;
  resourcesShared: number;
  peerMessagesExchanged: number;
  studySessionsAttended: number;
  engagementScore: number;
  timestamp: Date;
}
