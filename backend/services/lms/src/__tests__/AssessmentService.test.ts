/**
 * Unit Tests for AssessmentService
 */

import { AssessmentService } from '../services/AssessmentService';
import { getDatabase } from '@sai-mahendra/database';
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

describe('AssessmentService', () => {
  let assessmentService: AssessmentService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: jest.fn(),
      queryOne: jest.fn(),
      queryMany: jest.fn(),
      update: jest.fn(),
    };
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    assessmentService = new AssessmentService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAssessment', () => {
    const validAssessmentData = {
      courseId: 'course-123',
      title: 'JavaScript Fundamentals Quiz',
      description: 'Test your knowledge of JavaScript basics',
      type: 'quiz' as const,
      duration: 1800,
      passingScore: 70,
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice' as const,
          question: 'What is JavaScript?',
          options: ['A programming language', 'A coffee brand', 'A framework'],
          correctAnswer: 'A programming language',
          points: 10,
          difficulty: 'easy' as const,
        },
      ],
      createdBy: 'user-123',
    };

    it('should create an assessment successfully', async () => {
      const mockAssessment = {
        id: 'assessment-123',
        ...validAssessmentData,
        questions: JSON.stringify(validAssessmentData.questions),
      };

      mockDb.insert.mockResolvedValue(mockAssessment);

      const result = await assessmentService.createAssessment(validAssessmentData);

      expect(mockDb.insert).toHaveBeenCalledWith('assessments', expect.objectContaining({
        course_id: validAssessmentData.courseId,
        title: validAssessmentData.title,
        type: validAssessmentData.type,
      }));
      expect(result.id).toBe('assessment-123');
      expect(result.questions).toEqual(validAssessmentData.questions);
    });

    it('should throw error if no questions provided', async () => {
      const invalidData = { ...validAssessmentData, questions: [] };

      await expect(assessmentService.createAssessment(invalidData))
        .rejects
        .toThrow('Assessment must have at least one question');
    });

    it('should throw error if duration is invalid', async () => {
      const invalidData = { ...validAssessmentData, duration: 30 };

      await expect(assessmentService.createAssessment(invalidData))
        .rejects
        .toThrow('Duration must be between 60 and 14400 seconds');
    });

    it('should assign default passing score if not provided', async () => {
      const dataWithoutPassingScore = { ...validAssessmentData };
      delete (dataWithoutPassingScore as any).passingScore;

      mockDb.insert.mockResolvedValue({
        id: 'assessment-123',
        passing_score: 70,
      });

      await assessmentService.createAssessment(dataWithoutPassingScore);

      expect(mockDb.insert).toHaveBeenCalledWith('assessments', expect.objectContaining({
        passing_score: 70,
      }));
    });
  });

  describe('getAssessmentById', () => {
    const mockAssessment = {
      id: 'assessment-123',
      title: 'Test Assessment',
      questions: JSON.stringify([
        {
          id: 'q1',
          question: 'What is 2+2?',
          correctAnswer: '4',
          explanation: 'Basic math',
        },
      ]),
    };

    it('should return assessment with answers when includeAnswers is true', async () => {
      mockDb.queryOne.mockResolvedValue(mockAssessment);

      const result = await assessmentService.getAssessmentById('assessment-123', true);

      expect(result.questions[0].correctAnswer).toBe('4');
      expect(result.questions[0].explanation).toBe('Basic math');
    });

    it('should return assessment without answers when includeAnswers is false', async () => {
      mockDb.queryOne.mockResolvedValue(mockAssessment);

      const result = await assessmentService.getAssessmentById('assessment-123', false);

      expect(result.questions[0].correctAnswer).toBeUndefined();
      expect(result.questions[0].explanation).toBeUndefined();
    });

    it('should throw error if assessment not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(assessmentService.getAssessmentById('nonexistent'))
        .rejects
        .toThrow('Assessment not found');
    });
  });

  describe('submitAssessmentAttempt', () => {
    const mockAttempt = {
      id: 'attempt-123',
      assessment_id: 'assessment-123',
      user_id: 'user-123',
      completed_at: null,
    };

    const mockAssessment = {
      id: 'assessment-123',
      passing_score: 70,
      show_feedback: true,
      type: 'quiz',
      course_id: 'course-123',
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'What is 2+2?',
          correctAnswer: '4',
          points: 10,
          explanation: 'Basic addition',
        },
        {
          id: 'q2',
          type: 'true-false',
          question: 'JavaScript is a programming language',
          correctAnswer: 'true',
          points: 10,
        },
      ],
    };

    beforeEach(() => {
      mockDb.queryOne.mockImplementation((query: string) => {
        if (query.includes('assessment_attempts')) {
          return Promise.resolve(mockAttempt);
        }
        if (query.includes('assessments')) {
          return Promise.resolve({
            ...mockAssessment,
            questions: JSON.stringify(mockAssessment.questions),
          });
        }
        return Promise.resolve(null);
      });
      mockDb.update.mockResolvedValue({});
    });

    it('should grade assessment correctly and provide feedback', async () => {
      const answers = {
        q1: '4',
        q2: 'true',
      };

      const result = await assessmentService.submitAssessmentAttempt('attempt-123', {
        assessmentId: 'assessment-123',
        userId: 'user-123',
        answers,
      });

      expect(result.percentage).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.feedback).toHaveLength(2);
      expect(result.feedback[0].isCorrect).toBe(true);
      expect(result.feedback[1].isCorrect).toBe(true);
    });

    it('should calculate partial score correctly', async () => {
      const answers = {
        q1: '4',
        q2: 'false', // Wrong answer
      };

      const result = await assessmentService.submitAssessmentAttempt('attempt-123', {
        assessmentId: 'assessment-123',
        userId: 'user-123',
        answers,
      });

      expect(result.percentage).toBe(50);
      expect(result.passed).toBe(false);
      expect(result.feedback[0].isCorrect).toBe(true);
      expect(result.feedback[1].isCorrect).toBe(false);
    });

    it('should throw error if attempt not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        assessmentService.submitAssessmentAttempt('nonexistent', {
          assessmentId: 'assessment-123',
          userId: 'user-123',
          answers: {},
        })
      ).rejects.toThrow('Assessment attempt not found');
    });

    it('should throw error if attempt already submitted', async () => {
      mockDb.queryOne.mockResolvedValue({
        ...mockAttempt,
        completed_at: new Date(),
      });

      await expect(
        assessmentService.submitAssessmentAttempt('attempt-123', {
          assessmentId: 'assessment-123',
          userId: 'user-123',
          answers: {},
        })
      ).rejects.toThrow('Assessment attempt already submitted');
    });

    it('should include recommendations when feedback is enabled', async () => {
      const answers = {
        q1: '4',
        q2: 'true',
      };

      const result = await assessmentService.submitAssessmentAttempt('attempt-123', {
        assessmentId: 'assessment-123',
        userId: 'user-123',
        answers,
      });

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('getLearningAnalytics', () => {
    it('should calculate analytics correctly', async () => {
      const mockAttempts = [
        {
          assessment_id: 'a1',
          title: 'Quiz 1',
          type: 'quiz',
          course_id: 'course-123',
          percentage: 80,
          passed: true,
          completed_at: new Date(),
          time_spent: 600,
          attempt_number: 1,
        },
        {
          assessment_id: 'a2',
          title: 'Quiz 2',
          type: 'quiz',
          course_id: 'course-123',
          percentage: 90,
          passed: true,
          completed_at: new Date(),
          time_spent: 500,
          attempt_number: 1,
        },
      ];

      mockDb.queryMany.mockResolvedValue(mockAttempts);

      const result = await assessmentService.getLearningAnalytics('user-123', 'course-123');

      expect(result.summary.totalAttempts).toBe(2);
      expect(result.summary.passedAttempts).toBe(2);
      expect(result.summary.passRate).toBe(100);
      expect(result.summary.averageScore).toBe(85);
      expect(result.summary.totalTimeSpent).toBe(1100);
    });

    it('should handle empty attempt history', async () => {
      mockDb.queryMany.mockResolvedValue([]);

      const result = await assessmentService.getLearningAnalytics('user-123');

      expect(result.summary.totalAttempts).toBe(0);
      expect(result.summary.averageScore).toBe(0);
    });

    it('should identify improving trend', async () => {
      const mockAttempts = [
        { percentage: 60, passed: false },
        { percentage: 70, passed: true },
        { percentage: 80, passed: true },
        { percentage: 90, passed: true },
      ];

      mockDb.queryMany.mockResolvedValue(mockAttempts);

      const result = await assessmentService.getLearningAnalytics('user-123');

      expect(result.trend).toBe('improving');
    });
  });

  describe('startAssessmentAttempt', () => {
    const mockAssessment = {
      id: 'assessment-123',
      allow_retake: true,
      max_attempts: 3,
      randomize_questions: false,
      randomize_options: false,
      questions: [
        { id: 'q1', question: 'Question 1', options: ['A', 'B', 'C'] },
        { id: 'q2', question: 'Question 2', options: ['X', 'Y', 'Z'] },
      ],
    };

    beforeEach(() => {
      mockDb.queryOne.mockResolvedValue({
        ...mockAssessment,
        questions: JSON.stringify(mockAssessment.questions),
      });
      mockDb.queryMany.mockResolvedValue([]);
      mockDb.insert.mockResolvedValue({
        id: 'attempt-123',
        started_at: new Date(),
      });
    });

    it('should start assessment attempt successfully', async () => {
      const result = await assessmentService.startAssessmentAttempt('assessment-123', 'user-123');

      expect(result.attemptId).toBe('attempt-123');
      expect(result.attemptNumber).toBe(1);
      expect(result.assessment.questions).toHaveLength(2);
    });

    it('should throw error if max attempts exceeded', async () => {
      mockDb.queryMany.mockResolvedValue([{}, {}, {}]); // 3 previous attempts

      await expect(
        assessmentService.startAssessmentAttempt('assessment-123', 'user-123')
      ).rejects.toThrow('Maximum attempts (3) exceeded');
    });

    it('should throw error if retakes not allowed', async () => {
      mockDb.queryOne.mockResolvedValue({
        ...mockAssessment,
        allow_retake: false,
        questions: JSON.stringify(mockAssessment.questions),
      });
      mockDb.queryMany.mockResolvedValue([{}]); // 1 previous attempt

      await expect(
        assessmentService.startAssessmentAttempt('assessment-123', 'user-123')
      ).rejects.toThrow('Retakes are not allowed for this assessment');
    });

    it('should randomize questions when enabled', async () => {
      mockDb.queryOne.mockResolvedValue({
        ...mockAssessment,
        randomize_questions: true,
        questions: JSON.stringify(mockAssessment.questions),
      });

      const result = await assessmentService.startAssessmentAttempt('assessment-123', 'user-123');

      expect(result.assessment.questions).toHaveLength(2);
      // Questions should still be present, just potentially in different order
      expect(result.assessment.questions.some((q: any) => q.id === 'q1')).toBe(true);
      expect(result.assessment.questions.some((q: any) => q.id === 'q2')).toBe(true);
    });
  });
});
