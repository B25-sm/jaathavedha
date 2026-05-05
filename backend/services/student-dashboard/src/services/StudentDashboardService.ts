/**
 * Student Dashboard Service
 * Core service for personalized student learning dashboard and AI recommendations
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getCache } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';
import {
  StudentDashboard,
  LearningOverview,
  CurrentCourse,
  RecommendedCourse,
  LearningPath,
  Achievement,
  SocialLearning,
  ProgressAnalytics,
  StudyStreak,
  PersonalizedInsight,
  RecommendationReason,
  RecommendationReasonType,
  LearningStyle,
  SkillLevel,
  DifficultyLevel
} from '../types';
import { AIRecommendationEngine } from './AIRecommendationEngine';
import { LearningAnalyticsEngine } from './LearningAnalyticsEngine';
import { SocialLearningService } from './SocialLearningService';

export class StudentDashboardService {
  private db = getDatabase();
  private cache = getCache();
  private aiEngine: AIRecommendationEngine;
  private analyticsEngine: LearningAnalyticsEngine;
  private socialService: SocialLearningService;

  constructor() {
    this.aiEngine = new AIRecommendationEngine();
    this.analyticsEngine = new LearningAnalyticsEngine();
    this.socialService = new SocialLearningService();
  }

  /**
   * Get comprehensive student dashboard
   */
  async getStudentDashboard(studentId: string): Promise<StudentDashboard> {
    try {
      const cacheKey = `student_dashboard:${studentId}`;
      const cached = await this.cache.get<StudentDashboard>(cacheKey);
      if (cached) return cached;

      const [
        personalInfo,
        learningOverview,
        currentCourses,
        recommendedCourses,
        learningPath,
        achievements,
        socialLearning,
        upcomingSessions,
        recentActivity,
        progressAnalytics,
        studyStreak,
        personalizedInsights
      ] = await Promise.all([
        this.getPersonalInfo(studentId),
        this.getLearningOverview(studentId),
        this.getCurrentCourses(studentId),
        this.getRecommendedCourses(studentId),
        this.getLearningPath(studentId),
        this.getAchievements(studentId),
        this.socialService.getSocialLearning(studentId),
        this.getUpcomingSessions(studentId),
        this.getRecentActivity(studentId),
        this.analyticsEngine.getProgressAnalytics(studentId),
        this.getStudyStreak(studentId),
        this.generatePersonalizedInsights(studentId)
      ]);

      const dashboard: StudentDashboard = {
        student_id: studentId,
        personal_info: personalInfo,
        learning_overview: learningOverview,
        current_courses: currentCourses,
        recommended_courses: recommendedCourses,
        learning_path: learningPath,
        achievements: achievements,
        social_learning: socialLearning,
        upcoming_sessions: upcomingSessions,
        recent_activity: recentActivity,
        progress_analytics: progressAnalytics,
        study_streak: studyStreak,
        personalized_insights: personalizedInsights
      };

      // Cache for 15 minutes
      await this.cache.set(cacheKey, dashboard, { ttl: 900 });

      return dashboard;
    } catch (error) {
      logger.error('Failed to get student dashboard', { error, studentId });
      throw new AppError('Failed to retrieve dashboard data', 500);
    }
  }

  /**
   * Get AI-powered course recommendations
   */
  async getRecommendedCourses(studentId: string, limit: number = 10): Promise<RecommendedCourse[]> {
    try {
      const cacheKey = `recommendations:${studentId}:${limit}`;
      const cached = await this.cache.get<RecommendedCourse[]>(cacheKey);
      if (cached) return cached;

      // Get student learning profile
      const learningProfile = await this.getStudentLearningProfile(studentId);
      
      // Get AI recommendations
      const recommendations = await this.aiEngine.generateCourseRecommendations(
        studentId,
        learningProfile,
        limit
      );

      // Enrich recommendations with additional data
      const enrichedRecommendations = await Promise.all(
        recommendations.map(async (rec) => {
          const courseDetails = await this.getCourseDetails(rec.course_id);
          const reasons = await this.generateRecommendationReasons(studentId, rec.course_id);
          
          return {
            ...rec,
            ...courseDetails,
            recommendation_reasons: reasons
          };
        })
      );

      // Cache for 1 hour
      await this.cache.set(cacheKey, enrichedRecommendations, { ttl: 3600 });

      return enrichedRecommendations;
    } catch (error) {
      logger.error('Failed to get recommended courses', { error, studentId });
      return [];
    }
  }

  /**
   * Get personalized learning path
   */
  async getLearningPath(studentId: string): Promise<LearningPath> {
    try {
      const cacheKey = `learning_path:${studentId}`;
      const cached = await this.cache.get<LearningPath>(cacheKey);
      if (cached) return cached;

      // Get student's current learning path or create one
      let learningPath = await this.db.queryOne<LearningPath>(
        'SELECT * FROM learning_paths WHERE student_id = $1 AND is_active = true',
        [studentId]
      );

      if (!learningPath) {
        learningPath = await this.createPersonalizedLearningPath(studentId);
      }

      // Update path with current progress
      learningPath = await this.updateLearningPathProgress(learningPath, studentId);

      // Cache for 30 minutes
      await this.cache.set(cacheKey, learningPath, { ttl: 1800 });

      return learningPath;
    } catch (error) {
      logger.error('Failed to get learning path', { error, studentId });
      throw new AppError('Failed to retrieve learning path', 500);
    }
  }

  /**
   * Update learning progress
   */
  async updateLearningProgress(
    studentId: string,
    courseId: string,
    lessonId: string,
    progressData: any
  ): Promise<void> {
    try {
      // Update course progress
      await this.updateCourseProgress(studentId, courseId, lessonId, progressData);

      // Update skill progression
      await this.updateSkillProgression(studentId, courseId, progressData);

      // Check for achievements
      await this.checkAndUnlockAchievements(studentId, progressData);

      // Update study streak
      await this.updateStudyStreak(studentId);

      // Invalidate relevant caches
      await this.invalidateStudentCaches(studentId);

      // Generate real-time insights
      await this.generateRealTimeInsights(studentId, progressData);

      logger.info('Learning progress updated', { studentId, courseId, lessonId });
    } catch (error) {
      logger.error('Failed to update learning progress', { error, studentId, courseId });
      throw new AppError('Failed to update progress', 500);
    }
  }

  /**
   * Get study recommendations
   */
  async getStudyRecommendations(studentId: string): Promise<any[]> {
    try {
      const learningProfile = await this.getStudentLearningProfile(studentId);
      const progressAnalytics = await this.analyticsEngine.getProgressAnalytics(studentId);
      
      const recommendations = [];

      // Time-based recommendations
      const timeRecommendations = await this.generateTimeBasedRecommendations(
        studentId,
        progressAnalytics
      );
      recommendations.push(...timeRecommendations);

      // Content-based recommendations
      const contentRecommendations = await this.generateContentRecommendations(
        studentId,
        learningProfile
      );
      recommendations.push(...contentRecommendations);

      // Social learning recommendations
      const socialRecommendations = await this.generateSocialRecommendations(studentId);
      recommendations.push(...socialRecommendations);

      // Sort by priority and impact
      recommendations.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const impactWeight = { very_high: 4, high: 3, medium: 2, low: 1 };
        
        const scoreA = (priorityWeight[a.priority] || 1) * (impactWeight[a.expected_impact] || 1);
        const scoreB = (priorityWeight[b.priority] || 1) * (impactWeight[b.expected_impact] || 1);
        
        return scoreB - scoreA;
      });

      return recommendations.slice(0, 10); // Return top 10 recommendations
    } catch (error) {
      logger.error('Failed to get study recommendations', { error, studentId });
      return [];
    }
  }

  /**
   * Track learning activity
   */
  async trackLearningActivity(
    studentId: string,
    activityType: string,
    activityData: any
  ): Promise<void> {
    try {
      // Store activity in database
      await this.db.insert('learning_activities', {
        id: uuidv4(),
        student_id: studentId,
        activity_type: activityType,
        activity_data: activityData,
        timestamp: new Date()
      });

      // Update real-time analytics
      await this.analyticsEngine.updateRealTimeAnalytics(studentId, activityType, activityData);

      // Check for pattern changes
      await this.checkLearningPatterns(studentId, activityType, activityData);

      logger.debug('Learning activity tracked', { studentId, activityType });
    } catch (error) {
      logger.error('Failed to track learning activity', { error, studentId, activityType });
    }
  }

  // Private helper methods

  private async getPersonalInfo(studentId: string): Promise<any> {
    const user = await this.db.queryOne<any>(
      'SELECT * FROM users WHERE id = $1',
      [studentId]
    );

    const preferences = await this.db.queryOne<any>(
      'SELECT * FROM student_preferences WHERE student_id = $1',
      [studentId]
    );

    return {
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      avatar_url: user.avatar_url,
      learning_goals: preferences?.learning_goals || [],
      preferred_learning_style: preferences?.learning_style || LearningStyle.MIXED,
      timezone: preferences?.timezone || 'UTC',
      study_schedule: preferences?.study_schedule || {
        preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        preferred_times: [{ start_time: '09:00', end_time: '17:00', timezone: 'UTC' }],
        daily_goal_minutes: 60,
        break_intervals: 25
      }
    };
  }

  private async getLearningOverview(studentId: string): Promise<LearningOverview> {
    const stats = await this.db.queryOne<any>(`
      SELECT 
        COUNT(DISTINCT e.program_id) as total_enrolled,
        COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.program_id END) as completed,
        COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.program_id END) as in_progress,
        COALESCE(SUM(va.watch_time), 0) / 3600 as total_hours,
        COALESCE(AVG(e.progress_percentage), 0) as avg_completion
      FROM enrollments e
      LEFT JOIN video_analytics va ON e.user_id = va.user_id
      WHERE e.user_id = $1
    `, [studentId]);

    const skillLevel = await this.calculateSkillLevel(studentId);
    const learningVelocity = await this.calculateLearningVelocity(studentId);
    const nextMilestone = await this.getNextMilestone(studentId);

    return {
      total_courses_enrolled: parseInt(stats.total_enrolled || '0', 10),
      courses_completed: parseInt(stats.completed || '0', 10),
      courses_in_progress: parseInt(stats.in_progress || '0', 10),
      total_learning_hours: parseFloat(stats.total_hours || '0'),
      average_completion_rate: parseFloat(stats.avg_completion || '0'),
      skill_level: skillLevel,
      learning_velocity: learningVelocity,
      next_milestone: nextMilestone
    };
  }

  private async getCurrentCourses(studentId: string): Promise<CurrentCourse[]> {
    const courses = await this.db.queryMany<any>(`
      SELECT 
        p.id as course_id,
        p.name as course_name,
        u.first_name || ' ' || u.last_name as instructor_name,
        p.thumbnail_url as course_thumbnail,
        e.progress_percentage,
        e.last_accessed,
        p.difficulty_level,
        p.rating as course_rating,
        COALESCE(SUM(va.watch_time), 0) / 60 as time_spent
      FROM enrollments e
      JOIN programs p ON e.program_id = p.id
      JOIN users u ON p.instructor_id = u.id
      LEFT JOIN video_analytics va ON e.user_id = va.user_id
      WHERE e.user_id = $1 AND e.status = 'active'
      GROUP BY p.id, p.name, u.first_name, u.last_name, p.thumbnail_url, 
               e.progress_percentage, e.last_accessed, p.difficulty_level, p.rating
      ORDER BY e.last_accessed DESC
    `, [studentId]);

    const currentCourses: CurrentCourse[] = [];

    for (const course of courses) {
      const nextLesson = await this.getNextLesson(studentId, course.course_id);
      const upcomingDeadlines = await this.getUpcomingDeadlines(studentId, course.course_id);
      const estimatedCompletion = await this.calculateEstimatedCompletion(
        studentId,
        course.course_id
      );

      currentCourses.push({
        course_id: course.course_id,
        course_name: course.course_name,
        instructor_name: course.instructor_name,
        course_thumbnail: course.course_thumbnail,
        progress_percentage: course.progress_percentage,
        last_accessed: course.last_accessed,
        next_lesson: nextLesson,
        estimated_completion: estimatedCompletion,
        difficulty_level: course.difficulty_level as DifficultyLevel,
        course_rating: course.course_rating,
        time_spent: parseInt(course.time_spent || '0', 10),
        modules_completed: 0, // Would calculate from detailed progress
        total_modules: 0, // Would get from course structure
        upcoming_deadlines: upcomingDeadlines
      });
    }

    return currentCourses;
  }

  private async getAchievements(studentId: string): Promise<Achievement[]> {
    return await this.db.queryMany<Achievement>(`
      SELECT * FROM student_achievements 
      WHERE student_id = $1 
      ORDER BY unlocked_at DESC
      LIMIT 20
    `, [studentId]);
  }

  private async getUpcomingSessions(studentId: string): Promise<any[]> {
    return await this.db.queryMany<any>(`
      SELECT 
        ls.id,
        ls.title,
        ls.scheduled_start,
        ls.scheduled_end,
        p.name as course_name,
        u.first_name || ' ' || u.last_name as instructor_name,
        'live_class' as type,
        true as is_registered
      FROM live_streams ls
      JOIN programs p ON ls.course_id = p.id
      JOIN users u ON ls.instructor_id = u.id
      JOIN enrollments e ON p.id = e.program_id AND e.user_id = $1
      WHERE ls.scheduled_start > NOW() 
        AND ls.status = 'scheduled'
        AND e.status = 'active'
      ORDER BY ls.scheduled_start ASC
      LIMIT 10
    `, [studentId]);
  }

  private async getRecentActivity(studentId: string): Promise<any[]> {
    return await this.db.queryMany<any>(`
      SELECT 
        id,
        activity_type,
        title,
        description,
        course_name,
        timestamp,
        points_earned
      FROM learning_activities 
      WHERE student_id = $1 
      ORDER BY timestamp DESC
      LIMIT 20
    `, [studentId]);
  }

  private async getStudyStreak(studentId: string): Promise<StudyStreak> {
    const streakData = await this.db.queryOne<any>(
      'SELECT * FROM study_streaks WHERE student_id = $1',
      [studentId]
    );

    if (!streakData) {
      return {
        current_streak: 0,
        longest_streak: 0,
        streak_goal: 30,
        streak_history: [],
        streak_rewards: [],
        motivation_message: "Start your learning journey today!"
      };
    }

    return streakData;
  }

  private async generatePersonalizedInsights(studentId: string): Promise<PersonalizedInsight[]> {
    const insights: PersonalizedInsight[] = [];

    // Generate various types of insights
    const learningPatternInsights = await this.generateLearningPatternInsights(studentId);
    const performanceInsights = await this.generatePerformanceInsights(studentId);
    const engagementInsights = await this.generateEngagementInsights(studentId);

    insights.push(...learningPatternInsights, ...performanceInsights, ...engagementInsights);

    // Sort by confidence score and limit to top insights
    insights.sort((a, b) => b.confidence_score - a.confidence_score);
    
    return insights.slice(0, 5);
  }

  private async getStudentLearningProfile(studentId: string): Promise<any> {
    // Implementation would build comprehensive learning profile
    return {
      learning_style: LearningStyle.MIXED,
      skill_level: SkillLevel.INTERMEDIATE,
      interests: [],
      goals: [],
      performance_history: [],
      engagement_patterns: []
    };
  }

  private async getCourseDetails(courseId: string): Promise<any> {
    return await this.db.queryOne<any>(
      'SELECT * FROM programs WHERE id = $1',
      [courseId]
    );
  }

  private async generateRecommendationReasons(
    studentId: string,
    courseId: string
  ): Promise<RecommendationReason[]> {
    const reasons: RecommendationReason[] = [];

    // Analyze why this course is recommended
    const skillGapAnalysis = await this.analyzeSkillGaps(studentId, courseId);
    if (skillGapAnalysis.hasGap) {
      reasons.push({
        type: RecommendationReasonType.SKILL_GAP,
        description: `This course addresses your skill gap in ${skillGapAnalysis.skillArea}`,
        confidence_score: skillGapAnalysis.confidence
      });
    }

    const learningPathAnalysis = await this.analyzeLearningPathFit(studentId, courseId);
    if (learningPathAnalysis.isNextStep) {
      reasons.push({
        type: RecommendationReasonType.LEARNING_PATH,
        description: `This course is the next step in your ${learningPathAnalysis.pathName} learning path`,
        confidence_score: learningPathAnalysis.confidence
      });
    }

    return reasons;
  }

  private async createPersonalizedLearningPath(studentId: string): Promise<LearningPath> {
    // Implementation would create AI-generated learning path
    const pathId = uuidv4();
    
    return {
      id: pathId,
      name: "Personalized Learning Journey",
      description: "AI-curated learning path based on your goals and progress",
      total_courses: 0,
      completed_courses: 0,
      estimated_completion_time: 6,
      difficulty_progression: [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE],
      current_stage: {
        stage_number: 1,
        stage_name: "Foundation",
        stage_description: "Building fundamental skills",
        required_courses: [],
        optional_courses: [],
        completion_criteria: {
          minimum_score: 80,
          required_assignments: 3
        }
      },
      next_recommended_course: {} as RecommendedCourse,
      skill_tree: []
    };
  }

  private async updateLearningPathProgress(
    learningPath: LearningPath,
    studentId: string
  ): Promise<LearningPath> {
    // Implementation would update path progress based on current student status
    return learningPath;
  }

  private async updateCourseProgress(
    studentId: string,
    courseId: string,
    lessonId: string,
    progressData: any
  ): Promise<void> {
    // Implementation would update detailed course progress
  }

  private async updateSkillProgression(
    studentId: string,
    courseId: string,
    progressData: any
  ): Promise<void> {
    // Implementation would update skill levels based on learning activities
  }

  private async checkAndUnlockAchievements(
    studentId: string,
    progressData: any
  ): Promise<void> {
    // Implementation would check for new achievements and unlock them
  }

  private async updateStudyStreak(studentId: string): Promise<void> {
    // Implementation would update daily study streak
  }

  private async invalidateStudentCaches(studentId: string): Promise<void> {
    const cacheKeys = [
      `student_dashboard:${studentId}`,
      `recommendations:${studentId}:*`,
      `learning_path:${studentId}`,
      `progress_analytics:${studentId}`
    ];

    for (const key of cacheKeys) {
      if (key.includes('*')) {
        // Handle wildcard cache invalidation
        const keys = await this.cache.keys(key.replace('*', ''));
        for (const k of keys) {
          await this.cache.del(k);
        }
      } else {
        await this.cache.del(key);
      }
    }
  }

  private async generateRealTimeInsights(
    studentId: string,
    progressData: any
  ): Promise<void> {
    // Implementation would generate insights based on real-time learning data
  }

  private async generateTimeBasedRecommendations(
    studentId: string,
    analytics: ProgressAnalytics
  ): Promise<any[]> {
    // Implementation would generate time management recommendations
    return [];
  }

  private async generateContentRecommendations(
    studentId: string,
    profile: any
  ): Promise<any[]> {
    // Implementation would generate content-based recommendations
    return [];
  }

  private async generateSocialRecommendations(studentId: string): Promise<any[]> {
    // Implementation would generate social learning recommendations
    return [];
  }

  private async checkLearningPatterns(
    studentId: string,
    activityType: string,
    activityData: any
  ): Promise<void> {
    // Implementation would analyze learning patterns and detect changes
  }

  private async calculateSkillLevel(studentId: string): Promise<SkillLevel> {
    // Implementation would calculate overall skill level
    return SkillLevel.INTERMEDIATE;
  }

  private async calculateLearningVelocity(studentId: string): Promise<number> {
    // Implementation would calculate learning velocity
    return 2.5; // courses per month
  }

  private async getNextMilestone(studentId: string): Promise<any> {
    // Implementation would get next learning milestone
    return {
      id: 'milestone_1',
      title: 'Complete 5 Courses',
      description: 'Finish 5 courses to unlock advanced features',
      target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      progress_percentage: 60,
      reward_points: 500
    };
  }

  private async getNextLesson(studentId: string, courseId: string): Promise<any> {
    // Implementation would get next lesson in course
    return {
      lesson_id: 'lesson_1',
      lesson_title: 'Introduction to React',
      lesson_type: 'video',
      estimated_duration: 45,
      prerequisites_met: true
    };
  }

  private async getUpcomingDeadlines(studentId: string, courseId: string): Promise<any[]> {
    // Implementation would get upcoming deadlines for course
    return [];
  }

  private async calculateEstimatedCompletion(
    studentId: string,
    courseId: string
  ): Promise<Date> {
    // Implementation would calculate estimated completion date
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  private async generateLearningPatternInsights(studentId: string): Promise<PersonalizedInsight[]> {
    // Implementation would generate learning pattern insights
    return [];
  }

  private async generatePerformanceInsights(studentId: string): Promise<PersonalizedInsight[]> {
    // Implementation would generate performance insights
    return [];
  }

  private async generateEngagementInsights(studentId: string): Promise<PersonalizedInsight[]> {
    // Implementation would generate engagement insights
    return [];
  }

  private async analyzeSkillGaps(studentId: string, courseId: string): Promise<any> {
    // Implementation would analyze skill gaps
    return { hasGap: false, skillArea: '', confidence: 0 };
  }

  private async analyzeLearningPathFit(studentId: string, courseId: string): Promise<any> {
    // Implementation would analyze learning path fit
    return { isNextStep: false, pathName: '', confidence: 0 };
  }
}