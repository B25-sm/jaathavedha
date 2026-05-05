import { MetricsService } from '../services/MetricsService';
import { EventType } from '../types';

describe('MetricsService', () => {
  let metricsService: MetricsService;
  let mockMongoDb: any;
  let mockRedisClient: any;

  beforeEach(() => {
    // Mock MongoDB
    mockMongoDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        }),
        distinct: jest.fn().mockResolvedValue([]),
        countDocuments: jest.fn().mockResolvedValue(0)
      })
    };

    // Mock Redis
    mockRedisClient = {
      sCard: jest.fn().mockResolvedValue(0),
      get: jest.fn().mockResolvedValue('0')
    };

    metricsService = new MetricsService(mockMongoDb, mockRedisClient);
  });

  describe('calculateEnrollmentMetrics', () => {
    it('should calculate enrollment metrics for a date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockEnrollmentData = [
        {
          _id: 'program-1',
          programName: 'Test Program',
          totalEnrollments: 10,
          enrollmentDates: []
        }
      ];

      const mockCompletionData = [
        {
          completedCount: 5,
          completionTimes: [30, 35, 40, 45, 50]
        }
      ];

      mockMongoDb.collection.mockReturnValue({
        aggregate: jest.fn()
          .mockReturnValueOnce({
            toArray: jest.fn().mockResolvedValue(mockEnrollmentData)
          })
          .mockReturnValueOnce({
            toArray: jest.fn().mockResolvedValue(mockCompletionData)
          })
      });

      const result = await metricsService.calculateEnrollmentMetrics(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].programId).toBe('program-1');
      expect(result[0].totalEnrollments).toBe(10);
      expect(result[0].completedEnrollments).toBe(5);
      expect(result[0].completionRate).toBe(50);
    });

    it('should handle empty enrollment data', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockMongoDb.collection.mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      });

      const result = await metricsService.calculateEnrollmentMetrics(startDate, endDate);

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateRevenueMetrics', () => {
    it('should calculate revenue metrics correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRevenueData = [
        {
          totalRevenue: 10000,
          transactionCount: 20,
          amounts: [500, 500, 500]
        }
      ];

      mockMongoDb.collection.mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockRevenueData)
        })
      });

      const result = await metricsService.calculateRevenueMetrics(startDate, endDate);

      expect(result.totalRevenue).toBe(10000);
      expect(result.transactionCount).toBe(20);
      expect(result.averageOrderValue).toBe(500);
    });

    it('should handle zero revenue', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockMongoDb.collection.mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      });

      const result = await metricsService.calculateRevenueMetrics(startDate, endDate);

      expect(result.totalRevenue).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.averageOrderValue).toBe(0);
    });
  });

  describe('calculateEngagementMetrics', () => {
    it('should calculate engagement metrics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockMongoDb.collection.mockReturnValue({
        distinct: jest.fn()
          .mockResolvedValueOnce(['user1', 'user2']) // daily
          .mockResolvedValueOnce(['user1', 'user2', 'user3']) // weekly
          .mockResolvedValueOnce(['user1', 'user2', 'user3', 'user4']), // monthly
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            {
              avgDuration: 300,
              avgPageViews: 5,
              totalSessions: 100
            }
          ])
        })
      });

      const result = await metricsService.calculateEngagementMetrics(startDate, endDate);

      expect(result.dailyActiveUsers).toBe(2);
      expect(result.weeklyActiveUsers).toBe(3);
      expect(result.monthlyActiveUsers).toBe(4);
      expect(result.averageSessionDuration).toBe(300);
    });
  });

  describe('calculateConversionFunnel', () => {
    it('should calculate conversion funnel correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockMongoDb.collection.mockReturnValue({
        distinct: jest.fn().mockResolvedValue(['session1', 'session2', 'session3', 'session4', 'session5']),
        countDocuments: jest.fn()
          .mockResolvedValueOnce(100) // signups
          .mockResolvedValueOnce(80)  // enrollment starts
          .mockResolvedValueOnce(60)  // payment initiated
          .mockResolvedValueOnce(50)  // payment completed
      });

      const result = await metricsService.calculateConversionFunnel(startDate, endDate);

      expect(result.visitors).toBe(5);
      expect(result.signups).toBe(100);
      expect(result.enrollmentStarts).toBe(80);
      expect(result.paymentInitiated).toBe(60);
      expect(result.paymentCompleted).toBe(50);
      expect(result.conversionRates.visitorToSignup).toBeGreaterThan(0);
      expect(result.conversionRates.overallConversion).toBeGreaterThan(0);
    });

    it('should handle zero conversions', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockMongoDb.collection.mockReturnValue({
        distinct: jest.fn().mockResolvedValue([]),
        countDocuments: jest.fn().mockResolvedValue(0)
      });

      const result = await metricsService.calculateConversionFunnel(startDate, endDate);

      expect(result.visitors).toBe(0);
      expect(result.conversionRates.overallConversion).toBe(0);
    });
  });
});
