#!/usr/bin/env node

/**
 * Setup Test Data for Performance Tests
 * 
 * Creates test users and sample data needed for performance testing
 */

const axios = require('axios');
const config = require('./config');

const BASE_URL = config.baseUrl;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkServiceHealth() {
  log('\nChecking service health...', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    if (response.status === 200) {
      log('✓ Services are healthy', 'green');
      return true;
    }
  } catch (error) {
    log('✗ Services are not responding', 'red');
    log('Please start services: cd backend && npm run start:services', 'yellow');
    return false;
  }
}

async function createTestUser(user) {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/register`, {
      email: user.email,
      password: user.password,
      firstName: user.email.split('@')[0],
      lastName: 'TestUser',
      phone: '+1234567890',
    });

    if (response.status === 201 || response.status === 200) {
      log(`  ✓ Created user: ${user.email}`, 'green');
      return true;
    }
  } catch (error) {
    if (error.response && error.response.status === 409) {
      log(`  ℹ User already exists: ${user.email}`, 'yellow');
      return true;
    } else {
      log(`  ✗ Failed to create user: ${user.email}`, 'red');
      if (error.response) {
        log(`    Error: ${error.response.data.message || error.message}`, 'red');
      }
      return false;
    }
  }
}

async function verifyUserLogin(user) {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: user.email,
      password: user.password,
    });

    if (response.status === 200 && response.data.accessToken) {
      log(`  ✓ Login verified: ${user.email}`, 'green');
      return response.data.accessToken;
    }
  } catch (error) {
    log(`  ✗ Login failed: ${user.email}`, 'red');
    return null;
  }
}

async function createSamplePrograms(token) {
  const programs = [
    {
      name: 'AI Fundamentals',
      description: 'Introduction to Artificial Intelligence',
      category: 'starter',
      price: 999,
      durationWeeks: 8,
      features: ['Video lectures', 'Assignments', 'Certificate'],
    },
    {
      name: 'Full Stack Development',
      description: 'Complete full stack development course',
      category: 'accelerator',
      price: 2999,
      durationWeeks: 16,
      features: ['Live sessions', 'Projects', 'Mentorship'],
    },
    {
      name: 'Pro Developer Program',
      description: 'Advanced development program',
      category: 'pro_developer',
      price: 4999,
      durationWeeks: 24,
      features: ['1-on-1 mentoring', 'Job assistance', 'Lifetime access'],
    },
  ];

  log('\nCreating sample programs...', 'blue');

  for (const program of programs) {
    try {
      await axios.post(`${BASE_URL}/api/programs`, program, {
        headers: { Authorization: `Bearer ${token}` },
      });
      log(`  ✓ Created program: ${program.name}`, 'green');
    } catch (error) {
      if (error.response && error.response.status === 409) {
        log(`  ℹ Program already exists: ${program.name}`, 'yellow');
      } else {
        log(`  ✗ Failed to create program: ${program.name}`, 'red');
      }
    }
  }
}

async function main() {
  log('='.repeat(50), 'blue');
  log('Performance Test Data Setup', 'blue');
  log('='.repeat(50), 'blue');

  // Check service health
  const isHealthy = await checkServiceHealth();
  if (!isHealthy) {
    process.exit(1);
  }

  // Create test users
  log('\nCreating test users...', 'blue');
  let successCount = 0;
  
  for (const user of config.testUsers) {
    const created = await createTestUser(user);
    if (created) successCount++;
  }

  log(`\nCreated/verified ${successCount}/${config.testUsers.length} test users`, 'blue');

  // Verify logins
  log('\nVerifying user logins...', 'blue');
  let loginCount = 0;
  let adminToken = null;

  for (const user of config.testUsers) {
    const token = await verifyUserLogin(user);
    if (token) {
      loginCount++;
      if (!adminToken) adminToken = token;
    }
  }

  log(`\nVerified ${loginCount}/${config.testUsers.length} user logins`, 'blue');

  // Create sample programs (if we have a token)
  if (adminToken) {
    await createSamplePrograms(adminToken);
  }

  // Summary
  log('\n' + '='.repeat(50), 'blue');
  log('Setup Summary', 'blue');
  log('='.repeat(50), 'blue');
  log(`Test Users: ${successCount}/${config.testUsers.length}`, 'green');
  log(`Login Verification: ${loginCount}/${config.testUsers.length}`, 'green');
  
  if (successCount === config.testUsers.length && loginCount === config.testUsers.length) {
    log('\n✓ Test data setup completed successfully!', 'green');
    log('\nYou can now run performance tests:', 'blue');
    log('  ./run-load-tests.sh', 'yellow');
    process.exit(0);
  } else {
    log('\n⚠ Test data setup completed with warnings', 'yellow');
    log('Some users may not be available for testing', 'yellow');
    process.exit(0);
  }
}

// Run setup
if (require.main === module) {
  main().catch(error => {
    log('\n✗ Setup failed with error:', 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createTestUser, verifyUserLogin, createSamplePrograms };
