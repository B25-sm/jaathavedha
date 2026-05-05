# Security Service

Comprehensive security service for the Sai Mahendra EdTech platform providing encryption, key management, security monitoring, intrusion detection, and GDPR compliance features.

## Features

### 1. Data Encryption (Requirement 11.1, 11.6)
- **AES-256-GCM encryption** for data at rest
- **Field-level encryption** for sensitive user data
- **Encryption key versioning** for rotation tracking
- **HMAC signatures** for data integrity verification

### 2. TLS Configuration (Requirement 11.2)
- **TLS 1.3** support for all service communications
- Secure cipher suite configuration
- Certificate management
- Self-signed certificate generation for development

### 3. Key Management (Requirement 11.1, 11.6)
- Automated key generation and rotation
- Key lifecycle management (active, rotated, revoked, expired)
- Integration-ready for AWS KMS and HashiCorp Vault
- 90-day default rotation policy

### 4. Security Monitoring (Requirement 11.7)
- Real-time security event logging
- Authentication attempt tracking
- Data access logging
- Security dashboard metrics
- Alert system for high-severity events

### 5. Intrusion Detection (Requirement 11.8)
- Brute force attack detection
- Anomaly detection for user behavior
- Automatic IP blocking
- Security incident tracking
- Automated threat response

### 6. GDPR Compliance (Requirement 11.4, 11.5)
- **Data portability**: Complete user data export
- **Right to erasure**: Comprehensive data deletion
- **Data anonymization**: Analytics data anonymization
- **Consent management**: Granular consent tracking
- Audit trail for all GDPR actions

## API Endpoints

### Encryption Endpoints

#### Encrypt Data
```http
POST /encryption/encrypt
Content-Type: application/json

{
  "data": "sensitive information"
}
```

#### Decrypt Data
```http
POST /encryption/decrypt
Content-Type: application/json

{
  "encrypted": "base64-encoded-encrypted-data"
}
```

#### Generate Encryption Key
```http
POST /encryption/keys/generate
Content-Type: application/json

{
  "purpose": "user-data-encryption"
}
```

#### Rotate Encryption Key
```http
POST /encryption/keys/:keyId/rotate
```

#### Get Active Keys
```http
GET /encryption/keys
```

### Security Monitoring Endpoints

#### Log Security Event
```http
POST /monitoring/events
Content-Type: application/json

{
  "type": "unauthorized_access",
  "severity": "high",
  "userId": "user-id",
  "ipAddress": "192.168.1.1",
  "details": {}
}
```

#### Log Authentication Attempt
```http
POST /monitoring/auth-attempt
Content-Type: application/json

{
  "userId": "user-id",
  "ipAddress": "192.168.1.1",
  "success": false,
  "method": "password",
  "reason": "invalid_credentials"
}
```

#### Check IP Block Status
```http
GET /monitoring/ip/:ipAddress/blocked
```

#### Detect User Anomalies
```http
GET /monitoring/anomalies/:userId
```

#### Get Security Dashboard
```http
GET /monitoring/dashboard
```

#### Log Data Access
```http
POST /monitoring/data-access
Content-Type: application/json

{
  "userId": "user-id",
  "ipAddress": "192.168.1.1",
  "resource": "user_profiles",
  "action": "read",
  "sensitiveData": true,
  "recordCount": 1
}
```

### GDPR Compliance Endpoints

#### Export User Data
```http
GET /gdpr/export/:userId
```

Response includes:
- User profile
- Enrollments
- Payment history
- Contact inquiries
- Progress data
- Consent records
- Analytics data (anonymized)

#### Delete User Data (Right to Erasure)
```http
DELETE /gdpr/delete/:userId
Content-Type: application/json

{
  "reason": "User requested account deletion"
}
```

#### Anonymize User Data
```http
POST /gdpr/anonymize/:userId
```

#### Record User Consent
```http
POST /gdpr/consent
Content-Type: application/json

{
  "userId": "user-id",
  "consentType": "privacy_policy",
  "granted": true,
  "purpose": "Accept privacy policy",
  "version": "1.0",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

#### Get User Consent Status
```http
GET /gdpr/consent/:userId
```

#### Withdraw Consent
```http
POST /gdpr/consent/:userId/withdraw
Content-Type: application/json

