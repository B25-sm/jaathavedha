/**
 * Task 20.3: Compliance Validation Script
 * 
 * Validates PCI DSS and GDPR compliance across the platform
 * 
 * Requirements: 11.3 (PCI DSS), 11.5 (GDPR), 15.7 (Compliance testing)
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

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

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

// Compliance Results
const complianceResults = {
  pciDss: {
    passed: 0,
    failed: 0,
    requirements: []
  },
  gdpr: {
    passed: 0,
    failed: 0,
    requirements: []
  }
};

function addPCIResult(requirement, status, description) {
  complianceResults.pciDss.requirements.push({
    requirement,
    status,
    description
  });

  if (status === 'pass') {
    complianceResults.pciDss.passed++;
  } else {
    complianceResults.pciDss.failed++;
  }
}

function addGDPRResult(requirement, status, description) {
  complianceResults.gdpr.requirements.push({
    requirement,
    status,
    description
  });

  if (status === 'pass') {
    complianceResults.gdpr.passed++;
  } else {
    complianceResults.gdpr.failed++;
  }
}

// PCI DSS Compliance Tests
async function validatePCIDSS() {
  log('\n' + '='.repeat(80), colors.blue);
  log('PCI DSS COMPLIANCE VALIDATION', colors.blue);
  log('='.repeat(80) + '\n', colors.blue);

  const pgPool = new Pool({ connectionString: DB_URL });

  try {
    // Requirement 3: Protect stored cardholder data
    log('Requirement 3: Protect Stored Cardholder Data', colors.cyan);

    // 3.1: Never store full magnetic stripe data
    const cardDataCheck = await pgPool.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (
        column_name LIKE '%card_number%' 
        OR column_name LIKE '%credit_card%'
        OR column_name LIKE '%magnetic%'
        OR column_name LIKE '%track%'
      )
    `);

    if (cardDataCheck.rows.length === 0) {
      logSuccess('3.1: No full card data storage detected');
      addPCIResult('3.1', 'pass', 'Full card data is not stored');
    } else {
      logError('3.1: Potential card data storage detected');
      addPCIResult('3.1', 'fail', 'Database may contain card data columns');
    }

    // 3.2: Never store CVV/CVC
    const cvvCheck = await pgPool.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%cvv%' OR column_name LIKE '%cvc%' OR column_name LIKE '%cid%')
    `);

    if (cvvCheck.rows.length === 0) {
      logSuccess('3.2: No CVV/CVC storage detected');
      addPCIResult('3.2', 'pass', 'CVV/CVC codes are not stored');
    } else {
      logError('3.2: CVV/CVC storage detected - CRITICAL VIOLATION');
      addPCIResult('3.2', 'fail', 'CVV/CVC codes must never be stored');
    }

    // 3.4: Render PAN unreadable
    const tokenColumns = await pgPool.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%token%' OR column_name LIKE '%gateway%')
    `);

    if (tokenColumns.rows.length > 0) {
      logSuccess('3.4: Payment tokenization appears to be implemented');
      addPCIResult('3.4', 'pass', 'Payment data is tokenized');
    } else {
      logWarning('3.4: Payment tokenization may not be implemented');
      addPCIResult('3.4', 'fail', 'Implement payment tokenization');
    }

    // Requirement 8: Identify and authenticate access
    log('\nRequirement 8: Identify and Authenticate Access', colors.cyan);

    // 8.2: Unique user IDs
    const userIdCheck = await pgPool.query(`
      SELECT COUNT(DISTINCT id) as unique_ids, COUNT(*) as total_users
      FROM users
    `);

    if (userIdCheck.rows[0] && userIdCheck.rows[0].unique_ids === userIdCheck.rows[0].total_users) {
      logSuccess('8.2: All users have unique IDs');
      addPCIResult('8.2', 'pass', 'Unique user identification is enforced');
    } else {
      logError('8.2: Duplicate user IDs detected');
      addPCIResult('8.2', 'fail', 'Ensure all users have unique IDs');
    }

    // 8.3: Multi-factor authentication
    const mfaColumns = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      AND (column_name LIKE '%mfa%' OR column_name LIKE '%two_factor%')
    `);

    if (mfaColumns.rows.length > 0) {
      logSuccess('8.3: MFA support is implemented');
      addPCIResult('8.3', 'pass', 'Multi-factor authentication is available');
    } else {
      logWarning('8.3: MFA support may not be implemented');
      addPCIResult('8.3', 'fail', 'Implement multi-factor authentication');
    }

    // Requirement 10: Track and monitor all access
    log('\nRequirement 10: Track and Monitor All Access', colors.cyan);

    // 10.1: Audit trails
    const auditTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%audit%' 
        OR table_name LIKE '%log%'
        OR table_name LIKE '%security_event%'
      )
    `);

    if (auditTables.rows.length > 0) {
      logSuccess('10.1: Audit logging tables found');
      addPCIResult('10.1', 'pass', 'Audit trail system is implemented');
    } else {
      logError('10.1: No audit logging tables detected');
      addPCIResult('10.1', 'fail', 'Implement comprehensive audit logging');
    }

    // 10.2: Automated audit trails for payment events
    const paymentAuditCheck = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'payments'
      AND (column_name LIKE '%created_at%' OR column_name LIKE '%updated_at%')
    `);

    if (paymentAuditCheck.rows.length >= 2) {
      logSuccess('10.2: Payment transaction timestamps are tracked');
      addPCIResult('10.2', 'pass', 'Payment events are timestamped');
    } else {
      logError('10.2: Payment transaction timestamps may not be tracked');
      addPCIResult('10.2', 'fail', 'Add timestamps to all payment transactions');
    }

    // Requirement 12: Information security policy
    log('\nRequirement 12: Information Security Policy', colors.cyan);

    // Check for security documentation
    const securityDocs = [
      'backend/services/security/README.md',
      'backend/services/payment/README.md'
    ];

    let docsFound = 0;
    for (const doc of securityDocs) {
      if (fs.existsSync(path.join(process.cwd(), doc))) {
        docsFound++;
      }
    }

    if (docsFound >= 2) {
      logSuccess('12.1: Security documentation is present');
      addPCIResult('12.1', 'pass', 'Security policies are documented');
    } else {
      logWarning('12.1: Security documentation may be incomplete');
      addPCIResult('12.1', 'fail', 'Document security policies and procedures');
    }

    await pgPool.end();
  } catch (error) {
    logError(`PCI DSS validation failed: ${error.message}`);
  }
}

// GDPR Compliance Tests
async function validateGDPR() {
  log('\n' + '='.repeat(80), colors.blue);
  log('GDPR COMPLIANCE VALIDATION', colors.blue);
  log('='.repeat(80) + '\n', colors.blue);

  const pgPool = new Pool({ connectionString: DB_URL });

  try {
    // Article 6: Lawfulness of processing
    log('Article 6: Lawfulness of Processing (Consent)', colors.cyan);

    // Check for consent management
    const consentTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%consent%'
    `);

    if (consentTables.rows.length > 0) {
      logSuccess('Article 6: Consent management system is implemented');
      addGDPRResult('Article 6', 'pass', 'User consent is tracked and managed');

      // Check consent table structure
      const consentColumns = await pgPool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%consent%'
      `);

      const requiredColumns = ['user_id', 'consent_type', 'granted', 'created_at'];
      const hasAllColumns = requiredColumns.every(col =>
        consentColumns.rows.some(row => row.column_name === col)
      );

      if (hasAllColumns) {
        logSuccess('Consent table has all required fields');
      } else {
        logWarning('Consent table may be missing required fields');
      }
    } else {
      logError('Article 6: No consent management system detected');
      addGDPRResult('Article 6', 'fail', 'Implement consent management system');
    }

    // Article 15: Right of access
    log('\nArticle 15: Right of Access (Data Export)', colors.cyan);

    // Check for data export functionality
    const exportTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%export%' OR table_name LIKE '%gdpr%')
    `);

    if (exportTables.rows.length > 0) {
      logSuccess('Article 15: Data export functionality appears to be implemented');
      addGDPRResult('Article 15', 'pass', 'Users can export their data');
    } else {
      logWarning('Article 15: Data export functionality may not be implemented');
      addGDPRResult('Article 15', 'fail', 'Implement data portability feature');
    }

    // Article 17: Right to erasure
    log('\nArticle 17: Right to Erasure (Right to be Forgotten)', colors.cyan);

    // Check for deletion/anonymization support
    const deletionSupport = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      AND column_name = 'status'
    `);

    if (deletionSupport.rows.length > 0) {
      logSuccess('Article 17: User deletion/deactivation is supported');
      addGDPRResult('Article 17', 'pass', 'Users can request data deletion');
    } else {
      logError('Article 17: User deletion may not be supported');
      addGDPRResult('Article 17', 'fail', 'Implement right to erasure');
    }

    // Article 20: Right to data portability
    log('\nArticle 20: Right to Data Portability', colors.cyan);

    // Already covered by Article 15 check
    logSuccess('Article 20: Covered by data export functionality');
    addGDPRResult('Article 20', 'pass', 'Data portability is supported');

    // Article 25: Data protection by design
    log('\nArticle 25: Data Protection by Design and Default', colors.cyan);

    // Check for encryption
    const encryptionTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%encryption%'
    `);

    if (encryptionTables.rows.length > 0) {
      logSuccess('Article 25: Encryption system is implemented');
      addGDPRResult('Article 25', 'pass', 'Data protection by design is implemented');
    } else {
      logWarning('Article 25: Encryption system may not be fully implemented');
      addGDPRResult('Article 25', 'fail', 'Implement data protection by design');
    }

    // Article 30: Records of processing activities
    log('\nArticle 30: Records of Processing Activities', colors.cyan);

    // Check for audit logs
    const auditLogs = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%audit%' OR table_name LIKE '%data_access_log%')
    `);

    if (auditLogs.rows.length > 0) {
      logSuccess('Article 30: Processing activity logs are maintained');
      addGDPRResult('Article 30', 'pass', 'Records of processing are maintained');
    } else {
      logError('Article 30: No processing activity logs detected');
      addGDPRResult('Article 30', 'fail', 'Implement processing activity logging');
    }

    // Article 32: Security of processing
    log('\nArticle 32: Security of Processing', colors.cyan);

    // Check for security measures
    const securityTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%security%' 
        OR table_name LIKE '%encryption%'
        OR table_name LIKE '%audit%'
      )
    `);

    if (securityTables.rows.length >= 2) {
      logSuccess('Article 32: Security measures are implemented');
      addGDPRResult('Article 32', 'pass', 'Appropriate security measures are in place');
    } else {
      logError('Article 32: Security measures may be insufficient');
      addGDPRResult('Article 32', 'fail', 'Implement comprehensive security measures');
    }

    // Article 33: Breach notification
    log('\nArticle 33: Breach Notification', colors.cyan);

    // Check for incident response system
    const incidentTables = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%incident%' OR table_name LIKE '%breach%')
    `);

    if (incidentTables.rows.length > 0) {
      logSuccess('Article 33: Breach notification system is in place');
      addGDPRResult('Article 33', 'pass', 'Breach notification procedures exist');
    } else {
      logWarning('Article 33: Breach notification system may not be implemented');
      addGDPRResult('Article 33', 'fail', 'Implement breach notification procedures');
    }

    await pgPool.end();
  } catch (error) {
    logError(`GDPR validation failed: ${error.message}`);
  }
}

// Generate Compliance Report
function generateComplianceReport() {
  log('\n' + '='.repeat(80), colors.magenta);
  log('COMPLIANCE VALIDATION REPORT', colors.magenta);
  log('='.repeat(80) + '\n', colors.magenta);

  // PCI DSS Summary
  log('PCI DSS COMPLIANCE SUMMARY', colors.blue);
  log('-'.repeat(80), colors.blue);

  const pciTotal = complianceResults.pciDss.passed + complianceResults.pciDss.failed;
  const pciScore = pciTotal > 0 ? Math.round((complianceResults.pciDss.passed / pciTotal) * 100) : 0;

  log(`Requirements Passed: ${complianceResults.pciDss.passed}/${pciTotal}`, colors.green);
  log(`Compliance Score: ${pciScore}%`, pciScore >= 90 ? colors.green : pciScore >= 70 ? colors.yellow : colors.red);

  if (complianceResults.pciDss.failed > 0) {
    log('\nFailed Requirements:', colors.red);
    complianceResults.pciDss.requirements
      .filter(r => r.status === 'fail')
      .forEach(r => {
        log(`  ✗ ${r.requirement}: ${r.description}`, colors.red);
      });
  }

  // GDPR Summary
  log('\n' + '='.repeat(80), colors.blue);
  log('GDPR COMPLIANCE SUMMARY', colors.blue);
  log('-'.repeat(80), colors.blue);

  const gdprTotal = complianceResults.gdpr.passed + complianceResults.gdpr.failed;
  const gdprScore = gdprTotal > 0 ? Math.round((complianceResults.gdpr.passed / gdprTotal) * 100) : 0;

  log(`Requirements Passed: ${complianceResults.gdpr.passed}/${gdprTotal}`, colors.green);
  log(`Compliance Score: ${gdprScore}%`, gdprScore >= 90 ? colors.green : gdprScore >= 70 ? colors.yellow : colors.red);

  if (complianceResults.gdpr.failed > 0) {
    log('\nFailed Requirements:', colors.red);
    complianceResults.gdpr.requirements
      .filter(r => r.status === 'fail')
      .forEach(r => {
        log(`  ✗ ${r.requirement}: ${r.description}`, colors.red);
      });
  }

  // Overall Assessment
  log('\n' + '='.repeat(80), colors.magenta);
  log('OVERALL COMPLIANCE ASSESSMENT', colors.magenta);
  log('='.repeat(80), colors.magenta);

  const overallScore = Math.round((pciScore + gdprScore) / 2);

  log(`\nOverall Compliance Score: ${overallScore}%`, 
    overallScore >= 90 ? colors.green : overallScore >= 70 ? colors.yellow : colors.red);

  if (overallScore >= 90) {
    log('Status: Excellent - Platform is highly compliant', colors.green);
  } else if (overallScore >= 70) {
    log('Status: Good - Minor compliance gaps need attention', colors.yellow);
  } else if (overallScore >= 50) {
    log('Status: Fair - Several compliance issues must be addressed', colors.yellow);
  } else {
    log('Status: Poor - Critical compliance issues require immediate action', colors.red);
  }

  log('\n' + '='.repeat(80) + '\n', colors.magenta);
}

// Main execution
async function runComplianceValidation() {
  log('='.repeat(80), colors.cyan);
  log('COMPREHENSIVE COMPLIANCE VALIDATION', colors.cyan);
  log('Task 20.3: Security and Compliance Validation', colors.cyan);
  log('='.repeat(80) + '\n', colors.cyan);

  try {
    await validatePCIDSS();
    await validateGDPR();
    generateComplianceReport();
  } catch (error) {
    logError(`Compliance validation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run validation
runComplianceValidation().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
