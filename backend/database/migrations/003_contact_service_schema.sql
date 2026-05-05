-- Contact Service Database Schema Migration
-- Migration: 003_contact_service_schema.sql
-- Description: Create tables for contact inquiries, responses, and communication history

-- Create inquiry_category enum
CREATE TYPE inquiry_category AS ENUM (
  'general',
  'enrollment', 
  'technical_support',
  'billing'
);

-- Create inquiry_status enum
CREATE TYPE inquiry_status AS ENUM (
  'new',
  'in_progress',
  'resolved',
  'closed'
);

-- Create communication_type enum
CREATE TYPE communication_type AS ENUM (
  'email',
  'whatsapp',
  'internal_note'
);

-- Create communication_direction enum
CREATE TYPE communication_direction AS ENUM (
  'inbound',
  'outbound'
);

-- Contact inquiries table
CREATE TABLE contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  category inquiry_category NOT NULL DEFAULT 'general',
  status inquiry_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes for performance
  CONSTRAINT contact_inquiries_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT contact_inquiries_name_check CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT contact_inquiries_subject_check CHECK (LENGTH(TRIM(subject)) >= 5),
  CONSTRAINT contact_inquiries_message_check CHECK (LENGTH(TRIM(message)) >= 10)
);

-- Inquiry responses table
CREATE TABLE inquiry_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES contact_inquiries(id) ON DELETE CASCADE,
  admin_id VARCHAR(255) NOT NULL, -- Will reference users table when user service is integrated
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT inquiry_responses_message_check CHECK (LENGTH(TRIM(message)) >= 1)
);

-- Communication history table for tracking all interactions
CREATE TABLE communication_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES contact_inquiries(id) ON DELETE CASCADE,
  type communication_type NOT NULL,
  direction communication_direction NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email templates table for managing email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  subject VARCHAR(200) NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT email_templates_name_check CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT email_templates_subject_check CHECK (LENGTH(TRIM(subject)) >= 1)
);

