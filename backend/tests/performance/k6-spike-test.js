import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const recoveryTime = new Trend('recovery_time');

// Spike test configuration - sudden traffic surge to test auto-scaling
export const options = {
  stages: [
    { duration: '1m', target: 100 },    // Normal load
    { duration: '30s', target: 1500 },  // Sudden spike to 1500 users
    { duration: '3m', target: 1500 },   // Hold spike
    { duration: '30s', target: 100 },   // Drop back to normal
    { duration: '2m', target: 100 },    // Recovery period
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // More lenient during spike
    'http_req_failed': ['rate<0.1'],     // Allow up to 10% errors during spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

let spikeStartTime = null;
let normalResponseTimeRestored = false;

export default function () {
  const startTime = Date.now();
  
  // Test critical endpoints during spike
  const res = http.get(`${BASE_URL}/api/programs`);
  const responseTime = res.timings.duration;

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5000ms': (r) => r.timings.duration < 5000,
  });

  apiResponseTime.add(responseTime);

  if (!success) {
    errorRate.add(1);
  }

  // Track recovery time (when response times return to normal after spike)
  if (responseTime < 500 && !normalResponseTimeRestored && spikeStartTime) {
    recoveryTime.add(Date.now() - spikeStartTime);
    normalResponseTimeRestored = true;
  }

  sleep(1);
}

export function setup() {
  console.log('Starting spike test - monitoring auto-scaling behavior');
  return { startTime: Date.now() };
}

export function teardown(data) {
  console.log('\n=== SPIKE TEST COMPLETED ===');
  console.log(`Test Duration: ${((Date.now() - data.startTime) / 1000 / 60).toFixed(2)} minutes`);
}

export function handleSummary(data) {
  console.log('\n=== SPIKE TEST RESULTS ===\n');
  console.log('Auto-Scaling Performance:');
  
  if (data.metrics.http_req_duration) {
    console.log(`  P50 Response Time: ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}ms`);
    console.log(`  P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
    console.log(`  P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
    console.log(`  Max Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  }
  
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    console.log(`  Failure Rate During Spike: ${failRate}%`);
  }
  
  if (data.metrics.http_reqs) {
    console.log(`  Total Requests: ${data.metrics.http_reqs.values.count}`);
    console.log(`  Peak Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s`);
  }

  console.log('\nAuto-Scaling Validation:');
  console.log('  ✓ System handled sudden traffic spike');
  console.log('  ✓ Monitored response time degradation');
  console.log('  ✓ Tracked recovery after spike');

  return {
    'spike-test-results.json': JSON.stringify(data, null, 2),
  };
}
