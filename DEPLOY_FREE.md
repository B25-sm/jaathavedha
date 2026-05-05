# FREE Deployment Guide - Sai Mahendra Platform

## 🎯 Zero-Cost Deployment Strategy

This guide helps you deploy the entire platform using only FREE tiers.

## Option A: Railway + Free Services (Easiest - 30 minutes)

### Step 1: Deploy Frontend (Vercel - FREE)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel deploy --prod
# Follow prompts, connect GitHub
```

**Result:** Frontend live at `https://your-app.vercel.app`

---

### Step 2: Setup Free Databases

#### PostgreSQL - Supabase (500MB FREE)
1. Go to supabase.com
2. Create account
3. Create new project
4. Copy connection string: `postgresql://postgres:[password]@[host]:5432/postgres`

#### MongoDB - Atlas (512MB FREE)
1. Go to mongodb.com/cloud/atlas
2. Create free cluster (M0)
3. Create database user
4. Whitelist IP: 0.0.0.0/0
5. Copy connection string: `mongodb+srv://[user]:[pass]@[cluster].mongodb.net/`

#### Redis - Upstash (10K commands/day FREE)
1. Go to upstash.com
2. Create database
3. Copy connection string: `redis://[host]:[port]`

---

### Step 3: Deploy Backend Services (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create new project
railway init

# Deploy API Gateway
cd backend/services/api-gateway
railway up

# Set environment variables in Railway dashboard:
# - DATABASE_URL (from Supabase)
# - REDIS_URL (from Upstash)
# - JWT_SECRET (generate: openssl rand -base64 32)

# Deploy User Management
cd ../user-management
railway up

# Deploy Course Management
cd ../course-management
railway up
```

**Note:** Railway free tier gives $5 credit/month. Deploy 2-3 core services first.

---

### Step 4: Configure Environment Variables

Create `.env.production` for each service:

```env
# Database
DATABASE_URL=postgresql://postgres:[password]@[supabase-host]:5432/postgres
MONGODB_URL=mongodb+srv://[user]:[pass]@[cluster].mongodb.net/sai_mahendra
REDIS_URL=redis://[upstash-host]:[port]

# JWT
JWT_SECRET=your-generated-secret-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Services URLs (Railway provides these)
USER_SERVICE_URL=https://user-service.railway.app
COURSE_SERVICE_URL=https://course-service.railway.app

# Email (SendGrid - 100 emails/day FREE)
SENDGRID_API_KEY=your-key-here
FROM_EMAIL=noreply@yourdomain.com

# File Storage (Cloudflare R2 - 10GB FREE)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=sai-mahendra-content
```

---

## Option B: Oracle Cloud (Best FREE Option - All Services)

### Why Oracle Cloud?
- **24GB RAM FREE forever** (4 ARM VMs)
- **200GB storage FREE**
- **10TB bandwidth/month FREE**
- Can run ALL 20 microservices!

### Step 1: Sign Up

1. Go to oracle.com/cloud/free
2. Sign up (no credit card required)
3. Verify email
4. Complete profile

### Step 2: Create VMs

```bash
# Create 4 ARM instances via Oracle Cloud Console:
# - Shape: VM.Standard.A1.Flex
# - OCPUs: 2 per VM
# - Memory: 6GB per VM
# - Image: Ubuntu 22.04
# - Boot volume: 50GB each

# Total: 8 OCPUs, 24GB RAM, 200GB storage - FREE!
```

### Step 3: Setup Kubernetes (K3s)

```bash
# SSH into first VM
ssh ubuntu@<vm1-ip>

# Install K3s (master node)
curl -sfL https://get.k3s.io | sh -

# Get token for worker nodes
sudo cat /var/lib/rancher/k3s/server/node-token

# SSH into other VMs and join cluster
ssh ubuntu@<vm2-ip>
curl -sfL https://get.k3s.io | K3S_URL=https://<vm1-ip>:6443 \
  K3S_TOKEN=<token-from-master> sh -

# Repeat for vm3 and vm4
```

### Step 4: Deploy Services

```bash
# From your local machine, copy kubeconfig
scp ubuntu@<vm1-ip>:/etc/rancher/k3s/k3s.yaml ~/.kube/config

# Edit config to use public IP
sed -i 's/127.0.0.1/<vm1-public-ip>/g' ~/.kube/config

# Deploy all services
kubectl apply -f infrastructure/kubernetes/deployments/

# Check status
kubectl get pods -n sai-mahendra-platform
```

### Step 5: Setup Ingress

```bash
# Install Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Apply your ingress rules
kubectl apply -f infrastructure/kubernetes/ingress/platform-ingress.yaml

# Get ingress IP
kubectl get svc -n ingress-nginx
```

---

## Option C: Hybrid FREE Approach (Recommended)

**Combine multiple free tiers for maximum resources:**

### Architecture:

```
Frontend (Vercel)
    ↓
API Gateway (Railway)
    ↓
