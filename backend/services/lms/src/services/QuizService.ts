import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correct_answer: string | string[];
  points: number;
}

interface QuizData {
  timestamp: number;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  passing_score?: number;
  time_limit?: number;
  created_by: string;
}

interface QuizAttempt {
  quiz_id: string;
  user_id: string;
  answers: Record<string, any>;
}

export class QuizService {
  private db = getDatabase();

  async createQuiz(videoId: string, quizData: QuizData) {
    try {
      // Validate quiz data
      if (!quizData.questions || quizData.questions.length === 0) {
        throw new AppError('Quiz must have at least one question', 400);
      }

      if (quizData.timestamp < 0) {
        throw new AppError('Timestamp must be non-negative', 400);
      }

      const quiz = await this.db.insert('video_quizzes', {
        video_id: videoId,
        timestamp: quizData.timestamp,
        title: quizData.title,
        description: quizData.description || null,
        questions: JSON.stringify(quizData.questions),
        passing_score: quizData.passing_score || 70,
        time_limit: quizData.time_limit || null,
        created_by: quizData.created_by,
      });

      logger.info('Quiz created successfully', { 
        quizId: quiz.id, 
        videoId, 
        questionCount: quizData.questions.length 
      });

      return {
        ...quiz,
        questions: JSON.parse(quiz.questions as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create quiz', { error, videoId, quizData });
      throw new AppError('Failed to create quiz', 500);
    }
  }

  async getQuizzesByVideo(videoId: string) {
    try {
      const quizzes = await this.db.queryMany(
        `SELECT * FROM video_quizzes 
         WHERE video_id = $1 
         ORDER BY timestamp ASC`,
        [videoId]
      );

      return quizzes.map(quiz => ({
        ...quiz,
        questions: JSON.parse(quiz.questions as string),
      }));
    } catch (error) {
      logger.error('Failed to get quizzes by video', { error, videoId });
      throw new AppError('Failed to retrieve quizzes', 500);
    }
  }

  async getQuizById(quizId: string) {
    try {
      const quiz = await this.db.queryOne(
        'SELECT * FROM video_quizzes WHERE id = $1',
        [quizId]
      );

      if (!quiz) {
        throw new AppError('Quiz not found', 404);
      }

      return {
        ...quiz,
        questions: JSON.parse(quiz.questions as string),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get quiz by ID', { error, quizId });
      throw new AppError('Failed to retrieve quiz', 500);
    }
  }

  async submitQuizAttempt(quizId: string, userId: string, answers: Record<string, any>) {
    try {
      // Get quiz with questions
      const quiz = await this.getQuizById(quizId);
      const questions = quiz.questions as QuizQuestion[];

      // Calculate score
      let correctAnswers = 0;
      let totalPoints = 0;
      let earnedPoints = 0;

      questions.forEach(question => {
        totalPoints += question.points;
        const userAnswer = answers[question.id];

        if (this.isAnswerCorrect(question, userAnswer)) {
          correctAnswers++;
          earnedPoints += question.points;
        }
      });

      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const passed = score >= quiz.passing_score;

      // Save attempt
      const attempt = await this.db.insert('quiz_attempts', {
        quiz_id: quizId,
        user_id: userId,
        answers: JSON.stringify(answers),
        score,
        passed,
        time_spent: 0, // This should be tracked on the client side
      });

      // Award points if passed (integrate with gamification)
      if (passed) {
        try {
          // Award 50 points for passing a quiz
          await this.awardPoints(userId, 50, 'quiz_passed', { quizId, score });
        } catch (error) {
          logger.warn('Failed to award points for quiz completion', { error, userId, quizId });
        }
      }

      logger.info('Quiz attempt submitted', { 
        attemptId: attempt.id, 
        userId, 
        quizId, 
        score, 
        passed 
      });

      return {
        ...attempt,
        answers: JSON.parse(attempt.answers as string),
        total_questions: questions.length,
        correct_answers: correctAnswers,
        earned_points: earnedPoints,
        total_points: totalPoints,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to submit quiz attempt', { error, quizId, userId });
      throw new AppError('Failed to submit quiz attempt', 500);
    }
  }

  async getUserAttempts(userId: string, quizId: string) {
    try {
      const attempts = await this.db.queryMany(
        `SELECT * FROM quiz_attempts 
         WHERE user_id = $1 AND quiz_id = $2 
         ORDER BY completed_at DESC`,
        [userId, quizId]
      );

      return attempts.map(attempt => ({
        ...attempt,
        answers: JSON.parse(attempt.answers as string),
      }));
    } catch (error) {
      logger.error('Failed to get user attempts', { error, userId, quizId });
      throw new AppError('Failed to retrieve quiz attempts', 500);
    }
  }

  private isAnswerCorrect(question: QuizQuestion, userAnswer: any): boolean {
    if (!userAnswer) return false;

    switch (question.type) {
      case 'multiple_choice':
        if (Array.isArray(question.correct_answer)) {
          // Multiple correct answers
          const correctSet = new Set(question.correct_answer);
          const userSet = new Set(Array.isArray(userAnswer) ? userAnswer : [userAnswer]);
          return correctSet.size === userSet.size && 
                 [...correctSet].every(ans => userSet.has(ans));
        }
        return userAnswer === question.correct_answer;

      case 'true_false':
        return userAnswer.toString().toLowerCase() === question.correct_answer.toString().toLowerCase();

      case 'short_answer':
        // Case-insensitive comparison, trimmed
        const correctAnswers = Array.isArray(question.correct_answer) 
          ? question.correct_answer 
          : [question.correct_answer];
        const normalizedUserAnswer = userAnswer.toString().trim().toLowerCase();
        return correctAnswers.some(ans => 
          ans.toString().trim().toLowerCase() === normalizedUserAnswer
        );

      default:
        return false;
    }
  }

  private async awardPoints(userId: string, points: number, action: string, metadata: any) {
    // This would integrate with the gamification service
    // For now, we'll just log it
    logger.info('Points awarded', { userId, points, action, metadata });
  }
}
