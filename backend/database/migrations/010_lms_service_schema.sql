-- Migration 010: Interactive Learning Management System (LMS) Schema
-- Description: Creates tables for interactive learning features, collaborative tools,
--              gamification elements, and assessments

-- ============================================================================
-- Interactive Learning Tables
-- ============================================================================

-- Video Quizzes
CREATE TABLE IF NOT EXISTS video_quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL,
    timestamp INTEGER NOT NULL CHECK (timestamp >= 0),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    questions JSONB NOT NULL,
    passing_score INTEGER NOT NULL DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
    time_limit INTEGER CHECK (time_limit > 0),
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_video_quizzes_video_id ON video_quizzes(video_id);
CREATE INDEX idx_video_quizzes_created_by ON video_quizzes(created_by);

-- Quiz Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES video_quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    answers JSONB NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    passed BOOLEAN NOT NULL,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0)
);

CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_user_quiz ON quiz_attempts(user_id, quiz_id);

-- Video Notes
CREATE TABLE IF NOT EXISTS video_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL,
    user_id UUID NOT NULL,
    timestamp INTEGER NOT NULL CHECK (timestamp >= 0),
    content TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_video_notes_video_id ON video_notes(video_id);
CREATE INDEX idx_video_notes_user_id ON video_notes(user_id);
CREATE INDEX idx_video_notes_user_video ON video_notes(user_id, video_id);
CREATE INDEX idx_video_notes_public ON video_notes(is_public) WHERE is_public = TRUE;

-- Video Bookmarks
CREATE TABLE IF NOT EXISTS video_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL,
    user_id UUID NOT NULL,
    timestamp INTEGER NOT NULL CHECK (timestamp >= 0),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_id, timestamp)
);

CREATE INDEX idx_video_bookmarks_video_id ON video_bookmarks(video_id);
CREATE INDEX idx_video_bookmarks_user_id ON video_bookmarks(user_id);

-- Video Comments
CREATE TABLE IF NOT EXISTS video_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER CHECK (timestamp >= 0),
    parent_id UUID REFERENCES video_comments(id) ON DELETE CASCADE,
    upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
    downvotes INTEGER NOT NULL DEFAULT 0 CHECK (downvotes >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_video_comments_video_id ON video_comments(video_id);
CREATE INDEX idx_video_comments_user_id ON video_comments(user_id);
CREATE INDEX idx_video_comments_parent_id ON video_comments(parent_id);

-- Comment Votes
CREATE TABLE IF NOT EXISTS comment_votes (
    comment_id UUID NOT NULL REFERENCES video_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id)
);

-- ============================================================================
-- Collaborative Learning Tables
-- ============================================================================

-- Forums
CREATE TABLE IF NOT EXISTS forums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forums_course_id ON forums(course_id);
CREATE INDEX idx_forums_category ON forums(category);

-- Forum Posts
CREATE TABLE IF NOT EXISTS forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forum_id UUID NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
    upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forum_posts_forum_id ON forum_posts(forum_id);
CREATE INDEX idx_forum_posts_user_id ON forum_posts(user_id);
CREATE INDEX idx_forum_posts_pinned ON forum_posts(is_pinned) WHERE is_pinned = TRUE;

-- Forum Replies
CREATE TABLE IF NOT EXISTS forum_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
    is_solution BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forum_replies_post_id ON forum_replies(post_id);
CREATE INDEX idx_forum_replies_user_id ON forum_replies(user_id);
CREATE INDEX idx_forum_replies_solution ON forum_replies(is_solution) WHERE is_solution = TRUE;

-- Study Groups
CREATE TABLE IF NOT EXISTS study_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    max_members INTEGER NOT NULL DEFAULT 10 CHECK (max_members >= 2 AND max_members <= 50),
    current_members INTEGER NOT NULL DEFAULT 1 CHECK (current_members >= 0),
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (current_members <= max_members)
);

CREATE INDEX idx_study_groups_course_id ON study_groups(course_id);
CREATE INDEX idx_study_groups_created_by ON study_groups(created_by);

