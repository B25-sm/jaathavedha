-- Migration 014: Mobile Learning Features Schema
-- Video player gestures, voice notes, camera assignments, and social learning

-- ==================== Video Player Tables ====================

-- Video player gestures tracking
CREATE TABLE IF NOT EXISTS video_player_gestures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL,
  gesture_type VARCHAR(50) NOT NULL, -- swipe_up, swipe_down, swipe_left, swipe_right, double_tap, pinch, long_press
  action VARCHAR(50) NOT NULL, -- volume_up, volume_down, seek_forward, seek_backward, play_pause, zoom, speed_control
  position INTEGER NOT NULL, -- Video position in seconds
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_video_gestures_user (user_id),
  INDEX idx_video_gestures_video (video_id),
  INDEX idx_video_gestures_timestamp (timestamp)
);

-- Video player state for resume playback
CREATE TABLE IF NOT EXISTS video_player_states (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  playback_speed DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  volume DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  quality VARCHAR(20) NOT NULL DEFAULT 'auto',
  is_playing BOOLEAN NOT NULL DEFAULT false,
  is_fullscreen BOOLEAN NOT NULL DEFAULT false,
  brightness DECIMAL(3,2),
  last_gesture VARCHAR(50),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, video_id, device_id),
  INDEX idx_player_states_user (user_id),
  INDEX idx_player_states_video (video_id),
  INDEX idx_player_states_updated (updated_at)
);

-- Gesture control settings per device
CREATE TABLE IF NOT EXISTS gesture_control_settings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  swipe_enabled BOOLEAN NOT NULL DEFAULT true,
  double_tap_enabled BOOLEAN NOT NULL DEFAULT true,
  volume_gesture_enabled BOOLEAN NOT NULL DEFAULT true,
  brightness_gesture_enabled BOOLEAN NOT NULL DEFAULT true,
  seek_gesture_sensitivity VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high
  custom_gestures JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, device_id)
);

-- ==================== Voice Notes Tables ====================

-- Voice notes with transcription
CREATE TABLE IF NOT EXISTS voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  video_id UUID,
  video_position INTEGER, -- Position in video when note was taken
  audio_url TEXT NOT NULL,
  transcription TEXT,
  transcription_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  duration INTEGER NOT NULL DEFAULT 0,
  confidence DECIMAL(4,3), -- Transcription confidence score
  device_id VARCHAR(255) NOT NULL,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced', -- local, synced, conflict
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_voice_notes_user (user_id),
  INDEX idx_voice_notes_course (course_id),
  INDEX idx_voice_notes_lesson (lesson_id),
  INDEX idx_voice_notes_video (video_id),
  INDEX idx_voice_notes_status (transcription_status),
  INDEX idx_voice_notes_created (created_at)
);

-- Text notes (including mixed text+voice)
CREATE TABLE IF NOT EXISTS text_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  video_id UUID,
  video_position INTEGER,
  content TEXT NOT NULL,
  note_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, voice, mixed
  tags JSONB DEFAULT '[]',
  is_bookmarked BOOLEAN NOT NULL DEFAULT false,
  device_id VARCHAR(255) NOT NULL,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_text_notes_user (user_id),
  INDEX idx_text_notes_course (course_id),
  INDEX idx_text_notes_lesson (lesson_id),
  INDEX idx_text_notes_video (video_id),
  INDEX idx_text_notes_bookmarked (is_bookmarked),
  INDEX idx_text_notes_created (created_at)
);

-- Full-text search index for notes
CREATE INDEX IF NOT EXISTS idx_text_notes_content_search ON text_notes USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_voice_notes_transcription_search ON voice_notes USING gin(to_tsvector('english', transcription));

-- ==================== Camera Assignment Tables ====================

-- Assignment submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL,
  course_id UUID NOT NULL,
  submission_type VARCHAR(20) NOT NULL, -- camera, gallery, document, text, mixed
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, submitted, graded, returned
  text_content TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  graded_at TIMESTAMP WITH TIME ZONE,
  grade DECIMAL(5,2),
  feedback TEXT,
  device_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_submissions_user (user_id),
  INDEX idx_submissions_assignment (assignment_id),
  INDEX idx_submissions_course (course_id),
  INDEX idx_submissions_status (status),
  INDEX idx_submissions_submitted (submitted_at)
);

-- Camera captures for assignments
CREATE TABLE IF NOT EXISTS camera_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL,
  capture_type VARCHAR(20) NOT NULL, -- photo, video, scan
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- For videos
  metadata JSONB DEFAULT '{}',
  processing_status VARCHAR(20) NOT NULL DEFAULT 'completed', -- pending, processing, completed, failed
  ocr_text TEXT, -- For scanned documents
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_captures_submission (submission_id),
  INDEX idx_captures_user (user_id),
  INDEX idx_captures_assignment (assignment_id),
  INDEX idx_captures_type (capture_type),
  INDEX idx_captures_status (processing_status)
);

-- ==================== Social Learning Tables ====================

-- Study groups
CREATE TABLE IF NOT EXISTS study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  course_id UUID NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_members INTEGER NOT NULL DEFAULT 50,
  is_private BOOLEAN NOT NULL DEFAULT false,
  invite_code VARCHAR(20),
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_study_groups_course (course_id),
  INDEX idx_study_groups_creator (creator_id),
  INDEX idx_study_groups_private (is_private),
  INDEX idx_study_groups_activity (last_activity_at)
);

