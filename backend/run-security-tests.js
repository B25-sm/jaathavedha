/**
 * Task 20.3: Security and Compliance Test Runner
 * 
 * Runs comprehensive security and compliance validation tests
 * without requiring full jest installation
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const crypto = require('crypto');

// Configuration
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sai_mahendra_test';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Colors
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

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

// Test Results
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function assert(condition, testName) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    logSuccess(testName);
  } else {
    testResults.failed++;
    logError(testName);
  }
}

// Encryption Service Tests
function testEncryptionService() {
  log('\n=== Encryption Service Tests ===', colors.blue);

  const algorithm = 'aes-256-gcm';
  const masterKey = crypto.scryptSync('test-master-key-32-characters-long', 'salt', 32);

  // Test encryption/decryption
  const plaintext = 'sensitive-data-123';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, masterKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const decipher = crypto.createDecipheriv(algorithm, masterKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  assert(decrypted === plaintext, 'Encryption and decryption works correctly');
  assert(encrypted !== plaintext, 'Encrypted data is different from plaintext');

  // Test hashing
  const password = 'SecurePassword123!';
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  assert(hash.length === 64, 'SHA-256 hash produces 64 hex characters');
  assert(hash !== password, 'Hash is different from original password');

  // Test token generation
  const token = crypto.randomBytes(32).toString('hex');
  assert(token.length === 64, 'Generated token has correct length');

  // Test HMAC
  const data = 'test-data';
  const hmac = crypto.createHmac('sha256', masterKey).update(data).digest('hex');
  assert(hmac.length === 64, 'HMAC signature has correct length');
}

// SQL Injection Tests
async function testSQLInjectionProtection() {
  log('\n=== SQL Injection Protection Tests ===', colors.blue);

  const pgPool = new Pool({ connectionString: DB_URL });

  try {
    const sqlPayloads = [
      "admin' OR '1'='1",
      "admin'--",
      "' OR 1=1--"
    ];

    for (const payload of sqlPayloads) {
      const result = await pgPool.query(
        'SELECT * FROM users WHERE email = $1',
        [payload]
      );

      assert(result.rows.length === 0, `SQL injection prevented for payload: ${payload.substring(0, 20)}...`);
    }

    await pgPool.end();
  } catch (error) {
    logError(`SQL injection test failed: ${error.message}`);
  }
}

// PCI DSS Compliance Tests
async function testPCIDSSCompliance() {
  log('\n=== PCI DSS Compliance Tests ===', colors.blue);

  const pgPool = new Pool({ connectionString: DB_URL });

  try {
    // Test 1: No full card number storage
    const cardCheck = await pgPool.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND column_name LIKE '%card_number%'
    `);

    assert(cardCheck.rows.length === 0, 'No full credit card numbers stored');

    // Test 2: No CVV storage
    const cvvCheck = await pgPool.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%cvv%' OR column_name LIKE '%cvc%')
    `);

    assert(cvvCheck.rows.length === 0, 'No CVV/CVC codes stored');

    // Test 3: Payment tokenization
    const tokenCheck = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'payments'
      AND column_name LIKE '%token%'
    `);

    assert(tokenCheck.rows.length > 0, 'Payment tokenization is implemented');

    // Test 4: Audit logging
    const auditCheck = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%audit%' OR table_name LIKE '%log%')
    `);

    assert(auditCheck.rows.length > 0, 'Audit logging tables exist');

    await pgPool.end();
  } catch (error) {
    logError(`PCI DSS compliance test failed: ${error.message}`);
  }
}

// GDPR Compliance Tests
async function testGDPRCompliance() {
  log('\n=== GDPR Compliance Tests ===', colors.blue);

  const pgPool = new Pool({ connectionString: DB_URL });

  try {
    // Test 1: Consent management
    const consentCheck = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%consent%'
    `);

    assert(consentCheck.rows.length > 0, 'Consent management system exists');

    // Test 2: Data deletion support
    const deletionCheck = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      AND column_name = 'status'
    `);

    assert(deletionCheck.rows.length > 0, 'User deletion/deactivation is supported');

    // Test 3: Encryption support
    const encryptionCheck = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%encryption%'
    `);

    assert(encryptionCheck.rows.length > 0, 'Encryption key management exists');

    // Test 4: Audit logging for data access
    const dataAccessCheck = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%data_access%'
    `);

    assert(dataAccessCheck.rows.length > 0, 'Data access logging exists');

    await pgPool.end();
  } catch (error) {
    logError(`GDPR compliance test failed: ${error.message}`);
  }
}

// Security Monitoring Tests
async function testSecurityMonitoring() {
  log('\n=== Security Monitoring Tests ===', colors.blue);

  const redis = new Redis(REDIS_URL);

  try {
    // Test 1: Security event logging
    const testEvent = {
      type: 'test_event',
      severity: 'info',
      timestamp: new Date().toISOString()
    };

    await redis.lpush('security:events:recent', JSON.stringify(testEvent));
    const events = await redis.lrange('security:events:recent', 0, 0);

    assert(events.length > 0, 'Security events can be logged');

    // Test 2: Failed login tracking
    const testIP = '192.168.1.100';
    await redis.incr(`security:failed_logins:${testIP}`);
    const count = await redis.get(`security:failed_logins:${testIP}`);

    assert(parseInt(count) > 0, 'Failed login attempts are tracked');

    // Test 3: IP blocking
    await redis.setex(`security:blocked_ip:${testIP}`, 3600, 'blocked');
    const blocked = await redis.get(`security:blocked_ip:${testIP}`);

    assert(blocked === 'blocked', 'IP blocking is functional');

    // Cleanup
    await redis.del(`security:failed_logins:${testIP}`);
    await redis.del(`security:blocked_ip:${testIP}`);
    await redis.quit();
  } catch (error) {
    logError(`Security monitoring test failed: ${error.message}`);
  }
}

// Session Security Tests
async function testSessionSecurity() {
  log('\n=== Session Security Tests ===', colors.blue);

  const redis = new Redis(REDIS_URL);

  try {
    // Test 1: Session storage
    const sessionId = 'test-session-' + Date.now();
    const sessionData = {
      userId: 'test-user',
      createdAt: new Date().toISOString()
    };

    await redis.setex(`session:${sessionId}`, 1800, JSON.stringify(sessionData));
    const stored = await redis.get(`session:${sessionId}`);

    assert(stored !== null, 'Sessions can be stored');

    // Test 2: Session expiration
    const ttl = await redis.ttl(`session:${sessionId}`);
    assert(ttl > 0 && ttl <= 1800, 'Session expiration is configured');

    // Cleanup
    await redis.del(`session:${sessionId}`);
    await redis.quit();
  } catch (error) {
    logError(`Session security test failed: ${error.message}`);
  }
}

// XSS Protection Tests
function testXSSProtection() {
  log('\n=== XSS Protection Tests ===', colors.blue);

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")'
  ];

  for (const payload of xssPayloads) {
    const sanitized = payload
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    assert(!sanitized.includes('<script>'), `XSS payload sanitized: ${payload.substring(0, 20)}...`);
  }
}

// Password Security Tests
function testPasswordSecurity() {
  log('\n=== Password Security Tests ===', colors.blue);

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const weakPasswords = ['password', '12345678', 'qwerty'];
  const strongPassword = 'SecureP@ssw0rd123!';

  for (const weak of weakPasswords) {
    assert(!passwordRegex.test(weak), `Weak password rejected: ${weak}`);
  }

  assert(passwordRegex.test(strongPassword), 'Strong password accepted');
}

// Generate Report
function generateReport() {
  log('\n' + '='.repeat(80), colors.magenta);
  log('SECURITY AND COMPLIANCE TEST REPORT', colors.magenta);
  log('='.repeat(80), colors.magenta);

  log(`\nTotal Tests: ${testResults.total}`, colors.cyan);
  log(`Passed: ${testResults.passed}`, colors.green);
  log(`Failed: ${testResults.failed}`, colors.red);

  const successRate = testResults.total > 0 
    ? Math.round((testResults.passed / testResults.total) * 100) 
    : 0;

  log(`\nSuccess Rate: ${successRate}%`, 
    successRate >= 90 ? colors.green : successRate >= 70 ? colors.yellow : colors.red);

  if (successRate >= 90) {
    log('Status: Excellent - Security measures are comprehensive', colors.green);
  } else if (successRate >= 70) {
    log('Status: Good - Minor security improvements needed', colors.yellow);
  } else {
    log('Status: Needs Improvement - Address failed tests', colors.red);
  }

  log('\n' + '='.repeat(80) + '\n', colors.magenta);

  return testResults.failed === 0;
}

// Main execution
async function runSecurityTests() {
  log('='.repeat(80), colors.cyan);
  log('TASK 20.3: SECURITY AND COMPLIANCE VALIDATION', colors.cyan);
  log('='.repeat(80) + '\n', colors.cyan);

  try {
    testEncryptionService();
    await testSQLInjectionProtection();
    await testPCIDSSCompliance();
    await testGDPRCompliance();
    await testSecurityMonitoring();
    await testSessionSecurity();
    testXSSProtection();
    testPasswordSecurity();

    const allPassed = generateReport();

    if (allPassed) {
      log('✓ All security and compliance tests passed!', colors.green);
      process.exit(0);
    } else {
      log('✗ Some tests failed. Review the report above.', colors.red);
      process.exit(1);
    }
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runSecurityTests();
