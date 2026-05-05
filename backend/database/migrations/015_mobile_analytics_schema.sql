-- Migration 015: Mobile Analytics and Progress Tracking Schema
-- Mobile learning sessions, progress sync, engagement tracking, and habit reminders

-- ==================== Learning Session Tables ====================

-- Mobile learning sessions
CREATE TABLE IF NOT EXISTS mobile_learning_sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- Duration in seconds
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, completed, abandoned
  courses_accessed TEXT[] DEFAULT '{}',
  videos_watched TEXT[] DEFAULT '{}',
  notes_created INTEGER DEFAULT 0,
  assignments_completed INTEGER DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_mobile_sessions_user (user_id),
  INDEX idx_mobile_sessions_device (device_id),
  INDEX idx_mobile_sessions_start (start_time),
  INDEX idx_mobile_sessions_status (status)
);

-- ==================== Progress Synchronization Tables ====================

-- Mobile progress synchronization
CREATE TABLE IF NOT EXISTS mobile_progress_sync (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  lesson_id UUID,
  video_id UUID,
  progress INTEGER NOT NULL DEFAULT 0, -- Progress percentage 0-100
  last_position INTEGER, -- Last video position in seconds
  completed_at TIMESTAMP WITH TIME ZONE,
  device_id VARCHAR(255) NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, course_id, COALESCE(lesson_id, '00000000-0000-0000-0000-000000000000'), COALESCE(video_id, '00000000-0000-0000-0000-000000000000')),
  INDEX idx_progress_sync_user (user_id),
  INDEX idx_progress_sync_course (course_id),
  INDEX idx_progress_sync_lesson (lesson_id),
  INDEX idx_progress_sync_video (video_id),
  INDEX idx_progress_sync_synced (synced_at)
);

-- Progress sync conflicts (for conflict resolution)
CREATE TABLE IF NOT EXISTS mobile_progress_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  lesson_id UUID,
  video_id UUID,
  device1_id VARCHAR(255) NOT NULL,
  device1_progress INTEGER NOT NULL,
  device1_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
  device2_id VARCHAR(255) NOT NULL,
  device2_progress INTEGER NOT NULL,
  device2_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolution_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, resolved, ignored
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(20), -- user, auto
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_progress_conflicts_user (user_id),
  INDEX idx_progress_conflicts_status (resolution_status)
);

-- ==================== Engagement Tracking Tables ====================

-- Mobile engagement events
CREATE TABLE IF NOT EXISTS mobile_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  engagement_type VARCHAR(50) NOT NULL, -- session_start, session_end, video_watch, note_create, assignment_submit, social_interaction, etc.
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_engagement_events_user (user_id),
  INDEX idx_engagement_events_type (engagement_type),
  INDEX idx_engagement_events_timestamp (timestamp)
);

-- Mobile engagement metrics (aggregated)
CREATE TABLE IF NOT EXISTS mobile_engagement_metrics (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_active_streak INTEGER NOT NULL DEFAULT 0,
  weekly_active_streak INTEGER NOT NULL DEFAULT 0,
  total_learning_time INTEGER NOT NULL DEFAULT 0, -- Total seconds
  average_session_duration INTEGER NOT NULL DEFAULT 0, -- Average seconds
  courses_in_progress INTEGER NOT NULL DEFAULT 0,
  courses_completed INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0, -- 0-100
  last_active_date TIMESTAMP WITH TIME ZONE,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_engagement_metrics_score (engagement_score),
  INDEX idx_engagement_metrics_streak (daily_active_streak),
  INDEX idx_engagement_metrics_last_active (last_active_date)
);

-- ==================== Learning Habit Tables ====================

-- Mobile learning reminders
CREATE TABLE IF NOT EXISTS mobile_learning_reminders (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency VARCHAR(20) NOT NULL DEFAULT 'daily', -- daily, weekdays, custom
  reminder_time TIME NOT NULL DEFAULT '18:00:00',
  reminder_days TEXT[] DEFAULT '{Monday,Tuesday,Wednesday,Thursday,Friday}',
  timezone VARCHAR(50) DEFAULT 'UTC',
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Learning habit analytics
CREATE TABLE IF NOT EXISTS mobile_learning_habits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_learning_time TIME, -- Most common learning time
  average_sessions_per_day DECIMAL(4,2) DEFAULT 0,
  preferred_duration INTEGER DEFAULT 0, -- Preferred session duration in seconds
  most_active_day VARCHAR(20), -- Monday, Tuesday, etc.
  consistency_score INTEGER DEFAULT 0, -- 0-100
  last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_learning_habits_consistency (consistency_score)
);

-- ==================== Mobile Device Tracking ====================

-- Mobile devices
CREATE TABLE IF NOT EXISTS mobile_devices (
  device_id VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255),
  device_type VARCHAR(50), -- ios, android, tablet, etc.
  os_version VARCHAR(50),
  app_version VARCHAR(50),
  push_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_mobile_devices_user (user_id),
  INDEX idx_mobile_devices_active (is_active),
  INDEX idx_mobile_devices_last_active (last_active_at)
);

-- ==================== Mobile Analytics Aggregations ====================