{
  "consentType": "marketing_emails",
  "reason": "User opted out"
}
```

#### Check Required Consents
```http
GET /gdpr/consent/:userId/required
```

## Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3009

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/sai_mahendra_dev
MONGODB_URL=mongodb://admin:admin123@mongodb:27017/sai_mahendra_security?authSource=admin
REDIS_URL=redis://redis:6379

# Encryption Configuration
MASTER_ENCRYPTION_KEY=your-master-encryption-key-change-in-production-min-32-chars
ENCRYPTION_ALGORITHM=aes-256-gcm
KEY_ROTATION_DAYS=90

# TLS Configuration
TLS_ENABLED=true
TLS_CERT_PATH=/etc/ssl/certs/server.crt
TLS_KEY_PATH=/etc/ssl/private/server.key
TLS_MIN_VERSION=TLSv1.3

# Security Monitoring
SECURITY_LOG_LEVEL=info
ALERT_WEBHOOK_URL=https://your-alert-webhook.com
ANOMALY_DETECTION_ENABLED=true
INTRUSION_DETECTION_ENABLED=true

# GDPR Configuration
DATA_RETENTION_DAYS=2555
ANONYMIZATION_ENABLED=true
CONSENT_TRACKING_ENABLED=true
```

## Database Schema

The service uses the following database tables:

- `user_consents`: Stores user consent records
- `security_audit_log`: Comprehensive security audit trail
- `data_access_log`: Tracks all access to sensitive data
- `encryption_keys`: Manages encryption key lifecycle
- `gdpr_deletion_requests`: Tracks data deletion requests
- `gdpr_export_requests`: Tracks data export requests
- `security_incidents`: Records security incidents
- `blocked_ips`: Manages IP blocking

## Security Features

### Encryption at Rest
All sensitive data is encrypted using AES-256-GCM encryption with:
- Random initialization vectors (IV) for each encryption
- Authentication tags for data integrity
- Key versioning for rotation support

### Field-Level Encryption
Specific fields can be encrypted individually:
```typescript
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  ssn: '123-45-6789'
};

const encrypted = encryptionService.encryptFields(userData, ['ssn']);
```

### Automatic Key Rotation
Keys are automatically rotated based on the configured rotation policy (default: 90 days). The service checks for keys nearing expiration and rotates them automatically.

### Brute Force Protection
The service automatically detects and blocks brute force attacks:
- Tracks failed login attempts per user/IP
- Blocks IP after 5 failed attempts within 15 minutes
- Automatic unblock after 1 hour

### Anomaly Detection
The service detects anomalous user behavior:
- Unusual access times (2 AM - 5 AM)
- Rapid successive requests (>10 in 1 minute)
- Access from multiple locations
- Unusual data access volume (>1000 records)

### GDPR Compliance
Full GDPR compliance with:
- Complete data export in structured format
- Comprehensive data deletion with audit trail
- Consent management with versioning
- Data anonymization for analytics

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Integration with Other Services

### User Management Service
```typescript
// Encrypt sensitive user data before storing
const encryptedData = await fetch('http://security:3009/encryption/encrypt', {
  method: 'POST',
  body: JSON.stringify({ data: sensitiveInfo })
});

// Log authentication attempts
await fetch('http://security:3009/monitoring/auth-attempt', {
  method: 'POST',
  body: JSON.stringify({
    userId: user.id,
    ipAddress: req.ip,
    success: true,
    method: 'password'
  })
});
```

### Admin Panel
```typescript
// Export user data for GDPR request
const userData = await fetch(`http://security:3009/gdpr/export/${userId}`);

// Get security dashboard metrics
const metrics = await fetch('http://security:3009/monitoring/dashboard');
```

## Production Deployment

### AWS KMS Integration
For production, integrate with AWS KMS for key management:

```typescript
// Update KeyManagementService to use AWS KMS
const kms = new AWS.KMS({ region: process.env.AWS_REGION });
const result = await kms.generateDataKey({
  KeyId: process.env.AWS_KMS_KEY_ID,
  KeySpec: 'AES_256'
}).promise();
```

### TLS Certificate Setup
For production, use proper TLS certificates:

```bash
# Using Let's Encrypt
certbot certonly --standalone -d security.saimahendra.com

# Update environment variables
TLS_ENABLED=true
TLS_CERT_PATH=/etc/letsencrypt/live/security.saimahendra.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/security.saimahendra.com/privkey.pem
```

### Alert Webhook Configuration
Configure webhook for security alerts:

```env
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## Monitoring and Logging

The service logs all security events to:
- MongoDB for long-term storage and analysis
- Redis for real-time monitoring
- Console logs for immediate visibility

Security dashboard provides:
- Total security events
- Critical event count
- Event breakdown by type
- Recent security alerts
- Blocked IP addresses

## License

Proprietary - Sai Mahendra EdTech Platform
