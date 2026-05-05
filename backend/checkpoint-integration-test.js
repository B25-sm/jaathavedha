#!/usr/bin/env node

/**
 * Checkpoint 6: Core Services Integration Test
 * Tests the structure and basic functionality of Auth, Course, and Payment services
 * This test focuses on service architecture validation rather than full database integration
 */

const fs = require('fs');
const path = require('path');

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

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

function addTestResult(testName, passed, details = '') {
  results.total++;
  if (passed) {
    results.passed++;
    logSuccess(`${testName}: PASSED ${details}`);
  } else {
    results.failed++;
    logError(`${testName}: FAILED ${details}`);
  }
  results.details.push({ testName, passed, details });
}

// Core service structure tests
function testServiceStructure(serviceName, servicePath) {
  logInfo(`Testing ${serviceName} service structure...`);
  
  // Check if service directory exists
  if (!fs.existsSync(servicePath)) {
    addTestResult(`${serviceName} Directory`, false, 'Service directory not found');
    return false;
  }
  
  addTestResult(`${serviceName} Directory`, true, 'Service directory exists');
  
  // Check for main entry point
  const indexPath = path.join(servicePath, 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    addTestResult(`${serviceName} Entry Point`, true, 'index.ts found');
  } else {
    addTestResult(`${serviceName} Entry Point`, false, 'index.ts not found');
  }
  
  // Check for package.json
  const packagePath = path.join(servicePath, 'package.json');
  if (fs.existsSync(packagePath)) {
    addTestResult(`${serviceName} Package Config`, true, 'package.json found');
    
    try {
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageData.scripts && packageData.scripts.dev) {
        addTestResult(`${serviceName} Dev Script`, true, 'Development script configured');
      } else {
        addTestResult(`${serviceName} Dev Script`, false, 'No dev script found');
      }
    } catch (error) {
      addTestResult(`${serviceName} Package Parse`, false, 'Invalid package.json');
    }
  } else {
    addTestResult(`${serviceName} Package Config`, false, 'package.json not found');
  }
  
  // Check for Dockerfile
  const dockerfilePath = path.join(servicePath, 'Dockerfile.dev');
  if (fs.existsSync(dockerfilePath)) {
    addTestResult(`${serviceName} Docker Config`, true, 'Dockerfile.dev found');
  } else {
    addTestResult(`${serviceName} Docker Config`, false, 'Dockerfile.dev not found');
  }
  
  return true;
}

function testAuthServiceImplementation() {
  logInfo('Testing User Management Service implementation...');
  
  const servicePath = path.join(__dirname, 'services', 'user-management');
  const indexPath = path.join(servicePath, 'src', 'index.ts');
  
  if (!fs.existsSync(indexPath)) {
    addTestResult('Auth Service Implementation', false, 'Main file not found');
    return;
  }
  
  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check for essential authentication features
    const checks = [
      { name: 'Express Server', pattern: /import.*express/i, found: false },
      { name: 'CORS Middleware', pattern: /cors/i, found: false },
      { name: 'Security Headers', pattern: /helmet/i, found: false },
      { name: 'Rate Limiting', pattern: /rateLimit/i, found: false },
      { name: 'Auth Routes', pattern: /authRoutes|\/auth/i, found: false },
      { name: 'User Routes', pattern: /userRoutes|\/users/i, found: false },
      { name: 'Health Check', pattern: /\/health/i, found: false },
      { name: 'Error Handler', pattern: /errorHandler/i, found: false }
    ];
    
    checks.forEach(check => {
      check.found = check.pattern.test(content);
      addTestResult(`Auth ${check.name}`, check.found, check.found ? 'Implementation found' : 'Implementation missing');
    });
    
  } catch (error) {
    addTestResult('Auth Service Implementation', false, `Error reading file: ${error.message}`);
  }
}

