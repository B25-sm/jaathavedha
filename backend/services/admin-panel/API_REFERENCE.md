# Admin Panel API Reference

## Overview

The Admin Panel Service provides comprehensive administrative capabilities for the Sai Mahendra platform, including user management, content management, course administration, and financial operations.

**Base URL:** `http://localhost:3008`

**Authentication:** All endpoints (except `/health` and `/api/admin/auth/*`) require admin authentication via JWT Bearer token.

## Authentication

### Admin Login
```http
POST /api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "admin@example.com",
      "role": "admin"
    },
    "expiresIn": "15m"
  }
}
```

### Admin Logout
```http
POST /api/admin/auth/logout
Authorization: Bearer {token}
```

### Verify Session
```http
GET /api/admin/auth/verify
Authorization: Bearer {token}
```

## User Management

### Search Users
```http
GET /api/admin/users?search=john&role=student&status=active&page=1&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `search` (optional): Search by name or email
- `role` (optional): Filter by role (student, instructor, admin)
- `status` (optional): Filter by status (active, inactive, suspended)
- `emailVerified` (optional): Filter by email verification status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

### Get User Details
```http
GET /api/admin/users/{userId}
Authorization: Bearer {token}
```

### Update User Role
```http
PUT /api/admin/users/{userId}/role
Authorization: Bearer {token}
Content-Type: application/json

{
  "role": "instructor"
}
```

### Update User Status
```http
PUT /api/admin/users/{userId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "suspended"
}
```

### Bulk User Operations
```http
POST /api/admin/users/bulk
Authorization: Bearer {token}
Content-Type: application/json

{
  "userIds": ["uuid1", "uuid2"],
  "operation": "update_status",
  "data": {
    "status": "active"
  }
}
```

**Operations:**
- `update_status`: Update status for multiple users
- `update_role`: Update role for multiple users
- `delete`: Soft delete multiple users

### Export User Data
```http
POST /api/admin/users/export
Authorization: Bearer {token}
Content-Type: application/json

{
  "filters": {
    "role": "student",
    "status": "active"
  },
  "format": "csv",
  "fields": ["id", "email", "first_name", "last_name", "created_at"]
}
```

### Get User Statistics
```http
GET /api/admin/users/stats/overview
Authorization: Bearer {token}
```

## Content Management

### Get All Content
```http
GET /api/admin/content?type=testimonial&status=published&page=1&limit=20
Authorization: Bearer {token}
```

### Create Content
```http
POST /api/admin/content
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "testimonial",
  "title": "Great Experience",
  "content": "This platform changed my career...",
  "author": "John Doe",
  "status": "pending"
}
```

### Update Content
```http
PUT /api/admin/content/{contentId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content..."
}
```

### Delete Content
```http
DELETE /api/admin/content/{contentId}
Authorization: Bearer {token}
```

### Approve Content
```http
POST /api/admin/content/{contentId}/approve
Authorization: Bearer {token}
Content-Type: application/json

{
  "comments": "Looks good, approved for publishing"
}
```

### Reject Content
```http
POST /api/admin/content/{contentId}/reject
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Content needs revision"
}
```

### Bulk Publish
```http
POST /api/admin/content/bulk/publish
Authorization: Bearer {token}
Content-Type: application/json

