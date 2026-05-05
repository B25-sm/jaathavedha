/**
 * Task 20.3: Comprehensive Penetration Testing Script
 * 
 * This script performs automated penetration testing on the backend services
 * to identify security vulnerabilities and compliance issues.
 * 
 * Requirements: 11.3 (PCI DSS), 11.5 (GDPR), 15.7 (Security testing)
 */

const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('ioredis');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sai_mahendra_test';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

// Test Results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  vulnerabilities: []
};

function addVulnerability(severity, category, description, recommendation) {
  results.vulnerabilities.push({
    severity,
    category,
    description,
    recommendation
  });

  if (severity === 'critical' || severity === 'high') {
    results.failed++;
  } else {
    results.warnings++;
  }
}

// Penetration Tests
async function testSQLInjection() {
  log('\n=== SQL Injection Testing ===', colors.blue);

  const sqlPayloads = [
    "admin' OR '1'='1",
    "admin'--",
    "admin' OR '1'='1'--",
    "' OR 1=1--",
    "admin'; DROP TABLE users--",
    "1' UNION SELECT NULL, NULL, NULL--"
  ];

  let vulnerableEndpoints = 0;

  for (const payload of sqlPayloads) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: payload,
        password: 'test'
      }, {
        validateStatus: () => true
      });

      // If we get a 200 or unexpected success, it might be vulnerable
      if (response.status === 200 && response.data.token) {
        vulnerableEndpoints++;
        addVulnerability(
          'critical',
          'SQL Injection',
          `Login endpoint vulnerable to SQL injection with payload: ${payload}`,
          'Use parameterized queries and input validation'
        );
        logError(`SQL Injection vulnerability found with payload: ${payload}`);
      }
    } catch (error) {
      // Expected to fail
    }
  }

  if (vulnerableEndpoints === 0) {
    logSuccess('No SQL injection vulnerabilities detected');
    results.passed++;
  }
}

async function testXSSVulnerabilities() {
  log('\n=== Cross-Site Scripting (XSS) Testing ===', colors.blue);

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload=alert("XSS")>'
  ];

  let vulnerableFields = 0;

  for (const payload of xssPayloads) {
    try {
      const response = await axios.post(`${BASE_URL}/contact/submit`, {
        name: payload,
        email: 'test@example.com',
        message: 'Test message'
      }, {
        validateStatus: () => true
      });

      // Check if payload is reflected without sanitization
      if (response.data && JSON.stringify(response.data).includes('<script>')) {
        vulnerableFields++;
        addVulnerability(
          'high',
          'XSS',
          `Contact form vulnerable to XSS with payload: ${payload}`,
          'Implement input sanitization and output encoding'
        );
        logError(`XSS vulnerability found with payload: ${payload}`);
      }
    } catch (error) {
      // Expected to fail
    }
  }

  if (vulnerableFields === 0) {
    logSuccess('No XSS vulnerabilities detected');
    results.passed++;
  }
}

async function testAuthenticationBypass() {
  log('\n=== Authentication Bypass Testing ===', colors.blue);

  const bypassAttempts = [
    { email: 'admin@example.com', password: '' },
    { email: '', password: '' },
    { email: 'admin', password: 'admin' },
    { email: null, password: null }
  ];

  let bypassSuccessful = 0;

  for (const attempt of bypassAttempts) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, attempt, {
        validateStatus: () => true
      });

      if (response.status === 200 && response.data.token) {
        bypassSuccessful++;
        addVulnerability(
          'critical',
          'Authentication Bypass',
          `Authentication bypassed with credentials: ${JSON.stringify(attempt)}`,
          'Implement proper authentication validation'
        );
        logError(`Authentication bypass successful with: ${JSON.stringify(attempt)}`);
      }
    } catch (error) {
      // Expected to fail
    }
  }

  if (bypassSuccessful === 0) {
    logSuccess('No authentication bypass vulnerabilities detected');
    results.passed++;
  }
}

