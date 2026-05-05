import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface Question {
  id: string;
  type: 'multiple-choice' | 'multiple-select' | 'true-false' | 'short-answer' | 'essay' | 'code';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

interface AssessmentData {
  courseId: string;
  title: string;
  description: string;
  type: 'quiz' | 'exam' | 'practice' | 'adaptive';
  duration: number;
  passingScore?: number;
  questions: Question[];
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  showFeedback?: boolean;
  allowRetake?: boolean;
  maxAttempts?: number;
  createdBy: string;
}

interface AssessmentAttemptData {
  assessmentId: string;
  userId: string;
  answers: Record<string, any>;
  timeSpent?: number;
}

interface FeedbackItem {
  questionId: string;
  question: string;
  userAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  explanation?: string;
  points: number;
  earnedPoints: number;
}

export class AssessmentService {
  private db = getDatabase();

  /**
   * Create a new assessment
   */
  async createAssessment(assessmentData: AssessmentData) {
    try {
      // Validate assessment data
      if (!assessmentData.questions || assessmentData.questions.length === 0) {
        throw new AppError('Assessment must have at least one question', 400);
      }

      if (assessmentData.duration < 60 || assessmentData.duration > 14400) {
        throw new AppError('Duration must be between 60 and 14400 seconds', 400);
      }

      // Assign unique IDs to questions if not present
      const questionsWithIds = assessmentData.questions.map((q, index) => ({
        ...q,
        id: q.id || `q${index + 1}`,
      }));

      const assessment = await this.db.insert('assessments', {
        course_id: assessmentData.courseId,
        title: assessmentData.title,
        description: assessmentData.description,
        type: assessmentData.type,
        duration: assessmentData.duration,
        passing_score: assessmentData.passingScore || 70,
        questions: JSON.stringify(questionsWithIds),
        randomize_questions: assessmentData.randomizeQuestions || false,
        randomize_options: assessmentData.randomizeOptions || false,
        show_feedback: assessmentData.showFeedback !== false,
        allow_retake: assessmentData.allowRetake !== false,
        max_attempts: assessmentData.maxAttempts || 3,
        created_by: assessmentData.createdBy,
      });

      logger.info('Assessment created successfully', {
        assessmentId: assessment.id,
        courseId: assessmentData.courseId,
        questionCount: questionsWithIds.length,
      });

      return {
        ...assessment,
        questions: questionsWithIds,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create assessment', { error, assessmentData });
      throw new AppError('Failed to create assessment', 500);
    }
  }

  /**
   * Get assessment by ID
   */
  async getAssessmentById(assessmentId: string, includeAnswers: boolean = false) {
    try {
      const assessment = await this.db.queryOne(
        'SELECT * FROM assessments WHERE id = $1',
        [assessmentId]
      );

      if (!assessment) {
        throw new AppError('Assessment not found', 404);
      }

      const questions = JSON.parse(assessment.questions as string);

      // Remove correct answers if not requested (for student view)
      const sanitizedQuestions = includeAnswers
        ? questions
        : questions.map((q: Question) => {
            const { correctAnswer, explanation, ...rest } = q;
            return rest;
          });

      return {
        ...assessment,
        questions: sanitizedQuestions,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get assessment', { error, assessmentId });
      throw new AppError('Failed to retrieve assessment', 500);
    }
  }

  /**
   * Get assessments by course
   */
  async getAssessmentsByCourse(courseId: string) {
    try {
      const assessments = await this.db.queryMany(
        `SELECT id, course_id, title, description, type, duration, 
                passing_score, allow_retake, max_attempts, created_at
         FROM assessments 
         WHERE course_id = $1 
         ORDER BY created_at DESC`,
        [courseId]
      );

      return assessments;
    } catch (error) {
      logger.error('Failed to get assessments by course', { error, courseId });
      throw new AppError('Failed to retrieve assessments', 500);
    }
  }

  /**
   * Start an assessment attempt
   */
  async startAssessmentAttempt(assessmentId: string, userId: string) {
    try {
      const assessment = await this.getAssessmentById(assessmentId, false);

      // Check if user has exceeded max attempts
      const previousAttempts = await this.getUserAttempts(userId, assessmentId);
      
      if (!assessment.allow_retake && previousAttempts.length > 0) {
        throw new AppError('Retakes are not allowed for this assessment', 403);
      }

      if (previousAttempts.length >= assessment.max_attempts) {
        throw new AppError(`Maximum attempts (${assessment.max_attempts}) exceeded`, 403);
      }

      const attemptNumber = previousAttempts.length + 1;

      // Randomize questions if enabled
      let questions = assessment.questions;
      if (assessment.randomize_questions) {
        questions = this.shuffleArray([...questions]);
      }

      // Randomize options if enabled
      if (assessment.randomize_options) {
        questions = questions.map((q: Question) => {
          if (q.options && q.options.length > 0) {
            return {
              ...q,
              options: this.shuffleArray([...q.options]),
            };
          }
          return q;
        });
      }

      // Create attempt record
      const attempt = await this.db.insert('assessment_attempts', {
        assessment_id: assessmentId,
        user_id: userId,
        answers: JSON.stringify({}),
        score: 0,
        percentage: 0,
        passed: false,
        attempt_number: attemptNumber,
        time_spent: 0,
      });

      logger.info('Assessment attempt started', {
        attemptId: attempt.id,
        assessmentId,
        userId,
        attemptNumber,
      });

      return {
        attemptId: attempt.id,
        assessment: {
          ...assessment,
          questions,
        },
        attemptNumber,
        startedAt: attempt.started_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to start assessment attempt', { error, assessmentId, userId });
      throw new AppError('Failed to start assessment attempt', 500);
    }
  }

  /**
   * Submit assessment attempt with immediate feedback
   */
  async submitAssessmentAttempt(attemptId: string, attemptData: AssessmentAttemptData) {
    try {
      // Get the attempt
      const attempt = await this.db.queryOne(
        'SELECT * FROM assessment_attempts WHERE id = $1',
        [attemptId]
      );

      if (!attempt) {
        throw new AppError('Assessment attempt not found', 404);
      }

      if (attempt.completed_at) {
        throw new AppError('Assessment attempt already submitted', 400);
      }

      // Get assessment with correct answers
      const assessment = await this.getAssessmentById(attempt.assessment_id, true);
      const questions = assessment.questions as Question[];

      // Grade the assessment and generate feedback
      const { score, percentage, passed, feedback, totalPoints, earnedPoints } = 
        this.gradeAssessment(questions, attemptData.answers, assessment.passing_score);

      // Update attempt record
      await this.db.update(
        'assessment_attempts',
        attemptId,
        {
          answers: JSON.stringify(attemptData.answers),
          score: earnedPoints,
          percentage,
          passed,
          completed_at: new Date(),
          time_spent: attemptData.timeSpent || 0,
        }
      );

      // Award points if passed (integrate with gamification)
      if (passed) {
        try {
          const pointsToAward = this.calculatePointsForAssessment(assessment.type, percentage);
          await this.awardPoints(attemptData.userId, pointsToAward, 'assessment_passed', {
            assessmentId: assessment.id,
            attemptId,
            score: percentage,
          });
        } catch (error) {
          logger.warn('Failed to award points for assessment completion', {
            error,
            userId: attemptData.userId,
            assessmentId: assessment.id,
          });
        }
      }

      // Update adaptive learning path based on performance
      try {
        await this.updateAdaptiveLearningPath(attemptData.userId, assessment.course_id, {
          assessmentId: assessment.id,
          score: percentage,
          passed,
          weakTopics: this.identifyWeakTopics(feedback),
          strongTopics: this.identifyStrongTopics(feedback),
        });
      } catch (error) {
        logger.warn('Failed to update adaptive learning path', {
          error,
          userId: attemptData.userId,
        });
      }

      logger.info('Assessment attempt submitted', {
        attemptId,
        userId: attemptData.userId,
        score: percentage,
        passed,
      });

      // Return immediate feedback if enabled
      const result: any = {
        attemptId,
        score: earnedPoints,
        totalPoints,
        percentage,
        passed,
        passingScore: assessment.passing_score,
        completedAt: new Date(),
      };

      if (assessment.show_feedback) {
        result.feedback = feedback;
        result.recommendations = await this.generateRecommendations(
          attemptData.userId,
          assessment.course_id,
          feedback
        );
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to submit assessment attempt', { error, attemptId });
      throw new AppError('Failed to submit assessment attempt', 500);
    }
  }

  /**
   * Get user's assessment attempts
   */
  async getUserAttempts(userId: string, assessmentId: string) {
    try {
      const attempts = await this.db.queryMany(
        `SELECT * FROM assessment_attempts 
         WHERE user_id = $1 AND assessment_id = $2 
         ORDER BY started_at DESC`,
        [userId, assessmentId]
      );

      return attempts.map((attempt) => ({
        ...attempt,
        answers: attempt.answers ? JSON.parse(attempt.answers as string) : {},
      }));
    } catch (error) {
      logger.error('Failed to get user attempts', { error, userId, assessmentId });
      throw new AppError('Failed to retrieve assessment attempts', 500);
    }
  }

  /**
   * Get detailed learning analytics for a user
   */
  async getLearningAnalytics(userId: string, courseId?: string) {
    try {
      let query = `
        SELECT 
          aa.assessment_id,
          a.title,
          a.type,
          a.course_id,
          aa.percentage,
          aa.passed,
          aa.completed_at,
          aa.time_spent,
          aa.attempt_number
        FROM assessment_attempts aa
        JOIN assessments a ON aa.assessment_id = a.id
        WHERE aa.user_id = $1 AND aa.completed_at IS NOT NULL
      `;
      
      const params: any[] = [userId];
      
      if (courseId) {
        query += ' AND a.course_id = $2';
        params.push(courseId);
      }
      
      query += ' ORDER BY aa.completed_at DESC';

      const attempts = await this.db.queryMany(query, params);

      // Calculate analytics
      const totalAttempts = attempts.length;
      const passedAttempts = attempts.filter((a: any) => a.passed).length;
      const averageScore = totalAttempts > 0
        ? attempts.reduce((sum: number, a: any) => sum + a.percentage, 0) / totalAttempts
        : 0;
      const totalTimeSpent = attempts.reduce((sum: number, a: any) => sum + (a.time_spent || 0), 0);

      // Group by assessment type
      const byType = attempts.reduce((acc: any, attempt: any) => {
        if (!acc[attempt.type]) {
          acc[attempt.type] = {
            total: 0,
            passed: 0,
            averageScore: 0,
            scores: [],
          };
        }
        acc[attempt.type].total++;
        if (attempt.passed) acc[attempt.type].passed++;
        acc[attempt.type].scores.push(attempt.percentage);
        return acc;
      }, {});

      // Calculate averages for each type
      Object.keys(byType).forEach((type) => {
        const scores = byType[type].scores;
        byType[type].averageScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        delete byType[type].scores;
      });

      // Identify trends
      const recentAttempts = attempts.slice(0, 5);
      const trend = this.calculateTrend(recentAttempts.map((a: any) => a.percentage));

      return {
        userId,
        courseId,
        summary: {
          totalAttempts,
          passedAttempts,
          passRate: totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0,
          averageScore: Math.round(averageScore),
          totalTimeSpent,
          averageTimePerAttempt: totalAttempts > 0 ? Math.round(totalTimeSpent / totalAttempts) : 0,
        },
        byType,
        trend,
        recentAttempts: recentAttempts.map((a: any) => ({
          assessmentId: a.assessment_id,
          title: a.title,
          type: a.type,
          score: a.percentage,
          passed: a.passed,
          completedAt: a.completed_at,
        })),
      };
    } catch (error) {
      logger.error('Failed to get learning analytics', { error, userId, courseId });
      throw new AppError('Failed to retrieve learning analytics', 500);
    }
  }

  /**
   * Grade assessment and generate detailed feedback
   */
  private gradeAssessment(
    questions: Question[],
    answers: Record<string, any>,
    passingScore: number
  ): {
    score: number;
    percentage: number;
    passed: boolean;
    feedback: FeedbackItem[];
    totalPoints: number;
    earnedPoints: number;
  } {
    let totalPoints = 0;
    let earnedPoints = 0;
    const feedback: FeedbackItem[] = [];

    questions.forEach((question) => {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const isCorrect = this.isAnswerCorrect(question, userAnswer);
      const pointsEarned = isCorrect ? question.points : 0;
      earnedPoints += pointsEarned;

      feedback.push({
        questionId: question.id,
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation,
        points: question.points,
        earnedPoints: pointsEarned,
      });
    });

    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = percentage >= passingScore;

    return {
      score: earnedPoints,
      percentage,
      passed,
      feedback,
      totalPoints,
      earnedPoints,
    };
  }

  /**
   * Check if answer is correct
   */
  private isAnswerCorrect(question: Question, userAnswer: any): boolean {
    if (!userAnswer) return false;

    switch (question.type) {
      case 'multiple-choice':
        return userAnswer === question.correctAnswer;

      case 'multiple-select':
        if (!Array.isArray(question.correctAnswer) || !Array.isArray(userAnswer)) {
          return false;
        }
        const correctSet = new Set(question.correctAnswer);
        const userSet = new Set(userAnswer);
        return (
          correctSet.size === userSet.size &&
          [...correctSet].every((ans) => userSet.has(ans))
        );

      case 'true-false':
        return (
          userAnswer.toString().toLowerCase() ===
          question.correctAnswer.toString().toLowerCase()
        );

      case 'short-answer':
        const correctAnswers = Array.isArray(question.correctAnswer)
          ? question.correctAnswer
          : [question.correctAnswer];
        const normalizedUserAnswer = userAnswer.toString().trim().toLowerCase();
        return correctAnswers.some(
          (ans) => ans.toString().trim().toLowerCase() === normalizedUserAnswer
        );

      case 'essay':
      case 'code':
        // These require manual grading
        return false;

      default:
        return false;
    }
  }

  /**
   * Identify weak topics from feedback
   */
  private identifyWeakTopics(feedback: FeedbackItem[]): string[] {
    const weakTopics: string[] = [];
    feedback.forEach((item) => {
      if (!item.isCorrect) {
        // Extract topics from question (this is simplified)
        weakTopics.push(item.questionId);
      }
    });
    return weakTopics;
  }

  /**
   * Identify strong topics from feedback
   */
  private identifyStrongTopics(feedback: FeedbackItem[]): string[] {
    const strongTopics: string[] = [];
    feedback.forEach((item) => {
      if (item.isCorrect) {
        strongTopics.push(item.questionId);
      }
    });
    return strongTopics;
  }

  /**
   * Calculate points to award based on assessment type and score
   */
  private calculatePointsForAssessment(type: string, percentage: number): number {
    const basePoints: Record<string, number> = {
      quiz: 50,
      practice: 25,
      exam: 100,
      adaptive: 75,
    };

    const base = basePoints[type] || 50;
    
    // Bonus for high scores
    if (percentage >= 90) return Math.round(base * 1.5);
    if (percentage >= 80) return Math.round(base * 1.2);
    return base;
  }

  /**
   * Calculate trend from recent scores
   */
  private calculateTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
    if (scores.length < 2) return 'stable';

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;

    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }

  /**
   * Shuffle array (Fisher-Yates algorithm)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate personalized recommendations based on performance
   */
  private async generateRecommendations(
    userId: string,
    courseId: string,
    feedback: FeedbackItem[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    const incorrectCount = feedback.filter((f) => !f.isCorrect).length;
    const totalCount = feedback.length;
    const correctPercentage = ((totalCount - incorrectCount) / totalCount) * 100;

    if (correctPercentage < 50) {
      recommendations.push('Consider reviewing the course materials before retaking this assessment');
      recommendations.push('Focus on understanding core concepts rather than memorization');
    } else if (correctPercentage < 70) {
      recommendations.push('Review the topics where you struggled');
      recommendations.push('Practice with additional exercises to reinforce your understanding');
    } else if (correctPercentage < 90) {
      recommendations.push('Great job! Review the questions you missed to achieve mastery');
      recommendations.push('Consider helping peers who are struggling with these topics');
    } else {
      recommendations.push('Excellent work! You have mastered this material');
      recommendations.push('Consider moving on to more advanced topics');
    }

    return recommendations;
  }

  /**
   * Update adaptive learning path based on assessment performance
   */
  private async updateAdaptiveLearningPath(
    userId: string,
    courseId: string,
    performanceData: any
  ): Promise<void> {
    // This would integrate with the AdaptiveLearningService
    // For now, we'll just log it
    logger.info('Updating adaptive learning path', {
      userId,
      courseId,
      performanceData,
    });
  }

  /**
   * Award points to user (integrates with gamification)
   */
  private async awardPoints(
    userId: string,
    points: number,
    action: string,
    metadata: any
  ): Promise<void> {
    // This would integrate with the GamificationService
    logger.info('Points awarded', { userId, points, action, metadata });
  }
}
