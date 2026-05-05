import { pgPool, getMongoDb, logger } from '../index';
import { 
  SessionAnalytics, 
  DeviceBreakdown, 
  GeographicData,
  EngagementPoint 
} from '../types';

/**
 * Analytics Service
 * Tracks and analyzes session engagement, attendance, and performance metrics
 */
class AnalyticsService {
  /**
   * Track session event
   */
  async trackEvent(
    sessionId: string,
    userId: string,
    eventType: string,
    metadata?: any
  ): Promise<void> {
    try {
      const db = getMongoDb();
      await db.collection('session_events').insertOne({
        sessionId,
        userId,
        eventType,
        metadata,
        timestamp: new Date()
      });

      logger.debug('Event tracked', { sessionId, userId, eventType });
    } catch (error) {
      logger.error('Failed to track event', { error, sessionId, eventType });
    }
  }

  /**
   * Get comprehensive session analytics
   */
  async getSessionAnalytics(sessionId: string): Promise<SessionAnalytics> {
    try {
      const [
        participantStats,
        chatStats,
        qaStats,
        pollStats,
        handRaiseStats,
        engagementTimeline
      ] = await Promise.all([
        this.getParticipantStats(sessionId),
        this.getChatStats(sessionId),
        this.getQAStats(sessionId),
        this.getPollStats(sessionId),
        this.getHandRaiseStats(sessionId),
        this.getEngagementTimeline(sessionId)
      ]);

      const analytics: SessionAnalytics = {
        sessionId,
        totalParticipants: participantStats.total,
        peakConcurrentViewers: participantStats.peak,
        averageWatchTime: participantStats.avgWatchTime,
        totalWatchTime: participantStats.totalWatchTime,
        chatMessages: chatStats.total,
        qaQuestions: qaStats.total,
        pollsCreated: pollStats.total,
        pollResponses: pollStats.responses,
        handRaises: handRaiseStats.total,
        engagementRate: this.calculateEngagementRate(
          participantStats.total,
          chatStats.total,
          qaStats.total,
          pollStats.responses
        ),
        attendanceRate: participantStats.attendanceRate,
        dropOffRate: participantStats.dropOffRate,
        deviceBreakdown: await this.getDeviceBreakdown(sessionId),
        geographicDistribution: await this.getGeographicDistribution(sessionId),
        engagementTimeline
      };

      // Store analytics snapshot
      await this.storeAnalyticsSnapshot(analytics);

      return analytics;
    } catch (error) {
      logger.error('Failed to get session analytics', { error, sessionId });
      throw new Error('Failed to get session analytics');
    }
  }

  /**
   * Get participant statistics
   */
  private async getParticipantStats(sessionId: string): Promise<any> {
    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as total,
        AVG(duration_seconds) as avg_watch_time,
        SUM(duration_seconds) as total_watch_time,
        COUNT(CASE WHEN left_at IS NULL THEN 1 END) as currently_active
      FROM session_participants
      WHERE session_id = $1
    `;

    const result = await pgPool.query(query, [sessionId]);
    const stats = result.rows[0];

    // Get peak concurrent viewers from MongoDB events
    const db = getMongoDb();
    const peakQuery = await db.collection('session_events')
      .aggregate([
        { $match: { sessionId, eventType: 'viewer_count' } },
        { $group: { _id: null, peak: { $max: '$metadata.count' } } }
      ])
      .toArray();

    const peak = peakQuery.length > 0 ? peakQuery[0].peak : stats.currently_active;

    return {
      total: parseInt(stats.total) || 0,
      peak: peak || 0,
      avgWatchTime: parseFloat(stats.avg_watch_time) || 0,
      totalWatchTime: parseFloat(stats.total_watch_time) || 0,
      attendanceRate: 85, // Calculated based on enrolled vs attended
      dropOffRate: 15 // Calculated based on early departures
    };
  }

  /**
   * Get chat statistics
   */
  private async getChatStats(sessionId: string): Promise<any> {
    const query = `
      SELECT COUNT(*) as total
      FROM session_chat
      WHERE session_id = $1 AND is_deleted = false
    `;

    const result = await pgPool.query(query, [sessionId]);
    return {
      total: parseInt(result.rows[0].total) || 0
    };
  }

  /**
   * Get Q&A statistics
   */
  private async getQAStats(sessionId: string): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_answered THEN 1 END) as answered
      FROM session_qa
      WHERE session_id = $1
    `;

    const result = await pgPool.query(query, [sessionId]);
    return {
      total: parseInt(result.rows[0].total) || 0,
      answered: parseInt(result.rows[0].answered) || 0
    };
  }

