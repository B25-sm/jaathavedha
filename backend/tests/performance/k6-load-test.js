import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp-up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 500 },   // Ramp-up to 500 users
    { duration: '5m', target: 500 },   // Stay at 500 users
    { duration: '2m', target: 1000 },  // Ramp-up to 1000 users
    { duration: '5m', target: 1000 },  // Stay at 1000 users
    { duration: '3m', target: 0 },     // Ramp-down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms
    'http_req_failed': ['rate<0.01'],                  // Error rate under 1%
    'errors': ['rate<0.01'],
    'api_response_time': ['p(95)<500'],
  },
};

// Base URL - can be overridden via environment variable
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'Test123!@#' },
  { email: 'test2@example.com', password: 'Test123!@#' },
  { email: 'test3@example.com', password: 'Test123!@#' },
];

// Helper function to get random test user
function getRandomUser() {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

// Helper function to authenticate and get token
function authenticate() {
  const user = getRandomUser();
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return body.accessToken;
  }
  return null;
}

export default function () {
  // Test 1: Health Check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Authentication
  const user = getRandomUser();
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 200ms': (r) => r.timings.duration < 200,
    'login returns token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.accessToken !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (loginSuccess) {
    successfulRequests.add(1);
    apiResponseTime.add(loginRes.timings.duration);
  } else {
    errorRate.add(1);
    failedRequests.add(1);
  }

  let token = null;
  if (loginRes.status === 200) {
    try {
      const body = JSON.parse(loginRes.body);
      token = body.accessToken;
    } catch (e) {
      console.error('Failed to parse login response');
    }
  }

  sleep(1);

  if (token) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Test 3: Get Programs
    const programsRes = http.get(`${BASE_URL}/api/programs`, { headers });
    const programsSuccess = check(programsRes, {
      'programs status is 200': (r) => r.status === 200,
      'programs response time < 200ms': (r) => r.timings.duration < 200,
      'programs returns array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body);
        } catch (e) {
          return false;
        }
      },
    });

    if (programsSuccess) {
      successfulRequests.add(1);
      apiResponseTime.add(programsRes.timings.duration);
    } else {
      errorRate.add(1);
      failedRequests.add(1);
    }

    sleep(1);

    // Test 4: Get User Profile
    const profileRes = http.get(`${BASE_URL}/api/users/profile`, { headers });
    const profileSuccess = check(profileRes, {
      'profile status is 200': (r) => r.status === 200,
      'profile response time < 200ms': (r) => r.timings.duration < 200,
      'profile returns user data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.email !== undefined;
        } catch (e) {
          return false;
        }
      },
    });

    if (profileSuccess) {
      successfulRequests.add(1);
      apiResponseTime.add(profileRes.timings.duration);
    } else {
      errorRate.add(1);
      failedRequests.add(1);
    }

    sleep(1);

    // Test 5: Get Enrollments
    const enrollmentsRes = http.get(`${BASE_URL}/api/enrollments`, { headers });
    const enrollmentsSuccess = check(enrollmentsRes, {
      'enrollments status is 200': (r) => r.status === 200,
      'enrollments response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (enrollmentsSuccess) {
      successfulRequests.add(1);
      apiResponseTime.add(enrollmentsRes.timings.duration);
    } else {
      errorRate.add(1);
      failedRequests.add(1);
    }

    sleep(1);

    // Test 6: Get Analytics Dashboard (if admin)
    const analyticsRes = http.get(`${BASE_URL}/api/analytics/dashboard`, { headers });
    check(analyticsRes, {
      'analytics response received': (r) => r.status === 200 || r.status === 403,
    });

    sleep(1);

    // Test 7: Get Content
    const contentRes = http.get(`${BASE_URL}/api/content/testimonials`, { headers });
    const contentSuccess = check(contentRes, {
      'content status is 200': (r) => r.status === 200,
      'content response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (contentSuccess) {
      successfulRequests.add(1);
      apiResponseTime.add(contentRes.timings.duration);
    } else {
      errorRate.add(1);
      failedRequests.add(1);
    }
  }

  sleep(2);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n';
  summary += `${indent}Test Summary\n`;
  summary += `${indent}============\n\n`;

  // Metrics
  if (data.metrics) {
    summary += `${indent}Metrics:\n`;
    
    if (data.metrics.http_req_duration) {
      summary += `${indent}  HTTP Request Duration:\n`;
      summary += `${indent}    avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
      summary += `${indent}    min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms\n`;
      summary += `${indent}    max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
      summary += `${indent}    p(95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
      summary += `${indent}    p(99): ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
    }

    if (data.metrics.http_reqs) {
      summary += `${indent}  HTTP Requests:\n`;
      summary += `${indent}    total: ${data.metrics.http_reqs.values.count}\n`;
      summary += `${indent}    rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
    }

    if (data.metrics.http_req_failed) {
      const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
      summary += `${indent}  HTTP Request Failed:\n`;
      summary += `${indent}    rate: ${failRate}%\n`;
    }

    if (data.metrics.errors) {
      const errorRateValue = (data.metrics.errors.values.rate * 100).toFixed(2);
      summary += `${indent}  Error Rate: ${errorRateValue}%\n`;
    }

    if (data.metrics.successful_requests) {
      summary += `${indent}  Successful Requests: ${data.metrics.successful_requests.values.count}\n`;
    }

    if (data.metrics.failed_requests) {
      summary += `${indent}  Failed Requests: ${data.metrics.failed_requests.values.count}\n`;
    }
  }

  summary += '\n';
  return summary;
}