function testCourseServiceImplementation() {
  logInfo('Testing Course Management Service implementation...');
  
  const servicePath = path.join(__dirname, 'services', 'course-management');
  const indexPath = path.join(servicePath, 'src', 'index.ts');
  
  if (!fs.existsSync(indexPath)) {
    addTestResult('Course Service Implementation', false, 'Main file not found');
    return;
  }
  
  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check for essential course management features
    const checks = [
      { name: 'Express Server', pattern: /import.*express/i, found: false },
      { name: 'Program Routes', pattern: /programRoutes|\/programs/i, found: false },
      { name: 'Enrollment Routes', pattern: /enrollmentRoutes|\/enrollments/i, found: false },
      { name: 'Database Init', pattern: /initializeDatabases|DatabaseUtils/i, found: false },
      { name: 'Health Check', pattern: /\/health/i, found: false },
      { name: 'Error Handler', pattern: /errorHandler/i, found: false }
    ];
    
    checks.forEach(check => {
      check.found = check.pattern.test(content);
      addTestResult(`Course ${check.name}`, check.found, check.found ? 'Implementation found' : 'Implementation missing');
    });
    
  } catch (error) {
    addTestResult('Course Service Implementation', false, `Error reading file: ${error.message}`);
  }
}

function testPaymentServiceImplementation() {
  logInfo('Testing Payment Service implementation...');
  
  const servicePath = path.join(__dirname, 'services', 'payment');
  const indexPath = path.join(servicePath, 'src', 'index.ts');
  
  if (!fs.existsSync(indexPath)) {
    addTestResult('Payment Service Implementation', false, 'Main file not found');
    return;
  }
  
  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check for essential payment features
    const checks = [
      { name: 'Express Server', pattern: /import.*express/i, found: false },
      { name: 'Payment Service', pattern: /PaymentService/i, found: false },
      { name: 'Razorpay Gateway', pattern: /RazorpayGateway/i, found: false },
      { name: 'Stripe Gateway', pattern: /StripeGateway/i, found: false },
      { name: 'Create Order Endpoint', pattern: /\/create-order/i, found: false },
      { name: 'Verify Payment Endpoint', pattern: /\/verify/i, found: false },
      { name: 'Webhook Endpoints', pattern: /\/webhook/i, found: false },
      { name: 'Subscription Management', pattern: /\/subscriptions/i, found: false },
      { name: 'Health Check', pattern: /\/health/i, found: false }
    ];
    
    checks.forEach(check => {
      check.found = check.pattern.test(content);
      addTestResult(`Payment ${check.name}`, check.found, check.found ? 'Implementation found' : 'Implementation missing');
    });
    
  } catch (error) {
    addTestResult('Payment Service Implementation', false, `Error reading file: ${error.message}`);
  }
}

function testServiceIntegrationReadiness() {
  logInfo('Testing service integration readiness...');
  
  // Check docker-compose configuration
  const dockerComposePath = path.join(__dirname, '..', 'docker-compose.dev.yml');
  if (fs.existsSync(dockerComposePath)) {
    addTestResult('Docker Compose Config', true, 'docker-compose.dev.yml found');
    
    try {
      const content = fs.readFileSync(dockerComposePath, 'utf8');
      
      const services = [
        'postgres', 'redis', 'mongodb', 'api-gateway', 
        'user-management', 'course-management', 'payment'
      ];
      
      services.forEach(service => {
        if (content.includes(service + ':')) {
          addTestResult(`Docker ${service} Service`, true, 'Service configured in docker-compose');
        } else {
          addTestResult(`Docker ${service} Service`, false, 'Service not found in docker-compose');
        }
      });
      
    } catch (error) {
      addTestResult('Docker Compose Parse', false, `Error reading docker-compose: ${error.message}`);
    }
  } else {
    addTestResult('Docker Compose Config', false, 'docker-compose.dev.yml not found');
  }
  
  // Check integration test file
  const integrationTestPath = path.join(__dirname, 'integration-test.js');
  if (fs.existsSync(integrationTestPath)) {
    addTestResult('Integration Test Script', true, 'integration-test.js found');
  } else {
    addTestResult('Integration Test Script', false, 'integration-test.js not found');
  }
}

