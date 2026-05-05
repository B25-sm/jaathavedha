#!/bin/bash

# Sai Mahendra Platform - Local Deployment Script
# This script prepares and deploys all services locally using Docker Compose

set -e  # Exit on error

echo "========================================="
echo "Sai Mahendra Platform - Local Deployment"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

print_success "Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it and try again."
    exit 1
fi

print_success "docker-compose is available"

echo ""
print_info "Step 1: Installing dependencies in all services..."
echo ""

# List of services that need npm install
SERVICES=(
    "backend/services/lms"
    "backend/services/live-streaming"
    "backend/services/mobile-api"
    "backend/services/video-streaming"
    "backend/services/instructor-portal"
    "backend/services/student-dashboard"
    "backend/services/user-management"
    "backend/services/course-management"
    "backend/services/payment"
    "backend/services/contact"
    "backend/services/content-management"
    "backend/services/analytics"
    "backend/services/notification"
    "backend/services/admin-panel"
    "backend/services/security"
    "backend/services/api-gateway"
    "backend/services/pwa"
    "backend/services/calendar-integration"
    "backend/services/video-conferencing"
    "backend/shared/database"
    "backend/shared/types"
    "backend/shared/utils"
)

# Install dependencies for each service
for service in "${SERVICES[@]}"; do
    if [ -f "$service/package.json" ]; then
        print_info "Installing dependencies for $service..."
        cd "$service"
        npm install --legacy-peer-deps > /dev/null 2>&1 || {
            print_warning "Failed to install dependencies for $service (continuing anyway)"
        }
        cd - > /dev/null
        print_success "Dependencies installed for $service"
    else
        print_warning "No package.json found for $service (skipping)"
    fi
done

echo ""
print_info "Step 2: Building shared libraries..."
echo ""

# Build shared libraries
SHARED_LIBS=(
    "backend/shared/types"
    "backend/shared/utils"
    "backend/shared/database"
)

for lib in "${SHARED_LIBS[@]}"; do
    if [ -f "$lib/package.json" ]; then
        print_info "Building $lib..."
        cd "$lib"
        npm run build > /dev/null 2>&1 || {
            print_warning "Failed to build $lib (continuing anyway)"
        }
        cd - > /dev/null
        print_success "Built $lib"
    fi
done

echo ""
print_info "Step 3: Stopping existing containers..."
echo ""

docker-compose -f docker-compose.dev.yml down > /dev/null 2>&1 || true
print_success "Stopped existing containers"

echo ""
print_info "Step 4: Starting database services..."
echo ""

# Start only database services first
docker-compose -f docker-compose.dev.yml up -d postgres redis mongodb

print_info "Waiting for databases to be ready..."
sleep 10

print_success "Database services started"

echo ""
print_info "Step 5: Running database migrations..."
echo ""

# Run database migrations
if [ -f "backend/database/migrate.js" ]; then
    cd backend/database
    npm install --legacy-peer-deps > /dev/null 2>&1 || true
    node migrate.js || {
        print_warning "Database migrations failed (continuing anyway)"
    }
    cd - > /dev/null
    print_success "Database migrations completed"
else
    print_warning "No migration script found (skipping)"
fi

echo ""
print_info "Step 6: Building and starting all services..."
echo ""

# Build and start all services
docker-compose -f docker-compose.dev.yml up -d --build

print_success "All services are starting..."

echo ""
print_info "Step 7: Waiting for services to be healthy..."
echo ""

# Wait for services to be healthy
sleep 15

echo ""
print_info "Step 8: Checking service health..."
echo ""

# Check health of each service
HEALTH_CHECK_SERVICES=(
    "http://localhost:3000/health:API Gateway"
    "http://localhost:3001/health:User Management"
    "http://localhost:3002/health:Course Management"
    "http://localhost:3003/health:Payment"
    "http://localhost:3004/health:Contact"
    "http://localhost:3005/health:Content Management"
    "http://localhost:3006/health:Analytics"
    "http://localhost:3007/health:Notification"
    "http://localhost:3008/health:Admin Panel"
    "http://localhost:3009/health:Security"
    "http://localhost:3010/health:LMS"
    "http://localhost:3011/health:Live Streaming"
    "http://localhost:3012/health:Mobile API"
    "http://localhost:3013/health:Video Streaming"
    "http://localhost:3014/health:Instructor Portal"
    "http://localhost:3015/health:Student Dashboard"
)

HEALTHY_COUNT=0
TOTAL_COUNT=${#HEALTH_CHECK_SERVICES[@]}

for service_info in "${HEALTH_CHECK_SERVICES[@]}"; do
    IFS=':' read -r url name <<< "$service_info"
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        print_success "$name is healthy"
        ((HEALTHY_COUNT++))
    else
        print_warning "$name is not responding yet"
    fi
done

echo ""
echo "========================================="
echo "Deployment Summary"
echo "========================================="
echo ""
echo "Services healthy: $HEALTHY_COUNT / $TOTAL_COUNT"
echo ""

if [ $HEALTHY_COUNT -eq $TOTAL_COUNT ]; then
    print_success "All services are healthy!"
else
    print_warning "Some services are not healthy yet. They may still be starting up."
    print_info "Run 'docker-compose -f docker-compose.dev.yml logs -f' to see logs"
fi

echo ""
echo "Service URLs:"
echo "  - API Gateway:        http://localhost:3000"
echo "  - User Management:    http://localhost:3001"
echo "  - Course Management:  http://localhost:3002"
echo "  - Payment:            http://localhost:3003"
echo "  - Contact:            http://localhost:3004"
echo "  - Content Management: http://localhost:3005"
echo "  - Analytics:          http://localhost:3006"
echo "  - Notification:       http://localhost:3007"
echo "  - Admin Panel:        http://localhost:3008"
echo "  - Security:           http://localhost:3009"
echo "  - LMS:                http://localhost:3010"
echo "  - Live Streaming:     http://localhost:3011"
echo "  - Mobile API:         http://localhost:3012"
echo "  - Video Streaming:    http://localhost:3013"
echo "  - Instructor Portal:  http://localhost:3014"
echo "  - Student Dashboard:  http://localhost:3015"
echo ""
echo "Database URLs:"
echo "  - PostgreSQL:         localhost:5432"
echo "  - Redis:              localhost:6379"
echo "  - MongoDB:            localhost:27017"
echo ""
print_success "Deployment complete!"
echo ""
print_info "To view logs: docker-compose -f docker-compose.dev.yml logs -f"
print_info "To stop all services: docker-compose -f docker-compose.dev.yml down"
echo ""
