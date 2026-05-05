#!/usr/bin/env node

/**
 * Service Startup Script
 * Starts all backend services for development and testing
 */

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Service configurations
const services = [
  {
    name: 'API Gateway',
    path: 'services/api-gateway',
    port: 3000,
    color: colors.blue,
    env: {
      PORT: '3000',
      NODE_ENV: 'development',
      USER_SERVICE_URL: 'http://localhost:3001',
      COURSE_SERVICE_URL: 'http://localhost:3002',
      PAYMENT_SERVICE_URL: 'http://localhost:3003',
      CONTACT_SERVICE_URL: 'http://localhost:3004',
      CONTENT_SERVICE_URL: 'http://localhost:3005',
      ANALYTICS_SERVICE_URL: 'http://localhost:3006',
      NOTIFICATION_SERVICE_URL: 'http://localhost:3007',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'development-jwt-secret-key'
    }
  },
  {
    name: 'User Management',
    path: 'services/user-management',
    port: 3001,
    color: colors.green,
    env: {
      PORT: '3001',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'development-jwt-secret-key'
    }
  },
  {
    name: 'Course Management',
    path: 'services/course-management',
    port: 3002,
    color: colors.yellow,
    env: {
      PORT: '3002',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev',
      REDIS_URL: 'redis://localhost:6379'
    }
  },
  {
    name: 'Payment Service',
    path: 'services/payment',
    port: 3003,
    color: colors.red,
    env: {
      PORT: '3003',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev',
      REDIS_URL: 'redis://localhost:6379',
      RAZORPAY_KEY_ID: 'test_key_id',
      RAZORPAY_KEY_SECRET: 'test_key_secret',
      STRIPE_SECRET_KEY: 'sk_test_...',
      STRIPE_WEBHOOK_SECRET: 'whsec_...'
    }
  },
  {
    name: 'Contact Service',
    path: 'services/contact',
    port: 3004,
    color: colors.magenta,
    env: {
      PORT: '3004',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:postgres123@localhost:5432/sai_mahendra_dev',
      REDIS_URL: 'redis://localhost:6379',
      SENDGRID_API_KEY: 'test_sendgrid_key',
      FROM_EMAIL: 'noreply@saimahendra.com',
      ADMIN_EMAIL: 'admin@saimahendra.com'
    }
  },
  {
    name: 'Content Management',
    path: 'services/content-management',
    port: 3005,
    color: colors.cyan,
    env: {
      PORT: '3005',
      NODE_ENV: 'development',
      MONGODB_URL: 'mongodb://admin:admin123@localhost:27017/sai_mahendra_content?authSource=admin',
      REDIS_URL: 'redis://localhost:6379'
    }
  },
  {
    name: 'Analytics Service',
    path: 'services/analytics',
    port: 3006,
    color: colors.blue,
    env: {
      PORT: '3006',
      NODE_ENV: 'development',
      MONGODB_URL: 'mongodb://admin:admin123@localhost:27017/sai_mahendra_analytics?authSource=admin',
      REDIS_URL: 'redis://localhost:6379'
    }
  },
  {
    name: 'Notification Service',
    path: 'services/notification',
    port: 3007,
    color: colors.green,
    env: {
      PORT: '3007',
      NODE_ENV: 'development',
      REDIS_URL: 'redis://localhost:6379',
      SENDGRID_API_KEY: 'test_sendgrid_key'
    }
  }
];

const processes = [];

function startService(service) {
  return new Promise((resolve, reject) => {
    const servicePath = path.join(__dirname, service.path);
    
    log(`Starting ${service.name} on port ${service.port}...`, service.color);
    
    const child = spawn('npm', ['run', 'dev'], {
      cwd: servicePath,
      env: { ...process.env, ...service.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let started = false;
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`${service.color}[${service.name}]${colors.reset} ${output.trim()}`);
      
      // Check if service has started successfully
      if (!started && (output.includes(`port ${service.port}`) || output.includes('started') || output.includes('running'))) {
        started = true;
        resolve(child);
      }
    });
    
    child.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`${colors.red}[${service.name} ERROR]${colors.reset} ${output.trim()}`);
    });
    
    child.on('error', (error) => {
      log(`Failed to start ${service.name}: ${error.message}`, colors.red);
      reject(error);
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        log(`${service.name} exited with code ${code}`, colors.red);
      }
    });
    
    processes.push({ name: service.name, process: child });
    
    // Timeout after 30 seconds if service doesn't start
    setTimeout(() => {
      if (!started) {
        log(`${service.name} startup timeout`, colors.red);
        resolve(child); // Still resolve to continue with other services
      }
    }, 30000);
  });
}

async function startAllServices() {
  log('🚀 Starting all backend services...\n', colors.blue);
  
  try {
    // Start services with a small delay between each
    for (const service of services) {
      await startService(service);
      // Small delay to prevent port conflicts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    log('\n✅ All services started successfully!', colors.green);
    log('\nService URLs:', colors.blue);
    services.forEach(service => {
      log(`  ${service.name}: http://localhost:${service.port}`, service.color);
    });
    
    log('\n📋 Available endpoints:', colors.blue);
    log('  API Gateway: http://localhost:3000/health');
    log('  Integration Test: node integration-test.js');
    log('\n⚠️  Press Ctrl+C to stop all services\n', colors.yellow);
    
  } catch (error) {
    log(`Failed to start services: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown() {
  log('\n🛑 Shutting down all services...', colors.yellow);
  
  processes.forEach(({ name, process }) => {
    log(`Stopping ${name}...`, colors.yellow);
    process.kill('SIGTERM');
  });
  
  setTimeout(() => {
    log('All services stopped.', colors.green);
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle script execution
if (require.main === module) {
  startAllServices().catch(error => {
    log(`Service startup failed: ${error.message}`, colors.red);
    process.exit(1);
  });
}

module.exports = {
  startAllServices,
  services
};