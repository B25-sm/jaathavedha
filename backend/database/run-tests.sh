#!/bin/bash

# Database Integration Test Runner
# Starts test databases, runs tests, and cleans up

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Sai Mahendra Database Integration Tests ===${NC}\n"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

# Function to cleanup
cleanup() {
    echo -e "\n${YELLOW}Cleaning up test databases...${NC}"
    docker-compose -f docker-compose.test.yml down -v
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Trap EXIT to ensure cleanup
trap cleanup EXIT

# Start test databases
echo -e "${YELLOW}Starting test databases...${NC}"
docker-compose -f docker-compose.test.yml up -d

# Wait for databases to be ready
echo -e "${YELLOW}Waiting for databases to be ready...${NC}"
sleep 5

# Check PostgreSQL
echo -n "Checking PostgreSQL... "
if docker exec sai-mahendra-postgres-test pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}PostgreSQL is not ready${NC}"
    exit 1
fi

# Check MongoDB
echo -n "Checking MongoDB... "
if docker exec sai-mahendra-mongo-test mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}MongoDB is not ready${NC}"
    exit 1
fi

# Check Redis
echo -n "Checking Redis... "
if docker exec sai-mahendra-redis-test redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Redis is not ready${NC}"
    exit 1
fi

echo -e "\n${GREEN}All databases are ready!${NC}\n"

# Set test environment variables
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5433
export TEST_DB_NAME=sai_mahendra_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=postgres
export TEST_MONGO_URL=mongodb://localhost:27018
export TEST_REDIS_HOST=localhost
export TEST_REDIS_PORT=6380

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Run tests
echo -e "${YELLOW}Running integration tests...${NC}\n"

if [ "$1" == "coverage" ]; then
    npm run test:coverage
elif [ "$1" == "migrations" ]; then
    npm run test:migrations
elif [ "$1" == "crud" ]; then
    npm run test:crud
elif [ "$1" == "transactions" ]; then
    npm run test:transactions
else
    npm test
fi

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
else
    echo -e "\n${RED}✗ Some tests failed${NC}"
fi

exit $TEST_EXIT_CODE
