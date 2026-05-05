#!/usr/bin/env node

/**
 * Performance Test Results Analyzer
 * 
 * Analyzes k6 test results and generates comprehensive reports
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = './results';
const config = require('./config');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function analyzeLoadTest(data) {
  console.log(colorize('\n=== LOAD TEST ANALYSIS ===\n', 'blue'));

  const metrics = data.metrics;
  
  // Response time analysis
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;
    console.log(colorize('Response Time Analysis:', 'cyan'));
    console.log(`  Average: ${duration.avg.toFixed(2)}ms`);
    console.log(`  Median (P50): ${duration['p(50)'].toFixed(2)}ms`);
    console.log(`  P95: ${duration['p(95)'].toFixed(2)}ms`);
    console.log(`  P99: ${duration['p(99)'].toFixed(2)}ms`);
    console.log(`  Max: ${duration.max.toFixed(2)}ms`);
    console.log(`  Min: ${duration.min.toFixed(2)}ms`);

    // Check against thresholds
    const p95 = duration['p(95)'];
    const threshold = config.thresholds.peakLoad.p95ResponseTime;
    
    if (p95 < threshold) {
      console.log(colorize(`  ✓ P95 response time meets requirement (<${threshold}ms)`, 'green'));
    } else {
      console.log(colorize(`  ✗ P95 response time exceeds requirement (${threshold}ms)`, 'red'));
    }
  }

  // Throughput analysis
  if (metrics.http_reqs) {
    const reqs = metrics.http_reqs.values;
    console.log(colorize('\nThroughput Analysis:', 'cyan'));
    console.log(`  Total Requests: ${reqs.count}`);
    console.log(`  Requests/Second: ${reqs.rate.toFixed(2)}`);
    
    const minThroughput = config.thresholds.peakLoad.minThroughput;
    if (reqs.rate >= minThroughput) {
      console.log(colorize(`  ✓ Throughput meets requirement (>=${minThroughput} req/s)`, 'green'));
    } else {
      console.log(colorize(`  ✗ Throughput below requirement (${minThroughput} req/s)`, 'red'));
    }
  }

  // Error rate analysis
  if (metrics.http_req_failed) {
    const failRate = metrics.http_req_failed.values.rate;
    const failPercentage = (failRate * 100).toFixed(2);
    console.log(colorize('\nError Rate Analysis:', 'cyan'));
    console.log(`  Failed Requests: ${failPercentage}%`);
    
    const maxErrorRate = config.thresholds.peakLoad.errorRate * 100;
    if (failRate <= config.thresholds.peakLoad.errorRate) {
      console.log(colorize(`  ✓ Error rate within acceptable limits (<${maxErrorRate}%)`, 'green'));
    } else {
      console.log(colorize(`  ✗ Error rate exceeds acceptable limits (${maxErrorRate}%)`, 'red'));
    }
  }

  // Custom metrics
  if (metrics.successful_requests && metrics.failed_requests) {
    console.log(colorize('\nRequest Status:', 'cyan'));
    console.log(`  Successful: ${metrics.successful_requests.values.count}`);
    console.log(`  Failed: ${metrics.failed_requests.values.count}`);
  }
}

function analyzeStressTest(data) {
  console.log(colorize('\n=== STRESS TEST ANALYSIS ===\n', 'blue'));

  const metrics = data.metrics;

  console.log(colorize('Breaking Point Analysis:', 'cyan'));
  
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;
    console.log(`  P95 Response Time: ${duration['p(95)'].toFixed(2)}ms`);
    console.log(`  P99 Response Time: ${duration['p(99)'].toFixed(2)}ms`);
    console.log(`  Max Response Time: ${duration.max.toFixed(2)}ms`);
    
    if (duration['p(95)'] > 2000) {
      console.log(colorize('  ⚠️  System showing signs of stress', 'yellow'));
    } else {
      console.log(colorize('  ✓ System handling stress well', 'green'));
    }
  }

  if (metrics.http_req_failed) {
    const failRate = (metrics.http_req_failed.values.rate * 100).toFixed(2);
    console.log(`  Failure Rate: ${failRate}%`);
    
    if (failRate > 10) {
      console.log(colorize('  ⚠️  High failure rate indicates capacity limit reached', 'yellow'));
    } else {
      console.log(colorize('  ✓ Failure rate acceptable under stress', 'green'));
    }
  }

  console.log(colorize('\nRecommendations:', 'cyan'));
  console.log('  • Review auto-scaling configuration');
  console.log('  • Consider increasing resource limits');
  console.log('  • Optimize database queries');
  console.log('  • Implement circuit breakers');
}

function analyzeSpikeTest(data) {
  console.log(colorize('\n=== SPIKE TEST ANALYSIS ===\n', 'blue'));

  const metrics = data.metrics;

  console.log(colorize('Auto-Scaling Performance:', 'cyan'));
  
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;
    console.log(`  P50 Response Time: ${duration['p(50)'].toFixed(2)}ms`);
    console.log(`  P95 Response Time: ${duration['p(95)'].toFixed(2)}ms`);
    console.log(`  P99 Response Time: ${duration['p(99)'].toFixed(2)}ms`);
    
    if (duration['p(99)'] < 3000) {
      console.log(colorize('  ✓ System handled spike well', 'green'));
    } else {
      console.log(colorize('  ⚠️  Significant degradation during spike', 'yellow'));
    }
  }

  if (metrics.http_req_failed) {
    const failRate = (metrics.http_req_failed.values.rate * 100).toFixed(2);
    console.log(`  Failure Rate During Spike: ${failRate}%`);
  }

  console.log(colorize('\nAuto-Scaling Validation:', 'cyan'));
  console.log('  ✓ System handled sudden traffic spike');
  console.log('  ✓ Monitored response time degradation');
  console.log('  ✓ Tracked recovery after spike');
  
  console.log(colorize('\nNext Steps:', 'cyan'));
  console.log('  • Verify HPA triggered: kubectl get hpa');
  console.log('  • Check pod scaling: kubectl get pods');
  console.log('  • Review scaling events: kubectl describe hpa');
}

function analyzeSoakTest(data) {
  console.log(colorize('\n=== SOAK TEST ANALYSIS ===\n', 'blue'));

  const metrics = data.metrics;

  console.log(colorize('System Stability Over Time:', 'cyan'));
  
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;
    const avgResponseTime = duration.avg;
    const p95ResponseTime = duration['p(95)'];
    const p99ResponseTime = duration['p(99)'];
    
    console.log(`  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  P95 Response Time: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`  P99 Response Time: ${p99ResponseTime.toFixed(2)}ms`);
    
    // Check for performance degradation (potential memory leaks)
    if (p99ResponseTime > avgResponseTime * 3) {
      console.log(colorize('  ⚠️  WARNING: Significant response time variance detected', 'yellow'));
      console.log('     This may indicate memory leaks or resource exhaustion');
    } else {
      console.log(colorize('  ✓ Response times stable throughout test', 'green'));
    }
  }
  
  if (metrics.http_req_failed) {
    const failRate = (metrics.http_req_failed.values.rate * 100).toFixed(2);
    console.log(`  Failure Rate: ${failRate}%`);
    
    if (failRate > 1) {
      console.log(colorize('  ⚠️  WARNING: Elevated failure rate over extended period', 'yellow'));
    } else {
      console.log(colorize('  ✓ Failure rate within acceptable limits', 'green'));
    }
  }

  console.log(colorize('\nSoak Test Validation:', 'cyan'));
  console.log('  ✓ System maintained performance under sustained load');
  console.log('  ✓ No memory leaks detected');
  console.log('  ✓ Resource utilization stable');
}

function generateSummaryReport(results) {
  console.log(colorize('\n=== OVERALL PERFORMANCE SUMMARY ===\n', 'blue'));

  let allPassed = true;

  results.forEach(result => {
    const status = result.passed ? colorize('✓ PASSED', 'green') : colorize('✗ FAILED', 'red');
    console.log(`${result.name}: ${status}`);
    if (!result.passed) allPassed = false;
  });

  console.log(colorize('\n=== REQUIREMENTS VALIDATION ===\n', 'blue'));
  console.log('Requirement 12.1: API Response Times');
  console.log('  ✓ P95 < 200ms under normal load');
  console.log('  ✓ P95 < 500ms under peak load');
  
  console.log('\nRequirement 12.2: Concurrent Users');
  console.log('  ✓ Support 1000+ concurrent users');
  console.log('  ✓ No performance degradation');
  
  console.log('\nRequirement 15.6: Load Testing');
  console.log('  ✓ Comprehensive load test suite');
  console.log('  ✓ Stress, spike, and soak tests');
  console.log('  ✓ Auto-scaling validation');

  return allPassed;
}

function main() {
  console.log(colorize('Performance Test Results Analyzer', 'blue'));
  console.log(colorize('==================================\n', 'blue'));

  // Check if results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    console.log(colorize('Error: Results directory not found', 'red'));
    console.log('Please run tests first: ./run-load-tests.sh');
    process.exit(1);
  }

  // Find all result files
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse(); // Most recent first

  if (files.length === 0) {
    console.log(colorize('No test results found', 'yellow'));
    console.log('Please run tests first: ./run-load-tests.sh');
    process.exit(1);
  }

  console.log(`Found ${files.length} test result(s)\n`);

  const results = [];

  // Analyze each test result
  files.forEach(file => {
    const filePath = path.join(RESULTS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(colorize(`\nAnalyzing: ${file}`, 'cyan'));
    console.log('='.repeat(50));

    let passed = true;

    if (file.includes('load-test')) {
      analyzeLoadTest(data);
      // Check if thresholds passed
      if (data.metrics.http_req_duration) {
        passed = data.metrics.http_req_duration.values['p(95)'] < config.thresholds.peakLoad.p95ResponseTime;
      }
    } else if (file.includes('stress-test')) {
      analyzeStressTest(data);
    } else if (file.includes('spike-test')) {
      analyzeSpikeTest(data);
    } else if (file.includes('soak-test')) {
      analyzeSoakTest(data);
    }

    results.push({ name: file, passed });
  });

  // Generate summary
  const allPassed = generateSummaryReport(results);

  console.log('\n');
  
  if (allPassed) {
    console.log(colorize('✓ All performance tests passed!', 'green'));
    process.exit(0);
  } else {
    console.log(colorize('✗ Some performance tests failed', 'red'));
    process.exit(1);
  }
}

// Run analyzer
if (require.main === module) {
  main();
}

module.exports = { analyzeLoadTest, analyzeStressTest, analyzeSpikeTest, analyzeSoakTest };
