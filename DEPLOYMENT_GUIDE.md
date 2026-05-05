# Sai Mahendra Platform - Deployment Guide

## ✅ ALL CRITICAL ISSUES FIXED!

This guide covers deploying the complete Sai Mahendra platform with all 29 tasks implemented.

---

## 🎯 What Was Fixed

### ✅ 1. New Services Added to docker-compose.dev.yml
- ✅ LMS service (port 3010)
- ✅ Live-streaming service (port 3011)
- ✅ Mobile-api service (port 3012)
- ✅ Video-streaming service (port 3013)
- ✅ Instructor-portal service (port 3014)
- ✅ Student-dashboard service (port 3015)

### ✅ 2. API Gateway Routing Updated
- ✅ Added routes for LMS (/api/v1/lms/*)
- ✅ Added routes for Live Streaming (/api/v1/live/*)
- ✅ Added routes for Mobile API (/api/v1/mobile/*)
- ✅ Added routes for Video Streaming (/api/v1/videos/*)
- ✅ Added routes for Instructor Portal (/api/v1/instructor/*)
- ✅ Added routes for Student Dashboard (/api/v1/student/*)

### ✅ 3. Deployment Scripts Created
- ✅ `deploy-local.sh` (Linux/Mac)
- ✅ `deploy-local.bat` (Windows)
- ✅ Automatic dependency installation
- ✅ Automatic database migrations
- ✅ Health check verification

### ✅ 4. Shared Libraries
- ✅ @sai-mahendra/database exists
- ✅ @sai-mahendra/utils exists
- ✅ @sai-mahendra/types exists

---

## 🚀 Quick Start - Local Deployment

### Prerequisites

1. **Docker Desktop** installed and running
2. **Node.js 18+** installed
3. **Git** installed

### Option 1: Automated Deployment (Recommended)

#### On Linux/Mac:
```bash
chmod +x deploy-local.sh
./deploy-local.sh
```

#### On Windows:
```cmd
deploy-local.bat
```

The script will:
1. ✅ Install dependencies in all services
2. ✅ Build shared libraries
3. ✅ Start database services
4. ✅ Run database migrations
5. ✅ Build and start all services
6. ✅ Verify service health

### Option 2: Manual Deployment

#### Step 1: Install Dependencies

```bash
# Install dependencies for new services
cd backend/services/lms && npm install --legacy-peer-deps && cd ../../..
cd backend/services/live-streaming && npm install --legacy-peer-deps && cd ../../..
cd backend/services/mobile-api && npm install --legacy-peer-deps && cd ../../..

# Install dependencies for existing services
cd backend/services/video-streaming && npm install --legacy-peer-deps && cd ../../..
cd backend/services/instructor-portal && npm install --legacy-peer-deps && cd ../../..
cd backend/services/student-dashboard && npm install --legacy-peer-deps && cd ../../..

# Install shared libraries
cd backend/shared/database && npm install --legacy-peer-deps && cd ../../..
cd backend/shared/types && npm install --legacy-peer-deps && cd ../../..
cd backend/shared/utils && npm install --legacy-peer-deps && cd ../../..
```

#### Step 2: Build Shared Libraries

```bash
cd backend/shared/types && npm run build && cd ../../..
cd backend/shared/utils && npm run build && cd ../../..
cd backend/shared/database && npm run build && cd ../../..
```

#### Step 3: Start Databases

```bash
docker-compose -f docker-compose.dev.yml up -d postgres redis mongodb
```

Wait 10 seconds for databases to initialize.

#### Step 4: Run Migrations

```bash
cd backend/database
npm install --legacy-peer-deps
node migrate.js
cd ../..
```

#### Step 5: Start All Services

```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

#### Step 6: Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.dev.yml ps

# Check service health
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3010/health  # LMS
curl http://localhost:3011/health  # Live Streaming
curl http://localhost:3012/health  # Mobile API
```

---

## 📋 Service Ports

| Service | Port | URL |
|---------|------|-----|
| API Gateway | 3000 | http://localhost:3000 |
| User Management | 3001 | http://localhost:3001 |
| Course Management | 3002 | http://localhost:3002 |
| Payment | 3003 | http://localhost:3003 |
| Contact | 3004 | http://localhost:3004 |
| Content Management | 3005 | http://localhost:3005 |
| Analytics | 3006 | http://localhost:3006 |
| Notification | 3007 | http://localhost:3007 |
| Admin Panel | 3008 | http://localhost:3008 |
| Security | 3009 | http://localhost:3009 |
| **LMS** | **3010** | **http://localhost:3010** |
| **Live Streaming** | **3011** | **http://localhost:3011** |
| **Mobile API** | **3012** | **http://localhost:3012** |
| **Video Streaming** | **3013** | **http://localhost:3013** |
| **Instructor Portal** | **3014** | **http://localhost:3014** |
| **Student Dashboard** | **3015** | **http://localhost:3015** |

### Database Ports

| Database | Port | Connection String |
|----------|------|-------------------|
| PostgreSQL | 5432 | postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev |
| Redis | 6379 | redis://localhost:6379 |
| MongoDB | 27017 | mongodb://admin:admin123@localhost:27017 |

---

## 🔍 Verification

### Check All Services Are Running

```bash
docker-compose -f docker-compose.dev.yml ps
```

Expected output: All services should show "Up" status.

### Check Service Health

```bash
# API Gateway health (includes all service statuses)
curl http://localhost:3000/health/services

# Individual service health checks
curl http://localhost:3010/health  # LMS
curl http://localhost:3011/health  # Live Streaming
curl http://localhost:3012/health  # Mobile API
curl http://localhost:3013/health  # Video Streaming
curl http://localhost:3014/health  # Instructor Portal
curl http://localhost:3015/health  # Student Dashboard
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f lms
docker-compose -f docker-compose.dev.yml logs -f live-streaming
docker-compose -f docker-compose.dev.yml logs -f mobile-api
```

---

## 🧪 Testing the Deployment

### Test API Gateway Routing

```bash
# Test LMS routes
curl -X GET http://localhost:3000/api/v1/lms/interactive/health

# Test Live Streaming routes
curl -X GET http://localhost:3000/api/v1/live/sessions

# Test Mobile API routes
curl -X GET http://localhost:3000/api/v1/mobile/sync/status
```

### Test Direct Service Access

```bash
# Test LMS service directly
curl http://localhost:3010/health

# Test Live Streaming service directly
curl http://localhost:3011/health

# Test Mobile API service directly
curl http://localhost:3012/health
```

---

## 🛠️ Troubleshooting

### Services Not Starting

```bash
# Check Docker logs
docker-compose -f docker-compose.dev.yml logs

# Restart specific service
docker-compose -f docker-compose.dev.yml restart lms

# Rebuild and restart
docker-compose -f docker-compose.dev.yml up -d --build lms
```

### Database Connection Issues

```bash
# Check database containers
docker-compose -f docker-compose.dev.yml ps postgres redis mongodb

# Restart databases
docker-compose -f docker-compose.dev.yml restart postgres redis mongodb

# Check database logs
docker-compose -f docker-compose.dev.yml logs postgres
```

### Port Conflicts

If ports are already in use:

1. Stop conflicting services
2. Or modify ports in `docker-compose.dev.yml`
3. Restart services

### Dependency Issues

```bash
# Clean install for specific service
cd backend/services/lms
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
cd ../../..

# Rebuild Docker image
docker-compose -f docker-compose.dev.yml build --no-cache lms
```

---

## 🔄 Common Commands

### Start Services
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Stop Services
```bash
docker-compose -f docker-compose.dev.yml down
```

### Restart Services
```bash
docker-compose -f docker-compose.dev.yml restart
```

### View Logs
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Rebuild Services
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

### Clean Everything
```bash
docker-compose -f docker-compose.dev.yml down -v
docker system prune -a
```

---

## 🌐 Production Deployment

For production deployment, see:
- `infrastructure/kubernetes/` - Kubernetes manifests
- `infrastructure/terraform/` - Terraform IaC
- `.github/workflows/` - CI/CD pipelines

### Production Checklist

- [ ] Update environment variables (remove dev values)
- [ ] Configure secrets (API keys, passwords)
- [ ] Set up SSL/TLS certificates
- [ ] Configure domain names
- [ ] Set up monitoring and alerting
- [ ] Configure backup systems
- [ ] Run security scans
- [ ] Load test the system
- [ ] Set up CDN for static assets
- [ ] Configure auto-scaling

---

## 📊 Monitoring

### Health Checks

All services expose `/health` endpoints:
- Returns 200 OK when healthy
- Returns 503 when unhealthy
- Includes service status and dependencies

### Logs

Logs are available via Docker:
```bash
docker-compose -f docker-compose.dev.yml logs -f [service-name]
```

### Metrics

For production, metrics are available via:
- Prometheus (port 9090)
- Grafana (port 3001)
- See `infrastructure/kubernetes/monitoring/`

---

## ✅ Deployment Checklist

- [x] All services added to docker-compose.dev.yml
- [x] API Gateway routing updated
- [x] Deployment scripts created
- [x] Shared libraries verified
- [x] Database migrations ready
- [x] Health checks implemented
- [x] Documentation complete

---

## 🎉 Success!

If all services show "healthy" status, your deployment is complete!

Access the platform at: **http://localhost:3000**

---

## 📞 Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose.dev.yml logs -f`
2. Verify health: `curl http://localhost:3000/health/services`
3. Review this guide
4. Check individual service README files

---

**Deployment Date:** May 1, 2026  
**Platform Version:** 1.0.0  
**All 29 Tasks:** ✅ IMPLEMENTED AND DEPLOYED
