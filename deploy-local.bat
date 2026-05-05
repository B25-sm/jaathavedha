@echo off
REM Sai Mahendra Platform - Local Deployment Script (Windows)
REM This script prepares and deploys all services locally using Docker Compose

echo =========================================
echo Sai Mahendra Platform - Local Deployment
echo =========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker and try again.
    exit /b 1
)

echo [OK] Docker is running

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] docker-compose is not installed. Please install it and try again.
    exit /b 1
)

echo [OK] docker-compose is available
echo.

echo Step 1: Installing dependencies in all services...
echo.

REM Install dependencies for new services
echo Installing dependencies for LMS service...
cd backend\services\lms
call npm install --legacy-peer-deps >nul 2>&1
cd ..\..\..

echo Installing dependencies for Live Streaming service...
cd backend\services\live-streaming
call npm install --legacy-peer-deps >nul 2>&1
cd ..\..\..

echo Installing dependencies for Mobile API service...
cd backend\services\mobile-api
call npm install --legacy-peer-deps >nul 2>&1
cd ..\..\..

echo [OK] Dependencies installed
echo.

echo Step 2: Stopping existing containers...
echo.

docker-compose -f docker-compose.dev.yml down >nul 2>&1

echo [OK] Stopped existing containers
echo.

echo Step 3: Starting database services...
echo.

docker-compose -f docker-compose.dev.yml up -d postgres redis mongodb

echo Waiting for databases to be ready...
timeout /t 10 /nobreak >nul

echo [OK] Database services started
echo.

echo Step 4: Running database migrations...
echo.

cd backend\database
call npm install --legacy-peer-deps >nul 2>&1
node migrate.js
cd ..\..

echo [OK] Database migrations completed
echo.

echo Step 5: Building and starting all services...
echo.

docker-compose -f docker-compose.dev.yml up -d --build

echo [OK] All services are starting...
echo.

echo Step 6: Waiting for services to be healthy...
echo.

timeout /t 15 /nobreak >nul

echo.
echo =========================================
echo Deployment Summary
echo =========================================
echo.

echo Service URLs:
echo   - API Gateway:        http://localhost:3000
echo   - User Management:    http://localhost:3001
echo   - Course Management:  http://localhost:3002
echo   - Payment:            http://localhost:3003
echo   - Contact:            http://localhost:3004
echo   - Content Management: http://localhost:3005
echo   - Analytics:          http://localhost:3006
echo   - Notification:       http://localhost:3007
echo   - Admin Panel:        http://localhost:3008
echo   - Security:           http://localhost:3009
echo   - LMS:                http://localhost:3010
echo   - Live Streaming:     http://localhost:3011
echo   - Mobile API:         http://localhost:3012
echo   - Video Streaming:    http://localhost:3013
echo   - Instructor Portal:  http://localhost:3014
echo   - Student Dashboard:  http://localhost:3015
echo.

echo Database URLs:
echo   - PostgreSQL:         localhost:5432
echo   - Redis:              localhost:6379
echo   - MongoDB:            localhost:27017
echo.

echo [OK] Deployment complete!
echo.
echo To view logs: docker-compose -f docker-compose.dev.yml logs -f
echo To stop all services: docker-compose -f docker-compose.dev.yml down
echo.

pause
