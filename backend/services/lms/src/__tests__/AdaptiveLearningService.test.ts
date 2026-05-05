/**
 * Unit Tests for AdaptiveLearningService
 */

import { AdaptiveLearningService } from '../services/AdaptiveLearningService';
import { getDatabase, getRedis, getMongoDB } from '@sai-mahendra/database';
import { AppError } from '@sai-mahendra/utils';

// Mock dependencies
jest.mock('@sai-mahendra/database');
jest.mock('@sai-mahendra/utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  AppError: class AppError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'AppError';
    }
  },
}));

describe('AdaptiveLearningService', () => {
  let adaptiveLearningService: AdaptiveLearningService;
  let mockDb: any;
  let mockRedis: any;
  let mockMongo: any;

  beforeEach(() => {
    mockDb = {
      queryMany: jest.fn(),
    };
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };
    mockMongo = {
      collection: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (getRedis as jest.Mock).mockReturnValue(mockRedis);
    (getMongoDB as jest.Mock).mockReturnValue(mockMongo);

    adaptiveLearningService = new AdaptiveLearningService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLearningPath', () => {
    const mockAssessmentHistory = [
      { percentage: 85, passed: true, type: 'quiz' },
      { percentage: 90, passed: true, type: 'quiz' },
      { percentage: 88, passed: true, type: 'exam' },
    ];

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.queryMany.mockResolvedValue(mockAssessmentHistory);
      
      const mockCollection = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([]),
      };
      mockMongo.collection.mockReturnValue(mockCollection);
    });

    it('should generate learning path for user', async () => {
      const result = await adaptiveLearningService.getLearningPath('user-123', 'course-123');

      expect(result.userId).toBe('user-123');
      expect(result.courseId).toBe('course-123');
      expect(result.currentLevel).toBeDefined();
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);
      expect(Array.isArray(result.recommendedContent)).toBe(true);
    });

    it('should return cached learning path if available', async () => {
      const cachedPath = {
        userId: 'user-123',
        courseId: 'course-123',
        currentLevel: 'advanced',
        strengths: ['topic1'],
        weaknesses: ['topic2'],
        completedContent: [],
        recommendedContent: [],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPath));

      const result = await adaptiveLearningService.getLearningPath('user-123', 'course-123');

      expect(result).toEqual(cachedPath);
      expect(mockDb.queryMany).not.toHaveBeenCalled();
    });

    it('should cache generated learning path', async () => {
      await adaptiveLearningService.getLearningPath('user-123', 'course-123');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'learning_path:user-123:course-123',
        3600,
        expect.any(String)
      );
    });

    it('should calculate correct level for beginner', async () => {
      mockDb.queryMany.mockResolvedValue([
        { percentage: 50, passed: false },
        { percentage: 55, passed: false },
      ]);

      const result = await adaptiveLearningService.getLearningPath('user-123', 'course-123');

      expect(result.currentLevel).toBe('beginner');
    });

    it('should calculate correct level for advanced user', async () => {
      mockDb.queryMany.mockResolvedValue([
        { percentage: 85, passed: true },
        { percentage: 90, passed: true },
        { percentage: 88, passed: true },
      ]);

      const result = await adaptiveLearningService.getLearningPath('user-123', 'course-123');

      expect(result.currentLevel).toBe('advanced');
    });

    it('should calculate correct level for expert user', async () => {
      mockDb.queryMany.mockResolvedValue([
        { percentage: 95, passed: true },
        { percentage: 92, passed: true },
        { percentage: 94, passed: true },
      ]);

      const result = await adaptiveLearningService.getLearningPath('user-123', 'course-123');

      expect(result.currentLevel).toBe('expert');
    });
  });

  describe('updateLearningPath', () => {
    const performanceData = {
      assessmentId: 'assessment-123',
      score: 85,
      passed: true,
      weakTopics: ['topic1', 'topic2'],
      strongTopics: ['topic3', 'topic4'],
    };

    beforeEach(() => {
      const mockCollection = {
        insertOne: jest.fn().mockResolvedValue({}),
        updateOne: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([]),
      };
      mockMongo.collection.mockReturnValue(mockCollection);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);
      mockDb.queryMany.mockResolvedValue([]);
    });

    it('should update learning path with new performance data', async () => {
      const result = await adaptiveLearningService.updateLearningPath(
        'user-123',
        'course-123',
        performanceData
      );

      expect(result).toBeDefined();
      expect(mockMongo.collection).toHaveBeenCalledWith('learning_performance');
    });

    it('should invalidate cache after update', async () => {
      await adaptiveLearningService.updateLearningPath(
        'user-123',
        'course-123',
        performanceData
      );

      expect(mockRedis.del).toHaveBeenCalledWith('learning_path:user-123:course-123');
    });

    it('should store performance data in MongoDB', async () => {
      const mockCollection = {
        insertOne: jest.fn().mockResolvedValue({}),
        updateOne: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([]),
      };
      mockMongo.collection.mockReturnValue(mockCollection);

      await adaptiveLearningService.updateLearningPath(
        'user-123',
        'course-123',
        performanceData
      );

      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          courseId: 'course-123',
          ...performanceData,
        })
      );
    });
  });

  describe('getLearningAnalytics', () => {
    it('should calculate learning analytics correctly', async () => {
      const mockPerformanceData = [
        {
          assessmentId: 'a1',
          score: 70,
          passed: true,
          timestamp: new Date('2024-01-01'),
          strongTopics: ['topic1'],
          weakTopics: ['topic2'],
        },
        {
          assessmentId: 'a2',
          score: 80,
          passed: true,
          timestamp: new Date('2024-01-02'),
          strongTopics: ['topic1', 'topic3'],
          weakTopics: ['topic2'],
        },
        {
          assessmentId: 'a3',
          score: 90,
          passed: true,
          timestamp: new Date('2024-01-03'),
          strongTopics: ['topic1', 'topic3'],
          weakTopics: [],
        },
      ];

      const mockCollection = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(mockPerformanceData),
      };
      mockMongo.collection.mockReturnValue(mockCollection);

      const result = await adaptiveLearningService.getLearningAnalytics('user-123', 'course-123');

      expect(result.userId).toBe('user-123');
      expect(result.courseId).toBe('course-123');
      expect(result.learningVelocity).toBeGreaterThan(0);
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);
    });

    it('should return default analytics for users with no data', async () => {
      const mockCollection = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([]),
      };
      mockMongo.collection.mockReturnValue(mockCollection);

      const result = await adaptiveLearningService.getLearningAnalytics('user-123');

      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
      expect(result.learningVelocity).toBe(0);
      expect(result.timeToMastery).toBe(0);
    });

    it('should calculate positive learning velocity for improving performance', async () => {
      const mockPerformanceData = [
        { score: 60, timestamp: new Date('2024-01-01') },
        { score: 70, timestamp: new Date('2024-01-02') },
        { score: 80, timestamp: new Date('2024-01-03') },
      ];

      const mockCollection = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(mockPerformanceData),
      };
      mockMongo.collection.mockReturnValue(mockCollection);

      const result = await adaptiveLearningService.getLearningAnalytics('user-123');

      expect(result.learningVelocity).toBeGreaterThan(0);
    });

    it('should calculate learning velocity correctly', async () => {
      const mockPerformanceData = [
        { score: 60, timestamp: new Date('2024-01-01') },
        { score: 70, timestamp: new Date('2024-01-02') },
        { score: 80, timestamp: new Date('2024-01-03') },
        { score: 90, timestamp: new Date('2024-01-04') },
      ];

      const mockCollection = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(mockPerformanceData),
      };
      mockMongo.collection.mockReturnValue(mockCollection);

      const result = await adaptiveLearningService.getLearningAnalytics('user-123');

      expect(result.learningVelocity).toBeDefined();
      expect(typeof result.learningVelocity).toBe('number');
    });

    it('should identify top strengths and weaknesses', async () => {
      const mockPerformanceData = [
        { strongTopics: ['topic1', 'topic2'], weakTopics: ['topic3'] },
        { strongTopics: ['topic1'], weakTopics: ['topic3', 'topic4'] },
        { strongTopics: ['topic1', 'topic2'], weakTopics: ['topic3'] },
      ];

      const mockCollection = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(mockPerformanceData),
      };
      mockMongo.collection.mockReturnValue(mockCollection);

      const result = await adaptiveLearningService.getLearningAnalytics('user-123');

      expect(result.strengths[0]).toBe('topic1'); // Most frequent strength
      expect(result.weaknesses[0]).toBe('topic3'); // Most frequent weakness
    });
  });

  describe('getRecommendations', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.queryMany.mockResolvedValue([
        { percentage: 75, passed: true },
      ]);
      
      const mockCollection = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([
          { strongTopics: ['topic1'], weakTopics: ['topic2'] },
        ]),
      };
      mockMongo.collection.mockReturnValue(mockCollection);
    });

    it('should generate content recommendations', async () => {
      const result = await adaptiveLearningService.getRecommendations('user-123', 'course-123');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should prioritize recommendations for weaknesses', async () => {
      const result = await adaptiveLearningService.getRecommendations('user-123', 'course-123');

      const weaknessRecommendations = result.filter(r => r.reason.includes('weakness'));
      expect(weaknessRecommendations.length).toBeGreaterThan(0);
    });

    it('should include content type and difficulty in recommendations', async () => {
      const result = await adaptiveLearningService.getRecommendations('user-123', 'course-123');

      result.forEach(recommendation => {
        expect(recommendation.contentType).toBeDefined();
        expect(recommendation.difficulty).toBeDefined();
        expect(recommendation.priority).toBeDefined();
      });
    });

    it('should sort recommendations by priority', async () => {
      const result = await adaptiveLearningService.getRecommendations('user-123', 'course-123');

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].priority).toBeGreaterThanOrEqual(result[i].priority);
      }
    });
  });
});
