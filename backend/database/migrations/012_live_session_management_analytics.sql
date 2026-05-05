-- Migration 012: Live Session Management and Analytics Schema
-- Extends live session functionality with attendance tracking, notifications, and analytics

-- ==================== SESSION ATTENDANCE TABLES ====================

-- Session attendance tracking
CREATE TABLE IF NOT EXISTS session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP NOT NULL,
  left_at TIMESTAMP,
  duration_seconds INTEGER DEFAULT 0,
  device_type VARCHAR(50), -- desktop, mobile, tablet
  browser VARCHAR(100),
  ip_address INET,
  location_country VARCHAR(100),
  location_city VARCHAR(100),
  engagement_score DECIMAL(5,2) DEFAULT 0, -- 0-100 score
  chat_messages_sent INTEGER DEFAULT 0,
  qa_questions_asked INTEGER DEFAULT 0,
  polls_participated INTEGER DEFAULT 0,
  hand_raises INTEGER DEFAULT 0,
  is_present BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attendance_session ON session_attendance(session_id);
CREATE INDEX idx_attendance_user ON session_attendance(user_id);
CREATE INDEX idx_attendance_joined ON session_attendance(session_id, joined_at);
CREATE INDEX idx_attendance_present ON session_attendance(session_id, is_present);

-- Attendance summary (aggregated per session)
CREATE TABLE IF NOT EXISTS session_attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  total_registered INTEGER DEFAULT 0,
  total_attended INTEGER DEFAULT 0,
  attendance_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  peak_concurrent_viewers INTEGER DEFAULT 0,
  average_duration_seconds INTEGER DEFAULT 0,
  total_watch_time_seconds BIGINT DEFAULT 0,
  on_time_arrivals INTEGER DEFAULT 0, -- joined within 5 min of start
  late_arrivals INTEGER DEFAULT 0,
  early_leavers INTEGER DEFAULT 0, -- left before 80% of session
  device_breakdown JSONB DEFAULT '{"desktop": 0, "mobile": 0, "tablet": 0}',
  geographic_distribution JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attendance_summary_session ON session_attendance_summary(session_id);

-- ==================== SESSION NOTIFICATIONS TABLES ====================

-- Session notification queue
CREATE TABLE IF NOT EXISTS session_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL, -- reminder_24h, reminder_1h, reminder_15m, starting, started, ended, recording_available
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(50) NOT NULL, -- email, push, sms, whatsapp
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, cancelled
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_session ON session_notifications(session_id);
CREATE INDEX idx_notifications_user ON session_notifications(user_id);
CREATE INDEX idx_notifications_scheduled ON session_notifications(scheduled_for);
CREATE INDEX idx_notifications_status ON session_notifications(status);
CREATE INDEX idx_notifications_type ON session_notifications(notification_type);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS session_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  reminder_24h_enabled BOOLEAN DEFAULT true,
  reminder_1h_enabled BOOLEAN DEFAULT true,
  reminder_15m_enabled BOOLEAN DEFAULT true,
  session_started_enabled BOOLEAN DEFAULT true,
  session_ended_enabled BOOLEAN DEFAULT false,
  recording_available_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_user ON session_notification_preferences(user_id);

-- ==================== SESSION ANALYTICS TABLES ====================

-- Real-time session analytics
CREATE TABLE IF NOT EXISTS session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  total_participants INTEGER DEFAULT 0,
  peak_concurrent_viewers INTEGER DEFAULT 0,
  average_watch_time_seconds INTEGER DEFAULT 0,
  total_watch_time_seconds BIGINT DEFAULT 0,
  chat_messages INTEGER DEFAULT 0,
  qa_questions INTEGER DEFAULT 0,
  qa_answered INTEGER DEFAULT 0,
  polls_created INTEGER DEFAULT 0,
  poll_responses INTEGER DEFAULT 0,
  hand_raises INTEGER DEFAULT 0,
  screen_shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  attendance_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  drop_off_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  average_engagement_score DECIMAL(5,2) DEFAULT 0,
  quality_rating DECIMAL(3,2), -- 1-5 stars
  total_ratings INTEGER DEFAULT 0,
  technical_issues_reported INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_session ON session_analytics(session_id);

-- Engagement timeline (time-series data)
CREATE TABLE IF NOT EXISTS session_engagement_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  concurrent_viewers INTEGER DEFAULT 0,
  chat_activity INTEGER DEFAULT 0, -- messages in last minute
  qa_activity INTEGER DEFAULT 0, -- questions in last minute
  poll_activity INTEGER DEFAULT 0, -- votes in last minute
  hand_raise_activity INTEGER DEFAULT 0, -- raises in last minute
  average_attention_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timeline_session ON session_engagement_timeline(session_id);
CREATE INDEX idx_timeline_timestamp ON session_engagement_timeline(session_id, timestamp);