-- Study group members
CREATE TABLE IF NOT EXISTS study_group_members (
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- creator, admin, member
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  
  PRIMARY KEY (group_id, user_id),
  INDEX idx_group_members_user (user_id),
  INDEX idx_group_members_role (role),
  INDEX idx_group_members_active (last_active_at)
);

-- Peer chat messages
CREATE TABLE IF NOT EXISTS peer_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, voice, image, video, file, link
  content TEXT NOT NULL,
  attachment_url TEXT,
  reply_to_id UUID REFERENCES peer_chats(id) ON DELETE SET NULL,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  read_by UUID[] DEFAULT '{}',
  reactions JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_peer_chats_group (group_id),
  INDEX idx_peer_chats_sender (sender_id),
  INDEX idx_peer_chats_recipient (recipient_id),
  INDEX idx_peer_chats_created (created_at),
  INDEX idx_peer_chats_deleted (is_deleted)
);

-- Peer interactions tracking
CREATE TABLE IF NOT EXISTS peer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL, -- message, help_request, study_session, resource_share, collaboration
  course_id UUID,
  lesson_id UUID,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_peer_interactions_user (user_id),
  INDEX idx_peer_interactions_peer (peer_id),
  INDEX idx_peer_interactions_type (interaction_type),
  INDEX idx_peer_interactions_timestamp (timestamp)
);

-- Study sessions
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  course_id UUID NOT NULL,
  lesson_id UUID,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- Duration in minutes
  participant_ids JSONB DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
  meeting_url TEXT,
  recording_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_study_sessions_group (group_id),
  INDEX idx_study_sessions_host (host_id),
  INDEX idx_study_sessions_course (course_id),
  INDEX idx_study_sessions_scheduled (scheduled_at),
  INDEX idx_study_sessions_status (status)
);

-- Peer help requests
CREATE TABLE IF NOT EXISTS peer_help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  lesson_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  tags JSONB DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, in_progress, resolved, closed
  priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high
  helper_id UUID REFERENCES users(id) ON DELETE SET NULL,
  responses JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  INDEX idx_help_requests_user (user_id),
  INDEX idx_help_requests_course (course_id),
  INDEX idx_help_requests_status (status),
  INDEX idx_help_requests_priority (priority),
  INDEX idx_help_requests_created (created_at)
);

-- Resource sharing
CREATE TABLE IF NOT EXISTS resource_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  lesson_id UUID,
  resource_type VARCHAR(20) NOT NULL, -- note, link, file, video, article
  title VARCHAR(255) NOT NULL,
  description TEXT,
  resource_url TEXT,
  file_url TEXT,
  tags JSONB DEFAULT '[]',
  likes INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  comments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_resource_shares_user (user_id),
  INDEX idx_resource_shares_group (group_id),
  INDEX idx_resource_shares_course (course_id),
  INDEX idx_resource_shares_type (resource_type),
  INDEX idx_resource_shares_created (created_at)
);

-- Collaborative notes
CREATE TABLE IF NOT EXISTS collaborative_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  lesson_id UUID,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  contributors JSONB DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_collab_notes_group (group_id),
  INDEX idx_collab_notes_course (course_id),
  INDEX idx_collab_notes_locked (is_locked),
  INDEX idx_collab_notes_updated (updated_at)
);

-- Social learning activity tracking
CREATE TABLE IF NOT EXISTS social_learning_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- group_join, message_sent, help_given, resource_shared, session_attended, note_collaborated
  entity_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_social_activities_user (user_id),
  INDEX idx_social_activities_type (activity_type),
  INDEX idx_social_activities_timestamp (timestamp)
);

-- ==================== Comments ====================

COMMENT ON TABLE video_player_gestures IS 'Tracks video player gesture interactions for analytics';
COMMENT ON TABLE video_player_states IS 'Stores video player state for resume playback across devices';
COMMENT ON TABLE gesture_control_settings IS 'User preferences for gesture controls per device';
COMMENT ON TABLE voice_notes IS 'Voice notes with automatic transcription';
COMMENT ON TABLE text_notes IS 'Text notes with optional video timestamps';
COMMENT ON TABLE assignment_submissions IS 'Student assignment submissions';
COMMENT ON TABLE camera_captures IS 'Photos/videos captured via mobile camera for assignments';
COMMENT ON TABLE study_groups IS 'Student study groups for collaborative learning';
COMMENT ON TABLE study_group_members IS 'Study group membership and roles';
COMMENT ON TABLE peer_chats IS 'Peer-to-peer and group chat messages';
COMMENT ON TABLE peer_interactions IS 'Tracks peer interactions for recommendations';
COMMENT ON TABLE study_sessions IS 'Scheduled study sessions';
COMMENT ON TABLE peer_help_requests IS 'Student help requests for peer assistance';
COMMENT ON TABLE resource_shares IS 'Shared learning resources';
COMMENT ON TABLE collaborative_notes IS 'Collaborative notes within study groups';
COMMENT ON TABLE social_learning_activities IS 'Tracks social learning activities for gamification';
