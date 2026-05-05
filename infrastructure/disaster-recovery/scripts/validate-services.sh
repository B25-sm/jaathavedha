#!/bin/bash
# Service Validation Script
# Validates all services are healthy after failover or recovery

set -euo pipefail

# Configuration
CONTEXT="${KUBE_CONTEXT:-secondary}"
NAMESPACE="${NAMESPACE:-production}"
DOMAIN="${DOMAIN:-api.saimahendra.com}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_CHECKS++))
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

check() {
    ((TOTAL_CHECKS++))
}

log "========================================="
log "Service Validation Report"
log "========================================="
log "Context: $CONTEXT"
log "Namespace: $NAMESPACE"
log "Domain: $DOMAIN"
log "========================================="

# Check 1: Kubernetes Cluster Connectivity
log "\n1. Checking Kubernetes cluster connectivity..."
check
if kubectl cluster-info --context="$CONTEXT" &>/dev/null; then
    log_success "Kubernetes cluster is accessible"
else
    log_error "Cannot connect to Kubernetes cluster"
fi

# Check 2: Node Status
log "\n2. Checking node status..."
check
NOT_READY_NODES=$(kubectl get nodes --context="$CONTEXT" --no-headers | grep -v "Ready" | wc -l)
TOTAL_NODES=$(kubectl get nodes --context="$CONTEXT" --no-headers | wc -l)

if [ "$NOT_READY_NODES" -eq 0 ]; then
    log_success "All $TOTAL_NODES nodes are Ready"
else
    log_error "$NOT_READY_NODES out of $TOTAL_NODES nodes are not Ready"
    kubectl get nodes --context="$CONTEXT"
fi

# Check 3: Pod Status
log "\n3. Checking pod status..."
check
NOT_RUNNING_PODS=$(kubectl get pods -n "$NAMESPACE" --context="$CONTEXT" --no-headers | grep -v "Running\|Completed" | wc -l)
TOTAL_PODS=$(kubectl get pods -n "$NAMESPACE" --context="$CONTEXT" --no-headers | wc -l)

if [ "$NOT_RUNNING_PODS" -eq 0 ]; then
    log_success "All $TOTAL_PODS pods are Running"
else
    log_error "$NOT_RUNNING_PODS out of $TOTAL_PODS pods are not Running"
    kubectl get pods -n "$NAMESPACE" --context="$CONTEXT" | grep -v "Running\|Completed"
fi

# Check 4: Critical Services
log "\n4. Checking critical services..."

CRITICAL_SERVICES=("api-gateway" "user-management" "payment")