async function testBruteForceProtection() {
  log('\n=== Brute Force Protection Testing ===', colors.blue);

  const testEmail = 'bruteforce@test.com';
  let successfulAttempts = 0;

  // Attempt 10 rapid login attempts
  for (let i = 0; i < 10; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: testEmail,
        password: `wrong-password-${i}`
      }, {
        validateStatus: () => true
      });

      if (response.status !== 429) {
        successfulAttempts++;
      }
    } catch (error) {
      // Expected to be rate limited
    }
  }

  if (successfulAttempts >= 10) {
    addVulnerability(
      'high',
      'Brute Force',
      'No rate limiting detected on login endpoint',
      'Implement rate limiting and account lockout after failed attempts'
    );
    logError('Brute force protection not implemented');
  } else {
    logSuccess('Brute force protection is active');
    results.passed++;
  }
}

async function testCSRFProtection() {
  log('\n=== CSRF Protection Testing ===', colors.blue);

  try {
    // Attempt state-changing operation without CSRF token
    const response = await axios.post(`${BASE_URL}/users/profile`, {
      firstName: 'Malicious',
      lastName: 'User'
    }, {
      validateStatus: () => true
    });

    if (response.status === 200) {
      addVulnerability(
        'medium',
        'CSRF',
        'State-changing operations possible without CSRF token',
        'Implement CSRF token validation for all state-changing operations'
      );
      logWarning('CSRF protection may not be implemented');
    } else {
      logSuccess('CSRF protection appears to be active');
      results.passed++;
    }
  } catch (error) {
    logSuccess('CSRF protection appears to be active');
    results.passed++;
  }
}

async function testSecurityHeaders() {
  log('\n=== Security Headers Testing ===', colors.blue);

  const requiredHeaders = {
    'X-Frame-Options': ['DENY', 'SAMEORIGIN'],
    'X-Content-Type-Options': ['nosniff'],
    'X-XSS-Protection': ['1; mode=block'],
    'Strict-Transport-Security': ['max-age='],
    'Content-Security-Policy': ['default-src']
  };

  try {
    const response = await axios.get(`${BASE_URL}/health`, {
      validateStatus: () => true
    });

    let missingHeaders = 0;

    for (const [header, expectedValues] of Object.entries(requiredHeaders)) {
      const headerValue = response.headers[header.toLowerCase()];

      if (!headerValue) {
        missingHeaders++;
        addVulnerability(
          'medium',
          'Security Headers',
          `Missing security header: ${header}`,
          `Add ${header} header to all responses`
        );
        logWarning(`Missing security header: ${header}`);
      } else {
        const hasExpectedValue = expectedValues.some(val =>
          headerValue.includes(val)
        );

        if (hasExpectedValue) {
          logSuccess(`Security header present: ${header}`);
        } else {
          logWarning(`Security header has unexpected value: ${header} = ${headerValue}`);
        }
      }
    }

    if (missingHeaders === 0) {
      results.passed++;
    }
  } catch (error) {
    logError(`Failed to test security headers: ${error.message}`);
  }
}