function testDatabaseSchemas() {
  logInfo('Testing database schema definitions...');
  
  // Check for database migration files
  const migrationPath = path.join(__dirname, 'database', 'migrations');
  if (fs.existsSync(migrationPath)) {
    addTestResult('Database Migrations', true, 'Migration directory found');
    
    const migrationFiles = fs.readdirSync(migrationPath).filter(file => file.endsWith('.sql'));
    if (migrationFiles.length > 0) {
      addTestResult('Migration Files', true, `${migrationFiles.length} migration files found`);
      
      // Check for essential tables in migrations
      const essentialTables = ['users', 'programs', 'enrollments', 'payments'];
      essentialTables.forEach(table => {
        let tableFound = false;
        migrationFiles.forEach(file => {
          const content = fs.readFileSync(path.join(migrationPath, file), 'utf8');
          if (content.toLowerCase().includes(`create table ${table}`) || 
              content.toLowerCase().includes(`create table if not exists ${table}`)) {
            tableFound = true;
          }
        });
        addTestResult(`${table} Table Schema`, tableFound, tableFound ? 'Table schema found' : 'Table schema missing');
      });
    } else {
      addTestResult('Migration Files', false, 'No migration files found');
    }
  } else {
    addTestResult('Database Migrations', false, 'Migration directory not found');
  }
}

function testAPIEndpointDefinitions() {
  logInfo('Testing API endpoint definitions...');
  
  // Check for route files in each service
  const services = [
    { name: 'Auth', path: 'services/user-management/src/routes' },
    { name: 'Course', path: 'services/course-management/src/routes' },
    { name: 'Payment', path: 'services/payment/src' }
  ];
  
  services.forEach(service => {
    const routePath = path.join(__dirname, service.path);
    if (fs.existsSync(routePath)) {
      addTestResult(`${service.name} Routes Directory`, true, 'Routes directory found');
      
      const routeFiles = fs.readdirSync(routePath).filter(file => 
        file.endsWith('.ts') || file.endsWith('.js')
      );
      
      if (routeFiles.length > 0) {
        addTestResult(`${service.name} Route Files`, true, `${routeFiles.length} route files found`);
      } else {
        addTestResult(`${service.name} Route Files`, false, 'No route files found');
      }
    } else {
      addTestResult(`${service.name} Routes Directory`, false, 'Routes directory not found');
    }
  });
}

