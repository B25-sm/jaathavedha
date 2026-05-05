# Sai Mahendra Platform Backend Services

This directory contains all the microservices that power the Sai Mahendra educational platform backend.

## Architecture Overview

The backend follows a microservices architecture with the following services:

- **API Gateway** (Port 3000) - Central entry point and request routing
- **User Management** (Port 3001) - Authentication and user management
- **Course Management** (Port 3002) - Programs, courses, and enrollments
- **Payment Service** (Port 3003) - Payment processing with Razorpay/Stripe
- **Contact Service** (Port 3004) - Contact forms and communication
- **Content Management** (Port 3005) - Dynamic content and media
- **Analytics Service** (Port 3006) - Event tracking and reporting
- **Notification Service** (Port 3007) - Email and push notifications

## Prerequisites

Before running the services, ensure you have:

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v15 or higher)
3. **Redis** (v7 or higher)
4. **MongoDB** (v7 or higher)

### Database Setup

1. **PostgreSQL**: Create database `sai_mahendra_dev`
2. **Redis**: Default configuration on port 6379
3. **MongoDB**: Create databases `sai_mahendra_content` and `sai_mahendra_analytics`

## Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Start all services with databases
npm run docker:up

# Stop all services
npm run docker:down
```

### Option 2: Manual Setup

1. **Install dependencies for all services:**
```bash
npm install
```

2. **Start databases** (PostgreSQL, Redis, MongoDB)

3. **Start all services:**
```bash
npm run start:services
```

4. **Run integration tests:**
```bash
npm run test:integration
```

## Service Details

### API Gateway (Port 3000)
- **Purpose**: Central entry point for all API requests
- **Features**: Authentication, rate limiting, request routing
- **Health Check**: `GET /health`

### User Management Service (Port 3001)
- **Purpose**: User authentication and profile management
- **Key Endpoints**:
  - `POST /auth/register` - User registration
  - `POST /auth/login` - User login
  - `GET /users/profile` - Get user profile
- **Health Check**: `GET /health`

### Course Management Service (Port 3002)
- **Purpose**: Program and course management
- **Key Endpoints**:
  - `GET /api/programs` - List programs
  - `POST /api/enrollments` - Enroll in program
  - `GET /api/enrollments/user/:userId` - User enrollments
- **Health Check**: `GET /health`

### Payment Service (Port 3003)
- **Purpose**: Payment processing and subscription management
- **Key Endpoints**:
  - `POST /api/payments/create-order` - Create payment order
  - `POST /api/payments/verify` - Verify payment
  - `GET /api/subscriptions/user/:userId` - User subscriptions
- **Health Check**: `GET /health`

### Contact Service (Port 3004)
- **Purpose**: Contact form handling and communication
- **Key Endpoints**:
  - `POST /api/contact/submit` - Submit contact form
  - `GET /api/admin/contact/inquiries` - Admin inquiries
- **Health Check**: `GET /health`

### Content Management Service (Port 3005)
- **Purpose**: Dynamic content and media management
- **Key Endpoints**:
  - `GET /api/content/testimonials` - Get testimonials
  - `GET /api/content/hero` - Get hero content
  - `POST /api/content/testimonials` - Create testimonial (admin)
- **Health Check**: `GET /health`

### Analytics Service (Port 3006)
- **Purpose**: Event tracking and business analytics
- **Key Endpoints**:
  - `POST /api/analytics/events` - Track events
  - `GET /api/analytics/dashboard` - Dashboard metrics
  - `GET /api/analytics/reports/enrollment` - Enrollment reports
- **Health Check**: `GET /health`

### Notification Service (Port 3007)
- **Purpose**: Email and push notification delivery
- **Key Endpoints**:
  - `POST /api/notifications/email/send` - Send email
  - `POST /api/notifications/push/send` - Send push notification
  - `GET /api/notifications/preferences/:userId` - User preferences
- **Health Check**: `GET /health`

## Integration Testing

The integration test suite validates communication between all services:

```bash
# Run integration tests
npm run test:integration
```

The test checks:
- ✅ Service health endpoints
- ✅ API endpoint availability
- ✅ Basic functionality of each service
- ✅ Response times and error handling

### Test Results Interpretation

- **80%+ Success Rate**: Services are ready for integration
- **60-79% Success Rate**: Some services need attention
- **<60% Success Rate**: Multiple services failing, check configurations

## Environment Configuration

Each service uses environment variables for configuration. Key variables:

### Common Variables
```env
NODE_ENV=development
PORT=<service_port>
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev
REDIS_URL=redis://localhost:6379
```

### Service-Specific Variables

**API Gateway:**
```env
JWT_SECRET=your-jwt-secret
USER_SERVICE_URL=http://localhost:3001
COURSE_SERVICE_URL=http://localhost:3002
# ... other service URLs
```

**Payment Service:**
```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
```

**Notification Service:**
```env
SENDGRID_API_KEY=your_sendgrid_api_key
FCM_SERVER_KEY=your_fcm_server_key
```

## Development Workflow

1. **Start Services**: `npm run start:services`
2. **Run Tests**: `npm run test:integration`
3. **Check Logs**: Monitor console output for each service
4. **API Testing**: Use tools like Postman or curl to test endpoints

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Check if services are already running
   - Kill existing processes: `pkill -f "node.*3000"`

2. **Database Connection Failed**
   - Ensure PostgreSQL/Redis/MongoDB are running
   - Check connection strings in environment variables

3. **Service Not Starting**
   - Check service logs for specific error messages
   - Verify all dependencies are installed: `npm install`

4. **Integration Tests Failing**
   - Ensure all services are running before running tests
   - Check service health endpoints individually

### Service-Specific Troubleshooting

**User Management Service:**
- Verify PostgreSQL connection
- Check JWT secret configuration

**Payment Service:**
- Verify payment gateway credentials
- Check webhook endpoint configurations

**Content/Analytics Services:**
- Verify MongoDB connection
- Check database authentication

## API Documentation

Each service exposes OpenAPI/Swagger documentation (when available):
- API Gateway: `http://localhost:3000/docs`
- Individual services: `http://localhost:<port>/docs`

## Security Considerations

- All services use helmet for security headers
- Rate limiting is implemented at both gateway and service levels
- JWT tokens are used for authentication
- Input validation is performed on all endpoints
- CORS is configured for allowed origins

## Performance Monitoring

Services include built-in monitoring:
- Request/response logging
- Performance metrics
- Health check endpoints
- Error tracking and reporting

## Next Steps

After successful integration testing:

1. **Task 7**: Implement Contact Service enhancements
2. **Task 8**: Add Content Management features
3. **Task 9**: Expand Analytics capabilities
4. **Task 10**: Enhance Notification system
5. **Task 11**: Complete API Gateway configuration
6. **Task 12**: Build Admin Panel backend

## Support

For issues or questions:
1. Check service logs for error details
2. Verify environment configuration
3. Run integration tests to identify failing components
4. Review this documentation for troubleshooting steps