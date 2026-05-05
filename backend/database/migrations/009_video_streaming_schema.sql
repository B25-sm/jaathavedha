-- Migration 009: Video Streaming and Content Delivery Schema
-- Task 22: Video Streaming and Content Delivery System
-- Requirements: 16.1-16.12, 18.12

-- Video status enum
CREATE TYPE video_status AS ENUM (
  'uploading',
  'processing',
  'ready',
  'failed',
  'archived'
);

-- Processing status enum
CREATE TYPE processing_status AS ENUM (
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

-- Processing step enum
CREATE TYPE processing_step AS ENUM (
  'validation',
  'transcoding',
  'thumbnail_generation',
  'hls_generation',
  'encryption',
  'finalization'
);

-- Interaction type enum
CREATE TYPE interaction_type AS ENUM (
  'play',
  'pause',
  'seek',
  'quality_change',
  'speed_change',
  'fullscreen',
  'volume_change',
  'complete'
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  original_filename VARCHAR(500),
  file_size BIGINT DEFAULT 0,
  duration INTEGER DEFAULT 0, -- in seconds
  status video_status DEFAULT 'uploading',
  s3_key VARCHAR(500),
  thumbnail_url VARCHAR(500),
  hls_url VARCHAR(500),
  dash_url VARCHAR(500),
  encryption_key VARCHAR(255),
  watermark_enabled BOOLEAN DEFAULT false,
  quality_levels JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Video processing jobs table
CREATE TABLE IF NOT EXISTS video_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  status processing_status DEFAULT 'queued',
  progress INTEGER DEFAULT 0, -- 0-100
  current_step processing_step DEFAULT 'validation',
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video progress tracking table
CREATE TABLE IF NOT EXISTS video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_position INTEGER DEFAULT 0, -- in seconds
  completion_percentage DECIMAL(5,2) DEFAULT 0.00,
  total_watch_time INTEGER DEFAULT 0, -- total seconds watched
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(video_id, user_id)
);

-- Video analytics events table (MongoDB-like structure in PostgreSQL)
CREATE TABLE IF NOT EXISTS video_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  event_type interaction_type NOT NULL,
  timestamp INTEGER NOT NULL, -- video timestamp in seconds
  quality VARCHAR(10), -- e.g., '720p'
  playback_speed DECIMAL(3,2), -- e.g., 1.5
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video analytics summary table (aggregated data)
CREATE TABLE IF NOT EXISTS video_analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  watch_time INTEGER DEFAULT 0, -- total seconds watched in this session
  total_duration INTEGER DEFAULT 0, -- video duration
  completion_percentage DECIMAL(5,2) DEFAULT 0.00,
  quality_changes JSONB DEFAULT '[]'::jsonb,
  interactions JSONB DEFAULT '[]'::jsonb,
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Streaming sessions table (for access control)
CREATE TABLE IF NOT EXISTS streaming_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  domain VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video quality levels table (normalized from JSONB)
CREATE TABLE IF NOT EXISTS video_quality_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  resolution VARCHAR(10) NOT NULL, -- e.g., '720p'
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bitrate INTEGER NOT NULL,
  file_size BIGINT,
  s3_key VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video chapters table
CREATE TABLE IF NOT EXISTS video_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_time INTEGER NOT NULL, -- in seconds
  end_time INTEGER NOT NULL, -- in seconds
  description TEXT,
  thumbnail_url VARCHAR(500),
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video thumbnails table (multiple thumbnails per video)
CREATE TABLE IF NOT EXISTS video_thumbnails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL, -- in seconds
  url VARCHAR(500) NOT NULL,
  width INTEGER DEFAULT 320,
  height INTEGER DEFAULT 240,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video downloads table (offline viewing tracking)
CREATE TABLE IF NOT EXISTS video_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quality VARCHAR(10) NOT NULL,
  file_size BIGINT,
  download_url VARCHAR(500),
  expires_at TIMESTAMP NOT NULL,
  downloaded_at TIMESTAMP,
  device_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, expired
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video engagement heatmap table (for analytics)
CREATE TABLE IF NOT EXISTS video_engagement_heatmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL, -- in seconds
  view_count INTEGER DEFAULT 0,
  replay_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  pause_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(video_id, timestamp)
);

-- Indexes for performance optimization

-- Videos table indexes
CREATE INDEX idx_videos_course_id ON videos(course_id);
CREATE INDEX idx_videos_instructor_id ON videos(instructor_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);

-- Video processing jobs indexes
CREATE INDEX idx_video_processing_jobs_video_id ON video_processing_jobs(video_id);
CREATE INDEX idx_video_processing_jobs_status ON video_processing_jobs(status);
CREATE INDEX idx_video_processing_jobs_created_at ON video_processing_jobs(created_at DESC);