-- Study Group Members
CREATE TABLE IF NOT EXISTS study_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'moderator', 'member')),
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_study_group_members_group_id ON study_group_members(group_id);
CREATE INDEX idx_study_group_members_user_id ON study_group_members(user_id);

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    due_date TIMESTAMP NOT NULL,
    max_score INTEGER NOT NULL DEFAULT 100 CHECK (max_score > 0),
    allow_late_submission BOOLEAN NOT NULL DEFAULT TRUE,
    peer_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    peer_review_count INTEGER NOT NULL DEFAULT 2 CHECK (peer_review_count >= 1 AND peer_review_count <= 5),
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignments_course_id ON assignments(course_id);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);

-- Assignment Submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    score INTEGER CHECK (score >= 0),
    feedback TEXT,
    graded_by UUID,
    graded_at TIMESTAMP,
    UNIQUE(assignment_id, user_id)
);

CREATE INDEX idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX idx_assignment_submissions_user_id ON assignment_submissions(user_id);
CREATE INDEX idx_assignment_submissions_graded ON assignment_submissions(graded_at);

-- Peer Reviews
CREATE TABLE IF NOT EXISTS peer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    feedback TEXT NOT NULL,
    criteria JSONB NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(submission_id, reviewer_id)
);

CREATE INDEX idx_peer_reviews_submission_id ON peer_reviews(submission_id);
CREATE INDEX idx_peer_reviews_reviewer_id ON peer_reviews(reviewer_id);

-- ============================================================================
-- Gamification Tables
-- ============================================================================

-- Badges
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon VARCHAR(500) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('achievement', 'milestone', 'special')),
    criteria JSONB NOT NULL,
    rarity VARCHAR(20) NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_badges_category ON badges(category);
CREATE INDEX idx_badges_rarity ON badges(rarity);

-- User Badges
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    progress INTEGER CHECK (progress >= 0 AND progress <= 100),
    UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX idx_user_badges_earned_at ON user_badges(earned_at);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon VARCHAR(500) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('course', 'quiz', 'assignment', 'social', 'streak')),
    requirement INTEGER NOT NULL CHECK (requirement > 0),
    points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_achievements_type ON achievements(type);

-- User Achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_completed ON user_achievements(completed) WHERE completed = TRUE;

-- ============================================================================
-- Assessment Tables
-- ============================================================================

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('quiz', 'exam', 'practice', 'adaptive')),
    duration INTEGER NOT NULL CHECK (duration >= 60 AND duration <= 14400),
    passing_score INTEGER NOT NULL DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
    questions JSONB NOT NULL,
    randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
    randomize_options BOOLEAN NOT NULL DEFAULT FALSE,
    show_feedback BOOLEAN NOT NULL DEFAULT TRUE,
    allow_retake BOOLEAN NOT NULL DEFAULT TRUE,
    max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1 AND max_attempts <= 10),
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assessments_course_id ON assessments(course_id);
CREATE INDEX idx_assessments_type ON assessments(type);

-- Assessment Attempts
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    answers JSONB NOT NULL,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    percentage INTEGER NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0)
);

CREATE INDEX idx_assessment_attempts_assessment_id ON assessment_attempts(assessment_id);
CREATE INDEX idx_assessment_attempts_user_id ON assessment_attempts(user_id);
CREATE INDEX idx_assessment_attempts_user_assessment ON assessment_attempts(user_id, assessment_id);

-- Flashcards
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    user_id UUID NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    difficulty VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    next_review TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    interval INTEGER NOT NULL DEFAULT 1 CHECK (interval > 0),
    ease_factor DECIMAL(3,2) NOT NULL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
    review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flashcards_course_id ON flashcards(course_id);
CREATE INDEX idx_flashcards_user_id ON flashcards(user_id);
CREATE INDEX idx_flashcards_next_review ON flashcards(next_review);
CREATE INDEX idx_flashcards_user_course ON flashcards(user_id, course_id);