{
  "contentIds": ["id1", "id2", "id3"]
}
```

### Get Pending Approvals
```http
GET /api/admin/content/pending?limit=20
Authorization: Bearer {token}
```

### Get Content Statistics
```http
GET /api/admin/content/stats/overview
Authorization: Bearer {token}
```

## Course Management

### Get All Programs
```http
GET /api/admin/courses/programs?page=1&limit=20
Authorization: Bearer {token}
```

### Create Program
```http
POST /api/admin/courses/programs
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "AI Mastery Program",
  "description": "Comprehensive AI training...",
  "category": "pro_developer",
  "price": 49999,
  "duration_weeks": 24,
  "features": {
    "live_sessions": true,
    "mentorship": true,
    "projects": 10
  }
}
```

### Update Program
```http
PUT /api/admin/courses/programs/{programId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "price": 54999,
  "is_active": true
}
```

### Delete Program
```http
DELETE /api/admin/courses/programs/{programId}
Authorization: Bearer {token}
```

### Get Course Analytics
```http
GET /api/admin/courses/analytics?programId={programId}
Authorization: Bearer {token}
```

### Get Enrollments
```http
GET /api/admin/courses/enrollments?programId={programId}&status=active&page=1&limit=20
Authorization: Bearer {token}
```

### Update Enrollment Status
```http
PUT /api/admin/courses/enrollments/{enrollmentId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "completed"
}
```

### Get Enrollment Statistics
```http
GET /api/admin/courses/stats/enrollments
Authorization: Bearer {token}
```

### Get Top Courses
```http
GET /api/admin/courses/top-courses?limit=10
Authorization: Bearer {token}
```

## Financial Management

### Get All Payments
```http
GET /api/admin/financial/payments?status=completed&gateway=razorpay&page=1&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `userId` (optional): Filter by user
- `programId` (optional): Filter by program
- `status` (optional): Filter by payment status
- `gateway` (optional): Filter by payment gateway
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

### Process Refund
```http
POST /api/admin/financial/payments/{paymentId}/refund
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 5000,
  "reason": "Customer requested refund due to technical issues"
}
```

### Get Subscriptions
```http
GET /api/admin/financial/subscriptions?status=active&page=1&limit=20
Authorization: Bearer {token}
```

### Cancel Subscription
```http
POST /api/admin/financial/subscriptions/{subscriptionId}/cancel
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Customer requested cancellation"
}
```

### Generate Revenue Report
```http
POST /api/admin/financial/reports/revenue
Authorization: Bearer {token}
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

### Generate Refunds Report
```http
POST /api/admin/financial/reports/refunds
Authorization: Bearer {token}
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

### Get Financial Statistics
```http
GET /api/admin/financial/stats/overview
Authorization: Bearer {token}
```

### Get Gateway Configuration
```http
GET /api/admin/financial/gateway/config
Authorization: Bearer {token}
```

### Update Gateway Configuration
```http
PUT /api/admin/financial/gateway/config/{gateway}
Authorization: Bearer {token}
Content-Type: application/json

{
  "enabled": true,
  "supportedCurrencies": ["INR", "USD"],
  "supportedMethods": ["card", "upi", "netbanking"]
}
```

## Dashboard

### Get Dashboard Metrics
```http
GET /api/admin/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1500,
      "active": 1200,
      "new": 50,
      "byRole": {
        "student": 1400,
        "instructor": 95,
        "admin": 5
      }
    },
    "enrollments": {
      "total": 3500,
      "active": 2800,
      "completed": 600,
      "recent": 120
    },
    "revenue": {
      "total": 5000000,
      "today": 50000,
      "thisMonth": 800000,
      "lastMonth": 750000
    },
    "content": {
      "total": 250,
      "published": 200,
      "pending": 15
    },
    "systemHealth": {
      "status": "healthy",
      "services": {
        "database": true,
        "mongodb": true,
        "redis": true,
        "analytics": true
      }
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Get Audit Logs
```http
GET /api/admin/dashboard/audit-logs?page=1&limit=50&action=USER_UPDATED
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `adminId` (optional): Filter by admin user
- `action` (optional): Filter by action type
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

### Get System Health
```http
GET /api/admin/dashboard/health
Authorization: Bearer {token}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "code": "MISSING_REQUIRED_FIELDS",
    "message": "Email and password are required",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Common Error Types:**
- `VALIDATION_ERROR`: Invalid input data
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `EXTERNAL_SERVICE_ERROR`: External service request failed
- `INTERNAL_SERVER_ERROR`: Unexpected server error

## Rate Limiting

- **Window:** 15 minutes
- **Max Requests:** 100 per IP address
- **Response:** 429 Too Many Requests

## Audit Logging

All admin actions are automatically logged with the following information:
- Admin user ID and email
- Action performed
- Resource affected
- Changes made
- IP address and user agent
- Timestamp
- Success/failure status

Audit logs can be accessed via the `/api/admin/dashboard/audit-logs` endpoint.