-- WhatsApp message log table for tracking WhatsApp communications
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES contact_inquiries(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, template, etc.
  content TEXT NOT NULL,
  direction communication_direction NOT NULL,
  whatsapp_message_id VARCHAR(255), -- WhatsApp's message ID
  status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read, failed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX idx_contact_inquiries_status ON contact_inquiries(status);
CREATE INDEX idx_contact_inquiries_category ON contact_inquiries(category);
CREATE INDEX idx_contact_inquiries_created_at ON contact_inquiries(created_at DESC);
CREATE INDEX idx_contact_inquiries_email ON contact_inquiries(email);
CREATE INDEX idx_contact_inquiries_status_created ON contact_inquiries(status, created_at DESC);

CREATE INDEX idx_inquiry_responses_inquiry_id ON inquiry_responses(inquiry_id);
CREATE INDEX idx_inquiry_responses_created_at ON inquiry_responses(created_at DESC);

CREATE INDEX idx_communication_history_inquiry_id ON communication_history(inquiry_id);
CREATE INDEX idx_communication_history_created_at ON communication_history(created_at DESC);
CREATE INDEX idx_communication_history_type ON communication_history(type);

CREATE INDEX idx_email_templates_name ON email_templates(name);
CREATE INDEX idx_email_templates_active ON email_templates(is_active);

CREATE INDEX idx_whatsapp_messages_inquiry_id ON whatsapp_messages(inquiry_id);
CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_contact_inquiries_updated_at 
  BEFORE UPDATE ON contact_inquiries 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at 
  BEFORE UPDATE ON email_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically set responded_at when status changes
CREATE OR REPLACE FUNCTION set_responded_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set responded_at when status changes from 'new' to any other status
  IF OLD.status = 'new' AND NEW.status != 'new' AND NEW.responded_at IS NULL THEN
    NEW.responded_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for responded_at
CREATE TRIGGER set_inquiry_responded_at 
  BEFORE UPDATE ON contact_inquiries 
  FOR EACH ROW EXECUTE FUNCTION set_responded_at();

-- Insert default email templates
INSERT INTO email_templates (name, subject, html_content, text_content, variables) VALUES
(
  'contact_confirmation',
  'Thank you for contacting Sai Mahendra Platform',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Thank you for contacting us</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
      <h1>Thank You for Contacting Us!</h1>
    </div>
    <div style="padding: 20px; background-color: #f9f9f9;">
      <p>Dear {{name}},</p>
      <p>We have received your inquiry and appreciate you taking the time to contact us. Our team will review your message and get back to you within 24 hours.</p>
      <div style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px;">
        <h3>Your Inquiry Details:</h3>
        <ul>
          <li><strong>Subject:</strong> {{subject}}</li>
          <li><strong>Category:</strong> {{category}}</li>
          <li><strong>Inquiry ID:</strong> {{inquiryId}}</li>
        </ul>
      </div>
      <p>Best regards,<br><strong>Sai Mahendra Platform Team</strong></p>
    </div>
  </div>
</body>
</html>',
  'Dear {{name}},

Thank you for contacting Sai Mahendra Platform!

We have received your inquiry and will get back to you within 24 hours.

Your inquiry details:
- Subject: {{subject}}
- Category: {{category}}
- Inquiry ID: {{inquiryId}}

Best regards,
Sai Mahendra Platform Team',
  ARRAY['name', 'subject', 'category', 'inquiryId']
),
(
  'admin_notification',
  'New Contact Inquiry: {{subject}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Contact Inquiry</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
      <h1>🔔 New Contact Inquiry</h1>
    </div>
    <div style="padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px;">
        <h3>Contact Information:</h3>
        <ul>
          <li><strong>Name:</strong> {{name}}</li>
          <li><strong>Email:</strong> {{email}}</li>
          <li><strong>Phone:</strong> {{phone}}</li>
          <li><strong>Category:</strong> {{category}}</li>
          <li><strong>Subject:</strong> {{subject}}</li>
          <li><strong>Inquiry ID:</strong> {{inquiryId}}</li>
        </ul>
      </div>
      <div style="background-color: #e9ecef; padding: 15px; margin: 15px 0; border-radius: 5px;">
        <h3>Message:</h3>
        <p>{{message}}</p>
      </div>
      <p><strong>Action Required:</strong> Please respond to this inquiry within 24 hours.</p>
    </div>
  </div>
</body>
</html>',
  'NEW CONTACT INQUIRY RECEIVED

Contact Information:
- Name: {{name}}
- Email: {{email}}
- Phone: {{phone}}
- Category: {{category}}
- Subject: {{subject}}
- Inquiry ID: {{inquiryId}}

Message:
{{message}}

Action Required: Please respond to this inquiry within 24 hours.',
  ARRAY['name', 'email', 'phone', 'category', 'subject', 'inquiryId', 'message']
);

-- Create view for inquiry statistics
CREATE VIEW inquiry_stats AS
SELECT 
  COUNT(*) as total_inquiries,
  COUNT(CASE WHEN status = 'new' THEN 1 END) as new_inquiries,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_inquiries,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_inquiries,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_inquiries,
  COUNT(CASE WHEN category = 'general' THEN 1 END) as general_inquiries,
  COUNT(CASE WHEN category = 'enrollment' THEN 1 END) as enrollment_inquiries,
  COUNT(CASE WHEN category = 'technical_support' THEN 1 END) as technical_inquiries,
  COUNT(CASE WHEN category = 'billing' THEN 1 END) as billing_inquiries,
  AVG(CASE 
    WHEN responded_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (responded_at - created_at))/3600 
  END) as avg_response_time_hours,
  COUNT(CASE WHEN responded_at IS NOT NULL THEN 1 END)::FLOAT / 
    NULLIF(COUNT(*), 0) * 100 as response_rate_percentage
FROM contact_inquiries;

-- Grant permissions (adjust as needed for your user setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO contact_service_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO contact_service_user;

-- Add comments for documentation
COMMENT ON TABLE contact_inquiries IS 'Stores contact form submissions and inquiries from users';
COMMENT ON TABLE inquiry_responses IS 'Stores admin responses to contact inquiries';
COMMENT ON TABLE communication_history IS 'Tracks all communication interactions for inquiries';
COMMENT ON TABLE email_templates IS 'Stores email templates for automated communications';
COMMENT ON TABLE whatsapp_messages IS 'Logs WhatsApp messages sent and received';
COMMENT ON VIEW inquiry_stats IS 'Provides aggregated statistics for contact inquiries';