-- Video progress indexes
CREATE INDEX idx_video_progress_video_id ON video_progress(video_id);
CREATE INDEX idx_video_progress_user_id ON video_progress(user_id);
CREATE INDEX idx_video_progress_user_video ON video_progress(user_id, video_id);
CREATE INDEX idx_video_progress_completion ON video_progress(is_completed);

-- Video analytics events indexes
CREATE INDEX idx_video_analytics_events_video_id ON video_analytics_events(video_id);
CREATE INDEX idx_video_analytics_events_user_id ON video_analytics_events(user_id);
CREATE INDEX idx_video_analytics_events_session_id ON video_analytics_events(session_id);
CREATE INDEX idx_video_analytics_events_created_at ON video_analytics_events(created_at DESC);

-- Video analytics summary indexes
CREATE INDEX idx_video_analytics_summary_video_id ON video_analytics_summary(video_id);
CREATE INDEX idx_video_analytics_summary_user_id ON video_analytics_summary(user_id);
CREATE INDEX idx_video_analytics_summary_session_id ON video_analytics_summary(session_id);

-- Streaming sessions indexes
CREATE INDEX idx_streaming_sessions_video_id ON streaming_sessions(video_id);
CREATE INDEX idx_streaming_sessions_user_id ON streaming_sessions(user_id);
CREATE INDEX idx_streaming_sessions_token ON streaming_sessions(session_token);
CREATE INDEX idx_streaming_sessions_expires_at ON streaming_sessions(expires_at);

-- Video notes indexes (from PWA migration, ensure they exist)
CREATE INDEX IF NOT EXISTS idx_video_notes_video_id ON video_notes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_notes_user_id ON video_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_video_notes_timestamp ON video_notes(timestamp);

-- Video bookmarks indexes (from PWA migration, ensure they exist)
CREATE INDEX IF NOT EXISTS idx_video_bookmarks_video_id ON video_bookmarks(video_id);
CREATE INDEX IF NOT EXISTS idx_video_bookmarks_user_id ON video_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_video_bookmarks_timestamp ON video_bookmarks(timestamp);

-- Video quality levels indexes
CREATE INDEX idx_video_quality_levels_video_id ON video_quality_levels(video_id);
CREATE INDEX idx_video_quality_levels_resolution ON video_quality_levels(resolution);

-- Video chapters indexes
CREATE INDEX idx_video_chapters_video_id ON video_chapters(video_id);
CREATE INDEX idx_video_chapters_order ON video_chapters(order_index);

-- Video thumbnails indexes
CREATE INDEX idx_video_thumbnails_video_id ON video_thumbnails(video_id);
CREATE INDEX idx_video_thumbnails_primary ON video_thumbnails(is_primary);

-- Video downloads indexes
CREATE INDEX idx_video_downloads_video_id ON video_downloads(video_id);
CREATE INDEX idx_video_downloads_user_id ON video_downloads(user_id);
CREATE INDEX idx_video_downloads_status ON video_downloads(status);
CREATE INDEX idx_video_downloads_expires_at ON video_downloads(expires_at);

-- Video engagement heatmap indexes
CREATE INDEX idx_video_engagement_heatmap_video_id ON video_engagement_heatmap(video_id);
CREATE INDEX idx_video_engagement_heatmap_timestamp ON video_engagement_heatmap(timestamp);

-- Triggers for updated_at timestamps

CREATE OR REPLACE FUNCTION update_video_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_video_updated_at();

CREATE TRIGGER trigger_video_progress_updated_at
  BEFORE UPDATE ON video_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_video_updated_at();

CREATE TRIGGER trigger_video_analytics_summary_updated_at
  BEFORE UPDATE ON video_analytics_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_video_updated_at();

CREATE TRIGGER trigger_video_engagement_heatmap_updated_at
  BEFORE UPDATE ON video_engagement_heatmap
  FOR EACH ROW
  EXECUTE FUNCTION update_video_updated_at();

-- Comments for documentation

COMMENT ON TABLE videos IS 'Stores video metadata and processing status for the LMS platform';
COMMENT ON TABLE video_processing_jobs IS 'Tracks video transcoding and processing jobs';
COMMENT ON TABLE video_progress IS 'Tracks student progress for each video';
COMMENT ON TABLE video_analytics_events IS 'Stores detailed video interaction events for analytics';
COMMENT ON TABLE video_analytics_summary IS 'Aggregated video analytics data per session';
COMMENT ON TABLE streaming_sessions IS 'Manages secure video streaming sessions with access control';
COMMENT ON TABLE video_quality_levels IS 'Stores available quality levels for each video';
COMMENT ON TABLE video_chapters IS 'Defines chapter markers within videos';
COMMENT ON TABLE video_thumbnails IS 'Stores multiple thumbnail images for each video';
COMMENT ON TABLE video_downloads IS 'Tracks offline video downloads for enrolled students';
COMMENT ON TABLE video_engagement_heatmap IS 'Aggregates engagement metrics for video timeline visualization';

-- Grant permissions (adjust based on your user roles)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sai_mahendra_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sai_mahendra_app;
