import { getDatabase, getRedis, getMongoDB } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface LearningPathData {
  userId: string;
  courseId: string;
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  pace?: 'slow' | 'normal' | 'fast';
  strengths: string[];
  weaknesses: string[];
  completedContent: string[];
  recommendedContent: string[];
  nextMilestone?: string;
}

interface PerformanceData {
  assessmentId: string;
  score: number;
  passed: boolean;
  weakTopics: string[];
  strongTopics: string[];
  timeSpent?: number;
}

interface ContentRecommendation {
  contentId: string;
  contentType: 'video' | 'reading' | 'practice' | 'quiz' | 'project';
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;
  reason: string;
  priority: number;
}

export class AdaptiveLearningService {
  private db = getDatabase();
  private redis = getRedis();
  private mongo = getMongoDB();

  /**
   * Get personalized learning path for a user
   */
  async getLearningPath(userId: string, courseId: string): Promise<LearningPathData> {
    try {
      // Try to get from cache first
      const cacheKey = `learning_path:${userId}:${courseId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Get user's assessment history
      const assessmentHistory = await this.db.queryMany(
        `SELECT aa.*, a.type, a.course_id
         FROM assessment_attempts aa
         JOIN assessments a ON aa.assessment_id = a.id
         WHERE aa.user_id = $1 AND a.course_id = $2 AND aa.completed_at IS NOT NULL
         ORDER BY aa.completed_at DESC`,
        [userId, courseId]
      );

      // Calculate current level based on performance
      const currentLevel = this.calculateLevel(assessmentHistory);

      // Identify strengths and weaknesses
      const { strengths, weaknesses } = await this.analyzePerformance(userId, courseId);

      // Get completed content
      const completedContent = await this.getCompletedContent(userId, courseId);

      // Generate recommendations
      const recommendedContent = await this.generateContentRecommendations(
        userId,
        courseId,
        currentLevel,
        weaknesses,
        completedContent
      );

      // Determine next milestone
      const nextMilestone = this.determineNextMilestone(currentLevel, completedContent);

      const learningPath: LearningPathData = {
        userId,
        courseId,
        currentLevel,
        strengths,
        weaknesses,
        completedContent,
        recommendedContent: recommendedContent.map(r => r.contentId),
        nextMilestone,
      };

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(learningPath));

      logger.info('Learning path generated', { userId, courseId, currentLevel });

      return learningPath;
    } catch (error) {
      logger.error('Failed to get learning path', { error, userId, courseId });
      throw new AppError('Failed to retrieve learning path', 500);
    }
  }

  /**
   * Update learning path based on new performance data
   */
  async updateLearningPath(userId: string, courseId: string, performanceData: PerformanceData) {
    try {
      // Store performance data in MongoDB for analytics
      const collection = this.mongo.collection('learning_performance');
      await collection.insertOne({
        userId,
        courseId,
        ...performanceData,
        timestamp: new Date(),
      });

      // Invalidate cache
      const cacheKey = `learning_path:${userId}:${courseId}`;
      await this.redis.del(cacheKey);

      // Update user's learning profile
      await this.updateLearningProfile(userId, courseId, performanceData);

      // Trigger adaptive content adjustment
      const adjustedPath = await this.adjustLearningPath(userId, courseId, performanceData);

      logger.info('Learning path updated', {
        userId,
        courseId,
        assessmentId: performanceData.assessmentId,
        score: performanceData.score,
      });

      return adjustedPath;
    } catch (error) {
      logger.error('Failed to update learning path', { error, userId, courseId });
      throw new AppError('Failed to update learning path', 500);
    }
  }

  /**
   * Get detailed learning analytics for a user
   */
  async getLearningAnalytics(userId: string, courseId?: string) {
    try {
      const collection = this.mongo.collection('learning_performance');
      
      const query: any = { userId };
      if (courseId) {
        query.courseId = courseId;
      }

      const performanceData = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();

      if (performanceData.length === 0) {
        return {
          userId,
          courseId,
          strengths: [],
          weaknesses: [],
          learningVelocity: 0,
          timeToMastery: 0,
          engagementScore: 0,
          consistencyScore: 0,
        };
      }

      // Calculate learning velocity (improvement rate)
      const learningVelocity = this.calculateLearningVelocity(performanceData);

      // Estimate time to mastery
      const timeToMastery = this.estimateTimeToMastery(performanceData, learningVelocity);

      // Calculate engagement score
      const engagementScore = this.calculateEngagementScore(userId, courseId);

      // Calculate consistency score
      const consistencyScore = this.calculateConsistencyScore(performanceData);

      // Aggregate strengths and weaknesses
      const strengths = this.aggregateTopics(
        performanceData.flatMap((p: any) => p.strongTopics || [])
      );
      const weaknesses = this.aggregateTopics(
        performanceData.flatMap((p: any) => p.weakTopics || [])
      );

      return {
        userId,
        courseId,
        strengths: strengths.slice(0, 5),
        weaknesses: weaknesses.slice(0, 5),
        learningVelocity,
        timeToMastery,
        engagementScore,
        consistencyScore,
        recentPerformance: performanceData.slice(0, 10).map((p: any) => ({
          assessmentId: p.assessmentId,
          score: p.score,
          passed: p.passed,
          timestamp: p.timestamp,
        })),
      };
    } catch (error) {
      logger.error('Failed to get learning analytics', { error, userId, courseId });
      throw new AppError('Failed to retrieve learning analytics', 500);
    }
  }

  /**
   * Get personalized content recommendations
   */
  async getRecommendations(userId: string, courseId: string): Promise<ContentRecommendation[]> {
    try {
      // Get learning path
      const learningPath = await this.getLearningPath(userId, courseId);

      // Generate recommendations based on weaknesses and level
      const recommendations = await this.generateContentRecommendations(
        userId,
        courseId,
        learningPath.currentLevel,
        learningPath.weaknesses,
        learningPath.completedContent
      );

      logger.info('Recommendations generated', {
        userId,
        courseId,
        count: recommendations.length,
      });

      return recommendations;
    } catch (error) {
      logger.error('Failed to get recommendations', { error, userId, courseId });
      throw new AppError('Failed to retrieve recommendations', 500);
    }
  }

  /**
   * Calculate user's current level based on assessment history
   */
  private calculateLevel(assessmentHistory: any[]): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (assessmentHistory.length === 0) return 'beginner';

    const recentAttempts = assessmentHistory.slice(0, 10);
    const averageScore = recentAttempts.reduce((sum, a) => sum + a.percentage, 0) / recentAttempts.length;
    const passRate = recentAttempts.filter(a => a.passed).length / recentAttempts.length;

    if (averageScore >= 90 && passRate >= 0.9) return 'expert';
    if (averageScore >= 75 && passRate >= 0.75) return 'advanced';
    if (averageScore >= 60 && passRate >= 0.6) return 'intermediate';
    return 'beginner';
  }

  /**
   * Analyze performance to identify strengths and weaknesses
   */
  private async analyzePerformance(userId: string, courseId: string): Promise<{
    strengths: string[];
    weaknesses: string[];
  }> {
    try {
      const collection = this.mongo.collection('learning_performance');
      
      const performanceData = await collection
        .find({ userId, courseId })
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();

      const allStrongTopics = performanceData.flatMap((p: any) => p.strongTopics || []);
      const allWeakTopics = performanceData.flatMap((p: any) => p.weakTopics || []);

      const strengths = this.aggregateTopics(allStrongTopics).slice(0, 5);
      const weaknesses = this.aggregateTopics(allWeakTopics).slice(0, 5);

      return { strengths, weaknesses };
    } catch (error) {
      logger.warn('Failed to analyze performance', { error, userId, courseId });
      return { strengths: [], weaknesses: [] };
    }
  }

  /**
   * Aggregate and rank topics by frequency
   */
  private aggregateTopics(topics: string[]): string[] {
    const topicCounts = topics.reduce((acc: Record<string, number>, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([topic]) => topic);
  }

  /**
   * Get completed content for a user
   */
  private async getCompletedContent(userId: string, courseId: string): Promise<string[]> {
    try {
      // This would query the course progress tracking system
      // For now, return empty array
      return [];
    } catch (error) {
      logger.warn('Failed to get completed content', { error, userId, courseId });
      return [];
    }
  }

  /**
   * Generate content recommendations based on user profile
   */
  private async generateContentRecommendations(
    userId: string,
    courseId: string,
    level: string,
    weaknesses: string[],
    completedContent: string[]
  ): Promise<ContentRecommendation[]> {
    const recommendations: ContentRecommendation[] = [];

    // Recommend content to address weaknesses (highest priority)
    weaknesses.forEach((weakness, index) => {
      recommendations.push({
        contentId: `content_${weakness}`,
        contentType: 'practice',
        title: `Practice: ${weakness}`,
        difficulty: level === 'beginner' ? 'easy' : 'medium',
        estimatedTime: 30,
        reason: 'Addresses identified weakness',
        priority: 10 - index,
      });
    });

    // Recommend level-appropriate content
    const levelContent = this.getLevelAppropriateContent(level, completedContent);
    recommendations.push(...levelContent);

    // Sort by priority
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations.slice(0, 10);
  }

  /**
   * Get level-appropriate content recommendations
   */
  private getLevelAppropriateContent(
    level: string,
    completedContent: string[]
  ): ContentRecommendation[] {
    // This would query the content database
    // For now, return sample recommendations
    const recommendations: ContentRecommendation[] = [];

    if (level === 'beginner') {
      recommendations.push({
        contentId: 'intro_video_1',
        contentType: 'video',
        title: 'Introduction to Core Concepts',
        difficulty: 'easy',
        estimatedTime: 15,
        reason: 'Foundation building',
        priority: 5,
      });
    } else if (level === 'intermediate') {
      recommendations.push({
        contentId: 'advanced_practice_1',
        contentType: 'practice',
        title: 'Intermediate Practice Problems',
        difficulty: 'medium',
        estimatedTime: 45,
        reason: 'Skill reinforcement',
        priority: 5,
      });
    } else {
      recommendations.push({
        contentId: 'expert_project_1',
        contentType: 'project',
        title: 'Advanced Capstone Project',
        difficulty: 'hard',
        estimatedTime: 120,
        reason: 'Mastery demonstration',
        priority: 5,
      });
    }

    return recommendations;
  }

  /**
   * Determine next milestone based on progress
   */
  private determineNextMilestone(level: string, completedContent: string[]): string {
    const milestones: Record<string, string> = {
      beginner: 'Complete foundational assessments',
      intermediate: 'Pass intermediate certification',
      advanced: 'Complete advanced projects',
      expert: 'Achieve course mastery',
    };

    return milestones[level] || 'Continue learning';
  }

  /**
   * Update user's learning profile
   */
  private async updateLearningProfile(
    userId: string,
    courseId: string,
    performanceData: PerformanceData
  ): Promise<void> {
    try {
      const collection = this.mongo.collection('learning_profiles');
      
      await collection.updateOne(
        { userId, courseId },
        {
          $set: {
            lastUpdated: new Date(),
            lastAssessmentScore: performanceData.score,
          },
          $push: {
            performanceHistory: {
              $each: [performanceData],
              $slice: -50, // Keep last 50 entries
            },
          },
        },
        { upsert: true }
      );
    } catch (error) {
      logger.warn('Failed to update learning profile', { error, userId, courseId });
    }
  }

  /**
   * Adjust learning path based on new performance data
   */
  private async adjustLearningPath(
    userId: string,
    courseId: string,
    performanceData: PerformanceData
  ): Promise<any> {
    // Regenerate learning path with updated data
    return this.getLearningPath(userId, courseId);
  }

  /**
   * Calculate learning velocity (rate of improvement)
   */
  private calculateLearningVelocity(performanceData: any[]): number {
    if (performanceData.length < 2) return 0;

    const scores = performanceData.map((p: any) => p.score).reverse();
    
    // Simple linear regression to find slope
    const n = scores.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = scores.reduce((a: number, b: number) => a + b, 0);
    const sumXY = scores.reduce((sum: number, score: number, i: number) => sum + i * score, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return Math.round(slope * 100) / 100;
  }

  /**
   * Estimate time to mastery based on current velocity
   */
  private estimateTimeToMastery(performanceData: any[], velocity: number): number {
    if (velocity <= 0) return -1; // Cannot estimate

    const currentScore = performanceData[0]?.score || 0;
    const targetScore = 90; // Mastery threshold

    if (currentScore >= targetScore) return 0;

    const pointsNeeded = targetScore - currentScore;
    const assessmentsNeeded = Math.ceil(pointsNeeded / velocity);

    // Assume 1 assessment per week
    return assessmentsNeeded;
  }

  /**
   * Calculate engagement score based on activity
   */
  private async calculateEngagementScore(userId: string, courseId?: string): Promise<number> {
    try {
      const collection = this.mongo.collection('learning_performance');
      
      const query: any = { userId };
      if (courseId) query.courseId = courseId;

      const recentActivity = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .limit(30)
        .toArray();

      if (recentActivity.length === 0) return 0;

      // Calculate based on frequency and recency
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const recentCount = recentActivity.filter(
        (a: any) => new Date(a.timestamp) > thirtyDaysAgo
      ).length;

      const engagementScore = Math.min(100, (recentCount / 30) * 100);

      return Math.round(engagementScore);
    } catch (error) {
      logger.warn('Failed to calculate engagement score', { error, userId });
      return 0;
    }
  }

  /**
   * Calculate consistency score based on regular activity
   */
  private calculateConsistencyScore(performanceData: any[]): number {
    if (performanceData.length < 2) return 0;

    const timestamps = performanceData.map((p: any) => new Date(p.timestamp).getTime());
    const intervals = [];

    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i - 1] - timestamps[i]);
    }

    // Calculate standard deviation of intervals
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher consistency
    // Normalize to 0-100 scale
    const consistencyScore = Math.max(0, 100 - (stdDev / (24 * 60 * 60 * 1000)) * 10);

    return Math.round(consistencyScore);
  }
}
