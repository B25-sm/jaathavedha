/**
 * Gamification Service
 * Handles points, badges, achievements, leaderboards, streaks, and habit tracking
 */

import { getPostgresPool, getRedisClient } from '@sai-mahendra/database';
import { AppError, logger } from '@sai-mahendra/utils';

interface PointTransaction {
  id: string;
  userId: string;
  points: number;
  action: string;
  description: string;
  metadata?: any;
  createdAt: Date;
}

interface UserPoints {
  userId: string;
  totalPoints: number;
  level: number;
  pointsToNextLevel: number;
  rank?: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'achievement' | 'milestone' | 'special';
  criteria: any;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  createdAt: Date;
}

interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  badge: Badge;
  earnedAt: Date;
  progress?: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'course' | 'quiz' | 'assignment' | 'social' | 'streak';
  requirement: number;
  points: number;
  createdAt: Date;
}

interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  achievement: Achievement;
  progress: number;
  completed: boolean;
  completedAt?: Date;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  points: number;
  rank: number;
  level: number;
  badgeCount: number;
}

interface UserStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  freezesAvailable: number;
}

export class GamificationService {
  private readonly POINTS_PER_LEVEL = 100;
  private readonly LEVEL_MULTIPLIER = 1.5;

  /**
   * Calculate user level based on total points
   */
  private calculateLevel(totalPoints: number): { level: number; pointsToNextLevel: number } {
    let level = 1;
    let pointsRequired = this.POINTS_PER_LEVEL;
    let accumulatedPoints = 0;

    while (totalPoints >= accumulatedPoints + pointsRequired) {
      accumulatedPoints += pointsRequired;
      level++;
      pointsRequired = Math.floor(pointsRequired * this.LEVEL_MULTIPLIER);
    }

    const pointsToNextLevel = accumulatedPoints + pointsRequired - totalPoints;

    return { level, pointsToNextLevel };
  }

