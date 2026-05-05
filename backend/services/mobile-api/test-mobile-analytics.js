/**
 * Mobile Analytics and Progress Tracking Integration Test
 * Tests Task 26.3 implementation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3012';
const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_DEVICE_ID = 'test-device-android-001';
const TEST_COURSE_ID = '123e4567-e89b-12d3-a456-426614174001';
const TEST_LESSON_ID = '123e4567-e89b-12d3-a456-426614174002';
const TEST_VIDEO_ID = '123e4567-e89b-12d3-a456-426614174003';

let sessionId = null;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`Testing: ${testName}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== Test Functions ====================

async function testStartSession() {
  logTest('Start Learning Session');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/analytics/session/start`, {
      userId: TEST_USER_ID,
      deviceId: TEST_DEVICE_ID
    });

    if (response.data.success && response.data.data.id) {
      sessionId = response.data.data.id;
      logSuccess(`Session started: ${sessionId}`);
      logInfo(`Start time: ${response.data.data.startTime}`);
      return true;
    } else {
      logError('Failed to start session');
      return false;
    }
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testTrackSessionActivity() {
  logTest('Track Session Activity');
  
  if (!sessionId) {
    logError('No active session');
    return false;
  }

  const activities = [
    { type: 'course_access', id: TEST_COURSE_ID },
    { type: 'video_watch', id: TEST_VIDEO_ID },
    { type: 'note_create', id: 'note-001' },
    { type: 'assignment_complete', id: 'assignment-001' }
  ];

  try {
    for (const activity of activities) {
      const response = await axios.post(`${BASE_URL}/api/analytics/session/activity`, {
        sessionId,
        activityType: activity.type,
        entityId: activity.id
      });

      if (response.data.success) {
        logSuccess(`Tracked: ${activity.type}`);
      } else {
        logError(`Failed to track: ${activity.type}`);
      }
      
      await delay(500);
    }
    return true;
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testSyncProgress() {
  logTest('Sync Learning Progress');
  
  const progressData = [
    {
      courseId: TEST_COURSE_ID,
      lessonId: TEST_LESSON_ID,
      videoId: TEST_VIDEO_ID,
      progress: 45,
      lastPosition: 120
    },
    {
      courseId: TEST_COURSE_ID,
      lessonId: TEST_LESSON_ID,
      progress: 60
    },
    {
      courseId: TEST_COURSE_ID,
      progress: 30
    }
  ];

  try {
    for (const data of progressData) {
      const response = await axios.post(`${BASE_URL}/api/analytics/progress/sync`, {
        userId: TEST_USER_ID,
        deviceId: TEST_DEVICE_ID,
        ...data
      });

      if (response.data.success) {
        logSuccess(`Synced progress: ${data.progress}% for ${data.videoId ? 'video' : data.lessonId ? 'lesson' : 'course'}`);
      } else {
        logError(`Failed to sync progress`);
      }
      
      await delay(500);
    }
    return true;
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testGetProgress() {
  logTest('Get Learning Progress');
  
  try {
    // Get video progress
    const videoResponse = await axios.get(
      `${BASE_URL}/api/analytics/progress/${TEST_USER_ID}/${TEST_COURSE_ID}?videoId=${TEST_VIDEO_ID}`
    );

    if (videoResponse.data.success) {
      logSuccess(`Video progress: ${videoResponse.data.data.progress}%`);
      logInfo(`Last position: ${videoResponse.data.data.lastPosition}s`);
    }

    await delay(500);

    // Get all progress
    const allResponse = await axios.get(
      `${BASE_URL}/api/analytics/progress/${TEST_USER_ID}/all`
    );

    if (allResponse.data.success) {
      logSuccess(`Total progress records: ${allResponse.data.count}`);
      allResponse.data.data.forEach(p => {
        logInfo(`Course ${p.courseId}: ${p.progress}%`);
      });
    }

    return true;
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testTrackEngagement() {
  logTest('Track Engagement Events');
  
  const events = [
    { type: 'video_complete', metadata: { videoId: TEST_VIDEO_ID, duration: 300 } },
    { type: 'quiz_attempt', metadata: { quizId: 'quiz-001', score: 85 } },
    { type: 'discussion_post', metadata: { postId: 'post-001' } },
    { type: 'resource_download', metadata: { resourceId: 'resource-001' } }
  ];

  try {
    for (const event of events) {
      const response = await axios.post(`${BASE_URL}/api/analytics/engagement/track`, {
        userId: TEST_USER_ID,
        engagementType: event.type,
        metadata: event.metadata
      });

      if (response.data.success) {
        logSuccess(`Tracked engagement: ${event.type}`);
      } else {
        logError(`Failed to track: ${event.type}`);
      }
      
      await delay(500);
    }
    return true;
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testGetEngagementMetrics() {
  logTest('Get Engagement Metrics');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/analytics/engagement/${TEST_USER_ID}`);

    if (response.data.success) {
      const metrics = response.data.data;
      logSuccess('Engagement metrics retrieved');
      logInfo(`Daily streak: ${metrics.dailyActiveStreak} days`);
      logInfo(`Weekly streak: ${metrics.weeklyActiveStreak} weeks`);
      logInfo(`Total learning time: ${Math.round(metrics.totalLearningTime / 60)} minutes`);
      logInfo(`Average session: ${Math.round(metrics.averageSessionDuration / 60)} minutes`);
      logInfo(`Courses in progress: ${metrics.coursesInProgress}`);
      logInfo(`Courses completed: ${metrics.coursesCompleted}`);
      logInfo(`Engagement score: ${metrics.engagementScore}/100`);
      return true;
    } else {
      logError('Failed to get engagement metrics');
      return false;
    }
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testAnalyzeLearningHabits() {
  logTest('Analyze Learning Habits');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/analytics/habits/${TEST_USER_ID}`);

    if (response.data.success) {
      const habits = response.data.data;
      logSuccess('Learning habits analyzed');
      logInfo(`Preferred learning time: ${habits.preferredLearningTime}`);
      logInfo(`Average sessions per day: ${habits.averageSessionsPerDay.toFixed(2)}`);
      logInfo(`Preferred duration: ${Math.round(habits.preferredDuration / 60)} minutes`);
      logInfo(`Most active day: ${habits.mostActiveDay}`);
      logInfo(`Consistency score: ${habits.consistencyScore}/100`);
      logInfo(`Reminders enabled: ${habits.reminderPreferences.enabled}`);
      return true;
    } else {
      logError('Failed to analyze habits');
      return false;
    }
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testSetReminderPreferences() {
  logTest('Set Reminder Preferences');
  
  try {
    const preferences = {
      enabled: true,
      frequency: 'daily',
      time: '18:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    };

    const response = await axios.put(
      `${BASE_URL}/api/analytics/habits/${TEST_USER_ID}/reminders`,
      preferences
    );

    if (response.data.success) {
      logSuccess('Reminder preferences updated');
      logInfo(`Frequency: ${preferences.frequency}`);
      logInfo(`Time: ${preferences.time}`);
      logInfo(`Days: ${preferences.days.join(', ')}`);
      return true;
    } else {
      logError('Failed to set preferences');
      return false;
    }
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testGetUpcomingReminders() {
  logTest('Get Upcoming Reminders');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/analytics/habits/${TEST_USER_ID}/reminders/upcoming`
    );

    if (response.data.success) {
      logSuccess(`Found ${response.data.count} upcoming reminders`);
      response.data.data.forEach((reminder, index) => {
        logInfo(`Reminder ${index + 1}: ${new Date(reminder.scheduledFor).toLocaleString()}`);
        logInfo(`  Message: ${reminder.message}`);
      });
      return true;
    } else {
      logError('Failed to get reminders');
      return false;
    }
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testGetAnalyticsReport() {
  logTest('Get Analytics Report');
  
  try {
    const periods = ['7d', '30d'];
    
    for (const period of periods) {
      const response = await axios.get(
        `${BASE_URL}/api/analytics/report/${TEST_USER_ID}?period=${period}`
      );

      if (response.data.success) {
        const report = response.data.data;
        logSuccess(`${period} report generated`);
        logInfo(`Total sessions: ${report.summary.totalSessions}`);
        logInfo(`Total learning time: ${Math.round(report.summary.totalLearningTime / 60)} minutes`);
        logInfo(`Engagement score: ${report.summary.engagementScore}/100`);
        logInfo(`Consistency score: ${report.summary.consistencyScore}/100`);
        logInfo(`Daily streak: ${report.streaks.daily} days`);
      }
      
      await delay(500);
    }
    return true;
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testGetDashboard() {
  logTest('Get Mobile Dashboard');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/analytics/dashboard/${TEST_USER_ID}`);

    if (response.data.success) {
      const dashboard = response.data.data;
      logSuccess('Dashboard data retrieved');
      
      log('\nEngagement:', 'yellow');
      logInfo(`Score: ${dashboard.engagement.score}/100`);
      logInfo(`Daily streak: ${dashboard.engagement.dailyStreak} days`);
      logInfo(`Total learning time: ${Math.round(dashboard.engagement.totalLearningTime / 60)} minutes`);
      
      log('\nCourses:', 'yellow');
      logInfo(`Active: ${dashboard.courses.active}`);
      logInfo(`Completed: ${dashboard.courses.completed}`);
      logInfo(`Total progress: ${dashboard.courses.totalProgress}%`);
      
      log('\nHabits:', 'yellow');
      logInfo(`Preferred time: ${dashboard.habits.preferredTime}`);
      logInfo(`Consistency: ${dashboard.habits.consistencyScore}/100`);
      logInfo(`Most active: ${dashboard.habits.mostActiveDay}`);
      
      return true;
    } else {
      logError('Failed to get dashboard');
      return false;
    }
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testEndSession() {
  logTest('End Learning Session');
  
  if (!sessionId) {
    logError('No active session');
    return false;
  }

  try {
    const response = await axios.post(`${BASE_URL}/api/analytics/session/end`, {
      sessionId
    });

    if (response.data.success) {
      logSuccess('Session ended successfully');
      logInfo(`Session ID: ${sessionId}`);
      return true;
    } else {
      logError('Failed to end session');
      return false;
    }
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testCrossDeviceSync() {
  logTest('Cross-Device Progress Synchronization');
  
  const device1 = 'device-ios-001';
  const device2 = 'device-android-002';
  
  try {
    // Device 1 syncs progress
    logInfo('Device 1 (iOS) syncing progress...');
    await axios.post(`${BASE_URL}/api/analytics/progress/sync`, {
      userId: TEST_USER_ID,
      courseId: TEST_COURSE_ID,
      lessonId: TEST_LESSON_ID,
      progress: 75,
      lastPosition: 450,
      deviceId: device1
    });
    logSuccess('Device 1 synced: 75%');

    await delay(1000);

    // Device 2 gets progress
    logInfo('Device 2 (Android) fetching progress...');
    const response = await axios.get(
      `${BASE_URL}/api/analytics/progress/${TEST_USER_ID}/${TEST_COURSE_ID}?lessonId=${TEST_LESSON_ID}`
    );

    if (response.data.success && response.data.data.progress === 75) {
      logSuccess('Device 2 received synced progress: 75%');
      logInfo(`Last position: ${response.data.data.lastPosition}s`);
      logInfo('Cross-device sync working correctly!');
      return true;
    } else {
      logError('Progress not synced correctly');
      return false;
    }
  } catch (error) {
    logError(`Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// ==================== Main Test Runner ====================

async function runAllTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('MOBILE ANALYTICS AND PROGRESS TRACKING TEST SUITE', 'cyan');
  log('Task 26.3: Mobile Analytics Implementation', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  const tests = [
    { name: 'Start Session', fn: testStartSession },
    { name: 'Track Session Activity', fn: testTrackSessionActivity },
    { name: 'Sync Progress', fn: testSyncProgress },
    { name: 'Get Progress', fn: testGetProgress },
    { name: 'Track Engagement', fn: testTrackEngagement },
    { name: 'Get Engagement Metrics', fn: testGetEngagementMetrics },
    { name: 'Analyze Learning Habits', fn: testAnalyzeLearningHabits },
    { name: 'Set Reminder Preferences', fn: testSetReminderPreferences },
    { name: 'Get Upcoming Reminders', fn: testGetUpcomingReminders },
    { name: 'Get Analytics Report', fn: testGetAnalyticsReport },
    { name: 'Get Dashboard', fn: testGetDashboard },
    { name: 'Cross-Device Sync', fn: testCrossDeviceSync },
    { name: 'End Session', fn: testEndSession }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      logError(`Test "${test.name}" threw an error: ${error.message}`);
      failed++;
    }
    await delay(1000);
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`Total tests: ${tests.length}`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, 'red');
  log(`Success rate: ${((passed / tests.length) * 100).toFixed(1)}%`, 'yellow');
  log('='.repeat(60) + '\n', 'cyan');

  if (failed === 0) {
    log('✓ ALL TESTS PASSED!', 'green');
    log('Task 26.3 implementation is working correctly.', 'green');
  } else {
    log('✗ SOME TESTS FAILED', 'red');
    log('Please check the errors above and fix the issues.', 'red');
  }
}

// Run tests
runAllTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
