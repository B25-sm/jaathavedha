-- Video Conferencing Service Schema Migration
-- This migration creates tables for video conferencing integration

-- Create enum types
CREATE TYPE meeting_provider AS ENUM ('zoom', 'google_meet');
CREATE TYPE meeting_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE recording_status AS ENUM ('processing', 'available', 'downloading', 'downloaded', 'failed');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');

-- Video conferencing meetings table
CREATE TABLE IF NOT EXISTS video_conferencing_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider meeting_provider NOT NULL,
  provider_meeting_id VARCHAR(255) NOT NULL,
  session_id UUID NOT NULL,
  instructor_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  join_url TEXT NOT NULL,
  start_url TEXT,
  password VARCHAR(100),
  status meeting_status DEFAULT 'scheduled',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_instructor FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT check_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  CONSTRAINT check_start_time CHECK (start_time > created_at)
);

-- Video conferencing recordings table
CREATE TABLE IF NOT EXISTS video_conferencing_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  provider_recording_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  recording_type VARCHAR(50) NOT NULL,
  download_url TEXT,
  s3_key VARCHAR(500),
  s3_url TEXT,
  status recording_status DEFAULT 'processing',
  recorded_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_meeting FOREIGN KEY (meeting_id) REFERENCES video_conferencing_meetings(id) ON DELETE CASCADE,
  CONSTRAINT check_file_size CHECK (file_size_bytes > 0)
);

-- Video conferencing attendance table
CREATE TABLE IF NOT EXISTS video_conferencing_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  join_time TIMESTAMP NOT NULL,
  leave_time TIMESTAMP,
  duration_minutes INTEGER DEFAULT 0,
  status attendance_status DEFAULT 'present',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_meeting_attendance FOREIGN KEY (meeting_id) REFERENCES video_conferencing_meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_attendance FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT check_leave_time CHECK (leave_time IS NULL OR leave_time > join_time),
  CONSTRAINT check_duration_attendance CHECK (duration_minutes >= 0)
);

-- Recording views tracking table
CREATE TABLE IF NOT EXISTS video_conferencing_recording_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL,
  user_id UUID NOT NULL,
  viewed_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_recording_view FOREIGN KEY (recording_id) REFERENCES video_conferencing_recordings(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_view FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_meetings_session ON video_conferencing_meetings(session_id);
CREATE INDEX idx_meetings_instructor ON video_conferencing_meetings(instructor_id);
CREATE INDEX idx_meetings_start_time ON video_conferencing_meetings(start_time);
CREATE INDEX idx_meetings_status ON video_conferencing_meetings(status);
CREATE INDEX idx_meetings_provider_id ON video_conferencing_meetings(provider_meeting_id);

CREATE INDEX idx_recordings_meeting ON video_conferencing_recordings(meeting_id);
CREATE INDEX idx_recordings_status ON video_conferencing_recordings(status);
CREATE INDEX idx_recordings_recorded_at ON video_conferencing_recordings(recorded_at);

CREATE INDEX idx_attendance_meeting ON video_conferencing_attendance(meeting_id);
CREATE INDEX idx_attendance_user ON video_conferencing_attendance(user_id);
CREATE INDEX idx_attendance_status ON video_conferencing_attendance(status);
CREATE INDEX idx_attendance_join_time ON video_conferencing_attendance(join_time);

CREATE INDEX idx_recording_views_recording ON video_conferencing_recording_views(recording_id);
CREATE INDEX idx_recording_views_user ON video_conferencing_recording_views(user_id);
CREATE INDEX idx_recording_views_viewed_at ON video_conferencing_recording_views(viewed_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_conferencing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON video_conferencing_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_video_conferencing_updated_at();

CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON video_conferencing_recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_video_conferencing_updated_at();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON video_conferencing_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_video_conferencing_updated_at();

-- Add comments for documentation
COMMENT ON TABLE video_conferencing_meetings IS 'Stores video conferencing meeting information from Zoom and Google Meet';
COMMENT ON TABLE video_conferencing_recordings IS 'Stores meeting recording metadata and S3 storage information';
COMMENT ON TABLE video_conferencing_attendance IS 'Tracks participant attendance for meetings';
COMMENT ON TABLE video_conferencing_recording_views IS 'Tracks when users view recordings';

COMMENT ON COLUMN video_conferencing_meetings.provider IS 'Video conferencing provider (zoom or google_meet)';
COMMENT ON COLUMN video_conferencing_meetings.provider_meeting_id IS 'Meeting ID from the provider (Zoom or Google)';
COMMENT ON COLUMN video_conferencing_meetings.session_id IS 'Reference to the course session';
COMMENT ON COLUMN video_conferencing_meetings.settings IS 'JSON object containing meeting settings (waiting room, recording, etc.)';

COMMENT ON COLUMN video_conferencing_recordings.s3_key IS 'S3 object key for the stored recording';
COMMENT ON COLUMN video_conferencing_recordings.s3_url IS 'Full S3 URL for the recording';
COMMENT ON COLUMN video_conferencing_recordings.status IS 'Recording processing status';

COMMENT ON COLUMN video_conferencing_attendance.duration_minutes IS 'Total duration the participant was in the meeting';
COMMENT ON COLUMN video_conferencing_attendance.status IS 'Attendance status based on duration and threshold';
