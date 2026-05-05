/**
 * Integration Test for Mobile Learning Features (Task 26.2)
 * Tests all four sub-tasks:
 * 1. Mobile-optimized video player with gesture controls
 * 2. Voice-to-text note-taking
 * 3. Mobile assignment submission with camera integration
 * 4. Mobile social learning and peer interaction
 */

const axios = require('axios');

const BASE_URL = process.env.MOBILE_API_URL || 'http://localhost:3012';
const TEST_USER_ID = 'test-user-123';
const TEST_TOKEN = 'test-jwt-token'; // In production, this would be a real JWT

// Test configuration
const config = {
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'x-device-id': 'test-device-001',
    'Content-Type': 'application/json'
  }
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealthCheck() {
  log('\n=== Testing Health Check ===', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    log(`✓ Health check passed: ${response.data.status}`, 'green');
    return true;
  } catch (error) {
    log(`✗ Health check failed: ${error.message}`, 'red');
    return false;
  }
}

async function testVideoPlayerFeatures() {
  log('\n=== Testing Video Player Features (Sub-task 1) ===', 'blue');
  let passed = 0;
  let failed = 0;

  // Test 1: Record gesture
  try {
    log('Testing gesture recording...', 'yellow');
    const gestureData = {
      videoId: 'video-123',
      gestureType: 'swipe_right',
      action: 'seek_forward',
      position: 120,
      metadata: { sensitivity: 'medium' }
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/video-player/gesture`,
      gestureData,
      config
    );
    
    if (response.data.success) {
      log('✓ Gesture recording works', 'green');
      passed++;
    } else {
      log('✗ Gesture recording failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Gesture recording error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 2: Save player state
  try {
    log('Testing player state save...', 'yellow');
    const stateData = {
      videoId: 'video-123',
      deviceId: 'test-device-001',
      position: 150,
      duration: 600,
      playbackSpeed: 1.5,
      volume: 0.8,
      quality: 'auto',
      isPlaying: true,
      isFullscreen: false
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/video-player/state`,
      stateData,
      config
    );
    
    if (response.data.success) {
      log('✓ Player state save works', 'green');
      passed++;
    } else {
      log('✗ Player state save failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Player state save error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 3: Get gesture settings
  try {
    log('Testing gesture settings retrieval...', 'yellow');
    const response = await axios.get(
      `${BASE_URL}/api/video-player/gesture-settings/test-device-001`,
      config
    );
    
    if (response.data.success) {
      log('✓ Gesture settings retrieval works', 'green');
      passed++;
    } else {
      log('✗ Gesture settings retrieval failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Gesture settings error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  log(`\nVideo Player Tests: ${passed} passed, ${failed} failed`, passed === 3 ? 'green' : 'yellow');
  return { passed, failed };
}

async function testVoiceNoteFeatures() {
  log('\n=== Testing Voice-to-Text Note-Taking (Sub-task 2) ===', 'blue');
  let passed = 0;
  let failed = 0;

  // Test 1: Create voice note with transcription
  try {
    log('Testing voice note creation...', 'yellow');
    const voiceNoteData = {
      audioData: Buffer.from('fake-audio-data').toString('base64'),
      audioFormat: 'mp3',
      language: 'en',
      courseId: 'course-123',
      lessonId: 'lesson-456',
      videoId: 'video-123',
      videoPosition: 180
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/voice-notes/transcribe`,
      voiceNoteData,
      config
    );
    
    if (response.data.success) {
      log('✓ Voice note creation works', 'green');
      passed++;
    } else {
      log('✗ Voice note creation failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Voice note creation error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 2: Create text note
  try {
    log('Testing text note creation...', 'yellow');
    const textNoteData = {
      courseId: 'course-123',
      lessonId: 'lesson-456',
      content: 'This is a test note',
      noteType: 'text',
      tags: ['important', 'review'],
      isBookmarked: true
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/voice-notes/text`,
      textNoteData,
      config
    );
    
    if (response.data.success) {
      log('✓ Text note creation works', 'green');
      passed++;
    } else {
      log('✗ Text note creation failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Text note creation error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 3: Get voice notes
  try {
    log('Testing voice notes retrieval...', 'yellow');
    const response = await axios.get(
      `${BASE_URL}/api/voice-notes?courseId=course-123`,
      config
    );
    
    if (response.data.success) {
      log('✓ Voice notes retrieval works', 'green');
      passed++;
    } else {
      log('✗ Voice notes retrieval failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Voice notes retrieval error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  log(`\nVoice Notes Tests: ${passed} passed, ${failed} failed`, passed === 3 ? 'green' : 'yellow');
  return { passed, failed };
}

async function testCameraAssignmentFeatures() {
  log('\n=== Testing Camera Assignment Submission (Sub-task 3) ===', 'blue');
  let passed = 0;
  let failed = 0;

  // Test 1: Upload camera capture
  try {
    log('Testing camera capture upload...', 'yellow');
    const captureData = {
      assignmentId: 'assignment-123',
      courseId: 'course-123',
      captureType: 'photo',
      fileData: Buffer.from('fake-image-data').toString('base64'),
      fileName: 'test-photo.jpg',
      mimeType: 'image/jpeg',
      metadata: { width: 1920, height: 1080 }
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/assignments/camera/upload`,
      captureData,
      config
    );
    
    if (response.data.success) {
      log('✓ Camera capture upload works', 'green');
      passed++;
    } else {
      log('✗ Camera capture upload failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Camera capture upload error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 2: Create assignment submission
  try {
    log('Testing assignment submission creation...', 'yellow');
    const submissionData = {
      assignmentId: 'assignment-123',
      courseId: 'course-123',
      submissionType: 'camera',
      captureIds: [],
      textContent: 'Test submission'
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/assignments/submit`,
      submissionData,
      config
    );
    
    if (response.data.success) {
      log('✓ Assignment submission creation works', 'green');
      passed++;
    } else {
      log('✗ Assignment submission creation failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Assignment submission error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 3: Get user submissions
  try {
    log('Testing submissions retrieval...', 'yellow');
    const response = await axios.get(
      `${BASE_URL}/api/assignments/submissions?courseId=course-123`,
      config
    );
    
    if (response.data.success) {
      log('✓ Submissions retrieval works', 'green');
      passed++;
    } else {
      log('✗ Submissions retrieval failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Submissions retrieval error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  log(`\nCamera Assignment Tests: ${passed} passed, ${failed} failed`, passed === 3 ? 'green' : 'yellow');
  return { passed, failed };
}

async function testSocialLearningFeatures() {
  log('\n=== Testing Social Learning Features (Sub-task 4) ===', 'blue');
  let passed = 0;
  let failed = 0;

  // Test 1: Create study group
  try {
    log('Testing study group creation...', 'yellow');
    const groupData = {
      name: 'Test Study Group',
      description: 'A test study group',
      courseId: 'course-123',
      maxMembers: 10,
      isPrivate: false,
      tags: ['javascript', 'react']
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/social/groups`,
      groupData,
      config
    );
    
    if (response.data.success) {
      log('✓ Study group creation works', 'green');
      passed++;
    } else {
      log('✗ Study group creation failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Study group creation error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 2: Create help request
  try {
    log('Testing help request creation...', 'yellow');
    const helpData = {
      courseId: 'course-123',
      lessonId: 'lesson-456',
      title: 'Need help with React hooks',
      description: 'I am confused about useEffect',
      tags: ['react', 'hooks'],
      priority: 'medium'
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/social/help`,
      helpData,
      config
    );
    
    if (response.data.success) {
      log('✓ Help request creation works', 'green');
      passed++;
    } else {
      log('✗ Help request creation failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Help request creation error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 3: Share resource
  try {
    log('Testing resource sharing...', 'yellow');
    const resourceData = {
      courseId: 'course-123',
      resourceType: 'link',
      title: 'Helpful React Tutorial',
      description: 'Great tutorial on React hooks',
      resourceUrl: 'https://example.com/tutorial',
      tags: ['react', 'tutorial']
    };
    
    const response = await axios.post(
      `${BASE_URL}/api/social/resources/share`,
      resourceData,
      config
    );
    
    if (response.data.success) {
      log('✓ Resource sharing works', 'green');
      passed++;
    } else {
      log('✗ Resource sharing failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Resource sharing error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  // Test 4: Get peer recommendations
  try {
    log('Testing peer recommendations...', 'yellow');
    const response = await axios.get(
      `${BASE_URL}/api/social/recommendations?courseId=course-123`,
      config
    );
    
    if (response.data.success) {
      log('✓ Peer recommendations work', 'green');
      passed++;
    } else {
      log('✗ Peer recommendations failed', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ Peer recommendations error: ${error.response?.data?.error || error.message}`, 'red');
    failed++;
  }

  log(`\nSocial Learning Tests: ${passed} passed, ${failed} failed`, passed === 4 ? 'green' : 'yellow');
  return { passed, failed };
}

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║  Mobile Learning Features Integration Test (Task 26.2)    ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  // Check if service is running
  const isHealthy = await testHealthCheck();
  if (!isHealthy) {
    log('\n⚠ Service is not running. Please start the mobile-api service first:', 'yellow');
    log('  cd backend/services/mobile-api && npm run dev', 'yellow');
    process.exit(1);
  }

  // Run all feature tests
  const results = {
    videoPlayer: await testVideoPlayerFeatures(),
    voiceNotes: await testVoiceNoteFeatures(),
    cameraAssignment: await testCameraAssignmentFeatures(),
    socialLearning: await testSocialLearningFeatures()
  };

  // Calculate totals
  const totalPassed = Object.values(results).reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
  const totalTests = totalPassed + totalFailed;

  // Print summary
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║                      Test Summary                          ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  log(`\nTotal Tests: ${totalTests}`, 'blue');
  log(`Passed: ${totalPassed}`, 'green');
  log(`Failed: ${totalFailed}`, totalFailed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%\n`, 
      totalFailed === 0 ? 'green' : 'yellow');

  // Feature breakdown
  log('Feature Breakdown:', 'blue');
  log(`  1. Video Player: ${results.videoPlayer.passed}/${results.videoPlayer.passed + results.videoPlayer.failed}`, 
      results.videoPlayer.failed === 0 ? 'green' : 'yellow');
  log(`  2. Voice Notes: ${results.voiceNotes.passed}/${results.voiceNotes.passed + results.voiceNotes.failed}`, 
      results.voiceNotes.failed === 0 ? 'green' : 'yellow');
  log(`  3. Camera Assignment: ${results.cameraAssignment.passed}/${results.cameraAssignment.passed + results.cameraAssignment.failed}`, 
      results.cameraAssignment.failed === 0 ? 'green' : 'yellow');
  log(`  4. Social Learning: ${results.socialLearning.passed}/${results.socialLearning.passed + results.socialLearning.failed}`, 
      results.socialLearning.failed === 0 ? 'green' : 'yellow');

  if (totalFailed === 0) {
    log('\n✅ All mobile learning features are working correctly!', 'green');
    log('Task 26.2 implementation is complete and verified.\n', 'green');
  } else {
    log('\n⚠ Some tests failed. Please review the errors above.', 'yellow');
    log('Note: Some failures may be due to missing authentication or database setup.\n', 'yellow');
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  log(`\n✗ Test execution failed: ${error.message}`, 'red');
  process.exit(1);
});
