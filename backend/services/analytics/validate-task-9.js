/**
 * Task 9 Validation Script
 * Validates Analytics Service and Reporting System implementation
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('TASK 9 VALIDATION: Analytics Service and Reporting System');
console.log('='.repeat(80));
console.log();

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    results.passed.push(`✓ ${description}`);
    return true;
  } else {
    results.failed.push(`✗ ${description} - File not found: ${filePath}`);
    return false;
  }
}

function checkFileContent(filePath, searchStrings, description) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    results.failed.push(`✗ ${description} - File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const missingStrings = searchStrings.filter(str => !content.includes(str));

  if (missingStrings.length === 0) {
    results.passed.push(`✓ ${description}`);
    return true;
  } else {
    results.failed.push(`✗ ${description} - Missing: ${missingStrings.join(', ')}`);
    return false;
  }
}

console.log('Task 9.1: Analytics Data Collection');
console.log('-'.repeat(80));

// Check TypeScript interfaces
checkFile('src/types/index.ts', 'TypeScript interfaces for AnalyticsEvent and UserMetrics');
checkFileContent(
  'src/types/index.ts',
  ['AnalyticsEvent', 'UserMetrics', 'EventType', 'EnrollmentMetrics', 'RevenueMetrics'],
  'Analytics type definitions include all required interfaces'
);

// Check Express.js service setup
checkFile('src/index.ts', 'Express.js service with MongoDB integration');
checkFileContent(
  'src/index.ts',
  ['express', 'MongoClient', 'createClient', 'RedisClientType'],
  'Service includes Express, MongoDB, and Redis setup'
);

// Check event tracking endpoints
checkFileContent(
  'src/index.ts',
  [
    'POST /api/analytics/events',
    'POST /api/analytics/page-view',
    'POST /api/analytics/events/batch',
    'POST /api/analytics/user-action'
  ],
  'Event tracking endpoints implemented'
);

// Check real-time event processing with Redis streams
checkFileContent(
  'src/index.ts',
  ['processEventStream', 'xAdd', 'analytics:events', 'updateUserMetrics'],
  'Real-time event processing with Redis streams'
);

console.log();
console.log('Task 9.2: Business Metrics Calculation');
console.log('-'.repeat(80));

// Check MetricsService
checkFile('src/services/MetricsService.ts', 'MetricsService implementation');
checkFileContent(
  'src/services/MetricsService.ts',
  [
    'calculateEnrollmentMetrics',
    'calculateRevenueMetrics',
    'calculateEngagementMetrics',
    'calculateRetentionMetrics',
    'calculateConversionFunnel'
  ],
  'MetricsService includes all required calculation methods'
);

// Check enrollment and revenue tracking
checkFileContent(
  'src/services/MetricsService.ts',
  ['totalEnrollments', 'completionRate', 'totalRevenue', 'averageOrderValue'],
  'Enrollment and revenue tracking algorithms'
);

// Check user engagement and retention metrics
checkFileContent(
  'src/services/MetricsService.ts',
  ['dailyActiveUsers', 'weeklyActiveUsers', 'monthlyActiveUsers', 'retentionByDay', 'retentionByWeek'],
  'User engagement and retention metrics'
);

// Check conversion funnel analysis
checkFileContent(
  'src/services/MetricsService.ts',
  ['visitors', 'signups', 'enrollmentStarts', 'paymentCompleted', 'conversionRates'],
  'Conversion funnel analysis'
);

// Check ReportService
checkFile('src/services/ReportService.ts', 'ReportService implementation');
checkFileContent(
  'src/services/ReportService.ts',
  ['generateReport', 'exportReport', 'scheduleReport'],
  'Automated report generation system'
);

console.log();
console.log('Task 9.3: Admin Analytics Dashboard');
console.log('-'.repeat(80));

// Check dashboard API endpoints
checkFileContent(
  'src/index.ts',
  [
    'GET /api/analytics/dashboard',
    'GET /api/analytics/reports/enrollment',
    'GET /api/analytics/reports/revenue',
    'GET /api/analytics/reports/user-engagement',
    'GET /api/analytics/reports/retention',
    'GET /api/analytics/reports/conversion-funnel'
  ],
  'Real-time dashboard API endpoints'
);

// Check data aggregation for KPIs
checkFileContent(
  'src/index.ts',
  ['realTime', 'trends', 'topPages', 'activeUsers', 'todayRevenue', 'todayEnrollments'],
  'Data aggregation for key performance indicators'
);

// Check data export functionality
checkFileContent(
  'src/index.ts',
  ['POST /api/analytics/export', 'ExportFormat', 'CSV', 'JSON'],
  'Data export functionality'
);
checkFileContent(
  'src/services/ReportService.ts',
  ['convertToCSV', 'enrollmentMetricsToCSV', 'revenueMetricsToCSV'],
  'CSV export implementation'
);

// Check alert system
checkFile('src/services/AlertService.ts', 'AlertService implementation');
checkFileContent(
  'src/services/AlertService.ts',
  ['checkThresholds', 'createAlert', 'AlertThreshold', 'AlertSeverity'],
  'Alert system for critical metric thresholds'
);
checkFileContent(
  'src/index.ts',
  [
    'GET /api/analytics/alerts',
    'GET /api/analytics/alerts/thresholds',
    'POST /api/analytics/alerts/thresholds'
  ],
  'Alert management endpoints'
);

console.log();
console.log('Additional Checks');
console.log('-'.repeat(80));

// Check unit tests
checkFile('src/__tests__/MetricsService.test.ts', 'MetricsService unit tests');
checkFile('src/__tests__/AlertService.test.ts', 'AlertService unit tests');
checkFile('src/__tests__/integration.test.ts', 'Integration tests');

// Check configuration files
checkFile('package.json', 'Package.json with dependencies');
checkFile('tsconfig.json', 'TypeScript configuration');
checkFile('jest.config.js', 'Jest configuration');
checkFile('Dockerfile.dev', 'Docker development configuration');

// Check MongoDB indexes
checkFileContent(
  'src/index.ts',
  ['createIndex', 'eventType', 'userId', 'timestamp', 'sessionId'],
  'MongoDB indexes for performance optimization'
);

// Check error handling
checkFileContent(
  'src/index.ts',
  ['try', 'catch', 'error', 'logger.error', 'res.status(500)'],
  'Error handling implementation'
);

// Check security middleware
checkFileContent(
  'src/index.ts',
  ['helmet', 'cors', 'rateLimit', 'compression'],
  'Security middleware (helmet, cors, rate limiting)'
);

console.log();
console.log('='.repeat(80));
console.log('VALIDATION RESULTS');
console.log('='.repeat(80));
console.log();

if (results.passed.length > 0) {
  console.log('PASSED CHECKS:');
  results.passed.forEach(item => console.log(`  ${item}`));
  console.log();
}

if (results.warnings.length > 0) {
  console.log('WARNINGS:');
  results.warnings.forEach(item => console.log(`  ${item}`));
  console.log();
}

if (results.failed.length > 0) {
  console.log('FAILED CHECKS:');
  results.failed.forEach(item => console.log(`  ${item}`));
  console.log();
}

console.log('='.repeat(80));
console.log(`Total: ${results.passed.length} passed, ${results.failed.length} failed, ${results.warnings.length} warnings`);
console.log('='.repeat(80));

// Exit with appropriate code
if (results.failed.length > 0) {
  console.log();
  console.log('❌ VALIDATION FAILED - Some checks did not pass');
  process.exit(1);
} else {
  console.log();
  console.log('✅ VALIDATION PASSED - All checks completed successfully');
  console.log();
  console.log('Task 9 Implementation Summary:');
  console.log('- ✓ Analytics data collection with TypeScript interfaces');
  console.log('- ✓ Express.js service with MongoDB and Redis integration');
  console.log('- ✓ Event tracking endpoints for user actions');
  console.log('- ✓ Real-time event processing with Redis streams');
  console.log('- ✓ Enrollment and revenue tracking algorithms');
  console.log('- ✓ User engagement and retention metrics');
  console.log('- ✓ Conversion funnel analysis and reporting');
  console.log('- ✓ Automated report generation system');
  console.log('- ✓ Real-time dashboard API endpoints');
  console.log('- ✓ Data aggregation for key performance indicators');
  console.log('- ✓ Data export functionality (CSV, JSON)');
  console.log('- ✓ Alert system for critical metric thresholds');
  console.log();
  process.exit(0);
}
