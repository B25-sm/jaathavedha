#!/usr/bin/env node

/**
 * Test Setup Validation Script
 * Validates that all prerequisites are met for running mobile integration tests
 */

const { createClient } = require('redis');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function warning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function info(message) {
  log(`ℹ ${message}`, colors.cyan);
}

async function validateRedis() {
  info('Checking Redis connection...');
  
  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    
    if (pong === 'PONG') {
      success('Redis is running and accessible');
      return true;
    } else {
      error('Redis ping failed');
      return false;
    }
  } catch (err) {
    error(`Redis connection failed: ${err.message}`);
    warning('Start Redis with: docker run -d -p 6379:6379 redis:7-alpine');
    return false;
  }
}

async function validatePostgreSQL() {
  info('Checking PostgreSQL connection...');
  
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db'
    });
    
    const result = await pool.query('SELECT version()');
    await pool.end();
    
    success('PostgreSQL is running and accessible');
    info(`  Version: ${result.rows[0].version.split(',')[0]}`);
    return true;
  } catch (err) {
    error(`PostgreSQL connection failed: ${err.message}`);
    warning('Start PostgreSQL with: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test_db postgres:15-alpine');
    return false;
  }
}

async function validateDatabaseTables() {
  info('Checking database tables...');
  
  const requiredTables = [
    'push_subscriptions',
    'sync_requests',
    'user_progress',
    'video_analytics',
    'video_notes',
    'video_bookmarks',
    'quiz_responses',
    'offline_data_cache',
    'background_sync_tasks',
    'pwa_analytics_events'
  ];
  
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db'
    });
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    await pool.end();
    
    const existingTables = result.rows.map(row => row.table_name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length === 0) {
      success('All required database tables exist');
      return true;
    } else {
      error(`Missing database tables: ${missingTables.join(', ')}`);
      warning('Run migrations with: cd backend/database && npm run migrate');
      return false;
    }
  } catch (err) {
    error(`Database table check failed: ${err.message}`);
    return false;
  }
}

function validateNodeVersion() {
  info('Checking Node.js version...');
  
  const version = process.version;
  const majorVersion = parseInt(version.split('.')[0].substring(1));
  
  if (majorVersion >= 18) {
    success(`Node.js version ${version} is compatible`);
    return true;
  } else {
    error(`Node.js version ${version} is too old. Requires v18 or higher`);
    return false;
  }
}

function validateTestFiles() {
  info('Checking test files...');
  
  const testFiles = [
    'src/__tests__/setup.ts',
    'src/__tests__/pwa-functionality.integration.test.ts',
    'src/__tests__/push-notification.integration.test.ts',
    'jest.config.js'
  ];
  
  let allExist = true;
  
  for (const file of testFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      success(`  ${file}`);
    } else {
      error(`  ${file} - NOT FOUND`);
      allExist = false;
    }
  }
  
  return allExist;
}

function validateEnvironmentVariables() {
  info('Checking environment variables...');
  
  const requiredVars = [
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT'
  ];
  
  const optionalVars = [
    'REDIS_URL',
    'DATABASE_URL',
    'JWT_SECRET',
    'NODE_ENV'
  ];
  
  let allRequired = true;
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      success(`  ${varName} is set`);
    } else {
      error(`  ${varName} is NOT set`);
      allRequired = false;
    }
  }
  
  for (const varName of optionalVars) {
    if (process.env[varName]) {
      success(`  ${varName} is set`);
    } else {
      warning(`  ${varName} is not set (will use default)`);
    }
  }
  
  if (!allRequired) {
    warning('Generate VAPID keys with: npx web-push generate-vapid-keys');
  }
  
  return allRequired;
}

function validateDependencies() {
  info('Checking dependencies...');
  
  const packageJsonPath = path.join(__dirname, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    error('package.json not found');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const requiredDeps = [
    'jest',
    'ts-jest',
    '@types/jest',
    'redis',
    'pg',
    'web-push'
  ];
  
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  let allInstalled = true;
  
  for (const dep of requiredDeps) {
    if (allDeps[dep]) {
      success(`  ${dep} v${allDeps[dep]}`);
    } else {
      error(`  ${dep} is NOT installed`);
      allInstalled = false;
    }
  }
  
  if (!allInstalled) {
    warning('Install dependencies with: npm install');
  }
  
  return allInstalled;
}

async function main() {
  log('\n=== Mobile Integration Tests - Setup Validation ===\n', colors.blue);
  
  const checks = [
    { name: 'Node.js Version', fn: validateNodeVersion },
    { name: 'Test Files', fn: validateTestFiles },
    { name: 'Dependencies', fn: validateDependencies },
    { name: 'Environment Variables', fn: validateEnvironmentVariables },
    { name: 'Redis Connection', fn: validateRedis },
    { name: 'PostgreSQL Connection', fn: validatePostgreSQL },
    { name: 'Database Tables', fn: validateDatabaseTables }
  ];
  
  const results = [];
  
  for (const check of checks) {
    log(`\n--- ${check.name} ---`, colors.yellow);
    try {
      const result = await check.fn();
      results.push({ name: check.name, passed: result });
    } catch (err) {
      error(`Unexpected error: ${err.message}`);
      results.push({ name: check.name, passed: false });
    }
  }
  
  // Summary
  log('\n=== Validation Summary ===\n', colors.blue);
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    if (result.passed) {
      success(`${result.name}: PASSED`);
    } else {
      error(`${result.name}: FAILED`);
    }
  });
  
  log(`\nTotal: ${passed}/${total} checks passed\n`, colors.cyan);
  
  if (passed === total) {
    success('✓ All checks passed! You can run the tests now.');
    info('\nRun tests with: npm test');
    process.exit(0);
  } else {
    error('✗ Some checks failed. Please fix the issues above before running tests.');
    info('\nRefer to TEST_GUIDE.md for detailed setup instructions.');
    process.exit(1);
  }
}

// Run validation
main().catch(err => {
  error(`Validation script failed: ${err.message}`);
  process.exit(1);
});