for service in "${CRITICAL_SERVICES[@]}"; do
    check
    READY_REPLICAS=$(kubectl get deployment "$service" -n "$NAMESPACE" --context="$CONTEXT" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    DESIRED_REPLICAS=$(kubectl get deployment "$service" -n "$NAMESPACE" --context="$CONTEXT" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    
    if [ "$READY_REPLICAS" -eq "$DESIRED_REPLICAS" ] && [ "$READY_REPLICAS" -gt 0 ]; then
        log_success "$service: $READY_REPLICAS/$DESIRED_REPLICAS replicas ready"
    else
        log_error "$service: $READY_REPLICAS/$DESIRED_REPLICAS replicas ready"
    fi
done

# Check 5: Database Connectivity
log "\n5. Checking database connectivity..."
check

DB_POD=$(kubectl get pods -n "$NAMESPACE" --context="$CONTEXT" -l app=user-management -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -n "$DB_POD" ]; then
    if kubectl exec -n "$NAMESPACE" --context="$CONTEXT" "$DB_POD" -- sh -c 'psql $DATABASE_URL -c "SELECT 1"' &>/dev/null; then
        log_success "Database is accessible"
    else
        log_error "Cannot connect to database"
    fi
else
    log_warning "Could not find pod to test database connectivity"
fi

# Check 6: Redis Connectivity
log "\n6. Checking Redis connectivity..."
check

if [ -n "$DB_POD" ]; then
    if kubectl exec -n "$NAMESPACE" --context="$CONTEXT" "$DB_POD" -- sh -c 'redis-cli -u $REDIS_URL ping' 2>/dev/null | grep -q "PONG"; then
        log_success "Redis is accessible"
    else
        log_error "Cannot connect to Redis"
    fi
else
    log_warning "Could not find pod to test Redis connectivity"
fi

# Check 7: API Health Endpoints
log "\n7. Checking API health endpoints..."

API_SERVICES=("api-gateway" "user-management" "course-management" "payment" "notification")

for service in "${API_SERVICES[@]}"; do
    check
    SERVICE_URL=$(kubectl get svc "$service" -n "$NAMESPACE" --context="$CONTEXT" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
    
    if [ -n "$SERVICE_URL" ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVICE_URL}/health" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            log_success "$service health endpoint: HTTP $HTTP_CODE"
        else
            log_error "$service health endpoint: HTTP $HTTP_CODE"
        fi
    else
        log_warning "$service: No external endpoint found"
    fi
done

# Check 8: External Domain
log "\n8. Checking external domain..."
check

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    log_success "External domain $DOMAIN: HTTP $HTTP_CODE"
else
    log_error "External domain $DOMAIN: HTTP $HTTP_CODE"
fi

# Check 9: DNS Resolution
log "\n9. Checking DNS resolution..."
check

if dig +short "$DOMAIN" | grep -q "."; then
    RESOLVED_IP=$(dig +short "$DOMAIN" | head -1)
    log_success "DNS resolves $DOMAIN to $RESOLVED_IP"
else
    log_error "DNS resolution failed for $DOMAIN"
fi

# Check 10: SSL Certificate
log "\n10. Checking SSL certificate..."
check

CERT_EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

if [ -n "$CERT_EXPIRY" ]; then
    EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$CERT_EXPIRY" +%s 2>/dev/null)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ "$DAYS_UNTIL_EXPIRY" -gt 30 ]; then
        log_success "SSL certificate valid for $DAYS_UNTIL_EXPIRY days"
    elif [ "$DAYS_UNTIL_EXPIRY" -gt 0 ]; then
        log_warning "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
    else
        log_error "SSL certificate has expired"
    fi
else
    log_error "Could not retrieve SSL certificate"
fi

# Check 11: Resource Usage
log "\n11. Checking resource usage..."
check

HIGH_CPU_PODS=$(kubectl top pods -n "$NAMESPACE" --context="$CONTEXT" 2>/dev/null | awk 'NR>1 {gsub(/[^0-9]/, "", $2); if ($2 > 80) print $1}' | wc -l)

if [ "$HIGH_CPU_PODS" -eq 0 ]; then
    log_success "No pods with high CPU usage"
else
    log_warning "$HIGH_CPU_PODS pods have CPU usage > 80%"
    kubectl top pods -n "$NAMESPACE" --context="$CONTEXT" | awk 'NR>1 {gsub(/[^0-9]/, "", $2); if ($2 > 80) print}'
fi

# Check 12: Recent Errors in Logs
log "\n12. Checking for recent errors in logs..."
check

ERROR_COUNT=0
for service in "${CRITICAL_SERVICES[@]}"; do
    ERRORS=$(kubectl logs -n "$NAMESPACE" --context="$CONTEXT" -l "app=$service" --tail=100 --since=5m 2>/dev/null | grep -i "error\|exception\|fatal" | wc -l)
    ERROR_COUNT=$((ERROR_COUNT + ERRORS))
done

if [ "$ERROR_COUNT" -eq 0 ]; then
    log_success "No recent errors in critical service logs"
elif [ "$ERROR_COUNT" -lt 10 ]; then
    log_warning "$ERROR_COUNT errors found in recent logs"
else
    log_error "$ERROR_COUNT errors found in recent logs"
fi

# Check 13: Persistent Volume Claims
log "\n13. Checking persistent volume claims..."
check

PENDING_PVCS=$(kubectl get pvc -n "$NAMESPACE" --context="$CONTEXT" --no-headers 2>/dev/null | grep -v "Bound" | wc -l)

if [ "$PENDING_PVCS" -eq 0 ]; then
    log_success "All PVCs are Bound"
else
    log_error "$PENDING_PVCS PVCs are not Bound"
    kubectl get pvc -n "$NAMESPACE" --context="$CONTEXT" | grep -v "Bound"
fi

# Check 14: ConfigMaps and Secrets
log "\n14. Checking ConfigMaps and Secrets..."
check

REQUIRED_SECRETS=("db-credentials" "redis-credentials" "api-keys")
MISSING_SECRETS=0

for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! kubectl get secret "$secret" -n "$NAMESPACE" --context="$CONTEXT" &>/dev/null; then
        log_warning "Secret $secret not found"
        ((MISSING_SECRETS++))
    fi
done

if [ "$MISSING_SECRETS" -eq 0 ]; then
    log_success "All required secrets are present"
else
    log_warning "$MISSING_SECRETS required secrets are missing"
fi

# Check 15: Network Policies
log "\n15. Checking network policies..."
check

NETWORK_POLICIES=$(kubectl get networkpolicies -n "$NAMESPACE" --context="$CONTEXT" --no-headers 2>/dev/null | wc -l)

if [ "$NETWORK_POLICIES" -gt 0 ]; then
    log_success "$NETWORK_POLICIES network policies configured"
else
    log_warning "No network policies found"
fi

# Summary
log "\n========================================="
log "Validation Summary"
log "========================================="
log "Total Checks: $TOTAL_CHECKS"
log_success "Passed: $PASSED_CHECKS"
log_error "Failed: $FAILED_CHECKS"

SUCCESS_RATE=$(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))
log "Success Rate: ${SUCCESS_RATE}%"
log "========================================="

# Exit code based on critical failures
CRITICAL_FAILURES=$((TOTAL_CHECKS - PASSED_CHECKS))

if [ "$CRITICAL_FAILURES" -eq 0 ]; then
    log_success "All validation checks passed!"
    exit 0
elif [ "$CRITICAL_FAILURES" -le 3 ]; then
    log_warning "Some non-critical checks failed"
    exit 0
else
    log_error "Multiple critical checks failed"
    exit 1
fi
