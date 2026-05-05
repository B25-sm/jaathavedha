/**
 * TypeScript Type Definitions for LMS Service
 */

// ============================================================================
// Interactive Learning Types
// ============================================================================

export interface VideoQuiz {
  id: string;
  videoId: string;
  timestamp: number;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimit?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'code';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: Record<string, string | string[]>;
  score: number;
  passed: boolean;
  completedAt: Date;
  timeSpent: number;
}

export interface VideoNote {
  id: string;
  videoId: string;
  userId: string;
  timestamp: number;
  content: string;
  isPublic: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoBookmark {
  id: string;
  videoId: string;
  userId: string;
  timestamp: number;
  title: string;
  description?: string;
  createdAt: Date;
}

export interface VideoComment {
  id: string;
  videoId: string;
  userId: string;
  content: string;
  timestamp?: number;
  parentId?: string;
  upvotes: number;
  downvotes: number;
  replies?: VideoComment[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Collaborative Learning Types
// ============================================================================

export interface Forum {
  id: string;
  courseId: string;
  title: string;
  description: string;
  category: string;
  isLocked: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumPost {
  id: string;
  forumId: string;
  userId: string;
  title: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  views: number;
  upvotes: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumReply {
  id: string;
  postId: string;
  userId: string;
  content: string;
  upvotes: number;
  isSolution: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudyGroup {
  id: string;
  courseId: string;
  name: string;
  description: string;
  maxMembers: number;
  currentMembers: number;
  isPrivate: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudyGroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'moderator' | 'member';
  joinedAt: Date;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  instructions: string;
  dueDate: Date;
  maxScore: number;
  allowLateSubmission: boolean;
  peerReviewRequired: boolean;
  peerReviewCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  userId: string;
  content: string;
  attachments?: string[];
  submittedAt: Date;
  isLate: boolean;
  score?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: Date;
}

export interface PeerReview {
  id: string;
  submissionId: string;
  reviewerId: string;
  score: number;
  feedback: string;
  criteria: Record<string, number>;
  submittedAt: Date;
}

// ============================================================================
// Gamification Types
// ============================================================================

export interface UserPoints {
  userId: string;
  totalPoints: number;
  coursePoints: Record<string, number>;
  weeklyPoints: number;
  monthlyPoints: number;
  lastUpdated: Date;
}

export interface PointTransaction {
  id: string;
  userId: string;
  points: number;
  action: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'achievement' | 'milestone' | 'special';
  criteria: BadgeCriteria;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  createdAt: Date;
}

export interface BadgeCriteria {
  type: 'points' | 'courses' | 'streak' | 'quiz' | 'custom';
  threshold?: number;
  conditions?: Record<string, any>;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
  progress?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'course' | 'quiz' | 'assignment' | 'social' | 'streak';
  requirement: number;
  points: number;
  createdAt: Date;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
}

export interface Leaderboard {
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
  scope: 'global' | 'course';
  scopeId?: string;
  entries: LeaderboardEntry[];
  generatedAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  points: number;
  badges: number;
  streak: number;
}

export interface LearningStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  freezesAvailable: number;
  freezesUsed: number;
  streakHistory: StreakDay[];
}

export interface StreakDay {
  date: Date;
  completed: boolean;
  frozen: boolean;
  points: number;
}

// ============================================================================
// Assessment Types
// ============================================================================

export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  type: 'quiz' | 'exam' | 'practice' | 'adaptive';
  duration: number;
  passingScore: number;
  questions: AssessmentQuestion[];
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showFeedback: boolean;
  allowRetake: boolean;
  maxAttempts: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentQuestion {
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

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  userId: string;
  answers: Record<string, string | string[]>;
  score: number;
  percentage: number;
  passed: boolean;
  startedAt: Date;
  completedAt: Date;
  timeSpent: number;
  attemptNumber: number;
}

export interface Flashcard {
  id: string;
  courseId: string;
  userId: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  nextReview: Date;
  interval: number;
  easeFactor: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlashcardReview {
  id: string;
  flashcardId: string;
  userId: string;
  quality: number; // 0-5 scale
  reviewedAt: Date;
  timeSpent: number;
}

export interface AdaptivePath {
  id: string;
  userId: string;
  courseId: string;
  currentLevel: string;
  recommendedContent: string[];
  strengths: string[];
  weaknesses: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  pace: 'slow' | 'normal' | 'fast';
  lastUpdated: Date;
}

export interface LearningAnalytics {
  userId: string;
  courseId: string;
  totalTimeSpent: number;
  videosWatched: number;
  quizzesCompleted: number;
  averageQuizScore: number;
  assignmentsSubmitted: number;
  averageAssignmentScore: number;
  forumPosts: number;
  notesCreated: number;
  lastActivity: Date;
  completionRate: number;
  engagementScore: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    code: string;
    message: string;
    timestamp: string;
  };
}

// ============================================================================
// User Context (from auth middleware)
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}
