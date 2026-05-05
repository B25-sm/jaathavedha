@echo off
REM Database Integration Test Runner for Windows
REM Starts test databases, runs tests, and cleans up

echo === Sai Mahendra Database Integration Tests ===
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running
    echo Please start Docker and try again
    exit /b 1
)

REM Start test databases
echo Starting test databases...
docker-compose -f docker-compose.test.yml up -d

REM Wait for databases to be ready
echo Waiting for databases to be ready...
timeout /t 5 /nobreak >nul

REM Check PostgreSQL
echo Checking PostgreSQL...
docker exec sai-mahendra-postgres-test pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo PostgreSQL is not ready
    goto cleanup
)
echo PostgreSQL: OK

REM Check MongoDB
echo Checking MongoDB...
docker exec sai-mahendra-mongo-test mongosh --eval "db.adminCommand('ping')" >nul 2>&1
if errorlevel 1 (
    echo MongoDB is not ready
    goto cleanup
)
echo MongoDB: OK

REM Check Redis
echo Checking Redis...
docker exec sai-mahendra-redis-test redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo Redis is not ready
    goto cleanup
)
echo Redis: OK

echo.
echo All databases are ready!
echo.

REM Set test environment variables
set TEST_DB_HOST=localhost
set TEST_DB_PORT=5433
set TEST_DB_NAME=sai_mahendra_test
set TEST_DB_USER=postgres
set TEST_DB_PASSWORD=postgres
set TEST_MONGO_URL=mongodb://localhost:27018
set TEST_REDIS_HOST=localhost
set TEST_REDIS_PORT=6380

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Run tests
echo Running integration tests...
echo.

if "%1"=="coverage" (
    call npm run test:coverage
) else if "%1"=="migrations" (
    call npm run test:migrations
) else if "%1"=="crud" (
    call npm run test:crud
) else if "%1"=="transactions" (
    call npm run test:transactions
) else (
    call npm test
)

set TEST_EXIT_CODE=%errorlevel%

if %TEST_EXIT_CODE%==0 (
    echo.
    echo All tests passed!
) else (
    echo.
    echo Some tests failed
)

:cleanup
echo.
echo Cleaning up test databases...
docker-compose -f docker-compose.test.yml down -v
echo Cleanup complete

exit /b %TEST_EXIT_CODE%
