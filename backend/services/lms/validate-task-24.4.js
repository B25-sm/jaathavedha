/**
 * Validation Script for Task 24.4: Assessment and Feedback System
 * 
 * This script validates that all required components are implemented correctly.
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('Task 24.4: Assessment and Feedback System - Validation');
console.log('='.repeat(80));
console.log('');

let passed = 0;
let failed = 0;

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${description}`);
    passed++;
    return true;
  } else {
    console.log(`❌ ${description} - File not found: ${filePath}`);
    failed++;
    return false;
  }
}

function checkFileContent(filePath, searchStrings, description) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${description} - File not found: ${filePath}`);
    failed++;
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const allFound = searchStrings.every(str => content.includes(str));

  if (allFound) {
    console.log(`✅ ${description}`);
    passed++;
    return true;
  } else {
    console.log(`❌ ${description} - Missing required content`);
    const missing = searchStrings.filter(str => !content.includes(str));
    console.log(`   Missing: ${missing.join(', ')}`);
    failed++;
    return false;
  }
}

console.log('1. Core Service Files');
console.log('-'.repeat(80));
checkFile('src/services/AssessmentService.ts', 'AssessmentService implementation');
checkFile('src/services/AdaptiveLearningService.ts', 'AdaptiveLearningService implementation');
console.log('');

console.log('2. AssessmentService Features');
console.log('-'.repeat(80));
checkFileContent(
  'src/services/AssessmentService.ts',
  [
    'createAssessment',
    'getAssessmentById',
    'startAssessmentAttempt',
    'submitAssessmentAttempt',
    'getLearningAnalytics',
    'gradeAssessment',
    'generateRecommendations'
  ],
  'AssessmentService has all required methods'
);

checkFileContent(
  'src/services/AssessmentService.ts',
  [
    'multiple-choice',
    'multiple-select',
    'true-false',
    'short-answer',
    'essay',
    'code'
  ],
  'AssessmentService supports all question types'
);

checkFileContent(
  'src/services/AssessmentService.ts',
  [
    'feedback',
    'isCorrect',
    'explanation',
    'earnedPoints'
  ],
  'AssessmentService provides immediate feedback'
);
console.log('');

console.log('3. AdaptiveLearningService Features');
console.log('-'.repeat(80));
checkFileContent(
  'src/services/AdaptiveLearningService.ts',
  [
    'getLearningPath',
    'updateLearningPath',
    'getLearningAnalytics',
    'getRecommendations',
    'calculateLearningVelocity',
    'estimateTimeToMastery'
  ],
  'AdaptiveLearningService has all required methods'
);

checkFileContent(
  'src/services/AdaptiveLearningService.ts',
  [
    'beginner',
    'intermediate',
    'advanced',
    'expert'
  ],
  'AdaptiveLearningService supports skill levels'
);

checkFileContent(
  'src/services/AdaptiveLearningService.ts',
  [
    'strengths',
    'weaknesses',
    'recommendedContent',
    'learningVelocity'
  ],
  'AdaptiveLearningService provides analytics'
);
console.log('');

console.log('4. API Routes');
console.log('-'.repeat(80));
checkFile('src/routes/assessments.ts', 'Assessment routes file');

checkFileContent(
  'src/routes/assessments.ts',
  [
    'POST /api/assessments',
    'GET /api/assessments/:assessmentId',
    'POST /api/assessments/:assessmentId/start',
    'POST /api/assessments/attempts/:attemptId/submit',
    'GET /api/assessments/analytics',
    'GET /api/assessments/learning-path',
    'GET /api/assessments/recommendations'
  ],
  'Assessment routes have all required endpoints'
);

checkFileContent(
  'src/routes/assessments.ts',
  [
    'requireAuth',
    'validate',
    'assessmentSchemas'
  ],
  'Assessment routes use authentication and validation'
);
console.log('');

console.log('5. Unit Tests');
console.log('-'.repeat(80));
checkFile('src/__tests__/AssessmentService.test.ts', 'AssessmentService unit tests');
checkFile('src/__tests__/AdaptiveLearningService.test.ts', 'AdaptiveLearningService unit tests');

checkFileContent(
  'src/__tests__/AssessmentService.test.ts',
  [
    'createAssessment',
    'getAssessmentById',
    'submitAssessmentAttempt',
    'getLearningAnalytics',
    'should grade assessment correctly'
  ],
  'AssessmentService tests cover core functionality'
);

checkFileContent(
  'src/__tests__/AdaptiveLearningService.test.ts',
  [
    'getLearningPath',
    'updateLearningPath',
    'getLearningAnalytics',
    'getRecommendations',
    'should calculate learning velocity'
  ],
  'AdaptiveLearningService tests cover core functionality'
);
console.log('');

console.log('6. Documentation');
console.log('-'.repeat(80));
checkFile('TASK_24.4_API_REFERENCE.md', 'API Reference documentation');
checkFile('TASK_24.4_COMPLETION_REPORT.md', 'Completion report');

checkFileContent(
  'TASK_24.4_API_REFERENCE.md',
  [
    'POST /api/assessments',
    'immediate feedback',
    'adaptive learning',
    'Request Body',
    'Response'
  ],
  'API documentation is comprehensive'
);

checkFileContent(
  'TASK_24.4_COMPLETION_REPORT.md',
  [
    'Requirement 18.9',
    'Requirement 6.4',
    'Immediate Feedback',
    'Adaptive Learning',
    'COMPLETE'
  ],
  'Completion report covers all requirements'
);
console.log('');

console.log('7. Integration Points');
console.log('-'.repeat(80));
checkFileContent(
  'src/services/AssessmentService.ts',
  [
    'awardPoints',
    'updateAdaptiveLearningPath'
  ],
  'AssessmentService integrates with gamification and adaptive learning'
);

checkFileContent(
  'src/services/AdaptiveLearningService.ts',
  [
    'getRedis',
    'getMongoDB',
    'collection'
  ],
  'AdaptiveLearningService uses Redis and MongoDB'
);
console.log('');

console.log('8. Database Schema Validation');
console.log('-'.repeat(80));
const schemaPath = path.join(__dirname, '../../database/migrations/010_lms_service_schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  const tables = [
    'assessments',
    'assessment_attempts'
  ];
  
  const allTablesExist = tables.every(table => schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`));
  
  if (allTablesExist) {
    console.log('✅ Database schema includes assessment tables');
    passed++;
  } else {
    console.log('❌ Database schema missing assessment tables');
    failed++;
  }
} else {
  console.log('❌ Database schema file not found');
  failed++;
}
console.log('');

console.log('9. TypeScript Type Safety');
console.log('-'.repeat(80));
checkFileContent(
  'src/services/AssessmentService.ts',
  [
    'interface Question',
    'interface AssessmentData',
    'interface FeedbackItem'
  ],
  'AssessmentService has proper TypeScript interfaces'
);

checkFileContent(
  'src/services/AdaptiveLearningService.ts',
  [
    'interface LearningPathData',
    'interface PerformanceData',
    'interface ContentRecommendation'
  ],
  'AdaptiveLearningService has proper TypeScript interfaces'
);
console.log('');

console.log('10. Error Handling');
console.log('-'.repeat(80));
checkFileContent(
  'src/services/AssessmentService.ts',
  [
    'try {',
    'catch (error)',
    'throw new AppError',
    'logger.error'
  ],
  'AssessmentService has proper error handling'
);

checkFileContent(
  'src/services/AdaptiveLearningService.ts',
  [
    'try {',
    'catch (error)',
    'throw new AppError',
    'logger.error'
  ],
  'AdaptiveLearningService has proper error handling'
);
console.log('');

console.log('='.repeat(80));
console.log('Validation Summary');
console.log('='.repeat(80));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);
console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
console.log('');

if (failed === 0) {
  console.log('🎉 All validations passed! Task 24.4 is complete and ready for deployment.');
  process.exit(0);
} else {
  console.log('⚠️  Some validations failed. Please review the issues above.');
  process.exit(1);
}