-- Session quality metrics
CREATE TABLE IF NOT EXISTS session_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_quality VARCHAR(50), -- 1080p, 720p, 480p, 240p
  audio_quality VARCHAR(50), -- excellent, good, fair, poor
  connection_quality VARCHAR(50), -- excellent, good, fair, poor
  buffering_events INTEGER DEFAULT 0,
  disconnections INTEGER DEFAULT 0,
  average_bitrate INTEGER, -- kbps
  packet_loss_percentage DECIMAL(5,2),
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_session ON session_quality_metrics(session_id);
CREATE INDEX idx_quality_user ON session_quality_metrics(user_id);

-- ==================== SESSION CALENDAR INTEGRATION ====================

-- Session calendar reminders
CREATE TABLE IF NOT EXISTS session_calendar_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_provider VARCHAR(50) NOT NULL, -- google, outlook, apple
  calendar_event_id VARCHAR(255),
  reminder_minutes_before INTEGER[] DEFAULT '{15, 60, 1440}', -- 15min, 1hr, 24hr
  is_synced BOOLEAN DEFAULT false,
  sync_error TEXT,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_reminders_session ON session_calendar_reminders(session_id);
CREATE INDEX idx_calendar_reminders_user ON session_calendar_reminders(user_id);
CREATE INDEX idx_calendar_reminders_synced ON session_calendar_reminders(is_synced);

-- ==================== SESSION RECORDINGS METADATA ====================

-- Extended recording metadata
CREATE TABLE IF NOT EXISTS session_recording_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  recording_id UUID,
  file_name VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT,
  duration_seconds INTEGER,
  format VARCHAR(50), -- mp4, webm
  resolution VARCHAR(50), -- 1080p, 720p
  bitrate INTEGER, -- kbps
  codec VARCHAR(50),
  s3_bucket VARCHAR(255),
  s3_key VARCHAR(500),
  cdn_url TEXT,
  thumbnail_url TEXT,
  transcript_url TEXT,
  chapters JSONB DEFAULT '[]', -- Array of {time, title}
  status VARCHAR(50) DEFAULT 'processing', -- processing, available, failed
  views INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recording_metadata_session ON session_recording_metadata(session_id);
CREATE INDEX idx_recording_metadata_status ON session_recording_metadata(status);

-- ==================== SESSION FEEDBACK ====================

-- Post-session feedback
CREATE TABLE IF NOT EXISTS session_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  content_quality INTEGER CHECK (content_quality >= 1 AND content_quality <= 5),
  instructor_rating INTEGER CHECK (instructor_rating >= 1 AND instructor_rating <= 5),
  technical_quality INTEGER CHECK (technical_quality >= 1 AND technical_quality <= 5),
  engagement_rating INTEGER CHECK (engagement_rating >= 1 AND engagement_rating <= 5),
  would_recommend BOOLEAN,
  feedback_text TEXT,
  improvements_suggested TEXT,
  favorite_aspects TEXT,
  technical_issues TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX idx_feedback_session ON session_feedback(session_id);
CREATE INDEX idx_feedback_user ON session_feedback(user_id);
CREATE INDEX idx_feedback_rating ON session_feedback(overall_rating);

-- ==================== TRIGGERS ====================

-- Update session_attendance duration on left_at change
CREATE OR REPLACE FUNCTION update_attendance_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.left_at IS NOT NULL AND NEW.joined_at IS NOT NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))::INTEGER;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_attendance_duration
BEFORE UPDATE ON session_attendance
FOR EACH ROW
EXECUTE FUNCTION update_attendance_duration();

-- Update session_attendance_summary updated_at
CREATE OR REPLACE FUNCTION update_attendance_summary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_attendance_summary_timestamp
BEFORE UPDATE ON session_attendance_summary
FOR EACH ROW
EXECUTE FUNCTION update_attendance_summary_timestamp();

-- Update session_analytics updated_at
CREATE OR REPLACE FUNCTION update_analytics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analytics_timestamp
BEFORE UPDATE ON session_analytics
FOR EACH ROW
EXECUTE FUNCTION update_analytics_timestamp();

-- ==================== COMMENTS ====================

COMMENT ON TABLE session_attendance IS 'Tracks individual user attendance and engagement in live sessions';
COMMENT ON TABLE session_attendance_summary IS 'Aggregated attendance statistics per session';
COMMENT ON TABLE session_notifications IS 'Queue for session-related notifications (reminders, updates)';
COMMENT ON TABLE session_notification_preferences IS 'User preferences for session notifications';
COMMENT ON TABLE session_analytics IS 'Comprehensive analytics data for each session';
COMMENT ON TABLE session_engagement_timeline IS 'Time-series engagement data for real-time analytics';
COMMENT ON TABLE session_quality_metrics IS 'Technical quality metrics per user per session';
COMMENT ON TABLE session_calendar_reminders IS 'Calendar integration for session reminders';
COMMENT ON TABLE session_recording_metadata IS 'Extended metadata for session recordings';
COMMENT ON TABLE session_feedback IS 'Post-session feedback and ratings from participants';
