@echo off
REM System Integration Test Runner for Windows
REM This script helps run integration tests with proper setup and validation

setlocal enabledelayedexpansion

REM Colors (using Windows color codes)
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo.
echo ==========================================
echo System Integration Test Runner
echo ==========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo %RED%X Node.js not found. Please install Node.js 18+%NC%
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo %GREEN%√ Node.js installed: %NODE_VERSION%%NC%

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo %RED%X npm not found%NC%
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo %GREEN%√ npm installed: %NPM_VERSION%%NC%

REM Check if node_modules exists
if exist "node_modules\" (
    echo %GREEN%√ Dependencies installed%NC%
) else (
    echo %YELLOW%! Dependencies not installed. Running npm install...%NC%
    call npm install
)

echo.
echo ==========================================
echo Checking Services
echo ==========================================
echo.

REM Check API Gateway
curl -s -f http://localhost:3000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo %GREEN%√ API Gateway is running (port 3000)%NC%
) else (
    echo %RED%X API Gateway is not responding%NC%
    echo %YELLOW%  Start services with: docker-compose -f ..\..\docker-compose.dev.yml up -d%NC%
    exit /b 1
)

REM Check PostgreSQL
netstat -an | find ":5432" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo %GREEN%√ PostgreSQL is running (port 5432)%NC%
) else (
    echo %RED%X PostgreSQL is not running%NC%
    exit /b 1
)

REM Check Redis
netstat -an | find ":6379" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo %GREEN%√ Redis is running (port 6379)%NC%
) else (
    echo %RED%X Redis is not running%NC%
    exit /b 1
)

REM Check MongoDB
netstat -an | find ":27017" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo %GREEN%√ MongoDB is running (port 27017)%NC%
) else (
    echo %YELLOW%! MongoDB is not running (optional for some tests)%NC%
)

echo.
echo ==========================================
echo Running Tests
echo ==========================================
echo.

REM Determine test type
set TEST_TYPE=%1
if "%TEST_TYPE%"=="" set TEST_TYPE=all

REM Run tests based on type
if "%TEST_TYPE%"=="all" (
    call npm test
) else if "%TEST_TYPE%"=="api" (
    call npm run test:api
) else if "%TEST_TYPE%"=="database" (
    call npm run test:database
) else if "%TEST_TYPE%"=="services" (
    call npm run test:services
) else if "%TEST_TYPE%"=="journey" (
    call npm run test:journey
) else if "%TEST_TYPE%"=="admin" (
    call npm run test:admin
) else if "%TEST_TYPE%"=="failures" (
    call npm run test:failures
) else if "%TEST_TYPE%"=="verbose" (
    call npm run test:verbose
) else if "%TEST_TYPE%"=="-h" (
    goto :usage
) else if "%TEST_TYPE%"=="--help" (
    goto :usage
) else (
    echo %RED%Unknown test type: %TEST_TYPE%%NC%
    goto :usage
)

set TEST_EXIT_CODE=%ERRORLEVEL%

echo.
echo ==========================================
echo Test Execution Complete
echo ==========================================
echo.

if %TEST_EXIT_CODE% EQU 0 (
    echo %GREEN%√ Tests passed!%NC%
) else (
    echo %RED%X Tests failed with exit code: %TEST_EXIT_CODE%%NC%
)

exit /b %TEST_EXIT_CODE%

:usage
echo.
echo Usage: run-tests.bat [test-type]
echo.
echo Test types:
echo   all       - Run all tests (default)
echo   api       - Run API integration tests
echo   database  - Run database integration tests
echo   services  - Run service-to-service tests
echo   journey   - Run complete user journey tests
echo   admin     - Run admin panel tests
echo   failures  - Run failure scenario tests
echo   verbose   - Run all tests with verbose output
echo.
echo Examples:
echo   run-tests.bat              # Run all tests
echo   run-tests.bat journey      # Run only user journey tests
echo   run-tests.bat admin        # Run only admin panel tests
echo.
exit /b 0
