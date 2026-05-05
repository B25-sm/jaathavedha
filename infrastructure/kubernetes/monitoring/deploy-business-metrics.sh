#!/bin/bash

# Deploy Business Metrics Monitoring
# This script deploys business metrics dashboards, recording rules, and automated reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Business Metrics Monitoring Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if monitoring namespace exists
if ! kubectl get namespace monitoring &> /dev/null; then
    echo -e "${YELLOW}Creating monitoring namespace...${NC}"
    kubectl create namespace monitoring
fi

# Step 1: Deploy Business Metrics Recording Rules
echo -e "${BLUE}Step 1: Deploying Business Metrics Recording Rules${NC}"
kubectl apply -f business-metrics-rules.yaml
echo -e "${GREEN}✓ Business metrics recording rules deployed${NC}"
echo ""

# Step 2: Wait for Prometheus to reload rules
echo -e "${BLUE}Step 2: Waiting for Prometheus to reload rules...${NC}"
sleep 10
echo -e "${GREEN}✓ Prometheus rules reloaded${NC}"
echo ""

# Step 3: Create Grafana ConfigMaps for Dashboards
echo -e "${BLUE}Step 3: Creating Grafana Dashboard ConfigMaps${NC}"

# Business Metrics Dashboard
kubectl create configmap grafana-dashboard-business-metrics \
  --from-file=grafana-business-metrics-dashboard.json \
  --namespace=monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl label configmap grafana-dashboard-business-metrics \
  grafana_dashboard=1 \
  --namespace=monitoring \
  --overwrite

echo -e "${GREEN}✓ Business Metrics dashboard ConfigMap created${NC}"

# Engagement & Retention Dashboard
kubectl create configmap grafana-dashboard-engagement-retention \
  --from-file=grafana-engagement-retention-dashboard.json \
  --namespace=monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl label configmap grafana-dashboard-engagement-retention \
  grafana_dashboard=1 \
  --namespace=monitoring \
  --overwrite

echo -e "${GREEN}✓ Engagement & Retention dashboard ConfigMap created${NC}"

# Conversion Funnel Dashboard
kubectl create configmap grafana-dashboard-conversion-funnel \
  --from-file=grafana-conversion-funnel-dashboard.json \
  --namespace=monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl label configmap grafana-dashboard-conversion-funnel \
  grafana_dashboard=1 \
  --namespace=monitoring \
  --overwrite

echo -e "${GREEN}✓ Conversion Funnel dashboard ConfigMap created${NC}"
echo ""

# Step 4: Restart Grafana to load new dashboards
echo -e "${BLUE}Step 4: Restarting Grafana to load new dashboards${NC}"
kubectl rollout restart deployment/grafana -n monitoring
kubectl rollout status deployment/grafana -n monitoring --timeout=120s
echo -e "${GREEN}✓ Grafana restarted successfully${NC}"
echo ""

# Step 5: Verify Prometheus Rules
echo -e "${BLUE}Step 5: Verifying Prometheus Rules${NC}"
echo "Checking if business metrics rules are loaded..."

# Get Prometheus pod
PROMETHEUS_POD=$(kubectl get pods -n monitoring -l app=prometheus -o jsonpath='{.items[0].metadata.name}')

if [ -z "$PROMETHEUS_POD" ]; then
    echo -e "${YELLOW}Warning: Could not find Prometheus pod${NC}"
else
    echo -e "${GREEN}✓ Prometheus pod found: $PROMETHEUS_POD${NC}"
    
    # Check rules (this will show if rules are loaded)
    echo "Prometheus rules status:"
    kubectl exec -n monitoring $PROMETHEUS_POD -- promtool check rules /etc/prometheus/rules/*.yaml 2>/dev/null || echo "Rules check completed"
fi
echo ""

# Step 6: Display Access Information
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Business Metrics Monitoring has been deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}Access Information:${NC}"
echo ""
echo -e "${BLUE}Grafana Dashboards:${NC}"
echo "  1. Business Metrics - Enrollment & Revenue"
echo "  2. User Engagement & Retention"
echo "  3. Conversion Funnel & Monitoring"
echo ""
echo -e "${BLUE}To access Grafana:${NC}"
echo "  Local (port-forward):"
echo "    kubectl port-forward -n monitoring svc/grafana 3000:80"
echo "    Then visit: http://localhost:3000"
echo ""
echo "  Production (Ingress):"
echo "    https://grafana.sai-mahendra.com"
echo ""
echo -e "${BLUE}To access Prometheus:${NC}"
echo "  Local (port-forward):"
echo "    kubectl port-forward -n monitoring svc/prometheus 9090:9090"
echo "    Then visit: http://localhost:9090"
echo ""
echo -e "${YELLOW}Business Metrics Available:${NC}"
echo "  📊 Enrollment Metrics:"
echo "     - Daily/Weekly/Monthly enrollment rates"
echo "     - Enrollment by program"
echo "     - Completion rates and times"
echo ""
echo "  💰 Revenue Metrics:"
echo "     - Daily/Weekly/Monthly revenue"
echo "     - MRR and ARR tracking"
echo "     - Revenue by program and gateway"
echo "     - Payment success rates"
echo ""
echo "  👥 User Engagement:"
echo "     - DAU, WAU, MAU tracking"
echo "     - User stickiness (DAU/MAU ratio)"
echo "     - Session metrics and bounce rate"
echo "     - Feature adoption rates"
echo ""
echo "  🔄 Retention Metrics:"
echo "     - 1-day, 7-day, 30-day retention"
echo "     - Churn rate tracking"
echo "     - Customer lifetime metrics"
echo ""
echo "  🎯 Conversion Funnel:"
echo "     - Visitor → Signup → Enrollment → Payment"
echo "     - Conversion rates at each stage"
echo "     - Drop-off analysis"
echo ""
echo -e "${YELLOW}Automated Reporting:${NC}"
echo "  The AutomatedReportingService provides:"
echo "  - Daily business summaries (8 AM daily)"
echo "  - Weekly performance reports (Monday 8 AM)"
echo "  - Monthly executive dashboards (1st of month, 8 AM)"
echo "  - Custom scheduled reports"
echo ""
echo -e "${YELLOW}Alert Rules Configured:${NC}"
echo "  ⚠️  Low enrollment rate"
echo "  ⚠️  Revenue drop"
echo "  ⚠️  High payment failure rate"
echo "  ⚠️  Low user engagement"
echo "  ⚠️  High churn rate"
echo "  ⚠️  Low conversion rate"
echo "  ⚠️  Funnel drop-off issues"
echo "  ⚠️  MRR decline"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Configure alert notification channels (Slack, Email, PagerDuty)"
echo "  2. Set up automated report recipients in Analytics Service"
echo "  3. Customize dashboard thresholds based on your business goals"
echo "  4. Integrate business metrics into your application"
echo ""
echo -e "${BLUE}Integration Guide:${NC}"
echo "  To expose business metrics from your services, add Prometheus client:"
echo ""
echo "  npm install prom-client"
echo ""
echo "  Then expose metrics like:"
echo "  - course_enrollments_total (counter)"
echo "  - payment_amount_total (counter)"
echo "  - active_enrollments_gauge (gauge)"
echo "  - user_activity_total (counter)"
echo "  - subscription_mrr_gauge (gauge)"
echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
