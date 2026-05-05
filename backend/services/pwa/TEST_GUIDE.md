# Mobile Integration Tests - Test Guide

This guide provides instructions for running and understanding the mobile integration tests for Task 15.3.

## Overview

The test suite covers three main areas:
1. **PWA Functionality** - Service worker, offline sync, caching
2. **Mobile Payments** - Wallet integration, UPI, payment flows
3. **Push Notifications** - Subscription management, delivery, mobile features

## Prerequisites

### Required Services

1. **Redis** (version 7+)
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:7-alpine
   
   # Or install locally
   # macOS: brew install redis
   # Ubuntu: sudo apt-get install redis-server
   ```

2. **PostgreSQL** (version 15+)
   ```bash
   # Using Docker
   docker run -d -p 5432:5432 \
     -e POSTGRES_PASSWORD=test \
     -e POSTGRES_DB=test_db \
     postgres:15-alpine
   
   # Or install locally
   # macOS: brew install postgresql@15
   # Ubuntu: sudo apt-get install postgresql-15
   ```

3. **Node.js** (version 18+)
   ```bash
   # Check version
   node --version
   
   # Should output v18.x.x or higher
   ```

### Database Setup

Run the database migrations to create required tables:

```bash
cd backend/database
npm install
npm run migrate
```

This will create the following tables:
- `push_subscriptions`
- `sync_requests`
- `user_progress`
- `video_analytics`
- `video_notes`
- `video_bookmarks`
- `quiz_responses`
- `offline_data_cache`
- `background_sync_tasks`
- `pwa_analytics_events`

## Installation

### PWA Service Tests

```bash
cd backend/services/pwa
npm install
```

### Payment Service Tests

```bash
cd backend/services/payment
npm install
```

## Running Tests

### Run All PWA Tests

```bash
cd backend/services/pwa
npm test
```

### Run Specific Test Files

```bash
# PWA functionality tests
npm test pwa-functionality.integration.test.ts

# Push notification tests
npm test push-notification.integration.test.ts
```

### Run Mobile Payment Tests

```bash
cd backend/services/payment
npm test mobile-payment.integration.test.ts
```

### Run with Coverage

```bash
# PWA service
cd backend/services/pwa
npm test -- --coverage

# Payment service
cd backend/services/payment
npm test mobile-payment.integration.test.ts -- --coverage
```

### Run in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test Suite

```bash
# Run only PWA functionality tests
npm test -- --testNamePattern="PWA Functionality"

# Run only subscription tests
npm test -- --testNamePattern="Subscription Management"

# Run only payment validation tests
npm test -- --testNamePattern="Payment Validation"
```

## Test Structure

### PWA Functionality Tests

**File**: `src/__tests__/pwa-functionality.integration.test.ts`

**Test Suites**:
1. Service Worker Configuration (7 tests)
2. Offline Data Synchronization (8 tests)
3. Cache Management and Strategies (5 tests)
4. Background Sync and Queue Management (5 tests)
5. Offline Capability Testing (7 tests)
6. PWA Installation and Manifest (5 tests)

**Total**: 37 test cases

### Mobile Payment Tests

**File**: `src/__tests__/mobile-payment.integration.test.ts`

**Test Suites**:
1. Mobile Payment Method Detection (5 tests)
2. Mobile Payment Validation (7 tests)
3. Mobile Payment Session Management (5 tests)
4. Touch-Optimized Payment Flow (4 tests)
5. Gateway Selection Logic (3 tests)
6. Mobile Wallet Integration (4 tests)
7. Error Handling and Edge Cases (5 tests)

**Total**: 33 test cases

### Push Notification Tests

**File**: `src/__tests__/push-notification.integration.test.ts`

**Test Suites**:
1. Push Notification Subscription Management (8 tests)
2. Push Notification Delivery (7 tests)
3. VAPID Configuration (2 tests)
4. Subscription Cleanup and Maintenance (3 tests)
5. Mobile-Specific Notification Features (4 tests)
6. Bulk Notification Sending (1 test)

**Total**: 25 test cases

## Environment Variables

Tests use the following environment variables (configured in `src/__tests__/setup.ts`):

```env
NODE_ENV=test
PORT=3015
LOG_LEVEL=error
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
JWT_SECRET=test-jwt-secret-key-for-testing-only
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xYjEB6LWmOhRqjSHEHnysVZHkA4xWqvxRL6O9pSUK7TgkPcnWPLVc
VAPID_PRIVATE_KEY=UUxI4O8-FbRouAevSmBQ6o8FwXTpQUiMcN5VqtxVLWc
VAPID_SUBJECT=mailto:test@saimahendra.com
ALLOWED_ORIGINS=http://localhost:3000
SW_CACHE_VERSION=v1.0.0-test
SW_CACHE_MAX_AGE=86400
SYNC_BATCH_SIZE=50
SYNC_MAX_RETRIES=3
SYNC_RETRY_DELAY=1000
MOBILE_IMAGE_QUALITY=80
MOBILE_MAX_PAYLOAD_SIZE=1048576
```

To override these values, create a `.env.test` file in the service directory.

## Troubleshooting

### Redis Connection Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**:
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start Redis
# Docker: docker start <redis-container-id>
# macOS: brew services start redis
# Ubuntu: sudo systemctl start redis-server
```