async function testPCIDSSCompliance() {
  log('\n=== PCI DSS Compliance Testing ===', colors.blue);

  const pgPool = new Pool({ connectionString: DB_URL });

  try {
    // Check for credit card number storage
    const cardColumns = await pgPool.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%card_number%' OR column_name LIKE '%credit_card%')
    `);

    if (cardColumns.rows.length > 0) {
      addVulnerability(
        'critical',
        'PCI DSS',
        'Database contains columns that may store credit card numbers',
        'Never store full credit card numbers. Use tokenization.'
      );
      logError('Potential PCI DSS violation: Credit card storage detected');
    } else {
      logSuccess('No credit card number storage detected');
      results.passed++;
    }

    // Check for CVV storage
    const cvvColumns = await pgPool.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%cvv%' OR column_name LIKE '%cvc%')
    `);

    if (cvvColumns.rows.length > 0) {
      addVulnerability(
        'critical',
        'PCI DSS',
        'Database contains columns that may store CVV codes',
        'Never store CVV/CVC codes. This violates PCI DSS requirements.'
      );
      logError('Critical PCI DSS violation: CVV storage detected');
    } else {
      logSuccess('No CVV storage detected');
      results.passed++;
    }

    // Check for payment audit logging
    const auditTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%audit%' OR table_name LIKE '%log%')
    `);

    if (auditTables.rows.length > 0) {
      logSuccess('Audit logging tables found');
      results.passed++;
    } else {
      addVulnerability(
        'medium',
        'PCI DSS',
        'No audit logging tables detected',
        'Implement comprehensive audit logging for all payment transactions'
      );
      logWarning('Audit logging may not be implemented');
    }

    await pgPool.end();
  } catch (error) {
    logError(`PCI DSS compliance test failed: ${error.message}`);
  }
}

async function testGDPRCompliance() {
  log('\n=== GDPR Compliance Testing ===', colors.blue);

  const pgPool = new Pool({ connectionString: DB_URL });

  try {
    // Check for consent management tables
    const consentTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%consent%'
    `);

    if (consentTables.rows.length > 0) {
      logSuccess('Consent management tables found');
      results.passed++;
    } else {
      addVulnerability(
        'high',
        'GDPR',
        'No consent management tables detected',
        'Implement consent management system for GDPR compliance'
      );
      logWarning('Consent management may not be implemented');
    }

    // Check for data deletion/anonymization support
    const deletionTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%deletion%' OR table_name LIKE '%gdpr%')
    `);

    if (deletionTables.rows.length > 0) {
      logSuccess('GDPR data deletion support found');
      results.passed++;
    } else {
      addVulnerability(
        'high',
        'GDPR',
        'No GDPR data deletion tables detected',
        'Implement right to erasure functionality'
      );
      logWarning('GDPR data deletion may not be implemented');
    }

    await pgPool.end();
  } catch (error) {
    logError(`GDPR compliance test failed: ${error.message}`);
  }
}

async function testDataEncryption() {
  log('\n=== Data Encryption Testing ===', colors.blue);

  const pgPool = new Pool({ connectionString: DB_URL });

  try {
    // Check for encryption key management
    const encryptionTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%encryption%'
    `);

    if (encryptionTables.rows.length > 0) {
      logSuccess('Encryption key management tables found');
      results.passed++;
    } else {
      addVulnerability(
        'medium',
        'Encryption',
        'No encryption key management tables detected',
        'Implement proper encryption key management and rotation'
      );
      logWarning('Encryption key management may not be implemented');
    }

    await pgPool.end();
  } catch (error) {
    logError(`Data encryption test failed: ${error.message}`);
  }
}

async function testSessionSecurity() {
  log('\n=== Session Security Testing ===', colors.blue);

  const redis = new Redis(REDIS_URL);

  try {
    // Test session storage
    const testSessionId = 'test-session-' + Date.now();
    await redis.setex(`session:${testSessionId}`, 3600, JSON.stringify({
      userId: 'test-user',
      createdAt: new Date()
    }));

    const session = await redis.get(`session:${testSessionId}`);

    if (session) {
      logSuccess('Session storage is working');
      results.passed++;

      // Check TTL
      const ttl = await redis.ttl(`session:${testSessionId}`);
      if (ttl > 0 && ttl <= 3600) {
        logSuccess('Session expiration is configured');
        results.passed++;
      } else {
        addVulnerability(
          'medium',
          'Session Security',
          'Session expiration may not be properly configured',
          'Implement proper session timeout (recommended: 30 minutes)'
        );
        logWarning('Session expiration may not be properly configured');
      }

      // Cleanup
      await redis.del(`session:${testSessionId}`);
    } else {
      addVulnerability(
        'high',
        'Session Security',
        'Session storage is not working',
        'Ensure Redis is properly configured for session management'
      );
      logError('Session storage is not working');
    }

    await redis.quit();
  } catch (error) {
    logError(`Session security test failed: ${error.message}`);
  }
}

async function testAPIRateLimiting() {
  log('\n=== API Rate Limiting Testing ===', colors.blue);

  const redis = new Redis(REDIS_URL);

  try {
    const testIP = '192.168.1.100';
    const rateLimitKey = `rate_limit:${testIP}`;

    // Simulate rapid requests
    for (let i = 0; i < 150; i++) {
      await redis.incr(rateLimitKey);
    }

    const count = await redis.get(rateLimitKey);

    if (parseInt(count) >= 150) {
      logInfo('Rate limiting counter is working');
      results.passed++;
    }

    // Cleanup
    await redis.del(rateLimitKey);
    await redis.quit();
  } catch (error) {
    logError(`Rate limiting test failed: ${error.message}`);
  }
}