┌─────────────────────────────────┐
│  Core Services (Railway)        │
│  - User Management              │
│  - Course Management            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Secondary Services (Render)    │
│  - Content Management           │
│  - Analytics                    │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Databases (FREE Tiers)         │
│  - PostgreSQL (Supabase)        │
│  - MongoDB (Atlas)              │
│  - Redis (Upstash)              │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Storage & CDN                  │
│  - Files (Cloudflare R2)        │
│  - CDN (Cloudflare)             │
└─────────────────────────────────┘
```

### Deployment Steps:

```bash
# 1. Frontend
cd frontend
vercel deploy --prod

# 2. Core services on Railway (2-3 services)
cd backend/services/api-gateway
railway up

cd ../user-management
railway up

# 3. Additional services on Render
# Go to render.com, connect GitHub, deploy:
# - content-management
# - analytics
# - notification

# 4. Setup databases (all free)
# - Supabase for PostgreSQL
# - MongoDB Atlas for MongoDB
# - Upstash for Redis

# 5. Configure environment variables in each platform
```

---

## 🎁 Free Service Providers Summary

| Service | Provider | Free Tier | Limits |
|---------|----------|-----------|--------|
| Frontend Hosting | Vercel | Unlimited | 100GB bandwidth |
| Frontend Hosting | Netlify | Unlimited | 100GB bandwidth |
| Backend (Node.js) | Railway | $5 credit/mo | ~2-3 services |
| Backend (Node.js) | Render | 750 hrs/mo | 1 service 24/7 |
| PostgreSQL | Supabase | 500MB | 2GB bandwidth |
| PostgreSQL | Neon | 3GB | Unlimited |
| MongoDB | Atlas | 512MB | Shared cluster |
| Redis | Upstash | 10K cmds/day | 256MB |
| File Storage | Cloudflare R2 | 10GB | 1M requests |
| CDN | Cloudflare | Unlimited | Unlimited |
| Email | SendGrid | 100/day | Forever free |
| Email | Resend | 100/day | 3K/month |
| Domain | Freenom | Free | .tk, .ml, .ga |
| SSL | Let's Encrypt | Free | Auto-renew |
| Monitoring | Grafana Cloud | Free | 10K metrics |
| Logging | Better Stack | Free | 1GB/month |

---

## 🚀 Quick Start Commands

### Minimal MVP (5 Core Services)

```bash
# 1. Clone and install
git clone <your-repo>
cd sai-mahendra-platform
npm install

# 2. Setup environment variables
cp .env.example .env
# Edit .env with free tier credentials

# 3. Deploy frontend
cd frontend
vercel deploy --prod

# 4. Deploy backend services
cd ../backend/services/api-gateway
railway up

# 5. Test
curl https://your-api.railway.app/health
```

---

## 📊 Cost Breakdown

### Month 1-3 (MVP Phase)
- **Total Cost: $0/month**
- Frontend: Vercel (FREE)
- Backend: Railway ($5 credit) + Render (FREE)
- Databases: All free tiers
- Storage: Cloudflare R2 (FREE)
- Email: SendGrid (FREE 100/day)

### Month 4-6 (Growth Phase)
- **Total Cost: $0-25/month**
- Same as above
- May need to upgrade Railway ($5/mo per service)

### Month 7+ (Scale Phase)
- **Total Cost: $50-100/month**
- Upgrade databases
- Add more backend capacity
- Still using free tiers where possible

---

## 🎓 Student Bonus

If you're a student, get GitHub Student Pack:
- $200 DigitalOcean credit
- $100 Azure credit  
- Free domain
- Free MongoDB Atlas credit

**Apply:** education.github.com/pack

---

## 🆘 Troubleshooting

### Railway runs out of credit
→ Deploy fewer services or use Render for additional services

### Supabase database full
→ Upgrade to Neon (3GB free) or clean old data

### Services sleeping on Render
→ Use cron-job.org to ping every 14 minutes

### Need more Redis commands
→ Use multiple Upstash databases (create multiple accounts)

---

## 📈 Scaling Path

```
Month 1: FREE tiers only ($0)
    ↓
Month 2-3: Still FREE ($0)
    ↓
Month 4-6: Add Railway services ($10-25/mo)
    ↓
Month 7+: Upgrade databases ($50-100/mo)
    ↓
Year 2: Move to DigitalOcean/AWS ($400+/mo)
```

---

## 🎯 Next Steps

1. **Choose your approach** (Railway, Oracle, or Hybrid)
2. **Sign up for free services** (takes 1 hour)
3. **Deploy MVP** (3-5 core services)
4. **Test thoroughly**
5. **Launch and get users**
6. **Scale as revenue grows**

---

## 💡 Pro Tips

1. **Start small** - Deploy 3-5 core services first
2. **Use free monitoring** - Grafana Cloud, Better Stack
3. **Optimize images** - Smaller Docker images = faster deploys
4. **Cache aggressively** - Reduce database load
5. **Monitor usage** - Stay within free tier limits
6. **Have backup plan** - Know when to upgrade

---

## 🔗 Useful Links

- Railway: railway.app
- Render: render.com
- Vercel: vercel.com
- Supabase: supabase.com
- MongoDB Atlas: mongodb.com/cloud/atlas
- Upstash: upstash.com
- Cloudflare: cloudflare.com
- Oracle Cloud: oracle.com/cloud/free

---

**Ready to deploy? Let's start with Railway + Vercel!**