-- Daily mobile analytics summary
CREATE TABLE IF NOT EXISTS mobile_daily_analytics (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 0,
  total_duration INTEGER NOT NULL DEFAULT 0, -- Total seconds
  videos_watched INTEGER NOT NULL DEFAULT 0,
  notes_created INTEGER NOT NULL DEFAULT 0,
  assignments_completed INTEGER NOT NULL DEFAULT 0,
  social_interactions INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, date),
  INDEX idx_daily_analytics_date (date),
  INDEX idx_daily_analytics_engagement (engagement_score)
);

-- Weekly mobile analytics summary
CREATE TABLE IF NOT EXISTS mobile_weekly_analytics (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_duration INTEGER NOT NULL DEFAULT 0,
  average_daily_duration INTEGER NOT NULL DEFAULT 0,
  courses_accessed INTEGER NOT NULL DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, week_start),
  INDEX idx_weekly_analytics_week (week_start)
);

-- ==================== Mobile Optimization Tables ====================

-- Mobile performance metrics
CREATE TABLE IF NOT EXISTS mobile_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- api_latency, video_load_time, sync_duration, etc.
  metric_value DECIMAL(10,2) NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_performance_metrics_user (user_id),
  INDEX idx_performance_metrics_device (device_id),
  INDEX idx_performance_metrics_type (metric_type),
  INDEX idx_performance_metrics_timestamp (timestamp)
);

-- Mobile feature usage
CREATE TABLE IF NOT EXISTS mobile_feature_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_name VARCHAR(100) NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  first_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, feature_name),
  INDEX idx_feature_usage_feature (feature_name),
  INDEX idx_feature_usage_count (usage_count)
);

-- ==================== Triggers for Auto-Updates ====================

-- Update engagement metrics on session completion
CREATE OR REPLACE FUNCTION update_engagement_metrics_on_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO mobile_engagement_metrics (user_id, total_learning_time, last_active_date)
    VALUES (NEW.user_id, COALESCE(NEW.duration, 0), NEW.end_time)
    ON CONFLICT (user_id)
    DO UPDATE SET
      total_learning_time = mobile_engagement_metrics.total_learning_time + COALESCE(NEW.duration, 0),
      last_active_date = NEW.end_time,
      last_calculated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_engagement_metrics
AFTER UPDATE ON mobile_learning_sessions
FOR EACH ROW
EXECUTE FUNCTION update_engagement_metrics_on_session();

-- Update daily analytics on engagement event
CREATE OR REPLACE FUNCTION update_daily_analytics_on_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO mobile_daily_analytics (user_id, date, session_count)
  VALUES (NEW.user_id, DATE(NEW.timestamp), 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    session_count = mobile_daily_analytics.session_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_analytics
AFTER INSERT ON mobile_engagement_events
FOR EACH ROW
WHEN (NEW.engagement_type = 'session_start')
EXECUTE FUNCTION update_daily_analytics_on_event();

-- ==================== Views for Analytics ====================

-- Active learners view
CREATE OR REPLACE VIEW mobile_active_learners AS
SELECT 
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,
  mem.daily_active_streak,
  mem.engagement_score,
  mem.last_active_date,
  COUNT(DISTINCT mls.id) as total_sessions,
  SUM(mls.duration) as total_learning_time
FROM users u
LEFT JOIN mobile_engagement_metrics mem ON u.id = mem.user_id
LEFT JOIN mobile_learning_sessions mls ON u.id = mls.user_id AND mls.status = 'completed'
WHERE mem.last_active_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.id, u.email, u.first_name, u.last_name, mem.daily_active_streak, mem.engagement_score, mem.last_active_date;

-- Course progress overview
CREATE OR REPLACE VIEW mobile_course_progress_overview AS
SELECT 
  mps.user_id,
  mps.course_id,
  MAX(mps.progress) as current_progress,
  COUNT(DISTINCT mps.lesson_id) as lessons_accessed,
  COUNT(DISTINCT mps.video_id) as videos_watched,
  MAX(mps.synced_at) as last_synced,
  COUNT(DISTINCT mps.device_id) as devices_used
FROM mobile_progress_sync mps
GROUP BY mps.user_id, mps.course_id;

-- ==================== Comments ====================

COMMENT ON TABLE mobile_learning_sessions IS 'Tracks mobile learning sessions with detailed activity metrics';
COMMENT ON TABLE mobile_progress_sync IS 'Synchronizes learning progress across multiple devices';
COMMENT ON TABLE mobile_progress_conflicts IS 'Tracks and resolves progress synchronization conflicts';
COMMENT ON TABLE mobile_engagement_events IS 'Records all mobile engagement events for analytics';
COMMENT ON TABLE mobile_engagement_metrics IS 'Aggregated engagement metrics per user';
COMMENT ON TABLE mobile_learning_reminders IS 'User preferences for learning reminders';
COMMENT ON TABLE mobile_learning_habits IS 'Analyzed learning habits and patterns';
COMMENT ON TABLE mobile_devices IS 'Registered mobile devices per user';
COMMENT ON TABLE mobile_daily_analytics IS 'Daily aggregated analytics per user';
COMMENT ON TABLE mobile_weekly_analytics IS 'Weekly aggregated analytics per user';
COMMENT ON TABLE mobile_performance_metrics IS 'Mobile app performance metrics';
COMMENT ON TABLE mobile_feature_usage IS 'Tracks usage of mobile features';

