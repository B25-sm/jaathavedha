-- Security and GDPR Compliance Schema
-- Requirements: 11.1, 11.4, 11.5, 11.6, 11.7, 11.8

-- User Consents Table (GDPR Requirement 11.5)
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(100) NOT NULL,
  granted BOOLEAN NOT NULL,
  purpose TEXT NOT NULL,
  version VARCHAR(20) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_type ON user_consents(consent_type);
CREATE INDEX idx_user_consents_created_at ON user_consents(created_at DESC);

-- Security Audit Log Table (GDPR Requirement 11.7)
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_security_audit_user_id ON security_audit_log(user_id);
CREATE INDEX idx_security_audit_action ON security_audit_log(action);
CREATE INDEX idx_security_audit_created_at ON security_audit_log(created_at DESC);

-- Data Access Log Table (GDPR Requirement 11.4)
CREATE TABLE IF NOT EXISTS data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  accessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  sensitive_data BOOLEAN DEFAULT false,
  record_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_data_access_user_id ON data_access_log(user_id);
CREATE INDEX idx_data_access_accessed_by ON data_access_log(accessed_by);
CREATE INDEX idx_data_access_created_at ON data_access_log(created_at DESC);

-- Encryption Key Metadata Table (Requirement 11.6)
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id VARCHAR(255) UNIQUE NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  algorithm VARCHAR(50) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  rotated_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revocation_reason TEXT
);

CREATE INDEX idx_encryption_keys_key_id ON encryption_keys(key_id);
CREATE INDEX idx_encryption_keys_status ON encryption_keys(status);
CREATE INDEX idx_encryption_keys_expires_at ON encryption_keys(expires_at);

-- GDPR Data Deletion Requests Table (Requirement 11.4)
CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  records_deleted JSONB,
  notes TEXT
);

CREATE INDEX idx_gdpr_deletion_user_id ON gdpr_deletion_requests(user_id);
CREATE INDEX idx_gdpr_deletion_status ON gdpr_deletion_requests(status);
CREATE INDEX idx_gdpr_deletion_requested_at ON gdpr_deletion_requests(requested_at DESC);

-- GDPR Data Export Requests Table (Requirement 11.4)
CREATE TABLE IF NOT EXISTS gdpr_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  export_url TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  download_count INTEGER DEFAULT 0
);

CREATE INDEX idx_gdpr_export_user_id ON gdpr_export_requests(user_id);
CREATE INDEX idx_gdpr_export_status ON gdpr_export_requests(status);
CREATE INDEX idx_gdpr_export_requested_at ON gdpr_export_requests(requested_at DESC);

-- Security Incidents Table (Requirement 11.8)
CREATE TABLE IF NOT EXISTS security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  affected_users JSONB,
  ip_addresses JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  automated_response JSONB
);

CREATE INDEX idx_security_incidents_type ON security_incidents(incident_type);
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX idx_security_incidents_status ON security_incidents(status);
CREATE INDEX idx_security_incidents_detected_at ON security_incidents(detected_at DESC);

-- Blocked IPs Table (Requirement 11.8)
CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  blocked_by VARCHAR(50) DEFAULT 'system',
  permanent BOOLEAN DEFAULT false
);

CREATE INDEX idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX idx_blocked_ips_expires_at ON blocked_ips(expires_at);

-- Add encrypted fields tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_fields JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_key_version INTEGER DEFAULT 1;

-- Comments for documentation
COMMENT ON TABLE user_consents IS 'Stores user consent records for GDPR compliance';
COMMENT ON TABLE security_audit_log IS 'Comprehensive security audit trail';
COMMENT ON TABLE data_access_log IS 'Tracks all access to sensitive user data';
COMMENT ON TABLE encryption_keys IS 'Manages encryption key lifecycle and rotation';
COMMENT ON TABLE gdpr_deletion_requests IS 'Tracks GDPR right to erasure requests';
COMMENT ON TABLE gdpr_export_requests IS 'Tracks GDPR data portability requests';
COMMENT ON TABLE security_incidents IS 'Records security incidents and intrusion attempts';
COMMENT ON TABLE blocked_ips IS 'Manages IP blocking for security purposes';
