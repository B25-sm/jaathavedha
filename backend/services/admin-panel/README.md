# Admin Panel Backend Service

Comprehensive administrative backend service for the Sai Mahendra EdTech platform, providing complete management capabilities for users, content, courses, and financial operations.

## Features

### 🔐 Authentication & Authorization
- Admin-specific JWT authentication
- Redis-based session management
- Token blacklisting for secure logout
- Automatic session expiration
- Comprehensive audit logging

### 👥 User Management
- Advanced user search and filtering
- Role and status management
- Bulk operations (update, delete)
- User activity monitoring
- Data export (CSV/JSON)
- User statistics and analytics

### 📝 Content Management
- Content CRUD operations
- Approval workflow (approve/reject)
- Bulk publish/unpublish
- Pending approvals queue
- Content statistics
- Media management integration

### 📚 Course Management
- Program CRUD operations
- Enrollment management
- Course analytics (enrollment, completion, revenue)
- Top performing courses
- Enrollment statistics

### 💰 Financial Management
- Payment monitoring and filtering
- Refund processing
- Subscription management
- Revenue and refunds reporting
- Financial statistics
- Payment gateway configuration

### 📊 Dashboard & Analytics
- Real-time metrics dashboard
- System health monitoring
- Audit log viewing
- Integration with analytics service

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js with TypeScript
- **Databases:** PostgreSQL, MongoDB, Redis
- **Authentication:** JWT with Redis sessions
- **Testing:** Jest with Supertest
- **Documentation:** OpenAPI/Swagger compatible

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 15+
- MongoDB 7+
- Redis 7+
- Docker and Docker Compose (for containerized deployment)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3008

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev
MONGODB_URL=mongodb://admin:admin123@localhost:27017/sai_mahendra_content?authSource=admin
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Admin Session Configuration
ADMIN_SESSION_TIMEOUT=3600
ADMIN_SESSION_REFRESH_THRESHOLD=300

# Service URLs
USER_SERVICE_URL=http://localhost:3001
COURSE_SERVICE_URL=http://localhost:3002
PAYMENT_SERVICE_URL=http://localhost:3003
CONTENT_SERVICE_URL=http://localhost:3005
ANALYTICS_SERVICE_URL=http://localhost:3006

# Security
ALLOWED_ORIGINS=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f admin-panel

# Stop services
docker-compose down
```

## API Documentation

See [API_REFERENCE.md](./API_REFERENCE.md) for complete API documentation.

### Quick Examples

#### Admin Login
```bash
curl -X POST http://localhost:3008/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword"
  }'
```

#### Get Dashboard Metrics
```bash
curl -X GET http://localhost:3008/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Search Users
```bash
curl -X GET "http://localhost:3008/api/admin/users?search=john&role=student&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Process Refund
```bash
curl -X POST http://localhost:3008/api/admin/financial/payments/PAYMENT_ID/refund \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "reason": "Customer requested refund"
  }'
```

## Architecture

### Service Structure
```
admin-panel/
├── src/
│   ├── index.ts                 # Main application entry
│   ├── types/                   # TypeScript type definitions
│   ├── middleware/              # Authentication, audit logging
│   ├── routes/                  # API route handlers
│   │   ├── auth.ts             # Authentication routes
│   │   ├── users.ts            # User management routes
│   │   ├── content.ts          # Content management routes
│   │   ├── courses.ts          # Course management routes
│   │   ├── financial.ts        # Financial management routes
│   │   └── dashboard.ts        # Dashboard routes
│   ├── services/               # Business logic services
│   │   ├── UserManagementService.ts
│   │   ├── ContentManagementService.ts
│   │   ├── CourseManagementService.ts
│   │   └── FinancialManagementService.ts
│   └── __tests__/              # Test files
├── package.json
├── tsconfig.json
├── jest.config.js
├── Dockerfile.dev
└── README.md
```

### Database Schema

#### admin_audit_logs
```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

#### payment_refunds
```sql
CREATE TABLE payment_refunds (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  admin_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

## Security

### Authentication
- JWT-based authentication with admin role verification
- Redis-backed session management
- Token blacklisting for secure logout
- Automatic session expiration

### Authorization
- Admin-only access to all endpoints
- Role-based access control
- Permission validation

### Audit Logging
- All admin actions logged
- IP address and user agent tracking
- Success/failure status
- Change tracking

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable limits
- Protection against abuse

### Data Protection
- Parameterized SQL queries (SQL injection prevention)
- Input validation on all endpoints
- CORS protection
- Helmet security headers
- Compression enabled

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Coverage Report
```bash
npm run test:coverage
```

### Manual Testing
See [TASK_12_COMPLETION_REPORT.md](./TASK_12_COMPLETION_REPORT.md) for manual testing checklist.

## Monitoring

### Health Check
```bash
curl http://localhost:3008/health
```

### System Health
```bash
curl http://localhost:3008/api/admin/dashboard/health \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Audit Logs
```bash
curl "http://localhost:3008/api/admin/dashboard/audit-logs?page=1&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Performance

- **Pagination:** All list endpoints support pagination
- **Caching:** Redis caching for frequently accessed data
- **Connection Pooling:** PostgreSQL connection pool
- **Compression:** Response compression enabled
- **Indexing:** Database indexes on frequently queried fields

## Error Handling

All endpoints return standardized error responses:

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

## Contributing

1. Follow existing code patterns
2. Write tests for new features
3. Update documentation
4. Follow TypeScript best practices
5. Use meaningful commit messages

## License

Proprietary - Sai Mahendra EdTech Platform

## Support

For issues or questions, contact the development team.

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial release
- Admin authentication and authorization
- User management APIs
- Content management APIs
- Course management APIs
- Financial management APIs
- Dashboard and analytics
- Comprehensive audit logging
