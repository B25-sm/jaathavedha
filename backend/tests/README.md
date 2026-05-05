# System Integration Tests

Comprehensive integration test suite for the Sai Mahendra platform.

## Overview

This test suite validates:
- ✅ API endpoint functionality
- ✅ Database connections (PostgreSQL, Redis)
- ✅ Service-to-service communication
- ✅ Authentication and authorization flows
- ✅ Payment processing (Razorpay & Stripe)
- ✅ Notification system
- ✅ Analytics tracking
- ✅ **Complete user journeys from registration to course completion** 🆕
- ✅ **Admin panel functionality across all modules** 🆕
- ✅ **Performance and load testing with 1000+ concurrent users** 🆕
- ✅ Error handling and failure scenarios

## Prerequisites

- Node.js 18+
- PostgreSQL database running
- Redis cache running
- API services running on localhost:3000 (or configured URL)

## Installation

```bash
cd backend/tests
npm install
```

## Configuration

Set environment variables:

```bash
# API Configuration
export API_BASE_URL=http://localhost:3000

# Database Configuration
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=saimahendra
export DB_USER=admin
export DB_PASSWORD=your_password

# Redis Configuration
export REDIS_URL=redis://localhost:6379
```

## Running Tests

```bash
# Run all tests
npm test

# Run with verbose output
npm run test:verbose

# Run in watch mode (for development)
npm run test:watch

# Run for CI/CD (JSON output)
npm run test:ci

# Run only user journey tests
npm run test:journey

# Run only admin panel tests
npm run test:admin
```

## Test Structure

### 1. API Integration Tests (4 tests)
- Health endpoint validation
- Query endpoint testing
- Response format verification
- Service status checks

### 2. Database Integration Tests (6 tests)
- PostgreSQL connection and queries
- Redis cache operations
- Transaction handling
- Table existence verification

### 3. Service-to-Service Integration Tests (20+ tests)

#### Authentication Flow (5 tests)
- User registration
- JWT token authentication
- Protected resource access
- Email verification
- Password reset flow

#### Payment Processing (5 tests)
- Payment creation
- Razorpay payment verification
- Stripe payment intent handling
- Subscription creation
- Refund processing

#### Notification System (3 tests)
- Enrollment notifications
- Payment confirmation notifications
- Course reminder notifications

#### Analytics Tracking (3 tests)
- Course view events
- Enrollment events
- Payment events

#### Service Health Checks (1 test)
- All service health endpoints

### 4. Complete User Journey Tests (14 tests) 🆕

#### Registration to Course Completion Journey (11 tests)
1. User registration
2. User login with JWT
3. Browse available programs
4. View program details
5. Initiate payment
6. Payment verification
7. Automatic enrollment
8. Access course content
9. Complete a module
10. View progress dashboard
11. Receive completion certificate

#### Subscription Management Journey (3 tests)
- Subscribe to monthly membership
- View subscription details
- Cancel subscription

### 5. Admin Panel Functionality Tests (35+ tests) 🆕

#### User Management Module (5 tests)
- View all users
- Search users by email
- Update user role
- Suspend user account
- View user activity logs

#### Course Management Module (4 tests)
- Create new program
- Update program details
- View enrollment statistics
- Manually enroll user

#### Payment Management Module (5 tests)
- View all payments
- Filter payments by status
- Process refund
- View revenue reports
- Export payment data

#### Content Management Module (3 tests)
- Create testimonial
- Update hero section content
- Upload media files

#### Analytics Dashboard Module (5 tests)
- View dashboard metrics
- View enrollment trends
- View revenue analytics
- View user engagement metrics
- Export analytics data

#### System Configuration Module (3 tests)
- View system settings
- Update payment gateway configuration
- View audit logs

### 6. Failure Scenario Tests (10+ tests)
- HTTP error responses (404, 401, 403)
- Validation errors (400, 422)
- Duplicate data handling (409)
- Connection failures
- Rate limiting (429)
- Malformed JSON handling

## Test Coverage