### PostgreSQL Connection Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:
```bash
# Check if PostgreSQL is running
psql -U test -d test_db -c "SELECT 1"

# If not running, start PostgreSQL
# Docker: docker start <postgres-container-id>
# macOS: brew services start postgresql@15
# Ubuntu: sudo systemctl start postgresql
```

### Database Table Missing

**Error**: `relation "push_subscriptions" does not exist`

**Solution**:
```bash
# Run database migrations
cd backend/database
npm run migrate
```

### Test Timeout

**Error**: `Timeout - Async callback was not invoked within the 30000 ms timeout`

**Solution**:
- Check if Redis and PostgreSQL are running
- Increase timeout in jest.config.js: `testTimeout: 60000`
- Check network connectivity to external services

### VAPID Key Error

**Error**: `VAPID keys are required for push notifications`

**Solution**:
- Ensure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set in environment
- Generate new VAPID keys if needed:
  ```bash
  npx web-push generate-vapid-keys
  ```

## Test Data Cleanup

Tests automatically clean up data before each test run. However, if you need to manually clean up:

```bash
# Clean Redis
redis-cli FLUSHDB

# Clean PostgreSQL test data
psql -U test -d test_db -c "DELETE FROM push_subscriptions WHERE user_id LIKE 'test-user-%'"
psql -U test -d test_db -c "DELETE FROM sync_requests WHERE user_id LIKE 'test-user-%'"
```

## Coverage Reports

After running tests with coverage, view the reports:

```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
# Or on Linux: xdg-open coverage/lcov-report/index.html
```

**Coverage Goals**:
- Overall: 80%+
- Critical paths (payments, notifications): 100%

## Continuous Integration

Tests are designed to run in CI/CD pipelines. Example GitHub Actions workflow:

```yaml
name: Mobile Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
      
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        working-directory: backend/services/pwa
      
      - name: Run tests
        run: npm test -- --coverage
        working-directory: backend/services/pwa
```

## Manual Testing Checklist

While integration tests cover most scenarios, some features require manual testing on actual devices:

### PWA Features
- [ ] Install PWA on mobile device
- [ ] Test offline functionality
- [ ] Verify service worker updates
- [ ] Test cache strategies in browser DevTools

### Mobile Payments
- [ ] Test Apple Pay on iOS device
- [ ] Test Google Pay on Android device
- [ ] Test UPI payment with actual UPI app
- [ ] Test Paytm/PhonePe wallet payments
- [ ] Verify payment flow on different screen sizes

### Push Notifications
- [ ] Test notification appearance on iOS
- [ ] Test notification appearance on Android
- [ ] Test notification actions (buttons)
- [ ] Test notification grouping
- [ ] Test silent notifications
- [ ] Verify notification permissions

## Best Practices

### Writing New Tests

1. **Follow the existing structure**:
   ```typescript
   describe('Feature Name', () => {
     beforeEach(async () => {
       // Setup
     });
     
     it('should do something specific', async () => {
       // Arrange
       const input = { ... };
       
       // Act
       const result = await service.method(input);
       
       // Assert
       expect(result).toBeDefined();
       expect(result.property).toBe(expectedValue);
     });
   });
   ```

2. **Use descriptive test names**:
   - Good: `should detect Apple Pay on iOS devices`
   - Bad: `test payment detection`

3. **Clean up after tests**:
   ```typescript
   afterEach(async () => {
     await redisClient.flushDb();
     await dbPool.query('DELETE FROM test_table WHERE id LIKE $1', ['test-%']);
   });
   ```

4. **Mock external services**:
   - Don't make real API calls to payment gateways
   - Don't send real push notifications
   - Use test credentials and sandbox environments

5. **Test edge cases**:
   - Invalid inputs
   - Missing required fields
   - Expired sessions
   - Network failures

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review test output for specific error messages
3. Check service logs for detailed error information
4. Refer to the completion report: `TASK_15_3_COMPLETION_REPORT.md`

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [PWA Testing Guide](https://web.dev/pwa-testing/)
- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [Payment Request API](https://developer.mozilla.org/en-US/docs/Web/API/Payment_Request_API)

---

**Last Updated**: 2024-01-15
**Test Suite Version**: 1.0.0
**Maintainer**: Kiro AI
