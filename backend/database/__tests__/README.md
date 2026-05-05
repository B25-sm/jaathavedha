# Database Integration Tests

Comprehensive integration tests for the Sai Mahendra Platform database layer.

## Overview

This test suite validates:
- **Database Migrations**: Migration execution, rollbacks, and schema management
- **CRUD Operations**: Create, Read, Update, Delete operations across PostgreSQL, MongoDB, and Redis
- **Transaction Handling**: Transaction commits, rollbacks, and data integrity
- **Data Integrity**: Foreign keys, unique constraints, cascades, and referential integrity

**Validates Requirements**: 15.2 (Integration tests for API endpoints and service interactions), 15.8 (Test data management and database seeding)

## Prerequisites

Before running the tests, ensure you have:

1. **PostgreSQL** (v15+) running locally or accessible
2. **MongoDB** (v6+) running locally or accessible
3. **Redis** (v7+) running locally or accessible

### Quick Setup with Docker

```bash
# Start all databases
docker-compose up -d postgres mongodb redis

# Or start individually
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name test-postgres postgres:15
docker run -d -p 27017:27017 --name test-mongo mongo:6
docker run -d -p 6379:6379 --name test-redis redis:7
```

## Configuration

Create a `.env.test` file in the `backend/database` directory:

```env
# PostgreSQL Test Database
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=sai_mahendra_test
TEST_DB_USER=postgres
TEST_DB_PASSWORD=postgres

# MongoDB Test Database
TEST_MONGO_URL=mongodb://localhost:27017

# Redis Test Database
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6379
```

## Installation

Install test dependencies:

```bash
cd backend/database
npm install
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Migration tests only
npm run test:migrations

# CRUD operations tests only
npm run test:crud

# Transaction tests only
npm run test:transactions
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

## Test Structure

### 1. Migration Tests (`migrations.test.js`)

Tests database migration functionality:
- Migration table creation and management
- Executing pending migrations in order
- Schema creation (tables, types, indexes)
- Migration rollback functionality
- Transaction handling during migrations
- Data integrity after migrations

### 2. CRUD Operations Tests (`crud-operations.test.js`)

Tests basic database operations across all databases:

**PostgreSQL:**
- User CRUD operations
- Program CRUD operations
- Enrollment CRUD operations
- Payment CRUD operations
- Contact inquiry CRUD operations
- Complex queries with joins

**MongoDB:**
- Analytics events CRUD
- Content management CRUD
- Document versioning

**Redis:**
- Session management
- Caching operations
- Rate limiting

### 3. Transaction Tests (`transactions.test.js`)

Tests transaction handling and data integrity:
- Transaction commits
- Transaction rollbacks
- Savepoints and partial rollbacks
- Foreign key constraints
- Unique constraints
- Cascade operations
- Concurrent transactions
- Payment flow integrity
- Data consistency

## Test Database Management

The test suite automatically:
1. **Connects** to test databases before running tests
2. **Cleans up** test data between tests
3. **Seeds** necessary test data
4. **Disconnects** after all tests complete

### Manual Cleanup

If you need to manually reset the test databases:

```bash
# PostgreSQL
psql -U postgres -c "DROP DATABASE IF EXISTS sai_mahendra_test;"
psql -U postgres -c "CREATE DATABASE sai_mahendra_test;"

# MongoDB
mongo sai_mahendra_test --eval "db.dropDatabase()"

# Redis
redis-cli -n 15 FLUSHDB
```

## Test Isolation

Each test:
- Runs in isolation with clean database state
- Uses transactions where appropriate
- Cleans up after itself
- Does not depend on other tests

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Database Tests
  env:
    TEST_DB_HOST: localhost
    TEST_DB_NAME: sai_mahendra_test
    TEST_MONGO_URL: mongodb://localhost:27017
    TEST_REDIS_HOST: localhost
  run: |
    cd backend/database
    npm install
    npm test
```

## Troubleshooting

### Connection Errors

If you see connection errors:
1. Verify databases are running: `docker ps`
2. Check connection settings in `.env.test`
3. Ensure ports are not blocked by firewall

### Test Timeouts

If tests timeout:
1. Increase Jest timeout in `package.json`
2. Check database performance
3. Ensure databases are not under heavy load

### Migration Errors

If migration tests fail:
1. Ensure test database is clean
2. Check migration files are present
3. Verify database user has necessary permissions

## Best Practices

1. **Always run tests before committing** database changes
2. **Keep test data minimal** - only create what's needed
3. **Use descriptive test names** that explain what's being tested
4. **Clean up after tests** - don't leave orphaned data
5. **Test both success and failure cases**

## Contributing

When adding new database features:
1. Add corresponding integration tests
2. Ensure tests cover success and error cases
3. Update this README if adding new test files
4. Run full test suite before submitting PR

## Performance

Test suite typically completes in:
- Migration tests: ~5-10 seconds
- CRUD tests: ~10-15 seconds
- Transaction tests: ~10-15 seconds
- **Total**: ~30-40 seconds

## Coverage Goals

Target coverage metrics:
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Related Documentation

- [Database Schema](../migrations/001_initial_schema.sql)
- [Migration Guide](../README.md)
- [Requirements Document](../../../.kiro/specs/backend-integration/requirements.md)
- [Design Document](../../../.kiro/specs/backend-integration/design.md)
