#!/bin/bash

# System Integration Test Runner
# This script helps run integration tests with proper setup and validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Print section header
print_header() {
    echo ""
    print_message "$BLUE" "=========================================="
    print_message "$BLUE" "$1"
    print_message "$BLUE" "=========================================="
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_message "$GREEN" "✓ Node.js installed: $NODE_VERSION"
    else
        print_message "$RED" "✗ Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_message "$GREEN" "✓ npm installed: $NPM_VERSION"
    else
        print_message "$RED" "✗ npm not found"
        exit 1
    fi
    
    # Check Docker
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version)
        print_message "$GREEN" "✓ Docker installed: $DOCKER_VERSION"
    else
        print_message "$YELLOW" "⚠ Docker not found. Services must be running manually."
    fi
    
    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        print_message "$GREEN" "✓ Dependencies installed"
    else
        print_message "$YELLOW" "⚠ Dependencies not installed. Running npm install..."
        npm install
    fi
}

# Check if services are running
check_services() {
    print_header "Checking Services"
    
    # Check API Gateway
    if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
        print_message "$GREEN" "✓ API Gateway is running (port 3000)"
    else
        print_message "$RED" "✗ API Gateway is not responding"
        print_message "$YELLOW" "  Start services with: docker-compose -f ../../docker-compose.dev.yml up -d"
        exit 1
    fi
    
    # Check PostgreSQL
    if nc -z localhost 5432 2>/dev/null; then
        print_message "$GREEN" "✓ PostgreSQL is running (port 5432)"
    else
        print_message "$RED" "✗ PostgreSQL is not running"
        exit 1
    fi
    
    # Check Redis
    if nc -z localhost 6379 2>/dev/null; then
        print_message "$GREEN" "✓ Redis is running (port 6379)"
    else
        print_message "$RED" "✗ Redis is not running"
        exit 1
    fi
    
    # Check MongoDB
    if nc -z localhost 27017 2>/dev/null; then
        print_message "$GREEN" "✓ MongoDB is running (port 27017)"
    else
        print_message "$YELLOW" "⚠ MongoDB is not running (optional for some tests)"
    fi
}

# Run tests
run_tests() {
    local test_type=$1
    
    print_header "Running Tests: $test_type"
    
    case $test_type in
        "all")
            npm test
            ;;
        "api")
            npm run test:api
            ;;
        "database")
            npm run test:database
            ;;
        "services")
            npm run test:services
            ;;
        "journey")
            npm run test:journey
            ;;
        "admin")
            npm run test:admin
            ;;
        "failures")
            npm run test:failures
            ;;
        "verbose")
            npm run test:verbose
            ;;
        *)
            print_message "$RED" "Unknown test type: $test_type"
            print_usage
            exit 1
            ;;
    esac
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        print_message "$GREEN" "✓ Tests passed!"
    else
        print_message "$RED" "✗ Tests failed with exit code: $exit_code"
    fi
    
    return $exit_code
}

# Print usage
print_usage() {
    echo "Usage: $0 [test-type]"
    echo ""
    echo "Test types:"
    echo "  all       - Run all tests (default)"
    echo "  api       - Run API integration tests"
    echo "  database  - Run database integration tests"
    echo "  services  - Run service-to-service tests"
    echo "  journey   - Run complete user journey tests"
    echo "  admin     - Run admin panel tests"
    echo "  failures  - Run failure scenario tests"
    echo "  verbose   - Run all tests with verbose output"
    echo ""
    echo "Examples:"
    echo "  $0              # Run all tests"
    echo "  $0 journey      # Run only user journey tests"
    echo "  $0 admin        # Run only admin panel tests"
}

# Main execution
main() {
    local test_type=${1:-all}
    
    if [ "$test_type" = "-h" ] || [ "$test_type" = "--help" ]; then
        print_usage
        exit 0
    fi
    
    print_header "System Integration Test Runner"
    
    check_prerequisites
    check_services
    run_tests "$test_type"
    
    local exit_code=$?
    
    print_header "Test Execution Complete"
    
    exit $exit_code
}

# Run main function
main "$@"
