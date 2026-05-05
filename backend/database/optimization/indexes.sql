-- Database Optimization: Indexes for Performance
-- This file contains index definitions for frequently queried columns

-- ============================================
-- User Management Service Indexes
-- ============================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified) WHERE email_verified = true;

-- Composite index for user search and filtering
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

-- User sessions (if stored in PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- ============================================
-- Course Management Service Indexes
-- ============================================

-- Programs table indexes
CREATE INDEX IF NOT EXISTS idx_programs_category ON programs(category);
CREATE INDEX IF NOT EXISTS idx_programs_is_active ON programs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_programs_created_at ON programs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_programs_price ON programs(price);

-- Enrollments table indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_program_id ON enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at ON enrollments(enrolled_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_enrollments_user_status ON enrollments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_program_status ON enrollments(program_id, status);

-- User progress tracking
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_course_id ON user_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_updated_at ON user_progress(updated_at DESC);

-- ============================================
-- Payment Service Indexes
-- ============================================

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_program_id ON payments(program_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_gateway ON payments(gateway);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id ON payments(gateway_payment_id);

-- Composite indexes for payment queries
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);

-- Subscriptions table indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_program_id ON subscriptions(program_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway_subscription_id ON subscriptions(gateway_subscription_id);

-- Active subscriptions for billing
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_billing ON subscriptions(status, next_billing_date) 
  WHERE status = 'active';

-- ============================================
-- Contact Service Indexes
-- ============================================

-- Contact inquiries table indexes
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_category ON contact_inquiries(category);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at ON contact_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_user_id ON contact_inquiries(user_id);

-- Composite index for admin filtering
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status_created ON contact_inquiries(status, created_at DESC);

-- ============================================
-- Security Service Indexes
-- ============================================

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Security events
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);

-- ============================================
-- Full-Text Search Indexes
-- ============================================

-- Programs full-text search
CREATE INDEX IF NOT EXISTS idx_programs_search ON programs 
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Users full-text search
CREATE INDEX IF NOT EXISTS idx_users_search ON users 
  USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || email));

-- ============================================
-- Partial Indexes for Specific Queries
-- ============================================

-- Active users only
CREATE INDEX IF NOT EXISTS idx_users_active ON users(id, email) 
  WHERE status = 'active';

-- Pending payments
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(id, user_id, created_at) 
  WHERE status = 'pending';

-- Unresolved contact inquiries
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_unresolved ON contact_inquiries(id, created_at) 
  WHERE status IN ('new', 'in_progress');

-- ============================================
-- Index Maintenance Commands
-- ============================================

-- Analyze tables to update statistics (run periodically)
-- ANALYZE users;
-- ANALYZE programs;
-- ANALYZE enrollments;
-- ANALYZE payments;
-- ANALYZE subscriptions;

-- Reindex if needed (run during maintenance windows)
-- REINDEX TABLE users;
-- REINDEX TABLE programs;
-- REINDEX TABLE enrollments;

-- Check index usage
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan ASC;

-- Find unused indexes
-- SELECT schemaname, tablename, indexname
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0
-- AND indexname NOT LIKE '%_pkey';
