-- Migration: Mobile API Schema
-- Description: Database schema for mobile-optimized API, offline sync, downloads, and push notifications
-- Requirements: 20.1, 20.2, 20.3, 20.9

-- User Devices Table
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  device_name VARCHAR(255),
  os_version VARCHAR(50),
  app_version VARCHAR(50),
  fcm_token TEXT,
  apns_token TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_device_id ON user_devices(device_id);
CREATE INDEX idx_user_devices_active ON user_devices(is_active) WHERE is_active = true;

-- Offline Content Table
CREATE TABLE IF NOT EXISTS offline_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('video', 'document', 'quiz', 'assignment')),
  content_id UUID NOT NULL,
  course_id UUID NOT NULL,
  downloaded_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  file_size BIGINT NOT NULL,
  quality VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'downloading' CHECK (status IN ('downloading', 'completed', 'expired', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_offline_content_user_device ON offline_content(user_id, device_id);
CREATE INDEX idx_offline_content_status ON offline_content(status);
CREATE INDEX idx_offline_content_expires ON offline_content(expires_at);

-- Download Queue Table
CREATE TABLE IF NOT EXISTS download_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('video', 'document')),
  content_id UUID NOT NULL,
  course_id UUID NOT NULL,
  quality VARCHAR(20),
  priority INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'downloading', 'completed', 'failed', 'paused')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  file_size BIGINT,
  downloaded_bytes BIGINT DEFAULT 0,
  download_url TEXT,
  wifi_only BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_download_queue_user_device ON download_queue(user_id, device_id);
CREATE INDEX idx_download_queue_status ON download_queue(status);
CREATE INDEX idx_download_queue_priority ON download_queue(priority DESC);

-- Sync Operations Table
CREATE TABLE IF NOT EXISTS sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('progress', 'note', 'bookmark', 'quiz_result', 'assignment')),
  entity_id UUID NOT NULL,
  data JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'conflict', 'failed')),
  retry_count INTEGER DEFAULT 0,
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_operations_user_device ON sync_operations(user_id, device_id);
CREATE INDEX idx_sync_operations_status ON sync_operations(status);
CREATE INDEX idx_sync_operations_timestamp ON sync_operations(timestamp DESC);

-- Sync Conflicts Table
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  client_data JSONB NOT NULL,
  server_data JSONB NOT NULL,
  client_timestamp TIMESTAMP NOT NULL,
  server_timestamp TIMESTAMP NOT NULL,
  resolution VARCHAR(20) CHECK (resolution IN ('client_wins', 'server_wins', 'merge', 'manual')),
  resolved_at TIMESTAMP,
  resolved_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_conflicts_user ON sync_conflicts(user_id);
CREATE INDEX idx_sync_conflicts_unresolved ON sync_conflicts(resolution) WHERE resolution IS NULL;

-- Push Notifications Table
CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_ids TEXT[],
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  image_url TEXT,
  action_url TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('course_update', 'assignment', 'live_session', 'achievement', 'reminder', 'general')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  delivery_stats JSONB DEFAULT '{"sent": 0, "delivered": 0, "failed": 0, "opened": 0}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_push_notifications_user ON push_notifications(user_id);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_push_notifications_scheduled ON push_notifications(scheduled_for) WHERE status = 'scheduled';

-- Notification Subscriptions Table
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  categories TEXT[] DEFAULT ARRAY['course_update', 'assignment', 'live_session', 'achievement', 'reminder', 'general'],
  enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_notification_subscriptions_user ON notification_subscriptions(user_id);
CREATE INDEX idx_notification_subscriptions_enabled ON notification_subscriptions(enabled) WHERE enabled = true;

-- Mobile Analytics Events Table
CREATE TABLE IF NOT EXISTS mobile_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL CHECK (event_category IN ('engagement', 'performance', 'error', 'navigation', 'content')),
  event_data JSONB DEFAULT '{}',
  session_id UUID NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  device_info JSONB DEFAULT '{}'
);

CREATE INDEX idx_mobile_analytics_user ON mobile_analytics_events(user_id);
CREATE INDEX idx_mobile_analytics_session ON mobile_analytics_events(session_id);
CREATE INDEX idx_mobile_analytics_timestamp ON mobile_analytics_events(timestamp DESC);
CREATE INDEX idx_mobile_analytics_event_type ON mobile_analytics_events(event_type);

-- Mobile Sessions Table
CREATE TABLE IF NOT EXISTS mobile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  duration INTEGER,
  screen_views INTEGER DEFAULT 0,
  interactions INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  connection_type VARCHAR(20),
  battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100)
);

CREATE INDEX idx_mobile_sessions_user ON mobile_sessions(user_id);
CREATE INDEX idx_mobile_sessions_device ON mobile_sessions(device_id);
CREATE INDEX idx_mobile_sessions_start_time ON mobile_sessions(start_time DESC);

-- Cross-Device Progress Table
CREATE TABLE IF NOT EXISTS cross_device_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  last_position INTEGER,
  completed_at TIMESTAMP,
  devices JSONB DEFAULT '[]',
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_cross_device_progress_user ON cross_device_progress(user_id);
CREATE INDEX idx_cross_device_progress_course ON cross_device_progress(course_id);
CREATE INDEX idx_cross_device_progress_synced ON cross_device_progress(synced_at DESC);

-- Storage Info Table
CREATE TABLE IF NOT EXISTS mobile_storage_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  total_size BIGINT NOT NULL,
  used_size BIGINT NOT NULL,
  available_size BIGINT NOT NULL,
  downloads JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_mobile_storage_user_device ON mobile_storage_info(user_id, device_id);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_devices_updated_at BEFORE UPDATE ON user_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offline_content_updated_at BEFORE UPDATE ON offline_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_subscriptions_updated_at BEFORE UPDATE ON notification_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cross_device_progress_updated_at BEFORE UPDATE ON cross_device_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_devices IS 'Stores registered mobile devices for push notifications and sync';
COMMENT ON TABLE offline_content IS 'Tracks downloaded content for offline access';
COMMENT ON TABLE download_queue IS 'Manages video and document download queue';
COMMENT ON TABLE sync_operations IS 'Tracks sync operations between devices';
COMMENT ON TABLE sync_conflicts IS 'Stores sync conflicts for resolution';
COMMENT ON TABLE push_notifications IS 'Stores push notification history';
COMMENT ON TABLE notification_subscriptions IS 'User notification preferences per device';
COMMENT ON TABLE mobile_analytics_events IS 'Mobile app analytics events';
COMMENT ON TABLE mobile_sessions IS 'Mobile app session tracking';
COMMENT ON TABLE cross_device_progress IS 'Cross-device learning progress synchronization';
COMMENT ON TABLE mobile_storage_info IS 'Device storage information for download management';