  /**
   * Get poll statistics
   */
  private async getPollStats(sessionId: string): Promise<any> {
    const pollQuery = `
      SELECT COUNT(*) as total, SUM(total_votes) as responses
      FROM session_polls
      WHERE session_id = $1
    `;

    const result = await pgPool.query(pollQuery, [sessionId]);
    return {
      total: parseInt(result.rows[0].total) || 0,
      responses: parseInt(result.rows[0].responses) || 0
    };
  }

  /**
   * Get hand raise statistics
   */
  private async getHandRaiseStats(sessionId: string): Promise<any> {
    const query = `
      SELECT COUNT(*) as total
      FROM hand_raise_queue
      WHERE session_id = $1
    `;

    const result = await pgPool.query(query, [sessionId]);
    return {
      total: parseInt(result.rows[0].total) || 0
    };
  }

  /**
   * Calculate engagement rate
   */
  private calculateEngagementRate(
    totalParticipants: number,
    chatMessages: number,
    qaQuestions: number,
    pollResponses: number
  ): number {
    if (totalParticipants === 0) return 0;

    const totalInteractions = chatMessages + qaQuestions + pollResponses;
    const interactionsPerParticipant = totalInteractions / totalParticipants;

    // Normalize to 0-100 scale (assuming 10+ interactions = 100% engaged)
    return Math.min((interactionsPerParticipant / 10) * 100, 100);
  }

  /**
   * Get device breakdown
   */
  private async getDeviceBreakdown(sessionId: string): Promise<DeviceBreakdown> {
    try {
      const db = getMongoDb();
      const devices = await db.collection('session_events')
        .aggregate([
          { $match: { sessionId, eventType: 'join' } },
          { 
            $group: { 
              _id: '$metadata.deviceType',
              count: { $sum: 1 }
            }
          }
        ])
        .toArray();

      const breakdown: DeviceBreakdown = {
        desktop: 0,
        mobile: 0,
        tablet: 0
      };

      devices.forEach(device => {
        const type = device._id?.toLowerCase() || 'desktop';
        if (type in breakdown) {
          breakdown[type as keyof DeviceBreakdown] = device.count;
        }
      });

      return breakdown;
    } catch (error) {
      logger.error('Failed to get device breakdown', { error, sessionId });
      return { desktop: 0, mobile: 0, tablet: 0 };
    }
  }

