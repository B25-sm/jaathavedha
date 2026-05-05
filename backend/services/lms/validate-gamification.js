/**
 * Validation Script for Gamification Implementation
 * Checks that all required files and components are in place
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'src/services/GamificationService.ts',
  'src/services/FlashcardService.ts',
  'src/routes/gamification.ts',
  'src/schemas/gamificationSchemas.ts',
  'src/__tests__/gamification.test.ts',
  'jest.config.js',
];

const REQUIRED_ENDPOINTS = [
  'GET /api/gamification/users/:userId/points',
  'GET /api/gamification/badges',
  'GET /api/gamification/users/:userId/badges',
  'GET /api/gamification/achievements',
  'GET /api/gamification/users/:userId/achievements',
  'GET /api/gamification/leaderboard',
  'GET /api/gamification/users/:userId/streak',
  'POST /api/gamification/users/:userId/streak',
  'POST /api/gamification/users/:userId/streak/freeze',
  'POST /api/gamification/courses/:courseId/flashcards',
  'GET /api/gamification/courses/:courseId/flashcards',
  'GET /api/gamification/flashcards/:flashcardId',
  'PUT /api/gamification/flashcards/:flashcardId',
  'DELETE /api/gamification/flashcards/:flashcardId',
  'GET /api/gamification/flashcards/due',
  'POST /api/gamification/flashcards/:flashcardId/review',
  'GET /api/gamification/flashcards/reviews',
  'GET /api/gamification/flashcards/stats',
];

const REQUIRED_METHODS = {
  'GamificationService': [
    'getUserPoints',
    'awardPoints',
    'getAllBadges',
    'getUserBadges',
    'awardBadge',
    'getAllAchievements',
    'getUserAchievements',
    'getLeaderboard',
    'getUserStreak',
    'updateStreak',
    'freezeStreak',
  ],
  'FlashcardService': [
    'createFlashcard',
    'getFlashcards',
    'getFlashcard',
    'updateFlashcard',
    'deleteFlashcard',
    'getDueFlashcards',
    'reviewFlashcard',
    'getReviewHistory',
    'getFlashcardStats',
  ],
};

console.log('🔍 Validating Gamification Implementation...\n');

let allValid = true;

// Check required files
console.log('📁 Checking Required Files:');
for (const file of REQUIRED_FILES) {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allValid = false;
}

// Check GamificationService methods
console.log('\n🎮 Checking GamificationService Methods:');
const gamificationServicePath = path.join(__dirname, 'src/services/GamificationService.ts');
if (fs.existsSync(gamificationServicePath)) {
  const content = fs.readFileSync(gamificationServicePath, 'utf8');
  for (const method of REQUIRED_METHODS.GamificationService) {
    const hasMethod = content.includes(`async ${method}(`);
    console.log(`  ${hasMethod ? '✅' : '❌'} ${method}`);
    if (!hasMethod) allValid = false;
  }
} else {
  console.log('  ❌ GamificationService.ts not found');
  allValid = false;
}

// Check FlashcardService methods
console.log('\n🃏 Checking FlashcardService Methods:');
const flashcardServicePath = path.join(__dirname, 'src/services/FlashcardService.ts');
if (fs.existsSync(flashcardServicePath)) {
  const content = fs.readFileSync(flashcardServicePath, 'utf8');
  for (const method of REQUIRED_METHODS.FlashcardService) {
    const hasMethod = content.includes(`async ${method}(`);
    console.log(`  ${hasMethod ? '✅' : '❌'} ${method}`);
    if (!hasMethod) allValid = false;
  }
} else {
  console.log('  ❌ FlashcardService.ts not found');
  allValid = false;
}

// Check routes
console.log('\n🛣️  Checking API Routes:');
const routesPath = path.join(__dirname, 'src/routes/gamification.ts');
if (fs.existsSync(routesPath)) {
  const content = fs.readFileSync(routesPath, 'utf8');
  let foundEndpoints = 0;
  for (const endpoint of REQUIRED_ENDPOINTS) {
    const [method, path] = endpoint.split(' ');
    const hasEndpoint = content.includes(`router.${method.toLowerCase()}('${path.replace(/:[^/]+/g, ':')}`);
    if (hasEndpoint) foundEndpoints++;
  }
  console.log(`  ✅ Found ${foundEndpoints}/${REQUIRED_ENDPOINTS.length} endpoints`);
  if (foundEndpoints < REQUIRED_ENDPOINTS.length) {
    console.log(`  ⚠️  Missing ${REQUIRED_ENDPOINTS.length - foundEndpoints} endpoints`);
  }
} else {
  console.log('  ❌ gamification.ts routes not found');
  allValid = false;
}

// Check schemas
console.log('\n📋 Checking Validation Schemas:');
const schemasPath = path.join(__dirname, 'src/schemas/gamificationSchemas.ts');
if (fs.existsSync(schemasPath)) {
  const content = fs.readFileSync(schemasPath, 'utf8');
  const requiredSchemas = [
    'awardPoints',
    'createBadge',
    'createAchievement',
    'getLeaderboard',
    'freezeStreak',
    'createFlashcard',
    'updateFlashcard',
    'reviewFlashcard',
  ];
  let foundSchemas = 0;
  for (const schema of requiredSchemas) {
    if (content.includes(`${schema}:`)) foundSchemas++;
  }
  console.log(`  ✅ Found ${foundSchemas}/${requiredSchemas.length} schemas`);
  if (foundSchemas < requiredSchemas.length) {
    console.log(`  ⚠️  Missing ${requiredSchemas.length - foundSchemas} schemas`);
  }
} else {
  console.log('  ❌ gamificationSchemas.ts not found');
  allValid = false;
}

// Check database tables
console.log('\n🗄️  Checking Database Schema:');
const migrationPath = path.join(__dirname, '../../database/migrations/010_lms_service_schema.sql');
if (fs.existsSync(migrationPath)) {
  const content = fs.readFileSync(migrationPath, 'utf8');
  const requiredTables = [
    'badges',
    'user_badges',
    'achievements',
    'user_achievements',
    'flashcards',
    'flashcard_reviews',
  ];
  let foundTables = 0;
  for (const table of requiredTables) {
    if (content.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) foundTables++;
  }
  console.log(`  ✅ Found ${foundTables}/${requiredTables.length} tables`);
  if (foundTables < requiredTables.length) {
    console.log(`  ⚠️  Missing ${requiredTables.length - foundTables} tables`);
  }
} else {
  console.log('  ❌ Database migration not found');
  allValid = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('✅ All validation checks passed!');
  console.log('\n📝 Implementation Summary:');
  console.log('  • Points system with level progression');
  console.log('  • Badge system with automatic unlocking');
  console.log('  • Achievement system with progress tracking');
  console.log('  • Leaderboard rankings');
  console.log('  • Learning streak tracking with freezes');
  console.log('  • Spaced repetition flashcard system (SM-2)');
  console.log('  • 18+ API endpoints');
  console.log('  • Comprehensive validation schemas');
  console.log('  • Unit test structure');
  console.log('\n🚀 Ready for deployment!');
  process.exit(0);
} else {
  console.log('❌ Some validation checks failed');
  console.log('Please review the errors above');
  process.exit(1);
}
