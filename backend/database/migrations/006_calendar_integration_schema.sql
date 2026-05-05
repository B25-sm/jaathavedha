-- Calendar Integration Schema Migration
-- This migration creates tables for calendar integration functionality

-- Calendar Providers Enum
CREATE TYPE calendar_provider AS ENUM ('google', 'outlook');

-- Event Status Enum
CREATE TYPE event_status AS ENUM ('scheduled', 'cancelled', 'completed', 'rescheduled');

-- Sync Status Enum
CREATE TYPE sync_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Reminder Type Enum
CREATE TYPE reminder_type AS ENUM ('email', 'popup', 'notification');

-- Calendar Connections Table
-- Stores user calendar account connections
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP NOT NULL,
  calendar_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Calendar Events Table
-- Stores calendar events created for live sessions
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  location VARCHAR(500),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  status event_status DEFAULT 'scheduled',
  meeting_url TEXT,
  attendees TEXT[],
  reminders JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider, provider_event_id)
);

-- Sync Logs Table
-- Tracks calendar synchronization operations
CREATE TABLE calendar_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  status sync_status DEFAULT 'pending',
  events_created INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  events_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Sync Preferences Table
-- Stores user preferences for calendar synchronization
CREATE TABLE calendar_sync_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_interval INTEGER DEFAULT 15, -- minutes
  providers calendar_provider[] DEFAULT ARRAY['google']::calendar_provider[],
  sync_past_events BOOLEAN DEFAULT false,
  sync_future_events BOOLEAN DEFAULT true,
  days_in_past INTEGER DEFAULT 0,
  days_in_future INTEGER DEFAULT 90,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook Subscriptions Table
-- Stores webhook subscriptions for calendar change notifications
CREATE TABLE calendar_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider, resource_id)
);

-- Live Sessions Table (if not exists)
-- Stores information about scheduled live sessions
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  meeting_url TEXT,
  max_attendees INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX idx_calendar_connections_active ON calendar_connections(is_active);

CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_session_id ON calendar_events(session_id);
CREATE INDEX idx_calendar_events_enrollment_id ON calendar_events(enrollment_id);
CREATE INDEX idx_calendar_events_provider ON calendar_events(provider);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);

CREATE INDEX idx_calendar_sync_logs_user_id ON calendar_sync_logs(user_id);
CREATE INDEX idx_calendar_sync_logs_status ON calendar_sync_logs(status);
CREATE INDEX idx_calendar_sync_logs_started_at ON calendar_sync_logs(started_at);

CREATE INDEX idx_calendar_sync_preferences_user_id ON calendar_sync_preferences(user_id);

CREATE INDEX idx_calendar_webhook_subscriptions_user_id ON calendar_webhook_subscriptions(user_id);
CREATE INDEX idx_calendar_webhook_subscriptions_expires_at ON calendar_webhook_subscriptions(expires_at);

CREATE INDEX idx_live_sessions_start_time ON live_sessions(start_time);
CREATE INDEX idx_live_sessions_program_id ON live_sessions(program_id);
CREATE INDEX idx_live_sessions_active ON live_sessions(is_active);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER calendar_sync_preferences_updated_at
  BEFORE UPDATE ON calendar_sync_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER live_sessions_updated_at
  BEFORE UPDATE ON live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_updated_at();

-- Comments for documentation
COMMENT ON TABLE calendar_connections IS 'Stores user calendar account connections with OAuth tokens';
COMMENT ON TABLE calendar_events IS 'Stores calendar events created for live sessions and enrollments';
COMMENT ON TABLE calendar_sync_logs IS 'Tracks calendar synchronization operations and their results';
COMMENT ON TABLE calendar_sync_preferences IS 'Stores user preferences for calendar synchronization';
COMMENT ON TABLE calendar_webhook_subscriptions IS 'Stores webhook subscriptions for real-time calendar updates';
COMMENT ON TABLE live_sessions IS 'Stores scheduled live sessions for courses and programs';
