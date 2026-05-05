/**
 * Simple test script to verify PWA service structure
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing PWA Service Structure...\n');

// Check required files
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  '.env.example',
  'Dockerfile.dev',
  'README.md',
  'API_REFERENCE.md',
  'TASK_15_1_COMPLETION_REPORT.md',
  'src/index.ts',
  'src/types/index.ts',
  'src/services/ServiceWorkerConfigService.ts',
  'src/services/OfflineSyncService.ts',
  'src/services/PushNotificationService.ts',
  'src/services/MobileOptimizationService.ts'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log('\n📦 Checking package.json dependencies...\n');

const packageJson = require('./package.json');
const requiredDeps = [
  'express',
  'cors',
  'helmet',
  'compression',
  'express-rate-limit',
  'winston',
  'redis',
  'pg',
  'web-push',
  'jsonwebtoken'
];

requiredDeps.forEach(dep => {
  const exists = packageJson.dependencies[dep];
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${dep}${exists ? ` (${exists})` : ''}`);
});

console.log('\n📝 Service Configuration:\n');
console.log(`Name: ${packageJson.name}`);
console.log(`Version: ${packageJson.version}`);
console.log(`Description: ${packageJson.description}`);

console.log('\n🎯 Available Scripts:\n');
Object.keys(packageJson.scripts).forEach(script => {
  console.log(`  ${script}: ${packageJson.scripts[script]}`);
});

if (allFilesExist) {
  console.log('\n✅ All required files are present!');
  console.log('\n📋 Next Steps:');
  console.log('  1. Install dependencies: npm install');
  console.log('  2. Generate VAPID keys: npx web-push generate-vapid-keys');
  console.log('  3. Configure .env file with VAPID keys and database credentials');
  console.log('  4. Run database migrations');
  console.log('  5. Start service: npm run dev');
} else {
  console.log('\n❌ Some required files are missing!');
  process.exit(1);
}

console.log('\n✨ PWA Service structure validation complete!\n');
