-- Migration 011: Live Streaming Interactive Features Schema
-- Creates tables for chat, Q&A, polls, surveys, and hand-raising features

-- ==================== CHAT TABLES ====================

-- Session chat messages
CREATE TABLE IF NOT EXISTS session_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- text, system, announcement, poll, qa
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_chat_session ON session_chat(session_id);
CREATE INDEX idx_session_chat_created ON session_chat(created_at DESC);
CREATE INDEX idx_session_chat_pinned ON session_chat(session_id, is_pinned) WHERE is_pinned = true;

-- ==================== Q&A TABLES ====================

-- Q&A questions
CREATE TABLE IF NOT EXISTS session_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by VARCHAR(255),
  answered_at TIMESTAMP,
  upvotes INTEGER DEFAULT 0,
  upvoted_by TEXT[] DEFAULT '{}',
  is_answered BOOLEAN DEFAULT false,
  is_highlighted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_qa_session ON session_qa(session_id);
CREATE INDEX idx_session_qa_upvotes ON session_qa(session_id, upvotes DESC);
CREATE INDEX idx_session_qa_answered ON session_qa(session_id, is_answered);

-- ==================== POLL TABLES ====================

-- Session polls
CREATE TABLE IF NOT EXISTS session_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of {id, text, votes, percentage}
  poll_type VARCHAR(50) DEFAULT 'multiple_choice', -- multiple_choice, yes_no, rating
  is_active BOOLEAN DEFAULT true,
  is_anonymous BOOLEAN DEFAULT false,
  allow_multiple BOOLEAN DEFAULT false,
  total_votes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

CREATE INDEX idx_session_polls_session ON session_polls(session_id);
CREATE INDEX idx_session_polls_active ON session_polls(session_id, is_active);

-- Poll votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES session_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  option_ids TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

CREATE INDEX idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX idx_poll_votes_user ON poll_votes(user_id);

-- ==================== SURVEY TABLES ====================

-- Surveys
CREATE TABLE IF NOT EXISTS session_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  survey_type VARCHAR(50) DEFAULT 'post_session', -- pre_session, mid_session, post_session
  questions JSONB NOT NULL, -- Array of questions with types
  is_active BOOLEAN DEFAULT true,
  is_anonymous BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

CREATE INDEX idx_session_surveys_session ON session_surveys(session_id);
CREATE INDEX idx_session_surveys_type ON session_surveys(session_id, survey_type);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES session_surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  responses JSONB NOT NULL, -- Array of {questionId, answer}
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(survey_id, user_id)
);

CREATE INDEX idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_user ON survey_responses(user_id);

-- ==================== HAND RAISE TABLES ====================

-- Hand raise queue
CREATE TABLE IF NOT EXISTS hand_raise_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  raised_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined, cancelled
  queue_position INTEGER NOT NULL,
  speaking_duration INTEGER, -- seconds
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hand_raise_session ON hand_raise_queue(session_id);
CREATE INDEX idx_hand_raise_status ON hand_raise_queue(session_id, status);
CREATE INDEX idx_hand_raise_position ON hand_raise_queue(session_id, queue_position);

-- ==================== SCREEN SHARING TABLES ====================

-- Screen sharing sessions
CREATE TABLE IF NOT EXISTS screen_sharing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  share_type VARCHAR(50) DEFAULT 'screen', -- screen, window, tab
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_screen_sharing_session ON screen_sharing_sessions(session_id);
CREATE INDEX idx_screen_sharing_active ON screen_sharing_sessions(session_id, is_active);

-- ==================== PRESENTATION TABLES ====================

-- Presentations
CREATE TABLE IF NOT EXISTS session_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  uploaded_by VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- pdf, pptx
  total_slides INTEGER NOT NULL,
  current_slide INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_presentations_session ON session_presentations(session_id);
CREATE INDEX idx_presentations_active ON session_presentations(session_id, is_active);

-- Presentation annotations
CREATE TABLE IF NOT EXISTS presentation_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES session_presentations(id) ON DELETE CASCADE,
  slide_number INTEGER NOT NULL,
  annotation_data JSONB NOT NULL, -- Drawing data, coordinates, etc.
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_annotations_presentation ON presentation_annotations(presentation_id);
CREATE INDEX idx_annotations_slide ON presentation_annotations(presentation_id, slide_number);

-- ==================== PARTICIPANT MANAGEMENT TABLES ====================

-- Participant actions log
CREATE TABLE IF NOT EXISTS participant_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  action_by VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- mute, unmute, remove, ban, promote, demote
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_participant_actions_session ON participant_actions(session_id);
CREATE INDEX idx_participant_actions_user ON participant_actions(target_user_id);

-- Breakout rooms
CREATE TABLE IF NOT EXISTS breakout_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  room_name VARCHAR(255) NOT NULL,
  room_number INTEGER NOT NULL,
  max_participants INTEGER DEFAULT 10,
  duration_minutes INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

CREATE INDEX idx_breakout_rooms_session ON breakout_rooms(session_id);
CREATE INDEX idx_breakout_rooms_active ON breakout_rooms(session_id, is_active);

-- Breakout room assignments
CREATE TABLE IF NOT EXISTS breakout_room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES breakout_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_breakout_assignments_room ON breakout_room_assignments(room_id);
CREATE INDEX idx_breakout_assignments_user ON breakout_room_assignments(user_id);

-- ==================== REAL-TIME FEEDBACK TABLES ====================

-- Real-time feedback/reactions
CREATE TABLE IF NOT EXISTS session_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reaction_type VARCHAR(50) NOT NULL, -- thumbs_up, thumbs_down, clap, confused, slow_down, speed_up
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reactions_session ON session_reactions(session_id);
CREATE INDEX idx_reactions_timestamp ON session_reactions(session_id, timestamp DESC);

-- Engagement metrics (aggregated)
CREATE TABLE IF NOT EXISTS session_engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- chat_rate, qa_rate, poll_participation, attention_score
  metric_value DECIMAL(10,2) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_engagement_metrics_session ON session_engagement_metrics(session_id);
CREATE INDEX idx_engagement_metrics_timestamp ON session_engagement_metrics(session_id, timestamp DESC);

-- Comments
COMMENT ON TABLE session_chat IS 'Stores real-time chat messages during live sessions';
COMMENT ON TABLE session_qa IS 'Stores Q&A questions and answers with upvoting';
COMMENT ON TABLE session_polls IS 'Stores interactive polls with multiple types';
COMMENT ON TABLE session_surveys IS 'Stores pre/mid/post session surveys';
COMMENT ON TABLE hand_raise_queue IS 'Manages hand-raising queue for speaking requests';
COMMENT ON TABLE screen_sharing_sessions IS 'Tracks screen sharing sessions';
COMMENT ON TABLE session_presentations IS 'Stores presentation files and state';
COMMENT ON TABLE breakout_rooms IS 'Manages breakout rooms for group activities';
COMMENT ON TABLE session_reactions IS 'Stores real-time reactions and feedback';