// Main test runner
async function runCheckpointTests() {
  log('\n🚀 Starting Checkpoint 6: Core Services Integration Test\n', colors.blue);
  log('This test validates the structure and implementation of core services:', colors.blue);
  log('- User Management Service (Authentication)', colors.blue);
  log('- Course Management Service', colors.blue);
  log('- Payment Service', colors.blue);
  log('- Service Integration Readiness\n', colors.blue);
  
  // Test service structures
  testServiceStructure('User Management', path.join(__dirname, 'services', 'user-management'));
  testServiceStructure('Course Management', path.join(__dirname, 'services', 'course-management'));
  testServiceStructure('Payment', path.join(__dirname, 'services', 'payment'));
  
  // Test service implementations
  testAuthServiceImplementation();
  testCourseServiceImplementation();
  testPaymentServiceImplementation();
  
  // Test integration readiness
  testServiceIntegrationReadiness();
  testDatabaseSchemas();
  testAPIEndpointDefinitions();
  
  // Print summary
  log('\n📊 Checkpoint 6 Test Summary\n', colors.blue);
  log(`Total Tests: ${results.total}`);
  logSuccess(`Passed: ${results.passed}`);
  
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`);
  }
  
  const successRate = Math.round((results.passed / results.total) * 100);
  
  log('\n📋 Detailed Results:\n', colors.blue);
  results.details.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    const details = result.details ? ` - ${result.details}` : '';
    log(`${status} ${result.testName}${details}`);
  });
  
  log('\n🎯 Integration Assessment:\n', colors.blue);
  
  if (successRate >= 85) {
    logSuccess(`🎉 Excellent! ${successRate}% success rate`);
    logSuccess('✅ Core services are well-implemented and ready for integration');
    logSuccess('✅ All essential components are in place');
    logSuccess('✅ Service architecture follows microservices best practices');
    log('\n🚀 Next Steps:', colors.blue);
    log('1. Start services using: docker-compose -f docker-compose.dev.yml up -d');
    log('2. Run full integration test: npm run test:integration');
    log('3. Test complete user flow: registration → enrollment → payment');
  } else if (successRate >= 70) {
    logWarning(`⚠️  Good progress! ${successRate}% success rate`);
    logWarning('⚠️  Most core services are implemented but some components need attention');
    log('\n🔧 Recommendations:', colors.yellow);
    log('1. Review failed tests and implement missing components');
    log('2. Ensure all route handlers are properly implemented');
    log('3. Verify database schemas are complete');
  } else if (successRate >= 50) {
    logWarning(`⚠️  Partial implementation: ${successRate}% success rate`);
    logWarning('⚠️  Core services exist but significant work is needed');
    log('\n🔧 Priority Actions:', colors.yellow);
    log('1. Complete missing service implementations');
    log('2. Implement essential API endpoints');
    log('3. Set up proper database schemas');
  } else {
    logError(`💥 Significant issues found: ${successRate}% success rate`);
    logError('❌ Core services need substantial implementation work');
    log('\n🚨 Critical Actions Required:', colors.red);
    log('1. Implement missing core services');
    log('2. Set up basic service structure and endpoints');
    log('3. Configure database connections and schemas');
  }
  
  // Service-specific recommendations
  log('\n📝 Service-Specific Status:\n', colors.blue);
  
  const authTests = results.details.filter(r => r.testName.includes('Auth'));
  const authPassed = authTests.filter(r => r.passed).length;
  const authTotal = authTests.length;
  if (authTotal > 0) {
    const authRate = Math.round((authPassed / authTotal) * 100);
    log(`🔐 User Management Service: ${authRate}% complete (${authPassed}/${authTotal})`);
  }
  
  const courseTests = results.details.filter(r => r.testName.includes('Course'));
  const coursePassed = courseTests.filter(r => r.passed).length;
  const courseTotal = courseTests.length;
  if (courseTotal > 0) {
    const courseRate = Math.round((coursePassed / courseTotal) * 100);
    log(`📚 Course Management Service: ${courseRate}% complete (${coursePassed}/${courseTotal})`);
  }
  
  const paymentTests = results.details.filter(r => r.testName.includes('Payment'));
  const paymentPassed = paymentTests.filter(r => r.passed).length;
  const paymentTotal = paymentTests.length;
  if (paymentTotal > 0) {
    const paymentRate = Math.round((paymentPassed / paymentTotal) * 100);
    log(`💳 Payment Service: ${paymentRate}% complete (${paymentPassed}/${paymentTotal})`);
  }
  
  log('\n🔍 Integration Readiness Checklist:\n', colors.blue);
  
  const checklist = [
    { item: 'Service Structure', status: results.details.some(r => r.testName.includes('Directory') && r.passed) },
    { item: 'Docker Configuration', status: results.details.some(r => r.testName.includes('Docker Compose Config') && r.passed) },
    { item: 'Database Schemas', status: results.details.some(r => r.testName.includes('Table Schema') && r.passed) },
    { item: 'API Endpoints', status: results.details.some(r => r.testName.includes('Routes') && r.passed) },
    { item: 'Authentication System', status: results.details.some(r => r.testName.includes('Auth') && r.testName.includes('Routes') && r.passed) },
    { item: 'Payment Integration', status: results.details.some(r => r.testName.includes('Payment') && r.testName.includes('Gateway') && r.passed) }
  ];
  
  checklist.forEach(item => {
    const status = item.status ? '✅' : '❌';
    log(`${status} ${item.item}`);
  });
  
  // Exit with appropriate code
  return results.failed === 0;
}

// Handle script execution
if (require.main === module) {
  runCheckpointTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    logError(`Checkpoint test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runCheckpointTests,
  results
};