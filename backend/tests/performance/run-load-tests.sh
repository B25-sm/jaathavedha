#!/bin/bash

# Performance and Load Testing Script for Sai Mahendra Platform
# This script runs comprehensive performance tests including load, stress, spike, and soak tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
RESULTS_DIR="./results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Sai Mahendra Platform - Performance Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Base URL: ${GREEN}${BASE_URL}${NC}"
echo -e "Results Directory: ${GREEN}${RESULTS_DIR}${NC}"
echo -e "Timestamp: ${GREEN}${TIMESTAMP}${NC}"
echo ""

# Create results directory
mkdir -p "${RESULTS_DIR}"

# Function to check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}Error: k6 is not installed${NC}"
        echo ""
        echo "Please install k6:"
        echo "  macOS:   brew install k6"
        echo "  Linux:   sudo apt-get install k6"
        echo "  Windows: choco install k6"
        echo ""
        echo "Or download from: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    echo -e "${GREEN}✓ k6 is installed${NC}"
}

# Function to check if services are running
check_services() {
    echo ""
    echo -e "${YELLOW}Checking if services are running...${NC}"
    
    if curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Services are running${NC}"
    else
        echo -e "${RED}✗ Services are not responding${NC}"
        echo ""
        echo "Please start the services before running tests:"
        echo "  cd backend && npm run start:services"
        exit 1
    fi
}

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local description=$3
    
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Running: ${test_name}${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${description}"
    echo ""
    
    local result_file="${RESULTS_DIR}/${test_name}_${TIMESTAMP}.json"
    
    if k6 run --out json="${result_file}" "${test_file}"; then
        echo -e "${GREEN}✓ ${test_name} completed successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ ${test_name} failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    check_k6
    check_services
    
    echo ""
    echo -e "${YELLOW}Starting performance test suite...${NC}"
    
    local failed_tests=0
    
    # Test 1: Load Test
    if ! run_test "load-test" "k6-load-test.js" \
        "Load test with progressive ramp-up to 1000 concurrent users"; then
        ((failed_tests++))
    fi
    
    sleep 30  # Cool-down period between tests
    
    # Test 2: Stress Test
    if ! run_test "stress-test" "k6-stress-test.js" \
        "Stress test to find system breaking point (up to 2000 users)"; then
        ((failed_tests++))
    fi
    
    sleep 30  # Cool-down period
    
    # Test 3: Spike Test
    if ! run_test "spike-test" "k6-spike-test.js" \
        "Spike test to validate auto-scaling behavior"; then
        ((failed_tests++))
    fi
    
    # Optional: Soak Test (commented out by default due to 1-hour duration)
    # Uncomment to run soak test
    # sleep 30
    # if ! run_test "soak-test" "k6-soak-test.js" \
    #     "Soak test with sustained load for 1 hour"; then
    #     ((failed_tests++))
    # fi
    
    # Summary
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test Suite Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed successfully${NC}"
        echo ""
        echo "Results saved to: ${RESULTS_DIR}"
        echo ""
        echo "Next steps:"
        echo "  1. Review detailed results in JSON files"
        echo "  2. Check Grafana dashboards for system metrics"
        echo "  3. Verify auto-scaling behavior in Kubernetes"
        echo "  4. Review application logs for errors"
        exit 0
    else
        echo -e "${RED}✗ ${failed_tests} test(s) failed${NC}"
        echo ""
        echo "Please review the test results and system logs"
        exit 1
    fi
}

# Run main function
main
