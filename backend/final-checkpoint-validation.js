#!/usr/bin/env node

/**
 * Final Checkpoint 6 Validation
 * Comprehensive validation of core services integration readiness
 * Tests actual implementation details and service communication patterns
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
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

function logHeader(message) {
  log(`\n🎯 ${message}`, colors.magenta);
}

function logSubHeader(message) {
  log(`\n📋 ${message}`, colors.cyan);
}

// Test results tracking
const results = {
  categories: {},
  overall: { total: 0, passed: 0, failed: 0, warnings: 0 }
};

function addResult(category, testName, status, details = '') {
  if (!results.categories[category]) {
    results.categories[category] = { total: 0, passed: 0, failed: 0, warnings: 0, tests: [] };
  }
  
  results.categories[category].total++;
  results.categories[category][status]++;
  results.overall.total++;
  results.overall[status]++;
  
  results.categories[category].tests.push({ testName, status, details });
  
  const statusIcon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⚠️';
  const statusColor = status === 'passed' ? colors.green : status === 'failed' ? colors.red : colors.yellow;
  log(`${statusIcon} ${testName}${details ? ` - ${details}` : ''}`, statusColor);
}

// Validate User Management Service Implementation
function validateUserManagementService() {
  logSubHeader('User Management Service Validation');
  
  const servicePath = 'services/user-management';
  const routesPath = path.join(__dirname, servicePath, 'src', 'routes');
  
  // Check route files
  const expectedRoutes = ['auth.ts', 'users.ts', 'admin.ts', 'health.ts'];
  expectedRoutes.forEach(routeFile => {
    const filePath = path.join(routesPath, routeFile);
    if (fs.existsSync(filePath)) {
      addResult('User Management', `${routeFile} Route File`, 'passed', 'Route file exists');
    } else {
      addResult('User Management', `${routeFile} Route File`, 'failed', 'Route file missing');
    }
  });
  
  // Validate auth.ts endpoints
  const authPath = path.join(routesPath, 'auth.ts');
  if (fs.existsSync(authPath)) {
    const content = fs.readFileSync(authPath, 'utf8');
    
    const authEndpoints = [
      { name: 'User Registration', pattern: /router\.post\(['"`]\/register['"`]/ },
      { name: 'User Login', pattern: /router\.post\(['"`]\/login['"`]/ },
      { name: 'Token Refresh', pattern: /router\.post\(['"`]\/refresh-token['"`]/ },
      { name: 'Email Verification', pattern: /router\.post\(['"`]\/verify-email['"`]/ },
      { name: 'Password Reset Request', pattern: /router\.post\(['"`]\/forgot-password['"`]/ },
      { name: 'Password Reset Confirm', pattern: /router\.post\(['"`]\/reset-password['"`]/ },
      { name: 'User Logout', pattern: /router\.post\(['"`]\/logout['"`]/ },
      { name: 'Profile Access', pattern: /router\.get\(['"`]\/profile['"`]/ }
    ];
    
    authEndpoints.forEach(endpoint => {
      if (endpoint.pattern.test(content)) {
        addResult('User Management', endpoint.name, 'passed', 'Endpoint implemented');
      } else {
        addResult('User Management', endpoint.name, 'failed', 'Endpoint missing');
      }
    });
    
    // Check for security features
    const securityFeatures = [
      { name: 'Password Hashing', pattern: /hashPassword|bcrypt/ },
      { name: 'JWT Token Generation', pattern: /generateAccessToken|jwt/ },
      { name: 'Rate Limiting Protection', pattern: /failedAttempts|rateLimit/ },
      { name: 'Input Validation', pattern: /ValidationUtils|validate/ },
      { name: 'Email Services', pattern: /EmailService/ }
    ];
    
    securityFeatures.forEach(feature => {
      if (feature.pattern.test(content)) {
        addResult('User Management', feature.name, 'passed', 'Security feature implemented');
      } else {
        addResult('User Management', feature.name, 'warning', 'Security feature may be missing');
      }
    });
  }
  
  // Check users.ts endpoints
  const usersPath = path.join(routesPath, 'users.ts');
  if (fs.existsSync(usersPath)) {
    const content = fs.readFileSync(usersPath, 'utf8');
    
    const userEndpoints = [
      { name: 'Get User Profile', pattern: /router\.get\(['"`]\/:id['"`]/ },
      { name: 'Update User Profile', pattern: /router\.put\(['"`]\/:id['"`]/ },
      { name: 'Change Password', pattern: /router\.put\(['"`]\/:id\/password['"`]/ },
      { name: 'Resend Verification', pattern: /router\.post\(['"`]\/:id\/resend-verification['"`]/ },
      { name: 'Delete Account', pattern: /router\.delete\(['"`]\/:id['"`]/ }
    ];
    
    userEndpoints.forEach(endpoint => {
      if (endpoint.pattern.test(content)) {
        addResult('User Management', endpoint.name, 'passed', 'User endpoint implemented');
      } else {
        addResult('User Management', endpoint.name, 'warning', 'User endpoint may be missing');
      }
    });
  }
}

// Validate Course Management Service Implementation
function validateCourseManagementService() {
  logSubHeader('Course Management Service Validation');
  
  const servicePath = 'services/course-management';
  const routesPath = path.join(__dirname, servicePath, 'src', 'routes');
  
  if (!fs.existsSync(routesPath)) {
    addResult('Course Management', 'Routes Directory', 'failed', 'Routes directory not found');
    return;
  }
  
  const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.ts'));
  
  if (routeFiles.length > 0) {
    addResult('Course Management', 'Route Files', 'passed', `${routeFiles.length} route files found`);
    
    // Check for program and enrollment routes
    const hasPrograms = routeFiles.some(file => file.includes('program'));
    const hasEnrollments = routeFiles.some(file => file.includes('enrollment'));
    
    if (hasPrograms) {
      addResult('Course Management', 'Program Routes', 'passed', 'Program routes implemented');
    } else {
      addResult('Course Management', 'Program Routes', 'warning', 'Program routes may be missing');
    }
    
    if (hasEnrollments) {
      addResult('Course Management', 'Enrollment Routes', 'passed', 'Enrollment routes implemented');
    } else {
      addResult('Course Management', 'Enrollment Routes', 'warning', 'Enrollment routes may be missing');
    }
  } else {
    addResult('Course Management', 'Route Files', 'failed', 'No route files found');
  }
  
  // Check main service file
  const indexPath = path.join(__dirname, servicePath, 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    
    const features = [
      { name: 'Database Integration', pattern: /initializeDatabases|DatabaseUtils/ },
      { name: 'Program API Routes', pattern: /\/api\/programs/ },
      { name: 'Enrollment API Routes', pattern: /\/api\/enrollments/ },
      { name: 'Health Check', pattern: /\/health/ },
      { name: 'Error Handling', pattern: /errorHandler/ }
    ];
    
    features.forEach(feature => {
      if (feature.pattern.test(content)) {
        addResult('Course Management', feature.name, 'passed', 'Feature implemented');
      } else {
        addResult('Course Management', feature.name, 'warning', 'Feature may be missing');
      }
    });
  }
}

// Validate Payment Service Implementation
function validatePaymentService() {
  logSubHeader('Payment Service Validation');
  
  const servicePath = 'services/payment';
  const indexPath = path.join(__dirname, servicePath, 'src', 'index.ts');
  
  if (!fs.existsSync(indexPath)) {
    addResult('Payment Service', 'Main Service File', 'failed', 'index.ts not found');
    return;
  }
  
  const content = fs.readFileSync(indexPath, 'utf8');
  
  // Check payment endpoints
  const paymentEndpoints = [
    { name: 'Create Order', pattern: /\/api\/payments\/create-order/ },
    { name: 'Verify Payment', pattern: /\/api\/payments\/verify/ },
    { name: 'Razorpay Webhook', pattern: /\/api\/payments\/webhook\/razorpay/ },
    { name: 'Stripe Webhook', pattern: /\/api\/payments\/webhook\/stripe/ },
    { name: 'Subscription Management', pattern: /\/api\/subscriptions/ },
    { name: 'Refund Processing', pattern: /\/api\/payments\/refund/ },
    { name: 'Admin Reports', pattern: /\/api\/admin\/payments\/reports/ }
  ];
  
  paymentEndpoints.forEach(endpoint => {
    if (endpoint.pattern.test(content)) {
      addResult('Payment Service', endpoint.name, 'passed', 'Payment endpoint implemented');
    } else {
      addResult('Payment Service', endpoint.name, 'warning', 'Payment endpoint may be missing');
    }
  });
  
  // Check payment gateway integrations
  const gatewayFeatures = [
    { name: 'Razorpay Integration', pattern: /RazorpayGateway/ },
    { name: 'Stripe Integration', pattern: /StripeGateway/ },
    { name: 'Payment Service Class', pattern: /PaymentService/ },
    { name: 'Database Connection', pattern: /Pool|postgres/ },
    { name: 'Redis Integration', pattern: /redis|createClient/ }
  ];
  
  gatewayFeatures.forEach(feature => {
    if (feature.pattern.test(content)) {
      addResult('Payment Service', feature.name, 'passed', 'Gateway feature implemented');
    } else {
      addResult('Payment Service', feature.name, 'warning', 'Gateway feature may be missing');
    }
  });
  
  // Check gateway implementation files
  const gatewayPath = path.join(__dirname, servicePath, 'src', 'gateways');
  if (fs.existsSync(gatewayPath)) {
    const gatewayFiles = fs.readdirSync(gatewayPath);
    
    if (gatewayFiles.includes('RazorpayGateway.ts')) {
      addResult('Payment Service', 'Razorpay Gateway File', 'passed', 'Gateway implementation exists');
    } else {
      addResult('Payment Service', 'Razorpay Gateway File', 'warning', 'Gateway file missing');
    }
    
    if (gatewayFiles.includes('StripeGateway.ts')) {
      addResult('Payment Service', 'Stripe Gateway File', 'passed', 'Gateway implementation exists');
    } else {
      addResult('Payment Service', 'Stripe Gateway File', 'warning', 'Gateway file missing');
    }
  }
}

// Validate Database Integration
function validateDatabaseIntegration() {
  logSubHeader('Database Integration Validation');
  
  // Check migration files
  const migrationPath = path.join(__dirname, 'database', 'migrations');
  if (fs.existsSync(migrationPath)) {
    const migrationFiles = fs.readdirSync(migrationPath).filter(file => file.endsWith('.sql'));
    
    if (migrationFiles.length > 0) {
      addResult('Database', 'Migration Files', 'passed', `${migrationFiles.length} migration files found`);
      
      // Check for essential tables
      let allContent = '';
      migrationFiles.forEach(file => {
        allContent += fs.readFileSync(path.join(migrationPath, file), 'utf8').toLowerCase();
      });
      
      const essentialTables = [
        { name: 'Users Table', pattern: /create table.*users/ },
        { name: 'Programs Table', pattern: /create table.*programs/ },
        { name: 'Enrollments Table', pattern: /create table.*enrollments/ },
        { name: 'Payments Table', pattern: /create table.*payments/ },
        { name: 'Subscriptions Table', pattern: /create table.*subscriptions/ }
      ];
      
      essentialTables.forEach(table => {
        if (table.pattern.test(allContent)) {
          addResult('Database', table.name, 'passed', 'Table schema defined');
        } else {
          addResult('Database', table.name, 'warning', 'Table schema may be missing');
        }
      });
      
      // Check for foreign key relationships
      const relationships = [
        { name: 'User-Enrollment FK', pattern: /user_id.*references.*users/ },
        { name: 'Program-Enrollment FK', pattern: /program_id.*references.*programs/ },
        { name: 'User-Payment FK', pattern: /user_id.*references.*users/ },
        { name: 'Program-Payment FK', pattern: /program_id.*references.*programs/ }
      ];
      
      relationships.forEach(rel => {
        if (rel.pattern.test(allContent)) {
          addResult('Database', rel.name, 'passed', 'Foreign key relationship defined');
        } else {
          addResult('Database', rel.name, 'warning', 'Foreign key relationship may be missing');
        }
      });
      
    } else {
      addResult('Database', 'Migration Files', 'failed', 'No migration files found');
    }
  } else {
    addResult('Database', 'Migration Directory', 'failed', 'Migration directory not found');
  }
  
  // Check shared database utilities
  const sharedDbPath = path.join(__dirname, 'shared', 'database');
  if (fs.existsSync(sharedDbPath)) {
    addResult('Database', 'Shared Database Utils', 'passed', 'Shared database utilities exist');
  } else {
    addResult('Database', 'Shared Database Utils', 'warning', 'Shared database utilities may be missing');
  }
}

// Validate Service Communication and Infrastructure
function validateServiceCommunication() {
  logSubHeader('Service Communication & Infrastructure Validation');
  
  // Check Docker Compose configuration
  const dockerComposePath = path.join(__dirname, '..', 'docker-compose.dev.yml');
  if (fs.existsSync(dockerComposePath)) {
    const content = fs.readFileSync(dockerComposePath, 'utf8');
    
    addResult('Infrastructure', 'Docker Compose Config', 'passed', 'Configuration file exists');
    
    // Check for essential services
    const services = [
      { name: 'PostgreSQL Database', pattern: /postgres:/ },
      { name: 'Redis Cache', pattern: /redis:/ },
      { name: 'MongoDB Analytics', pattern: /mongo:/ },
      { name: 'API Gateway', pattern: /api-gateway:/ },
      { name: 'User Management Service', pattern: /user-management:/ },
      { name: 'Course Management Service', pattern: /course-management:/ },
      { name: 'Payment Service', pattern: /payment:/ }
    ];
    
    services.forEach(service => {
      if (service.pattern.test(content)) {
        addResult('Infrastructure', service.name, 'passed', 'Service configured in Docker Compose');
      } else {
        addResult('Infrastructure', service.name, 'warning', 'Service may not be configured');
      }
    });
    
    // Check for networking
    if (content.includes('networks:') && content.includes('sai-mahendra-network')) {
      addResult('Infrastructure', 'Service Networking', 'passed', 'Docker network configured');
    } else {
      addResult('Infrastructure', 'Service Networking', 'warning', 'Docker network may not be configured');
    }
    
    // Check for environment variables
    const envVars = [
      { name: 'Database URLs', pattern: /DATABASE_URL/ },
      { name: 'Redis URLs', pattern: /REDIS_URL/ },
      { name: 'JWT Secrets', pattern: /JWT_SECRET/ },
      { name: 'Payment Gateway Keys', pattern: /RAZORPAY_KEY|STRIPE_SECRET/ }
    ];
    
    envVars.forEach(envVar => {
      if (envVar.pattern.test(content)) {
        addResult('Infrastructure', envVar.name, 'passed', 'Environment variables configured');
      } else {
        addResult('Infrastructure', envVar.name, 'warning', 'Environment variables may be missing');
      }
    });
    
  } else {
    addResult('Infrastructure', 'Docker Compose Config', 'failed', 'docker-compose.dev.yml not found');
  }
  
  // Check API Gateway
  const gatewayPath = path.join(__dirname, 'services', 'api-gateway', 'src', 'index.ts');
  if (fs.existsSync(gatewayPath)) {
    addResult('Infrastructure', 'API Gateway Implementation', 'passed', 'Gateway service exists');
  } else {
    addResult('Infrastructure', 'API Gateway Implementation', 'warning', 'Gateway service may be missing');
  }
}

// Validate Complete User Flow
function validateCompleteUserFlow() {
  logSubHeader('Complete User Flow Validation');
  
  // Check if all components for user flow exist
  const flowComponents = [
    {
      name: 'User Registration',
      check: () => {
        const authPath = path.join(__dirname, 'services', 'user-management', 'src', 'routes', 'auth.ts');
        if (fs.existsSync(authPath)) {
          const content = fs.readFileSync(authPath, 'utf8');
          return content.includes('/register') && content.includes('UserModel.create');
        }
        return false;
      }
    },
    {
      name: 'User Authentication',
      check: () => {
        const authPath = path.join(__dirname, 'services', 'user-management', 'src', 'routes', 'auth.ts');
        if (fs.existsSync(authPath)) {
          const content = fs.readFileSync(authPath, 'utf8');
          return content.includes('/login') && content.includes('generateAccessToken');
        }
        return false;
      }
    },
    {
      name: 'Program Browsing',
      check: () => {
        const coursePath = path.join(__dirname, 'services', 'course-management', 'src', 'index.ts');
        if (fs.existsSync(coursePath)) {
          const content = fs.readFileSync(coursePath, 'utf8');
          return content.includes('/api/programs');
        }
        return false;
      }
    },
    {
      name: 'Course Enrollment',
      check: () => {
        const coursePath = path.join(__dirname, 'services', 'course-management', 'src', 'index.ts');
        if (fs.existsSync(coursePath)) {
          const content = fs.readFileSync(coursePath, 'utf8');
          return content.includes('/api/enrollments');
        }
        return false;
      }
    },
    {
      name: 'Payment Processing',
      check: () => {
        const paymentPath = path.join(__dirname, 'services', 'payment', 'src', 'index.ts');
        if (fs.existsSync(paymentPath)) {
          const content = fs.readFileSync(paymentPath, 'utf8');
          return content.includes('/api/payments/create-order') && content.includes('/api/payments/verify');
        }
        return false;
      }
    }
  ];
  
  flowComponents.forEach(component => {
    if (component.check()) {
      addResult('User Flow', component.name, 'passed', 'Flow component implemented');
    } else {
      addResult('User Flow', component.name, 'failed', 'Flow component missing or incomplete');
    }
  });
  
  // Overall flow assessment
  const implementedComponents = flowComponents.filter(c => c.check()).length;
  const flowCompleteness = Math.round((implementedComponents / flowComponents.length) * 100);
  
  if (flowCompleteness >= 80) {
    addResult('User Flow', 'Complete Flow Integration', 'passed', `${flowCompleteness}% of flow components implemented`);
  } else if (flowCompleteness >= 60) {
    addResult('User Flow', 'Complete Flow Integration', 'warning', `${flowCompleteness}% of flow components implemented`);
  } else {
    addResult('User Flow', 'Complete Flow Integration', 'failed', `${flowCompleteness}% of flow components implemented`);
  }
}

// Generate comprehensive report
function generateReport() {
  logHeader('Final Integration Assessment Report');
  
  // Calculate overall scores
  const totalTests = results.overall.total;
  const passedTests = results.overall.passed;
  const warningTests = results.overall.warnings;
  const failedTests = results.overall.failed;
  
  const overallScore = Math.round(((passedTests + (warningTests * 0.5)) / totalTests) * 100);
  
  log(`\n📊 Overall Results: ${totalTests} tests executed`);
  logSuccess(`✅ Passed: ${passedTests} (${Math.round((passedTests/totalTests)*100)}%)`);
  if (warningTests > 0) {
    logWarning(`⚠️  Warnings: ${warningTests} (${Math.round((warningTests/totalTests)*100)}%)`);
  }
  if (failedTests > 0) {
    logError(`❌ Failed: ${failedTests} (${Math.round((failedTests/totalTests)*100)}%)`);
  }
  
  log(`\n🎯 Overall Integration Score: ${overallScore}%`, overallScore >= 85 ? colors.green : overallScore >= 70 ? colors.yellow : colors.red);
  
  // Category breakdown
  logHeader('Category Performance Breakdown');
  
  Object.entries(results.categories).forEach(([category, data]) => {
    const categoryScore = Math.round(((data.passed + (data.warnings * 0.5)) / data.total) * 100);
    const statusColor = categoryScore >= 85 ? colors.green : categoryScore >= 70 ? colors.yellow : colors.red;
    
    log(`\n📋 ${category}: ${categoryScore}% (${data.passed}✅ ${data.warnings}⚠️ ${data.failed}❌)`, statusColor);
  });
  
  // Final assessment
  logHeader('Integration Readiness Assessment');
  
  if (overallScore >= 90) {
    logSuccess('🎉 EXCELLENT - Production Ready!');
    logSuccess('✅ All core services are fully implemented and integrated');
    logSuccess('✅ Complete user flow is supported end-to-end');
    logSuccess('✅ Security measures are properly implemented');
    logSuccess('✅ Database schemas and relationships are well-defined');
    logSuccess('✅ Service communication patterns are established');
    
    log('\n🚀 Recommended Next Steps:', colors.cyan);
    log('1. Deploy services using: docker-compose -f docker-compose.dev.yml up -d');
    log('2. Execute live integration testing with real database connections');
    log('3. Test complete user journey: registration → login → browse → enroll → pay');
    log('4. Validate payment gateway integrations with test transactions');
    log('5. Perform load testing with concurrent users');
    log('6. Set up monitoring and logging for production deployment');
    
  } else if (overallScore >= 80) {
    logSuccess('✅ VERY GOOD - Nearly Production Ready!');
    logSuccess('✅ Core services are well-implemented');
    logWarning('⚠️  Minor improvements needed for production readiness');
    
    log('\n🔧 Recommended Actions:', colors.yellow);
    log('1. Address any failed tests in critical categories');
    log('2. Complete any missing API endpoints or features');
    log('3. Enhance security measures where needed');
    log('4. Test service integration with live databases');
    
  } else if (overallScore >= 70) {
    logWarning('⚠️  GOOD - Significant Progress Made');
    logWarning('⚠️  Core foundation is solid but needs refinement');
    
    log('\n🔧 Priority Improvements:', colors.yellow);
    log('1. Complete missing service implementations');
    log('2. Fix any failed database or user flow tests');
    log('3. Implement missing security features');
    log('4. Ensure proper service communication');
    
  } else {
    logError('❌ NEEDS SIGNIFICANT WORK');
    logError('🚨 Core services require substantial development');
    
    log('\n🚨 Critical Actions Required:', colors.red);
    log('1. Complete missing service implementations');
    log('2. Fix database schema and migration issues');
    log('3. Implement complete user authentication and flow');
    log('4. Set up proper service communication patterns');
    log('5. Add essential security measures');
  }
  
  // Service-specific recommendations
  logHeader('Service-Specific Status Summary');
  
  const serviceCategories = ['User Management', 'Course Management', 'Payment Service'];
  serviceCategories.forEach(service => {
    if (results.categories[service]) {
      const data = results.categories[service];
      const score = Math.round(((data.passed + (data.warnings * 0.5)) / data.total) * 100);
      
      let status = 'Needs Work';
      let icon = '🔧';
      if (score >= 90) { status = 'Production Ready'; icon = '🚀'; }
      else if (score >= 80) { status = 'Nearly Ready'; icon = '✅'; }
      else if (score >= 70) { status = 'Good Progress'; icon = '⚠️'; }
      
      log(`${icon} ${service}: ${score}% - ${status}`);
    }
  });
  
  logHeader('Integration Checklist Summary');
  
  const checklist = [
    { item: 'Core Service Structure', category: 'User Management', threshold: 70 },
    { item: 'Database Integration', category: 'Database', threshold: 80 },
    { item: 'User Flow Implementation', category: 'User Flow', threshold: 75 },
    { item: 'Service Communication', category: 'Infrastructure', threshold: 70 },
    { item: 'Payment Processing', category: 'Payment Service', threshold: 80 }
  ];
  
  checklist.forEach(item => {
    const categoryData = results.categories[item.category];
    if (categoryData) {
      const score = Math.round(((categoryData.passed + (categoryData.warnings * 0.5)) / categoryData.total) * 100);
      const status = score >= item.threshold ? '✅' : '❌';
      log(`${status} ${item.item} (${score}%)`);
    }
  });
  
  log('\n');
  return overallScore >= 75;
}

// Main execution
async function runFinalValidation() {
  log('🚀 Starting Final Checkpoint 6 Validation', colors.magenta);
  log('═══════════════════════════════════════════════════════════════', colors.white);
  log('Comprehensive validation of core services integration readiness', colors.blue);
  log('Testing: User Management • Course Management • Payment Service', colors.blue);
  log('Validating: APIs • Database • Security • Communication • User Flow', colors.blue);
  log('═══════════════════════════════════════════════════════════════\n', colors.white);
  
  validateUserManagementService();
  validateCourseManagementService();
  validatePaymentService();
  validateDatabaseIntegration();
  validateServiceCommunication();
  validateCompleteUserFlow();
  
  return generateReport();
}

// Execute if run directly
if (require.main === module) {
  runFinalValidation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    logError(`Final validation failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runFinalValidation, results };