  /**
   * Get user points and level information
   */
  async getUserPoints(userId: string): Promise<UserPoints> {
    const pool = getPostgresPool();

    try {
      // Get total points from Redis cache first
      const redis = getRedisClient();
      const cacheKey = `user:${userId}:points`;
      const cachedPoints = await redis.get(cacheKey);

      let totalPoints: number;

      if (cachedPoints) {
        totalPoints = parseInt(cachedPoints, 10);
      } else {
        // Calculate from database
        const result = await pool.query(
          `SELECT COALESCE(SUM(points), 0) as total_points
           FROM (
             SELECT 50 as points FROM quiz_attempts WHERE user_id = $1 AND passed = true
             UNION ALL
             SELECT 25 as points FROM assignment_submissions WHERE user_id = $1 AND score IS NOT NULL
             UNION ALL
             SELECT 10 as points FROM forum_posts WHERE user_id = $1
             UNION ALL
             SELECT 5 as points FROM forum_replies WHERE user_id = $1
             UNION ALL
             SELECT points FROM user_badges ub JOIN badges b ON ub.badge_id = b.id WHERE ub.user_id = $1
             UNION ALL
             SELECT points FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id WHERE ua.user_id = $1 AND ua.completed = true
           ) as all_points`,
          [userId]
        );

        totalPoints = parseInt(result.rows[0].total_points, 10);

        // Cache for 5 minutes
        await redis.setex(cacheKey, 300, totalPoints.toString());
      }

      const { level, pointsToNextLevel } = this.calculateLevel(totalPoints);

      return {
        userId,
        totalPoints,
        level,
        pointsToNextLevel,
      };
    } catch (error) {
      logger.error('Error getting user points:', error);
      throw new AppError('Failed to get user points', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Award points to a user for an action
   */
  async awardPoints(
    userId: string,
    action: string,
    points: number,
    description: string,
    metadata?: any
  ): Promise<{ pointsAwarded: number; newTotal: number; levelUp: boolean; newLevel?: number }> {
    const pool = getPostgresPool();
    const redis = getRedisClient();

    try {
      // Get current points
      const currentPoints = await this.getUserPoints(userId);
      const oldLevel = currentPoints.level;

      // Award points (this is tracked implicitly through actions in the database)
      // For explicit point awards, we could create a separate points_transactions table
      // For now, we'll just invalidate the cache and recalculate

      // Invalidate cache
      await redis.del(`user:${userId}:points`);

      // Get new total
      const newPoints = await this.getUserPoints(userId);
      const levelUp = newPoints.level > oldLevel;

      // Check for badge/achievement unlocks
      await this.checkBadgeUnlocks(userId);
      await this.checkAchievementProgress(userId);

      logger.info(`Awarded ${points} points to user ${userId} for ${action}`);

      return {
        pointsAwarded: points,
        newTotal: newPoints.totalPoints,
        levelUp,
        newLevel: levelUp ? newPoints.level : undefined,
      };
    } catch (error) {
      logger.error('Error awarding points:', error);
      throw new AppError('Failed to award points', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get all available badges
   */
  async getAllBadges(): Promise<Badge[]> {
    const pool = getPostgresPool();

    try {
      const result = await pool.query(
        `SELECT id, name, description, icon, category, criteria, rarity, points, created_at
         FROM badges
         ORDER BY 
           CASE rarity
             WHEN 'legendary' THEN 1
             WHEN 'epic' THEN 2
             WHEN 'rare' THEN 3
             WHEN 'common' THEN 4
           END,
           points DESC`
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        category: row.category,
        criteria: row.criteria,
        rarity: row.rarity,
        points: row.points,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error getting all badges:', error);
      throw new AppError('Failed to get badges', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get user's earned badges
   */
  async getUserBadges(userId: string): Promise<UserBadge[]> {
    const pool = getPostgresPool();

    try {
      const result = await pool.query(
        `SELECT 
           ub.id, ub.user_id, ub.badge_id, ub.earned_at, ub.progress,
           b.name, b.description, b.icon, b.category, b.criteria, b.rarity, b.points, b.created_at
         FROM user_badges ub
         JOIN badges b ON ub.badge_id = b.id
         WHERE ub.user_id = $1
         ORDER BY ub.earned_at DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        badgeId: row.badge_id,
        badge: {
          id: row.badge_id,
          name: row.name,
          description: row.description,
          icon: row.icon,
          category: row.category,
          criteria: row.criteria,
          rarity: row.rarity,
          points: row.points,
          createdAt: row.created_at,
        },
        earnedAt: row.earned_at,
        progress: row.progress,
      }));
    } catch (error) {
      logger.error('Error getting user badges:', error);
      throw new AppError('Failed to get user badges', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Award a badge to a user
   */
  async awardBadge(userId: string, badgeId: string): Promise<UserBadge> {
    const pool = getPostgresPool();

    try {
      // Check if user already has this badge
      const existing = await pool.query(
        'SELECT id FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [userId, badgeId]
      );

      if (existing.rows.length > 0) {
        throw new AppError('User already has this badge', 400, 'BADGE_ALREADY_EARNED');
      }

      // Award the badge
      const result = await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, progress)
         VALUES ($1, $2, 100)
         RETURNING id, user_id, badge_id, earned_at, progress`,
        [userId, badgeId]
      );

      // Get badge details
      const badgeResult = await pool.query(
        'SELECT * FROM badges WHERE id = $1',
        [badgeId]
      );

      const badge = badgeResult.rows[0];

      // Invalidate points cache (badges give points)
      const redis = getRedisClient();
      await redis.del(`user:${userId}:points`);

      logger.info(`Awarded badge ${badgeId} to user ${userId}`);

      return {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        badgeId: result.rows[0].badge_id,
        badge: {
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
          criteria: badge.criteria,
          rarity: badge.rarity,
          points: badge.points,
          createdAt: badge.created_at,
        },
        earnedAt: result.rows[0].earned_at,
        progress: result.rows[0].progress,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error awarding badge:', error);
      throw new AppError('Failed to award badge', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Check and unlock badges based on user activity
   */
  private async checkBadgeUnlocks(userId: string): Promise<void> {
    const pool = getPostgresPool();

    try {
      // Get all badges user doesn't have
      const badges = await pool.query(
        `SELECT b.* FROM badges b
         WHERE b.id NOT IN (
           SELECT badge_id FROM user_badges WHERE user_id = $1
         )`,
        [userId]
      );

      for (const badge of badges.rows) {
        const criteria = badge.criteria;
        let shouldAward = false;

        // Check criteria
        if (criteria.type === 'points') {
          const userPoints = await this.getUserPoints(userId);
          shouldAward = userPoints.totalPoints >= criteria.threshold;
        } else if (criteria.type === 'courses') {
          const result = await pool.query(
            'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = $1 AND passed = true',
            [userId]
          );
          shouldAward = parseInt(result.rows[0].count, 10) >= criteria.threshold;
        } else if (criteria.type === 'quiz') {
          const result = await pool.query(
            'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = $1 AND passed = true',
            [userId]
          );
          shouldAward = parseInt(result.rows[0].count, 10) >= criteria.threshold;
        } else if (criteria.type === 'streak') {
          const streak = await this.getUserStreak(userId);
          shouldAward = streak.currentStreak >= criteria.threshold;
        }

        if (shouldAward) {
          await this.awardBadge(userId, badge.id);
        }
      }
    } catch (error) {
      logger.error('Error checking badge unlocks:', error);
      // Don't throw - this is a background check
    }
  }

  /**
   * Get all available achievements
   */
  async getAllAchievements(): Promise<Achievement[]> {
    const pool = getPostgresPool();

    try {
      const result = await pool.query(
        `SELECT id, name, description, icon, type, requirement, points, created_at
         FROM achievements
         ORDER BY points DESC, requirement ASC`
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        type: row.type,
        requirement: row.requirement,
        points: row.points,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error getting all achievements:', error);
      throw new AppError('Failed to get achievements', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get user's achievement progress
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const pool = getPostgresPool();

    try {
      const result = await pool.query(
        `SELECT 
           ua.id, ua.user_id, ua.achievement_id, ua.progress, ua.completed, ua.completed_at,
           a.name, a.description, a.icon, a.type, a.requirement, a.points, a.created_at
         FROM user_achievements ua
         JOIN achievements a ON ua.achievement_id = a.id
         WHERE ua.user_id = $1
         ORDER BY ua.completed DESC, ua.progress DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        achievementId: row.achievement_id,
        achievement: {
          id: row.achievement_id,
          name: row.name,
          description: row.description,
          icon: row.icon,
          type: row.type,
          requirement: row.requirement,
          points: row.points,
          createdAt: row.created_at,
        },
        progress: row.progress,
        completed: row.completed,
        completedAt: row.completed_at,
      }));
    } catch (error) {
      logger.error('Error getting user achievements:', error);
      throw new AppError('Failed to get user achievements', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Update achievement progress for a user
   */
  private async checkAchievementProgress(userId: string): Promise<void> {
    const pool = getPostgresPool();

    try {
      // Get all achievements
      const achievements = await pool.query('SELECT * FROM achievements');

      for (const achievement of achievements.rows) {
        let progress = 0;

        // Calculate progress based on type
        if (achievement.type === 'course') {
          const result = await pool.query(
            'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = $1 AND passed = true',
            [userId]
          );
          progress = parseInt(result.rows[0].count, 10);
        } else if (achievement.type === 'quiz') {
          const result = await pool.query(
            'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = $1 AND passed = true',
            [userId]
          );
          progress = parseInt(result.rows[0].count, 10);
        } else if (achievement.type === 'assignment') {
          const result = await pool.query(
            'SELECT COUNT(*) as count FROM assignment_submissions WHERE user_id = $1',
            [userId]
          );
          progress = parseInt(result.rows[0].count, 10);
        } else if (achievement.type === 'social') {
          const result = await pool.query(
            'SELECT COUNT(*) as count FROM forum_posts WHERE user_id = $1',
            [userId]
          );
          progress = parseInt(result.rows[0].count, 10);
        } else if (achievement.type === 'streak') {
          const streak = await this.getUserStreak(userId);
          progress = streak.longestStreak;
        }

        const completed = progress >= achievement.requirement;

        // Upsert achievement progress
        await pool.query(
          `INSERT INTO user_achievements (user_id, achievement_id, progress, completed, completed_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, achievement_id)
           DO UPDATE SET 
             progress = EXCLUDED.progress,
             completed = EXCLUDED.completed,
             completed_at = CASE WHEN EXCLUDED.completed AND user_achievements.completed_at IS NULL THEN NOW() ELSE user_achievements.completed_at END`,
          [userId, achievement.id, progress, completed, completed ? new Date() : null]
        );
      }

      // Invalidate points cache
      const redis = getRedisClient();
      await redis.del(`user:${userId}:points`);
    } catch (error) {
      logger.error('Error checking achievement progress:', error);
      // Don't throw - this is a background check
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(
    period: 'daily' | 'weekly' | 'monthly' | 'all-time',
    scope: 'global' | 'course',
    scopeId?: string,
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    const pool = getPostgresPool();

    try {
      // For now, implement all-time global leaderboard
      // Period-based leaderboards would require tracking points with timestamps
      const result = await pool.query(
        `WITH user_points AS (
           SELECT 
             user_id,
             SUM(points) as total_points
           FROM (
             SELECT user_id, 50 as points FROM quiz_attempts WHERE passed = true
             UNION ALL
             SELECT user_id, 25 as points FROM assignment_submissions WHERE score IS NOT NULL
             UNION ALL
             SELECT user_id, 10 as points FROM forum_posts
             UNION ALL
             SELECT user_id, 5 as points FROM forum_replies
             UNION ALL
             SELECT ub.user_id, b.points FROM user_badges ub JOIN badges b ON ub.badge_id = b.id
             UNION ALL
             SELECT ua.user_id, a.points FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id WHERE ua.completed = true
           ) as all_points
           GROUP BY user_id
         ),
         user_badges_count AS (
           SELECT user_id, COUNT(*) as badge_count
           FROM user_badges
           GROUP BY user_id
         )
         SELECT 
           up.user_id,
           up.total_points,
           COALESCE(ubc.badge_count, 0) as badge_count,
           ROW_NUMBER() OVER (ORDER BY up.total_points DESC) as rank
         FROM user_points up
         LEFT JOIN user_badges_count ubc ON up.user_id = ubc.user_id
         ORDER BY up.total_points DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows.map((row) => {
        const { level } = this.calculateLevel(row.total_points);
        return {
          userId: row.user_id,
          userName: `User ${row.user_id.substring(0, 8)}`, // Would need to join with users table
          points: row.total_points,
          rank: row.rank,
          level,
          badgeCount: row.badge_count,
        };
      });
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      throw new AppError('Failed to get leaderboard', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get user's learning streak
   */
  async getUserStreak(userId: string): Promise<UserStreak> {
    const redis = getRedisClient();

    try {
      const streakKey = `user:${userId}:streak`;
      const streakData = await redis.hgetall(streakKey);

      if (Object.keys(streakData).length === 0) {
        // Initialize streak
        return {
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          freezesAvailable: 2,
        };
      }

      return {
        userId,
        currentStreak: parseInt(streakData.currentStreak || '0', 10),
        longestStreak: parseInt(streakData.longestStreak || '0', 10),
        lastActivityDate: new Date(streakData.lastActivityDate || new Date()),
        freezesAvailable: parseInt(streakData.freezesAvailable || '2', 10),
      };
    } catch (error) {
      logger.error('Error getting user streak:', error);
      throw new AppError('Failed to get user streak', 500, 'REDIS_ERROR');
    }
  }

  /**
   * Update user's learning streak
   */
  async updateStreak(userId: string): Promise<UserStreak> {
    const redis = getRedisClient();

    try {
      const streak = await this.getUserStreak(userId);
      const now = new Date();
      const lastActivity = new Date(streak.lastActivityDate);
      const daysDiff = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

      let newCurrentStreak = streak.currentStreak;
      let newLongestStreak = streak.longestStreak;

      if (daysDiff === 0) {
        // Same day, no change
        return streak;
      } else if (daysDiff === 1) {
        // Consecutive day
        newCurrentStreak += 1;
        newLongestStreak = Math.max(newLongestStreak, newCurrentStreak);
      } else if (daysDiff > 1) {
        // Streak broken
        newCurrentStreak = 1;
      }

      const streakKey = `user:${userId}:streak`;
      await redis.hmset(streakKey, {
        currentStreak: newCurrentStreak.toString(),
        longestStreak: newLongestStreak.toString(),
        lastActivityDate: now.toISOString(),
        freezesAvailable: streak.freezesAvailable.toString(),
      });

      // Check for streak-based achievements
      await this.checkBadgeUnlocks(userId);
      await this.checkAchievementProgress(userId);

      logger.info(`Updated streak for user ${userId}: ${newCurrentStreak} days`);

      return {
        userId,
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastActivityDate: now,
        freezesAvailable: streak.freezesAvailable,
      };
    } catch (error) {
      logger.error('Error updating user streak:', error);
      throw new AppError('Failed to update user streak', 500, 'REDIS_ERROR');
    }
  }

  /**
   * Freeze streak (use a streak freeze to prevent breaking)
   */
  async freezeStreak(userId: string): Promise<UserStreak> {
    const redis = getRedisClient();

    try {
      const streak = await this.getUserStreak(userId);

      if (streak.freezesAvailable <= 0) {
        throw new AppError('No streak freezes available', 400, 'NO_FREEZES_AVAILABLE');
      }

      const streakKey = `user:${userId}:streak`;
      await redis.hmset(streakKey, {
        currentStreak: streak.currentStreak.toString(),
        longestStreak: streak.longestStreak.toString(),
        lastActivityDate: new Date().toISOString(), // Update to today
        freezesAvailable: (streak.freezesAvailable - 1).toString(),
      });

      logger.info(`Froze streak for user ${userId}`);

      return {
        userId,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActivityDate: new Date(),
        freezesAvailable: streak.freezesAvailable - 1,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error freezing streak:', error);
      throw new AppError('Failed to freeze streak', 500, 'REDIS_ERROR');
    }
  }
}
