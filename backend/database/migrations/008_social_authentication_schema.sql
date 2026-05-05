-- Social Authentication Schema
-- Migration: 008_social_authentication_schema.sql
-- Adds support for Google, LinkedIn, and GitHub OAuth authentication

-- Create social provider enum
CREATE TYPE social_provider AS ENUM ('google', 'linkedin', 'github');

-- Social accounts table
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider social_provider NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(255),
    profile_picture_url VARCHAR(500),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    profile_data JSONB,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

-- Account linking requests table (for linking social accounts to existing accounts)
CREATE TABLE account_linking_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider social_provider NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    verification_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX idx_social_accounts_provider ON social_accounts(provider);
CREATE INDEX idx_social_accounts_provider_user_id ON social_accounts(provider, provider_user_id);
CREATE INDEX idx_account_linking_requests_user_id ON account_linking_requests(user_id);
CREATE INDEX idx_account_linking_requests_token ON account_linking_requests(verification_token);
CREATE INDEX idx_account_linking_requests_expires_at ON account_linking_requests(expires_at);

-- Apply updated_at trigger
CREATE TRIGGER update_social_accounts_updated_at 
    BEFORE UPDATE ON social_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add social_login_enabled column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_login_enabled BOOLEAN DEFAULT true;

-- Comments for documentation
COMMENT ON TABLE social_accounts IS 'Stores OAuth credentials and profile data for social media authentication';
COMMENT ON TABLE account_linking_requests IS 'Temporary storage for account linking verification requests';
COMMENT ON COLUMN social_accounts.is_primary IS 'Indicates if this is the primary social account used for login';
COMMENT ON COLUMN social_accounts.profile_data IS 'Stores additional profile data from the social provider';
