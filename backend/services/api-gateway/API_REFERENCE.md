# API Gateway Reference

## Overview

The API Gateway serves as the single entry point for all client requests to the Sai Mahendra platform microservices. It provides routing, authentication, rate limiting, circuit breaking, and service health monitoring.

**Base URL**: `http://localhost:3000`

**Version**: 1.0.0

## Features

- **Service Routing**: Routes requests to appropriate microservices
- **Authentication**: JWT-based authentication validation
- **Authorization**: Role-based access control (RBAC)
- **Rate Limiting**: 1000 requests per 15 minutes per IP
- **Circuit Breaker**: Automatic failover for unhealthy services
- **Health Monitoring**: Periodic health checks for all services
- **API Versioning**: Support for v1 API with backward compatibility
- **Request Logging**: Comprehensive request/response logging
- **Security Headers**: Helmet.js security headers
- **CORS**: Configurable cross-origin resource sharing
- **Compression**: Response compression for better performance

## Architecture

```
Client Request
     ↓
API Gateway (Port 3000)
     ↓
┌────────────────────────────────────────┐
│  Authentication & Authorization        │
│  Rate Limiting                          │
│  Circuit Breaker Check                  │
│  Request Logging                        │
└────────────────────────────────────────┘
     ↓
Service Router
     ↓
┌─────────────────────────────────────────────────────┐
│  user-management (3001)                             │
│  course-management (3002)                           │
│  payment (3003)                                     │
│  contact (3004)                                     │
│  content-management (3005)                          │
│  analytics (3006)                                   │
│  notification (3007)                                │
└─────────────────────────────────────────────────────┘
```

## API Versioning

The gateway supports API versioning for backward compatibility:

- **v1 API**: `/api/v1/*` - Current version with all features
- **Legacy API**: `/api/*` - Backward compatible routes (no version prefix)

### Example:
```
# v1 API (recommended)
GET /api/v1/users/profile

# Legacy API (backward compatible)
GET /api/users/profile
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Token Structure:
```json
{
  "userId": "user_123",
  "email": "user@example.com",
  "role": "student",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### User Information Headers:
The gateway forwards user information to backend services via headers:
- `X-User-ID`: User's unique identifier
- `X-User-Role`: User's role (student, instructor, admin)
- `X-User-Email`: User's email address
- `X-Request-ID`: Unique request identifier for tracing

## Endpoints

### Health Check

#### GET /health

Check API Gateway health and all service statuses.

**Response**:
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "redis": "connected"
  },
  "services": {
    "user-management": {
      "status": "healthy",
      "lastCheck": "2024-01-15T10:29:45Z",
      "responseTime": 45
    },
    "course-management": {
      "status": "healthy",
      "lastCheck": "2024-01-15T10:29:45Z",
      "responseTime": 38
    },
    "payment": {
      "status": "healthy",
      "lastCheck": "2024-01-15T10:29:45Z",
      "responseTime": 52
    }
  }
}
```

#### GET /health/services

Get detailed health status of all backend services.

**Response**:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "services": [
    {
      "name": "user-management",
      "url": "http://localhost:3001",
      "status": "healthy",
      "lastCheck": "2024-01-15T10:29:45Z",
      "responseTime": 45
    },
    {
      "name": "course-management",
      "url": "http://localhost:3002",
      "status": "healthy",
      "lastCheck": "2024-01-15T10:29:45Z",
      "responseTime": 38
    }
  ]
}
```

---

### User Management Service Routes

#### Public Routes

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password

#### Protected Routes (Authentication Required)

- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile
- `POST /api/v1/auth/logout` - Logout user
- `POST /api/v1/auth/change-password` - Change password

#### Admin Routes (Admin Role Required)

- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/users/:id` - Get user by ID
- `PUT /api/v1/admin/users/:id` - Update user
- `DELETE /api/v1/admin/users/:id` - Delete user
- `POST /api/v1/admin/users/:id/roles` - Assign roles

---

### Course Management Service Routes

#### Protected Routes (Authentication Required)

- `GET /api/v1/programs` - List all programs
- `GET /api/v1/programs/:id` - Get program details
- `POST /api/v1/enrollments` - Enroll in program
- `GET /api/v1/enrollments` - Get user enrollments
- `GET /api/v1/enrollments/:id` - Get enrollment details
- `PUT /api/v1/enrollments/:id/progress` - Update progress

---

### Payment Service Routes

#### Protected Routes (Authentication Required)

- `POST /api/v1/payments/create-order` - Create payment order
- `POST /api/v1/payments/verify` - Verify payment
- `GET /api/v1/payments/history` - Get payment history
- `GET /api/v1/payments/:id` - Get payment details
- `POST /api/v1/payments/refund` - Request refund

---

### Contact Service Routes

#### Public Routes

- `POST /api/v1/contact/submit` - Submit contact form

#### Protected Routes (Authentication Required)

- `GET /api/v1/contact/admin/inquiries` - List all inquiries (admin)
- `GET /api/v1/contact/admin/inquiries/:id` - Get inquiry details (admin)
- `PUT /api/v1/contact/admin/inquiries/:id` - Update inquiry status (admin)

---

### Content Management Service Routes

#### Public Routes

- `GET /api/v1/content/public/testimonials` - Get testimonials
- `GET /api/v1/content/public/marketing` - Get marketing content

#### Protected Routes (Authentication Required)

- `GET /api/v1/content` - List content
- `POST /api/v1/content` - Create content (admin)
- `PUT /api/v1/content/:id` - Update content (admin)
- `DELETE /api/v1/content/:id` - Delete content (admin)
- `POST /api/v1/content/media/upload` - Upload media

---

### Analytics Service Routes

#### Protected Routes (Authentication Required)

- `GET /api/v1/analytics/dashboard` - Get dashboard data
- `GET /api/v1/analytics/reports/enrollment` - Enrollment reports
- `GET /api/v1/analytics/reports/revenue` - Revenue reports
- `GET /api/v1/analytics/reports/user-engagement` - Engagement reports
- `POST /api/v1/analytics/export` - Export analytics data

---

### Notification Service Routes

#### Protected Routes (Authentication Required)

- `POST /api/v1/notifications/email/send` - Send email
- `POST /api/v1/notifications/push/send` - Send push notification
- `GET /api/v1/notifications/preferences/:userId` - Get preferences
- `PUT /api/v1/notifications/preferences/:userId` - Update preferences
- `POST /api/v1/notifications/push/subscribe` - Subscribe to push

---

## Circuit Breaker

The gateway implements a circuit breaker pattern to handle service failures gracefully.

### States:

1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Service is failing, requests are rejected immediately
3. **HALF_OPEN**: Testing if service has recovered

### Configuration:

- **Failure Threshold**: 5 consecutive failures
- **Open Timeout**: 60 seconds
- **Reset Timeout**: 30 seconds

### Behavior:

- After 5 consecutive failures, circuit opens
- Requests are rejected with 503 status
- After 30 seconds, circuit moves to HALF_OPEN
- Next successful request closes the circuit
- Next failed request reopens the circuit

### Error Response:
```json
{
  "error": {
    "type": "SERVICE_UNAVAILABLE",
    "code": "CIRCUIT_BREAKER_OPEN",
    "message": "Service user-management is temporarily unavailable",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## Rate Limiting

Rate limiting is applied globally to all endpoints:

- **Window**: 15 minutes
- **Max Requests**: 1000 per IP address
- **Headers**: Standard rate limit headers included

### Rate Limit Headers:
```
RateLimit-Limit: 1000
RateLimit-Remaining: 999
RateLimit-Reset: 1234567890
```

### Rate Limit Exceeded Response:
```json
{
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests from this IP, please try again later.",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "type": "ERROR_TYPE",
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Common Error Types:

- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request data
- `SERVICE_UNAVAILABLE`: Backend service unavailable
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `NOT_FOUND`: Endpoint not found
- `INTERNAL_SERVER_ERROR`: Unexpected error

### HTTP Status Codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error
- `503`: Service Unavailable

---

## Security Features

### 1. Helmet.js Security Headers

- Content Security Policy
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

### 2. CORS Configuration

Configurable allowed origins via environment variable:
```env
ALLOWED_ORIGINS=http://localhost:3000,https://saimahendra.com
```

### 3. JWT Validation

- Token signature verification
- Token expiration check
- Blacklist check via Redis

### 4. Request Size Limits

- JSON body: 10MB max
- URL-encoded body: 10MB max

---

## Service Discovery

The gateway maintains a registry of all backend services and their health status:

- **Periodic Health Checks**: Every 30 seconds
- **Health Status**: healthy, unhealthy, unknown
- **Response Time Tracking**: Monitors service performance
- **Automatic Failover**: Circuit breaker for failed services

---

## Monitoring and Logging

### Request Logging

All requests are logged with:
- Method and URL
- Status code
- Response time
- User agent
- IP address
- Request ID for tracing

### Log Format:
```json
{
  "level": "info",
  "message": "Request completed",
  "method": "GET",
  "url": "/api/v1/users/profile",
  "statusCode": 200,
  "duration": "45ms",
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.1",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Service URLs
USER_SERVICE_URL=http://localhost:3001
COURSE_SERVICE_URL=http://localhost:3002
PAYMENT_SERVICE_URL=http://localhost:3003
CONTACT_SERVICE_URL=http://localhost:3004
CONTENT_SERVICE_URL=http://localhost:3005
ANALYTICS_SERVICE_URL=http://localhost:3006
NOTIFICATION_SERVICE_URL=http://localhost:3007
```

---

## Best Practices

1. **Always use v1 API**: Use `/api/v1/*` endpoints for new integrations
2. **Include Authorization header**: For all protected endpoints
3. **Handle rate limits**: Implement exponential backoff
4. **Check circuit breaker status**: Handle 503 errors gracefully
5. **Use request IDs**: For debugging and tracing
6. **Monitor health endpoint**: Check service health before critical operations
7. **Implement retries**: With exponential backoff for transient failures

---

## Deployment

### Docker

```bash
docker build -f Dockerfile.dev -t api-gateway .
docker run -p 3000:3000 --env-file .env api-gateway
```

### Docker Compose

```bash
docker-compose up api-gateway
```

---

## Support

For issues or questions:
- Email: support@saimahendra.com
- Documentation: This file
- Health Check: GET /health