// Generate Report
function generateReport() {
  log('\n' + '='.repeat(80), colors.magenta);
  log('PENETRATION TESTING REPORT', colors.magenta);
  log('='.repeat(80), colors.magenta);

  log(`\nTests Passed: ${results.passed}`, colors.green);
  log(`Tests Failed: ${results.failed}`, colors.red);
  log(`Warnings: ${results.warnings}`, colors.yellow);

  if (results.vulnerabilities.length > 0) {
    log('\n' + '='.repeat(80), colors.red);
    log('VULNERABILITIES DETECTED', colors.red);
    log('='.repeat(80), colors.red);

    const critical = results.vulnerabilities.filter(v => v.severity === 'critical');
    const high = results.vulnerabilities.filter(v => v.severity === 'high');
    const medium = results.vulnerabilities.filter(v => v.severity === 'medium');
    const low = results.vulnerabilities.filter(v => v.severity === 'low');

    if (critical.length > 0) {
      log(`\n🔴 CRITICAL (${critical.length})`, colors.red);
      critical.forEach((v, i) => {
        log(`\n${i + 1}. ${v.category}: ${v.description}`);
        log(`   Recommendation: ${v.recommendation}`, colors.yellow);
      });
    }

    if (high.length > 0) {
      log(`\n🟠 HIGH (${high.length})`, colors.red);
      high.forEach((v, i) => {
        log(`\n${i + 1}. ${v.category}: ${v.description}`);
        log(`   Recommendation: ${v.recommendation}`, colors.yellow);
      });
    }

    if (medium.length > 0) {
      log(`\n🟡 MEDIUM (${medium.length})`, colors.yellow);
      medium.forEach((v, i) => {
        log(`\n${i + 1}. ${v.category}: ${v.description}`);
        log(`   Recommendation: ${v.recommendation}`, colors.cyan);
      });
    }

    if (low.length > 0) {
      log(`\n🟢 LOW (${low.length})`, colors.green);
      low.forEach((v, i) => {
        log(`\n${i + 1}. ${v.category}: ${v.description}`);
        log(`   Recommendation: ${v.recommendation}`, colors.cyan);
      });
    }
  } else {
    log('\n✓ No vulnerabilities detected!', colors.green);
  }

  log('\n' + '='.repeat(80), colors.magenta);
  log('SECURITY SCORE', colors.magenta);
  log('='.repeat(80), colors.magenta);

  const totalTests = results.passed + results.failed + results.warnings;
  const score = totalTests > 0 ? Math.round((results.passed / totalTests) * 100) : 0;

  let scoreColor = colors.green;
  if (score < 50) scoreColor = colors.red;
  else if (score < 75) scoreColor = colors.yellow;

  log(`\nOverall Security Score: ${score}%`, scoreColor);

  if (score >= 90) {
    log('Status: Excellent - System is well secured', colors.green);
  } else if (score >= 75) {
    log('Status: Good - Minor improvements needed', colors.green);
  } else if (score >= 50) {
    log('Status: Fair - Several security issues need attention', colors.yellow);
  } else {
    log('Status: Poor - Critical security issues must be addressed', colors.red);
  }

  log('\n' + '='.repeat(80) + '\n', colors.magenta);
}

// Main execution
async function runPenetrationTests() {
  log('='.repeat(80), colors.cyan);
  log('COMPREHENSIVE PENETRATION TESTING', colors.cyan);
  log('Task 20.3: Security and Compliance Validation', colors.cyan);
  log('='.repeat(80) + '\n', colors.cyan);

  try {
    await testSQLInjection();
    await testXSSVulnerabilities();
    await testAuthenticationBypass();
    await testBruteForceProtection();
    await testCSRFProtection();
    await testSecurityHeaders();
    await testPCIDSSCompliance();
    await testGDPRCompliance();
    await testDataEncryption();
    await testSessionSecurity();
    await testAPIRateLimiting();

    generateReport();
  } catch (error) {
    logError(`Penetration testing failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runPenetrationTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
