/**
 * Performance Test Configuration
 * 
 * Centralized configuration for all performance tests
 */

module.exports = {
  // Base URL for API requests
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  // Test users for authentication
  testUsers: [
    { email: 'test1@example.com', password: 'Test123!@#' },
    { email: 'test2@example.com', password: 'Test123!@#' },
    { email: 'test3@example.com', password: 'Test123!@#' },
    { email: 'test4@example.com', password: 'Test123!@#' },
    { email: 'test5@example.com', password: 'Test123!@#' },
  ],

  // Performance thresholds
  thresholds: {
    normalLoad: {
      p95ResponseTime: 200,  // ms
      p99ResponseTime: 500,  // ms
      errorRate: 0.01,       // 1%
      minThroughput: 50,     // requests/second
    },
    peakLoad: {
      p95ResponseTime: 500,  // ms
      p99ResponseTime: 1000, // ms
      errorRate: 0.01,       // 1%
      minThroughput: 200,    // requests/second
    },
    stressTest: {
      p95ResponseTime: 1000, // ms
      p99ResponseTime: 2000, // ms
      errorRate: 0.05,       // 5%
    },
    spikeTest: {
      p95ResponseTime: 2000, // ms
      errorRate: 0.10,       // 10%
    },
  },

  // Load test stages
  loadTestStages: {
    warmup: { duration: '2m', target: 100 },
    normalLoad: { duration: '5m', target: 100 },
    rampToMedium: { duration: '2m', target: 500 },
    mediumLoad: { duration: '5m', target: 500 },
    rampToPeak: { duration: '2m', target: 1000 },
    peakLoad: { duration: '5m', target: 1000 },
    cooldown: { duration: '3m', target: 0 },
  },

  // Stress test stages
  stressTestStages: {
    warmup: { duration: '2m', target: 100 },
    level1: { duration: '3m', target: 500 },
    level2: { duration: '3m', target: 1000 },
    level3: { duration: '3m', target: 1500 },
    level4: { duration: '3m', target: 2000 },
    stress: { duration: '5m', target: 2000 },
    cooldown: { duration: '3m', target: 0 },
  },

  // Spike test stages
  spikeTestStages: {
    normal: { duration: '1m', target: 100 },
    spike: { duration: '30s', target: 1500 },
    hold: { duration: '3m', target: 1500 },
    recovery: { duration: '30s', target: 100 },
    stabilize: { duration: '2m', target: 100 },
    cooldown: { duration: '30s', target: 0 },
  },

  // Soak test stages
  soakTestStages: {
    rampup: { duration: '5m', target: 500 },
    soak: { duration: '60m', target: 500 },
    cooldown: { duration: '5m', target: 0 },
  },

  // API endpoints to test
  endpoints: {
    health: '/health',
    login: '/api/auth/login',
    register: '/api/auth/register',
    profile: '/api/users/profile',
    programs: '/api/programs',
    enrollments: '/api/enrollments',
    payments: '/api/payments',
    content: '/api/content/testimonials',
    analytics: '/api/analytics/dashboard',
    notifications: '/api/notifications/preferences',
  },

  // Auto-scaling configuration
  autoScaling: {
    minReplicas: 2,
    maxReplicas: 10,
    cpuThreshold: 70,        // percentage
    memoryThreshold: 80,     // percentage
    scaleUpTime: 120,        // seconds
    scaleDownCooldown: 300,  // seconds
  },

  // Monitoring configuration
  monitoring: {
    grafanaUrl: process.env.GRAFANA_URL || 'http://localhost:3001',
    prometheusUrl: process.env.PROMETHEUS_URL || 'http://localhost:9090',
    alertmanagerUrl: process.env.ALERTMANAGER_URL || 'http://localhost:9093',
  },

  // Results configuration
  results: {
    directory: './results',
    format: 'json',
    includeTimestamp: true,
  },

  // Test execution settings
  execution: {
    cooldownBetweenTests: 30,  // seconds
    maxRetries: 3,
    retryDelay: 5,             // seconds
  },
};