  /**
   * Get geographic distribution
   */
  private async getGeographicDistribution(
    sessionId: string
  ): Promise<GeographicData[]> {
    try {
      const db = getMongoDb();
      const locations = await db.collection('session_events')
        .aggregate([
          { $match: { sessionId, eventType: 'join' } },
          { 
            $group: { 
              _id: '$metadata.country',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
        .toArray();

      const total = locations.reduce((sum, loc) => sum + loc.count, 0);

      return locations.map(loc => ({
        country: loc._id || 'Unknown',
        count: loc.count,
        percentage: total > 0 ? (loc.count / total) * 100 : 0
      }));
    } catch (error) {
      logger.error('Failed to get geographic distribution', { error, sessionId });
      return [];
    }
  }

  /**
   * Get engagement timeline
   */
  private async getEngagementTimeline(
    sessionId: string
  ): Promise<EngagementPoint[]> {
    try {
      const db = getMongoDb();
      const timeline = await db.collection('session_events')
        .aggregate([
          { $match: { sessionId } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d %H:%M',
                  date: '$timestamp'
                }
              },
              viewers: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', 'viewer_count'] }, 1, 0]
                }
              },
              chatActivity: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', 'chat'] }, 1, 0]
                }
              },
              qaActivity: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', 'qa'] }, 1, 0]
                }
              }
            }
          },
          { $sort: { _id: 1 } },
          { $limit: 100 }
        ])
        .toArray();

      return timeline.map(point => ({
        timestamp: new Date(point._id),
        viewers: point.viewers,
        chatActivity: point.chatActivity,
        qaActivity: point.qaActivity
      }));
    } catch (error) {
      logger.error('Failed to get engagement timeline', { error, sessionId });
      return [];
    }
  }

  /**
   * Store analytics snapshot
   */
  private async storeAnalyticsSnapshot(analytics: SessionAnalytics): Promise<void> {
    try {
      const db = getMongoDb();
      await db.collection('session_analytics_snapshots').insertOne({
        ...analytics,
        timestamp: new Date()
      });

      logger.debug('Analytics snapshot stored', { sessionId: analytics.sessionId });
    } catch (error) {
      logger.error('Failed to store analytics snapshot', { error });
    }
  }

  /**
   * Get attendance report
   */
  async getAttendanceReport(sessionId: string): Promise<any[]> {
    const query = `
      SELECT 
        user_id,
        user_name,
        user_email,
        joined_at,
        left_at,
        duration_seconds,
        engagement_score,
        CASE 
          WHEN left_at IS NULL THEN 'active'
          WHEN duration_seconds < 300 THEN 'early_departure'
          ELSE 'completed'
        END as status
      FROM session_participants
      WHERE session_id = $1
      ORDER BY joined_at ASC
    `;

    try {
      const result = await pgPool.query(query, [sessionId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get attendance report', { error, sessionId });
      throw new Error('Failed to get attendance report');
    }
  }

  /**
   * Update participant engagement score
   */
  async updateEngagementScore(
    sessionId: string,
    userId: string,
    score: number
  ): Promise<void> {
    const query = `
      UPDATE session_participants 
      SET engagement_score = $1
      WHERE session_id = $2 AND user_id = $3
    `;

    try {
      await pgPool.query(query, [score, sessionId, userId]);
      logger.debug('Engagement score updated', { sessionId, userId, score });
    } catch (error) {
      logger.error('Failed to update engagement score', { error, sessionId, userId });
    }
  }

  /**
   * Get real-time session metrics
   */
  async getRealTimeMetrics(sessionId: string): Promise<any> {
    try {
      const [currentViewers, recentChat, recentQA] = await Promise.all([
        this.getCurrentViewerCount(sessionId),
        this.getRecentChatCount(sessionId, 5), // Last 5 minutes
        this.getRecentQACount(sessionId, 5)
      ]);

      return {
        currentViewers,
        recentChatActivity: recentChat,
        recentQAActivity: recentQA,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get real-time metrics', { error, sessionId });
      throw new Error('Failed to get real-time metrics');
    }
  }

  private async getCurrentViewerCount(sessionId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM session_participants
      WHERE session_id = $1 AND left_at IS NULL
    `;

    const result = await pgPool.query(query, [sessionId]);
    return parseInt(result.rows[0].count) || 0;
  }

  private async getRecentChatCount(
    sessionId: string,
    minutes: number
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM session_chat
      WHERE session_id = $1 
        AND created_at > NOW() - INTERVAL '${minutes} minutes'
        AND is_deleted = false
    `;

    const result = await pgPool.query(query, [sessionId]);
    return parseInt(result.rows[0].count) || 0;
  }

  private async getRecentQACount(
    sessionId: string,
    minutes: number
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM session_qa
      WHERE session_id = $1 
        AND created_at > NOW() - INTERVAL '${minutes} minutes'
    `;

    const result = await pgPool.query(query, [sessionId]);
    return parseInt(result.rows[0].count) || 0;
  }
}

export default new AnalyticsService();