- **Total Tests**: 100+
- **API Tests**: 4
- **Database Tests**: 6
- **Service Integration Tests**: 20+
- **User Journey Tests**: 14 🆕
- **Admin Panel Tests**: 35+ 🆕
- **Performance Tests**: 4 test types (Load, Stress, Spike, Soak) 🆕
- **Failure Scenarios**: 10+

## Performance Testing

Comprehensive performance and load testing infrastructure is available in the `performance/` directory.

### Quick Start

```bash
cd backend/tests/performance

# Install k6 (if not already installed)
# macOS: brew install k6
# Linux: sudo apt-get install k6
# Windows: choco install k6

# Setup test data
node setup-test-data.js

# Run all performance tests
./run-load-tests.sh  # Linux/macOS
run-load-tests.bat   # Windows

# Analyze results
node analyze-results.js
```

### Performance Test Types

1. **Load Test** (24 min): Progressive ramp-up to 1000 concurrent users
2. **Stress Test** (22 min): Find system breaking point (up to 2000 users)
3. **Spike Test** (8 min): Validate auto-scaling with sudden traffic surge
4. **Soak Test** (70 min): Detect memory leaks with sustained load

### Performance Targets

- **Normal Load (100 users)**: P95 < 200ms, Error rate < 1%
- **Peak Load (1000 users)**: P95 < 500ms, Error rate < 1%
- **Auto-Scaling**: Triggers at 70% CPU, scale-up < 2 min

📖 **Full Documentation**: See [performance/README.md](./performance/README.md) and [performance/QUICK_START.md](./performance/QUICK_START.md)

## Expected Results

All tests should pass when:
- All services are running
- Database is accessible and seeded
- Redis is running
- Network connectivity is stable
- Admin user credentials are configured

## Test Execution Examples

### Full Test Suite
```bash
npm test
```

Expected output:
```
System Integration Tests
  ✓ API Integration Tests (4 passing)
  ✓ Database Integration Tests (6 passing)
  ✓ Service-to-Service Integration Tests (20 passing)
  ✓ Complete User Journey Tests (14 passing)
  ✓ Admin Panel Functionality Tests (35 passing)
  ✓ Failure Scenario Tests (10 passing)

100+ passing (8s)
```

### User Journey Tests Only
```bash
npm run test:journey
```

### Admin Panel Tests Only
```bash
npm run test:admin
```

## Troubleshooting

### Connection Errors

If you see connection errors:
1. Verify services are running
2. Check environment variables
3. Confirm network connectivity
4. Review firewall settings

### Authentication Failures

If auth tests fail:
1. Ensure test user exists
2. Verify JWT secret is configured
3. Check token expiration settings
4. Confirm admin credentials for admin tests

### Timeout Errors

If tests timeout:
1. Increase timeout in test file (default: 30s)
2. Check service performance
3. Verify database query performance
4. Review network latency

### Admin Panel Test Failures

If admin tests fail:
1. Verify admin user exists with proper role
2. Check admin authentication endpoint
3. Confirm RBAC permissions are configured
4. Review audit logging setup

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: saimahendra_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend/tests
          npm install
      
      - name: Run all integration tests
        run: |
          cd backend/tests
          npm run test:ci
        env:
          API_BASE_URL: http://localhost:3000
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: saimahendra_test
          DB_USER: test_user
          DB_PASSWORD: test_password
          REDIS_URL: redis://localhost:6379
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: backend/tests/test-results.json
```

## Contributing

When adding new tests:
1. Follow existing structure and naming conventions
2. Add descriptive test names that explain what is being tested
3. Include proper assertions with meaningful error messages
4. Handle cleanup in `after` hooks to prevent test pollution
5. Update this README with new test categories
6. Add tests to appropriate describe blocks
7. Consider test isolation and independence

## Test Best Practices

1. **Test Independence**: Each test should be able to run independently
2. **Clean State**: Use before/after hooks to set up and tear down test data
3. **Meaningful Names**: Test names should clearly describe what is being tested
4. **Proper Assertions**: Use specific assertions that provide clear failure messages
5. **Error Handling**: Handle expected errors gracefully
6. **Timeouts**: Set appropriate timeouts for async operations
7. **Documentation**: Comment complex test logic

## License

Proprietary - Sai Mahendra Platform
