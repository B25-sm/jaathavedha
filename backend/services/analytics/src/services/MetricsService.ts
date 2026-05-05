import { Db } from 'mongodb';
import { RedisClientType } from 'redis';
import {
  EnrollmentMetrics,
  RevenueMetrics,
  EngagementMetrics,
  RetentionMetrics,
  ConversionFunnel,
  DateRange,
  EventType,
  ProgramRevenue,
  GatewayRevenue,
  PageMetric,
  RetentionData
} from '../types';

export class MetricsService {
  constructor(
    private mongoDb: Db,
    private redisClient: RedisClientType
  ) {}

  // Enrollment Metrics Calculation
  async calculateEnrollmentMetrics(
    startDate: Date,
    endDate: Date,
    programId?: string
  ): Promise<EnrollmentMetrics[]> {
    const matchStage: any = {
      eventType: EventType.ENROLLMENT_COMPLETED,
      timestamp: { $gte: startDate, $lte: endDate }
    };

    if (programId) {
      matchStage['properties.programId'] = programId;
    }

    const enrollmentData = await this.mongoDb.collection('events').aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$properties.programId',
          programName: { $first: '$properties.programName' },
          totalEnrollments: { $sum: 1 },
          enrollmentDates: { $push: '$timestamp' }
        }
      }
    ]).toArray();

    const metrics: EnrollmentMetrics[] = [];

    for (const data of enrollmentData) {
      // Calculate completion metrics
      const completionData = await this.mongoDb.collection('events').aggregate([
        {
          $match: {
            eventType: EventType.COURSE_COMPLETED,
            'properties.programId': data._id,
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            completedCount: { $sum: 1 },
            completionTimes: { $push: '$properties.completionTimeInDays' }
          }
        }
      ]).toArray();

      const completed = completionData[0] || { completedCount: 0, completionTimes: [] };
      const averageCompletionTime = completed.completionTimes.length > 0
        ? completed.completionTimes.reduce((a: number, b: number) => a + b, 0) / completed.completionTimes.length
        : 0;

      metrics.push({
        programId: data._id,
        programName: data.programName || 'Unknown Program',
        totalEnrollments: data.totalEnrollments,
        activeEnrollments: data.totalEnrollments - completed.completedCount,
        completedEnrollments: completed.completedCount,
        averageCompletionTime,
        completionRate: (completed.completedCount / data.totalEnrollments) * 100,
        period: { start: startDate, end: endDate }
      });
    }

    return metrics;
  }

  // Revenue Metrics Calculation
  async calculateRevenueMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<RevenueMetrics> {
    const revenueData = await this.mongoDb.collection('events').aggregate([
      {
        $match: {
          eventType: EventType.PAYMENT_COMPLETED,
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$properties.amount' },
          transactionCount: { $sum: 1 },
          amounts: { $push: '$properties.amount' }
        }
      }
    ]).toArray();

    const revenue = revenueData[0] || { totalRevenue: 0, transactionCount: 0, amounts: [] };
    const averageOrderValue = revenue.transactionCount > 0
      ? revenue.totalRevenue / revenue.transactionCount
      : 0;

    // Revenue by program
    const revenueByProgram = await this.calculateRevenueByProgram(startDate, endDate);

    // Revenue by gateway
    const revenueByGateway = await this.calculateRevenueByGateway(startDate, endDate);

    return {
      totalRevenue: revenue.totalRevenue,
      transactionCount: revenue.transactionCount,
      averageOrderValue,
      revenueByProgram,
      revenueByGateway,
      period: { start: startDate, end: endDate }
    };
  }

  private async calculateRevenueByProgram(
    startDate: Date,
    endDate: Date
  ): Promise<ProgramRevenue[]> {
    const data = await this.mongoDb.collection('events').aggregate([
      {
        $match: {
          eventType: EventType.PAYMENT_COMPLETED,
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$properties.programId',
          programName: { $first: '$properties.programName' },
          revenue: { $sum: '$properties.amount' },
          enrollments: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]).toArray();

    return data.map(d => ({
      programId: d._id,
      programName: d.programName || 'Unknown Program',
      revenue: d.revenue,
      enrollments: d.enrollments
    }));
  }

  private async calculateRevenueByGateway(
    startDate: Date,
    endDate: Date
  ): Promise<GatewayRevenue[]> {
    const data = await this.mongoDb.collection('events').aggregate([
      {
        $match: {
          $or: [
            { eventType: EventType.PAYMENT_COMPLETED },
            { eventType: EventType.PAYMENT_FAILED }
          ],
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$properties.gateway',
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', EventType.PAYMENT_COMPLETED] },
                '$properties.amount',
                0
              ]
            }
          },
          successCount: {
            $sum: {
              $cond: [{ $eq: ['$eventType', EventType.PAYMENT_COMPLETED] }, 1, 0]
            }
          },
          totalCount: { $sum: 1 }
        }
      }
    ]).toArray();

    return data.map(d => ({
      gateway: d._id || 'unknown',
      revenue: d.revenue,
      transactionCount: d.totalCount,
      successRate: (d.successCount / d.totalCount) * 100
    }));
  }

  // User Engagement Metrics
  async calculateEngagementMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<EngagementMetrics> {
    const today = new Date();
    const dayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Active users
    const [dailyActive, weeklyActive, monthlyActive] = await Promise.all([
      this.mongoDb.collection('events').distinct('userId', {
        timestamp: { $gte: dayAgo },
        userId: { $exists: true, $ne: null }
      }),
      this.mongoDb.collection('events').distinct('userId', {
        timestamp: { $gte: weekAgo },
        userId: { $exists: true, $ne: null }
      }),
      this.mongoDb.collection('events').distinct('userId', {
        timestamp: { $gte: monthAgo },
        userId: { $exists: true, $ne: null }
      })
    ]);

    // Session metrics
    const sessionData = await this.mongoDb.collection('events').aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          sessionId: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$sessionId',
          pageViews: { $sum: 1 },
          startTime: { $min: '$timestamp' },
          endTime: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          pageViews: 1,
          duration: {
            $divide: [
              { $subtract: ['$endTime', '$startTime'] },
              1000
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' },
          avgPageViews: { $avg: '$pageViews' },
          totalSessions: { $sum: 1 }
        }
      }
    ]).toArray();

    const sessions = sessionData[0] || {
      avgDuration: 0,
      avgPageViews: 0,
      totalSessions: 0
    };

    // Bounce rate (sessions with only 1 page view)
    const bounceSessions = await this.mongoDb.collection('events').aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          sessionId: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$sessionId',
          pageViews: { $sum: 1 }
        }
      },
      {
        $match: { pageViews: 1 }
      },
      {
        $count: 'bounces'
      }
    ]).toArray();

    const bounceRate = sessions.totalSessions > 0
      ? ((bounceSessions[0]?.bounces || 0) / sessions.totalSessions) * 100
      : 0;

    // Top pages
    const topPages = await this.calculateTopPages(startDate, endDate);

    return {
      dailyActiveUsers: dailyActive.length,
      weeklyActiveUsers: weeklyActive.length,
      monthlyActiveUsers: monthlyActive.length,
      averageSessionDuration: sessions.avgDuration,
      averagePageViewsPerSession: sessions.avgPageViews,
      bounceRate,
      topPages,
      period: { start: startDate, end: endDate }
    };
  }

  private async calculateTopPages(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<PageMetric[]> {
    const data = await this.mongoDb.collection('page_views').aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$page',
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          page: '$_id',
          views: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' }
        }
      },
      { $sort: { views: -1 } },
      { $limit: limit }
    ]).toArray();

    return data.map(d => ({
      page: d.page,
      views: d.views,
      uniqueVisitors: d.uniqueVisitors,
      averageTimeOnPage: 0 // Would need session tracking for accurate calculation
    }));
  }

  // Retention Metrics
  async calculateRetentionMetrics(cohortDate: Date): Promise<RetentionMetrics> {
    // Get users who registered on cohort date
    const cohortUsers = await this.mongoDb.collection('events').distinct('userId', {
      eventType: EventType.USER_REGISTERED,
      timestamp: {
        $gte: new Date(cohortDate.getFullYear(), cohortDate.getMonth(), cohortDate.getDate()),
        $lt: new Date(cohortDate.getFullYear(), cohortDate.getMonth(), cohortDate.getDate() + 1)
      },
      userId: { $exists: true, $ne: null }
    });

    const totalUsers = cohortUsers.length;

    // Calculate retention by day (first 30 days)
    const retentionByDay: RetentionData[] = [];
    for (let day = 1; day <= 30; day++) {
      const targetDate = new Date(cohortDate.getTime() + day * 24 * 60 * 60 * 1000);
      const activeUsers = await this.mongoDb.collection('events').distinct('userId', {
        userId: { $in: cohortUsers },
        timestamp: {
          $gte: targetDate,
          $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      retentionByDay.push({
        period: day,
        activeUsers: activeUsers.length,
        retentionRate: totalUsers > 0 ? (activeUsers.length / totalUsers) * 100 : 0
      });
    }

    // Calculate retention by week (first 12 weeks)
    const retentionByWeek: RetentionData[] = [];
    for (let week = 1; week <= 12; week++) {
      const startDate = new Date(cohortDate.getTime() + week * 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const activeUsers = await this.mongoDb.collection('events').distinct('userId', {
        userId: { $in: cohortUsers },
        timestamp: { $gte: startDate, $lt: endDate }
      });

      retentionByWeek.push({
        period: week,
        activeUsers: activeUsers.length,
        retentionRate: totalUsers > 0 ? (activeUsers.length / totalUsers) * 100 : 0
      });
    }

    // Calculate retention by month (first 12 months)
    const retentionByMonth: RetentionData[] = [];
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(cohortDate);
      startDate.setMonth(startDate.getMonth() + month);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const activeUsers = await this.mongoDb.collection('events').distinct('userId', {
        userId: { $in: cohortUsers },
        timestamp: { $gte: startDate, $lt: endDate }
      });

      retentionByMonth.push({
        period: month,
        activeUsers: activeUsers.length,
        retentionRate: totalUsers > 0 ? (activeUsers.length / totalUsers) * 100 : 0
      });
    }

    return {
      cohortDate,
      totalUsers,
      retentionByDay,
      retentionByWeek,
      retentionByMonth
    };
  }

  // Conversion Funnel Analysis
  async calculateConversionFunnel(
    startDate: Date,
    endDate: Date
  ): Promise<ConversionFunnel> {
    const [visitors, signups, enrollmentStarts, paymentInitiated, paymentCompleted] = await Promise.all([
      // Unique visitors (page views)
      this.mongoDb.collection('page_views').distinct('sessionId', {
        timestamp: { $gte: startDate, $lte: endDate }
      }),
      // User registrations
      this.mongoDb.collection('events').countDocuments({
        eventType: EventType.USER_REGISTERED,
        timestamp: { $gte: startDate, $lte: endDate }
      }),
      // Enrollment starts
      this.mongoDb.collection('events').countDocuments({
        eventType: EventType.ENROLLMENT_STARTED,
        timestamp: { $gte: startDate, $lte: endDate }
      }),
      // Payment initiated
      this.mongoDb.collection('events').countDocuments({
        eventType: EventType.PAYMENT_INITIATED,
        timestamp: { $gte: startDate, $lte: endDate }
      }),
      // Payment completed
      this.mongoDb.collection('events').countDocuments({
        eventType: EventType.PAYMENT_COMPLETED,
        timestamp: { $gte: startDate, $lte: endDate }
      })
    ]);

    const visitorCount = visitors.length;

    return {
      visitors: visitorCount,
      signups,
      enrollmentStarts,
      paymentInitiated,
      paymentCompleted,
      conversionRates: {
        visitorToSignup: visitorCount > 0 ? (signups / visitorCount) * 100 : 0,
        signupToEnrollment: signups > 0 ? (enrollmentStarts / signups) * 100 : 0,
        enrollmentToPayment: enrollmentStarts > 0 ? (paymentInitiated / enrollmentStarts) * 100 : 0,
        paymentSuccess: paymentInitiated > 0 ? (paymentCompleted / paymentInitiated) * 100 : 0,
        overallConversion: visitorCount > 0 ? (paymentCompleted / visitorCount) * 100 : 0
      },
      period: { start: startDate, end: endDate }
    };
  }
}
