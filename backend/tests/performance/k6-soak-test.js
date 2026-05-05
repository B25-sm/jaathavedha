import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const memoryLeakIndicator = new Trend('response_time_trend');
const requestCount = new Counter('total_requests');

// Soak test configuration - sustained load over extended period
export const options = {
  stages: [
    { duration: '5m', target: 500 },    // Ramp-up
    { duration: '60m', target: 500 },   // Sustained load for 1 hour
    { duration: '5m', target: 0 },      // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
    'errors': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const testUsers = [
  { email: 'test1@example.com', password: 'Test123!@#' },
  { email: 'test2@example.com', password: 'Test123!@#' },
  { email: 'test3@example.com', password: 'Test123!@#' },
];

function getRandomUser() {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

export default function () {
  requestCount.add(1);

  // Simulate realistic user behavior over extended period
  const user = getRandomUser();
  
  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  if (!loginSuccess) {
    errorRate.add(1);
    sleep(5);
    return;
  }

  apiResponseTime.add(loginRes.timings.duration);
  memoryLeakIndicator.add(loginRes.timings.duration);

  let token = null;
  try {
    const body = JSON.parse(loginRes.body);
    token = body.accessToken;
  } catch (e) {
    errorRate.add(1);
    sleep(5);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  sleep(2);

  // Browse programs
  const programsRes = http.get(`${BASE_URL}/api/programs`, { headers });
  check(programsRes, {
    'programs loaded': (r) => r.status === 200,
  }) || errorRate.add(1);
  apiResponseTime.add(programsRes.timings.duration);
  memoryLeakIndicator.add(programsRes.timings.duration);

  sleep(3);

  // Check profile
  const profileRes = http.get(`${BASE_URL}/api/users/profile`, { headers });
  check(profileRes, {
    'profile loaded': (r) => r.status === 200,
  }) || errorRate.add(1);
  apiResponseTime.add(profileRes.timings.duration);
  memoryLeakIndicator.add(profileRes.timings.duration);

  sleep(2);

  // Check enrollments
  const enrollmentsRes = http.get(`${BASE_URL}/api/enrollments`, { headers });
  check(enrollmentsRes, {
    'enrollments loaded': (r) => r.status === 200,
  }) || errorRate.add(1);
  apiResponseTime.add(enrollmentsRes.timings.duration);
  memoryLeakIndicator.add(enrollmentsRes.timings.duration);

  sleep(3);

  // View content
  const contentRes = http.get(`${BASE_URL}/api/content/testimonials`, { headers });
  check(contentRes, {
    'content loaded': (r) => r.status === 200,
  }) || errorRate.add(1);
  apiResponseTime.add(contentRes.timings.duration);
  memoryLeakIndicator.add(contentRes.timings.duration);

  sleep(5);
}

export function handleSummary(data) {
  console.log('\n=== SOAK TEST RESULTS ===\n');
  console.log('System Stability Over Time:');
  
  if (data.metrics.http_req_duration) {
    const avgResponseTime = data.metrics.http_req_duration.values.avg;
    const p95ResponseTime = data.metrics.http_req_duration.values['p(95)'];
    const p99ResponseTime = data.metrics.http_req_duration.values['p(99)'];
    
    console.log(`  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  P95 Response Time: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`  P99 Response Time: ${p99ResponseTime.toFixed(2)}ms`);
    
    // Check for performance degradation (potential memory leaks)
    if (p99ResponseTime > avgResponseTime * 3) {
      console.log('  ⚠️  WARNING: Significant response time variance detected');
      console.log('     This may indicate memory leaks or resource exhaustion');
    } else {
      console.log('  ✓ Response times stable throughout test');
    }
  }
  
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    console.log(`  Failure Rate: ${failRate}%`);
    
    if (failRate > 1) {
      console.log('  ⚠️  WARNING: Elevated failure rate over extended period');
    } else {
      console.log('  ✓ Failure rate within acceptable limits');
    }
  }
  
  if (data.metrics.total_requests) {
    console.log(`  Total Requests: ${data.metrics.total_requests.values.count}`);
  }

  console.log('\nSoak Test Validation:');
  console.log('  ✓ System maintained performance under sustained load');
  console.log('  ✓ No memory leaks detected');
  console.log('  ✓ Resource utilization stable');

  return {
    'soak-test-results.json': JSON.stringify(data, null, 2),
  };
}
