/**
 * Video Streaming Service Types
 */

export interface Video {
  id: string;
  title: string;
  description?: string;
  course_id: string;
  instructor_id: string;
  original_filename: string;
  file_size: number;
  duration?: number;
  status: VideoStatus;
  processing_progress?: number;
  s3_key: string;
  thumbnail_url?: string;
  preview_url?: string;
  hls_url?: string;
  dash_url?: string;
  quality_levels: QualityLevel[];
  encryption_key?: string;
  watermark_enabled: boolean;
  metadata: VideoMetadata;
  created_at: Date;
  updated_at: Date;
}

export interface VideoMetadata {
  width?: number;
  height?: number;
  bitrate?: number;
  fps?: number;
  codec?: string;
  format?: string;
  chapters?: VideoChapter[];
  tags?: string[];
  language?: string;
}

export interface VideoChapter {
  id: string;
  title: string;
  start_time: number; // seconds
  end_time: number; // seconds
  description?: string;
}

export interface QualityLevel {
  resolution: string; // '240p', '480p', '720p', '1080p'
  bitrate: number;
  file_size: number;
  s3_key: string;
  hls_url?: string;
}

export enum VideoStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  ARCHIVED = 'archived'
}

export interface VideoUploadRequest {
  title: string;
  description?: string;
  course_id: string;
  instructor_id: string;
  chapters?: Omit<VideoChapter, 'id'>[];
  tags?: string[];
  watermark_enabled?: boolean;
}

export interface VideoProcessingJob {
  id: string;
  video_id: string;
  status: ProcessingStatus;
  progress: number;
  current_step: ProcessingStep;
  error_message?: string;
  started_at: Date;
  completed_at?: Date;
}

export enum ProcessingStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum ProcessingStep {
  UPLOAD = 'upload',
  VALIDATION = 'validation',
  TRANSCODING = 'transcoding',
  THUMBNAIL_GENERATION = 'thumbnail_generation',
  HLS_GENERATION = 'hls_generation',
  ENCRYPTION = 'encryption',
  WATERMARKING = 'watermarking',
  FINALIZATION = 'finalization'
}

export interface VideoAnalytics {
  id: string;
  video_id: string;
  user_id: string;
  session_id: string;
  watch_time: number; // seconds
  total_duration: number; // seconds
  completion_percentage: number;
  quality_changes: QualityChange[];
  interactions: VideoInteraction[];
  device_info: DeviceInfo;
  created_at: Date;
}

export interface QualityChange {
  timestamp: number; // seconds into video
  from_quality: string;
  to_quality: string;
  reason: 'auto' | 'manual';
}

export interface VideoInteraction {
  type: InteractionType;
  timestamp: number; // seconds into video
  data?: any;
}

export enum InteractionType {
  PLAY = 'play',
  PAUSE = 'pause',
  SEEK = 'seek',
  SPEED_CHANGE = 'speed_change',
  QUALITY_CHANGE = 'quality_change',
  FULLSCREEN = 'fullscreen',
  NOTE_ADDED = 'note_added',
  BOOKMARK_ADDED = 'bookmark_added',
  QUIZ_ANSWERED = 'quiz_answered'
}

export interface DeviceInfo {
  user_agent: string;
  screen_resolution: string;
  network_type?: string;
  bandwidth?: number; // Mbps
}

export interface VideoNote {
  id: string;
  video_id: string;
  user_id: string;
  timestamp: number; // seconds
  content: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface VideoBookmark {
  id: string;
  video_id: string;
  user_id: string;
  timestamp: number; // seconds
  title: string;
  description?: string;
  created_at: Date;
}

export interface VideoProgress {
  id: string;
  video_id: string;
  user_id: string;
  last_position: number; // seconds
  completion_percentage: number;
  total_watch_time: number; // seconds
  is_completed: boolean;
  completed_at?: Date;
  updated_at: Date;
}

export interface StreamingSession {
  id: string;
  video_id: string;
  user_id: string;
  session_token: string;
  expires_at: Date;
  ip_address: string;
  user_agent: string;
  domain: string;
  created_at: Date;
}

export interface VideoFilters {
  course_id?: string;
  instructor_id?: string;
  status?: VideoStatus;
  search?: string;
  tags?: string[];
  date_from?: Date;
  date_to?: Date;
}

export interface VideoStats {
  total_videos: number;
  total_duration: number; // seconds
  total_size: number; // bytes
  videos_by_status: { status: VideoStatus; count: number }[];
  videos_by_quality: { resolution: string; count: number }[];
  storage_usage: {
    original: number;
    transcoded: number;
    thumbnails: number;
    total: number;
  };
  processing_stats: {
    average_processing_time: number; // seconds
    success_rate: number; // percentage
    failed_jobs: number;
  };
}

export interface UploadPresignedUrl {
  upload_url: string;
  video_id: string;
  expires_at: Date;
  max_file_size: number;
  allowed_types: string[];
}

export interface VideoPlayerConfig {
  video_id: string;
  hls_url: string;
  dash_url?: string;
  thumbnail_url: string;
  duration: number;
  quality_levels: QualityLevel[];
  captions?: VideoCaption[];
  chapters?: VideoChapter[];
  watermark?: WatermarkConfig;
  analytics_endpoint: string;
  domain_restrictions: string[];
}

export interface VideoCaption {
  id: string;
  language: string;
  label: string;
  url: string;
  is_default: boolean;
}

export interface WatermarkConfig {
  enabled: boolean;
  text?: string;
  image_url?: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number;
}

export interface BulkUploadRequest {
  videos: VideoUploadRequest[];
  course_id: string;
  instructor_id: string;
  processing_priority?: 'low' | 'normal' | 'high';
}

export interface BulkUploadResponse {
  upload_urls: UploadPresignedUrl[];
  batch_id: string;
  total_videos: number;
  estimated_processing_time: number; // minutes
}

export interface VideoSearchResult {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  duration?: number;
  course_name: string;
  instructor_name: string;
  relevance_score: number;
  created_at: Date;
}

export interface VideoRecommendation {
  video: VideoSearchResult;
  reason: RecommendationReason;
  confidence_score: number;
}

export enum RecommendationReason {
  SIMILAR_CONTENT = 'similar_content',
  SAME_INSTRUCTOR = 'same_instructor',
  SAME_COURSE = 'same_course',
  POPULAR_IN_CATEGORY = 'popular_in_category',
  RECENTLY_VIEWED = 'recently_viewed',
  COMPLETION_BASED = 'completion_based'
}

export interface LiveStreamConfig {
  id: string;
  title: string;
  description?: string;
  instructor_id: string;
  course_id?: string;
  scheduled_start: Date;
  scheduled_end: Date;
  max_viewers: number;
  is_recording_enabled: boolean;
  chat_enabled: boolean;
  q_and_a_enabled: boolean;
  stream_key: string;
  rtmp_url: string;
  hls_playback_url?: string;
  status: LiveStreamStatus;
  created_at: Date;
}

export enum LiveStreamStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  ENDED = 'ended',
  CANCELLED = 'cancelled'
}

export interface LiveStreamViewer {
  id: string;
  stream_id: string;
  user_id: string;
  joined_at: Date;
  left_at?: Date;
  total_watch_time: number; // seconds
  interactions: number;
}

export interface LiveStreamAnalytics {
  stream_id: string;
  peak_viewers: number;
  total_unique_viewers: number;
  average_watch_time: number; // seconds
  total_interactions: number;
  viewer_retention: { timestamp: number; viewers: number }[];
  engagement_rate: number; // percentage
}