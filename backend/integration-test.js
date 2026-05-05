#!/usr/bin/env node

/**
 * Core Services Integration Test
 * Tests communication between Auth, Course, Payment, and Contact services
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Service URLs
const services = {
  gateway: 'http://localhost:3000',
  auth: 'http://localhost:3001',
  courses: 'http://localhost:3002',
  payments: 'http://localhost:3003',
  contact: 'http://localhost:3004',
  content: 'http://localhost:3005',
  analytics: 'http://localhost:3006',
  notifications: 'http://localhost:3007'
};

// Test configuration
const testConfig = {
  timeout: 5000,
  retries: 3
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Test helper functions
async function makeRequest(url, options = {}) {
  const startTime = performance.now();
  
  try {
    const response = await axios({
      url,
      timeout: testConfig.timeout,
      validateStatus: () => true, // Don't throw on HTTP errors
      ...options
    });
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data,
      duration,
      error: null
    };
  } catch (error) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    return {
      success: false,
      status: error.response?.status || 0,
      data: null,
      duration,
      error: error.message
    };
  }
}

// Individual service tests
async function testServiceHealth(serviceName, url) {
  logInfo(`Testing ${serviceName} health...`);
  
  const result = await makeRequest(`${url}/health`);
  
  if (result.success) {
    logSuccess(`${serviceName} is healthy (${result.duration}ms)`);
    return true;
  } else {
    logError(`${serviceName} health check failed: ${result.error || `HTTP ${result.status}`}`);
    return false;
  }
}

async function testAuthService() {
  logInfo('Testing User Management Service...');
  
  // Test registration endpoint
  const registerResult = await makeRequest(`${services.auth}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    }
  });
  
  if (registerResult.success || registerResult.status === 400) {
    logSuccess('Auth service registration endpoint is working');
    return true;
  } else {
    logError(`Auth service registration failed: ${registerResult.error || `HTTP ${registerResult.status}`}`);
    return false;
  }
}

async function testCourseService() {
  logInfo('Testing Course Management Service...');
  
  // Test programs endpoint
  const programsResult = await makeRequest(`${services.courses}/api/programs`);
  
  if (programsResult.success || programsResult.status === 401) {
    logSuccess('Course service programs endpoint is working');
    return true;
  } else {
    logError(`Course service programs failed: ${programsResult.error || `HTTP ${programsResult.status}`}`);
    return false;
  }
}

async function testPaymentService() {
  logInfo('Testing Payment Service...');
  
  // Test create order endpoint (should fail without auth, but endpoint should exist)
  const orderResult = await makeRequest(`${services.payments}/api/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      userId: 'test-user',
      programId: 'test-program',
      amount: 100,
      currency: 'INR'
    }
  });
  
  if (orderResult.success || orderResult.status === 400 || orderResult.status === 401) {
    logSuccess('Payment service create order endpoint is working');
    return true;
  } else {
    logError(`Payment service create order failed: ${orderResult.error || `HTTP ${orderResult.status}`}`);
    return false;
  }
}

async function testContactService() {
  logInfo('Testing Contact Service...');
  
  // Test contact form submission
  const contactResult = await makeRequest(`${services.contact}/api/contact/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Integration Test',
      message: 'This is a test message from integration test',
      type: 'general'
    }
  });
  
  if (contactResult.success || contactResult.status === 400) {
    logSuccess('Contact service submission endpoint is working');
    return true;
  } else {
    logError(`Contact service submission failed: ${contactResult.error || `HTTP ${contactResult.status}`}`);
    return false;
  }
}

async function testContentService() {
  logInfo('Testing Content Management Service...');
  
  // Test testimonials endpoint
  const testimonialsResult = await makeRequest(`${services.content}/api/content/testimonials`);
  
  if (testimonialsResult.success) {
    logSuccess('Content service testimonials endpoint is working');
    return true;
  } else {
    logError(`Content service testimonials failed: ${testimonialsResult.error || `HTTP ${testimonialsResult.status}`}`);
    return false;
  }
}

async function testAnalyticsService() {
  logInfo('Testing Analytics Service...');
  
  // Test event tracking endpoint
  const eventResult = await makeRequest(`${services.analytics}/api/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      eventType: 'test_event',
      userId: 'test-user',
      sessionId: 'test-session',
      properties: { test: true }
    }
  });
  
  if (eventResult.success || eventResult.status === 400) {
    logSuccess('Analytics service event tracking endpoint is working');
    return true;
  } else {
    logError(`Analytics service event tracking failed: ${eventResult.error || `HTTP ${eventResult.status}`}`);
    return false;
  }
}

async function testNotificationService() {
  logInfo('Testing Notification Service...');
  
  // Test notification preferences endpoint (should fail without auth, but endpoint should exist)
  const prefsResult = await makeRequest(`${services.notifications}/api/notifications/preferences/test-user`);
  
  if (prefsResult.success || prefsResult.status === 401 || prefsResult.status === 404) {
    logSuccess('Notification service preferences endpoint is working');
    return true;
  } else {
    logError(`Notification service preferences failed: ${prefsResult.error || `HTTP ${prefsResult.status}`}`);
    return false;
  }
}

async function testAPIGateway() {
  logInfo('Testing API Gateway...');
  
  // Test gateway health endpoint
  const gatewayResult = await makeRequest(`${services.gateway}/health`);
  
  if (gatewayResult.success) {
    logSuccess('API Gateway is working');
    return true;
  } else {
    logError(`API Gateway failed: ${gatewayResult.error || `HTTP ${gatewayResult.status}`}`);
    return false;
  }
}

// Main test runner
async function runIntegrationTests() {
  log('\n🚀 Starting Core Services Integration Test\n', colors.blue);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  const tests = [
    { name: 'API Gateway', fn: testAPIGateway },
    { name: 'User Management Health', fn: () => testServiceHealth('User Management', services.auth) },
    { name: 'Course Management Health', fn: () => testServiceHealth('Course Management', services.courses) },
    { name: 'Payment Health', fn: () => testServiceHealth('Payment', services.payments) },
    { name: 'Contact Health', fn: () => testServiceHealth('Contact', services.contact) },
    { name: 'Content Management Health', fn: () => testServiceHealth('Content Management', services.content) },
    { name: 'Analytics Health', fn: () => testServiceHealth('Analytics', services.analytics) },
    { name: 'Notification Health', fn: () => testServiceHealth('Notification', services.notifications) },
    { name: 'Auth Service Endpoints', fn: testAuthService },
    { name: 'Course Service Endpoints', fn: testCourseService },
    { name: 'Payment Service Endpoints', fn: testPaymentService },
    { name: 'Contact Service Endpoints', fn: testContactService },
    { name: 'Content Service Endpoints', fn: testContentService },
    { name: 'Analytics Service Endpoints', fn: testAnalyticsService },
    { name: 'Notification Service Endpoints', fn: testNotificationService }
  ];
  
  for (const test of tests) {
    results.total++;
    
    try {
      const success = await test.fn();
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      logError(`${test.name} test threw an error: ${error.message}`);
      results.failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Print summary
  log('\n📊 Integration Test Summary\n', colors.blue);
  log(`Total Tests: ${results.total}`);
  logSuccess(`Passed: ${results.passed}`);
  
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`);
  }
  
  const successRate = Math.round((results.passed / results.total) * 100);
  
  if (successRate >= 80) {
    logSuccess(`\n🎉 Integration test completed with ${successRate}% success rate`);
    logInfo('Core services are ready for integration!');
  } else if (successRate >= 60) {
    logWarning(`\n⚠️  Integration test completed with ${successRate}% success rate`);
    logWarning('Some services may need attention before full integration');
  } else {
    logError(`\n💥 Integration test completed with ${successRate}% success rate`);
    logError('Multiple services are failing - check service configurations');
  }
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Handle script execution
if (require.main === module) {
  runIntegrationTests().catch(error => {
    logError(`Integration test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runIntegrationTests,
  testServiceHealth,
  services
};