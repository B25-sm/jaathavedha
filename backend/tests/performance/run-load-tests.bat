@echo off
REM Performance and Load Testing Script for Sai Mahendra Platform (Windows)
REM This script runs comprehensive performance tests including load, stress, spike, and soak tests

setlocal enabledelayedexpansion

REM Configuration
set BASE_URL=%BASE_URL%
if "%BASE_URL%"=="" set BASE_URL=http://localhost:3000

set RESULTS_DIR=.\results
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo ========================================
echo Sai Mahendra Platform - Performance Tests
echo ========================================
echo.
echo Base URL: %BASE_URL%
echo Results Directory: %RESULTS_DIR%
echo Timestamp: %TIMESTAMP%
echo.

REM Create results directory
if not exist "%RESULTS_DIR%" mkdir "%RESULTS_DIR%"

REM Check if k6 is installed
where k6 >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: k6 is not installed
    echo.
    echo Please install k6:
    echo   Windows: choco install k6
    echo   Or download from: https://k6.io/docs/getting-started/installation/
    exit /b 1
)
echo [OK] k6 is installed

REM Check if services are running
echo.
echo Checking if services are running...
curl -s "%BASE_URL%/health" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Services are not responding
    echo.
    echo Please start the services before running tests:
    echo   cd backend ^&^& npm run start:services
    exit /b 1
)
echo [OK] Services are running

REM Run tests
echo.
echo Starting performance test suite...
echo.

set FAILED_TESTS=0

REM Test 1: Load Test
echo ========================================
echo Running: Load Test
echo ========================================
echo Load test with progressive ramp-up to 1000 concurrent users
echo.

k6 run --out json="%RESULTS_DIR%\load-test_%TIMESTAMP%.json" k6-load-test.js
if %ERRORLEVEL% equ 0 (
    echo [OK] Load test completed successfully
) else (
    echo [ERROR] Load test failed
    set /a FAILED_TESTS+=1
)

REM Cool-down period
timeout /t 30 /nobreak >nul

REM Test 2: Stress Test
echo.
echo ========================================
echo Running: Stress Test
echo ========================================
echo Stress test to find system breaking point (up to 2000 users)
echo.

k6 run --out json="%RESULTS_DIR%\stress-test_%TIMESTAMP%.json" k6-stress-test.js
if %ERRORLEVEL% equ 0 (
    echo [OK] Stress test completed successfully
) else (
    echo [ERROR] Stress test failed
    set /a FAILED_TESTS+=1
)

REM Cool-down period
timeout /t 30 /nobreak >nul

REM Test 3: Spike Test
echo.
echo ========================================
echo Running: Spike Test
echo ========================================
echo Spike test to validate auto-scaling behavior
echo.

k6 run --out json="%RESULTS_DIR%\spike-test_%TIMESTAMP%.json" k6-spike-test.js
if %ERRORLEVEL% equ 0 (
    echo [OK] Spike test completed successfully
) else (
    echo [ERROR] Spike test failed
    set /a FAILED_TESTS+=1
)

REM Summary
echo.
echo ========================================
echo Test Suite Summary
echo ========================================
echo.

if %FAILED_TESTS% equ 0 (
    echo [OK] All tests passed successfully
    echo.
    echo Results saved to: %RESULTS_DIR%
    echo.
    echo Next steps:
    echo   1. Review detailed results in JSON files
    echo   2. Check Grafana dashboards for system metrics
    echo   3. Verify auto-scaling behavior in Kubernetes
    echo   4. Review application logs for errors
    exit /b 0
) else (
    echo [ERROR] %FAILED_TESTS% test(s) failed
    echo.
    echo Please review the test results and system logs
    exit /b 1
)