-- Flashcard Reviews
CREATE TABLE IF NOT EXISTS flashcard_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    quality INTEGER NOT NULL CHECK (quality >= 0 AND quality <= 5),
    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0)
);

CREATE INDEX idx_flashcard_reviews_flashcard_id ON flashcard_reviews(flashcard_id);
CREATE INDEX idx_flashcard_reviews_user_id ON flashcard_reviews(user_id);
CREATE INDEX idx_flashcard_reviews_reviewed_at ON flashcard_reviews(reviewed_at);

-- ============================================================================
-- Seed Data for Gamification
-- ============================================================================

-- Insert default badges
INSERT INTO badges (name, description, icon, category, criteria, rarity, points) VALUES
('First Steps', 'Complete your first video', 'https://example.com/badges/first-steps.png', 'milestone', '{"type": "courses", "threshold": 1}', 'common', 10),
('Quiz Master', 'Pass 10 quizzes', 'https://example.com/badges/quiz-master.png', 'achievement', '{"type": "quiz", "threshold": 10}', 'rare', 50),
('Streak Warrior', 'Maintain a 7-day learning streak', 'https://example.com/badges/streak-warrior.png', 'achievement', '{"type": "streak", "threshold": 7}', 'rare', 75),
('Point Collector', 'Earn 1000 points', 'https://example.com/badges/point-collector.png', 'milestone', '{"type": "points", "threshold": 1000}', 'epic', 100),
('Course Champion', 'Complete 5 courses', 'https://example.com/badges/course-champion.png', 'milestone', '{"type": "courses", "threshold": 5}', 'epic', 200),
('Legend', 'Earn 10000 points', 'https://example.com/badges/legend.png', 'special', '{"type": "points", "threshold": 10000}', 'legendary', 500)
ON CONFLICT (name) DO NOTHING;

-- Insert default achievements
INSERT INTO achievements (name, description, icon, type, requirement, points) VALUES
('Video Enthusiast', 'Watch 10 videos', 'https://example.com/achievements/video-enthusiast.png', 'course', 10, 25),
('Quiz Pro', 'Pass 25 quizzes', 'https://example.com/achievements/quiz-pro.png', 'quiz', 25, 50),
('Assignment Expert', 'Submit 10 assignments', 'https://example.com/achievements/assignment-expert.png', 'assignment', 10, 75),
('Social Butterfly', 'Make 50 forum posts', 'https://example.com/achievements/social-butterfly.png', 'social', 50, 40),
('Streak Legend', 'Maintain a 30-day streak', 'https://example.com/achievements/streak-legend.png', 'streak', 30, 150)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE video_quizzes IS 'In-video quizzes with timestamped questions';
COMMENT ON TABLE quiz_attempts IS 'User attempts at video quizzes';
COMMENT ON TABLE video_notes IS 'Timestamped notes on videos';
COMMENT ON TABLE video_bookmarks IS 'User bookmarks for quick video navigation';
COMMENT ON TABLE video_comments IS 'Discussion comments on videos';
COMMENT ON TABLE forums IS 'Course discussion forums';
COMMENT ON TABLE forum_posts IS 'Posts within forums';
COMMENT ON TABLE forum_replies IS 'Replies to forum posts';
COMMENT ON TABLE study_groups IS 'Collaborative study groups';
COMMENT ON TABLE assignments IS 'Course assignments';
COMMENT ON TABLE assignment_submissions IS 'Student assignment submissions';
COMMENT ON TABLE peer_reviews IS 'Peer reviews of assignment submissions';
COMMENT ON TABLE badges IS 'Achievement badges';
COMMENT ON TABLE user_badges IS 'Badges earned by users';
COMMENT ON TABLE achievements IS 'Platform achievements';
COMMENT ON TABLE user_achievements IS 'User progress on achievements';
COMMENT ON TABLE assessments IS 'Comprehensive assessments';
COMMENT ON TABLE assessment_attempts IS 'User attempts at assessments';
COMMENT ON TABLE flashcards IS 'Spaced repetition flashcards';
COMMENT ON TABLE flashcard_reviews IS 'Flashcard review history';
