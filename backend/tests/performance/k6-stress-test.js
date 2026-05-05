import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');

// Stress test configuration - progressively increase load to find breaking point
export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Warm-up
    { duration: '3m', target: 500 },    // Ramp to 500
    { duration: '3m', target: 1000 },   // Ramp to 1000
    { duration: '3m', target: 1500 },   // Ramp to 1500
    { duration: '3m', target: 2000 },   // Ramp to 2000 (stress)
    { duration: '5m', target: 2000 },   // Hold at 2000
    { duration: '3m', target: 0 },      // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // More lenient for stress test
    'http_req_failed': ['rate<0.05'],    // Allow up to 5% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simplified stress test - focus on core endpoints
  const endpoints = [
    '/health',
    '/api/programs',
    '/api/content/testimonials',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);

  const success = check(res, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
    'response time recorded': (r) => {
      apiResponseTime.add(r.timings.duration);
      return true;
    },
  });

  if (!success || res.status !== 200) {
    errorRate.add(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  console.log('\n=== STRESS TEST RESULTS ===\n');
  console.log('Breaking Point Analysis:');
  
  if (data.metrics.http_req_duration) {
    console.log(`  P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
    console.log(`  P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
    console.log(`  Max Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  }
  
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    console.log(`  Failure Rate: ${failRate}%`);
  }
  
  if (data.metrics.http_reqs) {
    console.log(`  Total Requests: ${data.metrics.http_reqs.values.count}`);
    console.log(`  Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s`);
  }

  return {
    'stress-test-results.json': JSON.stringify(data, null, 2),
  };
}
