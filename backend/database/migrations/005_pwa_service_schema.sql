-- PWA Service Schema Migration
-- Creates tables for service worker configuration, offline sync, and push notifications

-- Push Subscriptions Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_is_active ON push_subscriptions(is_active);
CREATE INDEX idx_push_subscriptions_platform ON push_subscriptions(platform);

-- Sync Requests Table
CREATE TABLE IF NOT EXISTS sync_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  error_message TEXT,
  completed_at TIMESTAMP
);

CREATE INDEX idx_sync_requests_user_id ON sync_requests(user_id);
CREATE INDEX idx_sync_requests_status ON sync_requests(status);
CREATE INDEX idx_sync_requests_priority ON sync_requests(priority);
CREATE INDEX idx_sync_requests_timestamp ON sync_requests(timestamp);

-- User Progress Table (for offline sync)
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  module_id UUID NOT NULL,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, course_id, module_id)
);

CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_course_id ON user_progress(course_id);
CREATE INDEX idx_user_progress_updated_at ON user_progress(updated_at);

-- Video Analytics Table (for offline sync)
CREATE TABLE IF NOT EXISTS video_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL,
  watch_time INTEGER DEFAULT 0, -- in seconds
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  last_position INTEGER DEFAULT 0, -- in seconds
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

CREATE INDEX idx_video_analytics_user_id ON video_analytics(user_id);
CREATE INDEX idx_video_analytics_video_id ON video_analytics(video_id);
CREATE INDEX idx_video_analytics_updated_at ON video_analytics(updated_at);

-- Video Notes Table (for offline sync)
CREATE TABLE IF NOT EXISTS video_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL,
  timestamp INTEGER NOT NULL, -- video timestamp in seconds
  content TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_video_notes_user_id ON video_notes(user_id);
CREATE INDEX idx_video_notes_video_id ON video_notes(video_id);
CREATE INDEX idx_video_notes_created_at ON video_notes(created_at);

-- Video Bookmarks Table (for offline sync)
CREATE TABLE IF NOT EXISTS video_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL,
  timestamp INTEGER NOT NULL, -- video timestamp in seconds
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_video_bookmarks_user_id ON video_bookmarks(user_id);
CREATE INDEX idx_video_bookmarks_video_id ON video_bookmarks(video_id);
CREATE INDEX idx_video_bookmarks_created_at ON video_bookmarks(created_at);

-- Quiz Responses Table (for offline sync)
CREATE TABLE IF NOT EXISTS quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL,
  question_id UUID NOT NULL,
  answer JSONB NOT NULL,
  is_correct BOOLEAN,
  completed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quiz_responses_user_id ON quiz_responses(user_id);
CREATE INDEX idx_quiz_responses_quiz_id ON quiz_responses(quiz_id);
CREATE INDEX idx_quiz_responses_completed_at ON quiz_responses(completed_at);

-- Offline Data Cache Table
CREATE TABLE IF NOT EXISTS offline_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  last_modified TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(user_id, data_type)
);

CREATE INDEX idx_offline_data_cache_user_id ON offline_data_cache(user_id);
CREATE INDEX idx_offline_data_cache_data_type ON offline_data_cache(data_type);
CREATE INDEX idx_offline_data_cache_expires_at ON offline_data_cache(expires_at);

-- Background Sync Tasks Table
CREATE TABLE IF NOT EXISTS background_sync_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  scheduled_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'executing', 'completed', 'failed')) DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_background_sync_tasks_user_id ON background_sync_tasks(user_id);
CREATE INDEX idx_background_sync_tasks_status ON background_sync_tasks(status);
CREATE INDEX idx_background_sync_tasks_scheduled_at ON background_sync_tasks(scheduled_at);

-- PWA Analytics Events Table
CREATE TABLE IF NOT EXISTS pwa_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  network_status JSONB,
  platform VARCHAR(20),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pwa_analytics_events_user_id ON pwa_analytics_events(user_id);
CREATE INDEX idx_pwa_analytics_events_event_type ON pwa_analytics_events(event_type);
CREATE INDEX idx_pwa_analytics_events_created_at ON pwa_analytics_events(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_analytics_updated_at
  BEFORE UPDATE ON video_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_notes_updated_at
  BEFORE UPDATE ON video_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_bookmarks_updated_at
  BEFORE UPDATE ON video_bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE push_subscriptions IS 'Stores push notification subscriptions for PWA users';
COMMENT ON TABLE sync_requests IS 'Queue for offline data synchronization requests';
COMMENT ON TABLE user_progress IS 'Tracks user progress through courses and modules';
COMMENT ON TABLE video_analytics IS 'Stores video viewing analytics and watch positions';
COMMENT ON TABLE video_notes IS 'User-created notes with video timestamps';
COMMENT ON TABLE video_bookmarks IS 'User bookmarks for important video segments';
COMMENT ON TABLE quiz_responses IS 'Stores user responses to quiz questions';
COMMENT ON TABLE offline_data_cache IS 'Caches data for offline access';
COMMENT ON TABLE background_sync_tasks IS 'Background synchronization tasks queue';
COMMENT ON TABLE pwa_analytics_events IS 'PWA-specific analytics events';
