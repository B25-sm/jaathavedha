/**
 * Student Dashboard Types
 */

export interface StudentDashboard {
  student_id: string;
  personal_info: StudentPersonalInfo;
  learning_overview: LearningOverview;
  current_courses: CurrentCourse[];
  recommended_courses: RecommendedCourse[];
  learning_path: LearningPath;
  achievements: Achievement[];
  social_learning: SocialLearning;
  upcoming_sessions: UpcomingSession[];
  recent_activity: RecentActivity[];
  progress_analytics: ProgressAnalytics;
  study_streak: StudyStreak;
  personalized_insights: PersonalizedInsight[];
}

export interface StudentPersonalInfo {
  name: string;
  email: string;
  avatar_url?: string;
  learning_goals: string[];
  preferred_learning_style: LearningStyle;
  timezone: string;
  study_schedule: StudySchedule;
}

export enum LearningStyle {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  KINESTHETIC = 'kinesthetic',
  READING_WRITING = 'reading_writing',
  MIXED = 'mixed'
}

export interface StudySchedule {
  preferred_days: string[];
  preferred_times: TimeSlot[];
  daily_goal_minutes: number;
  break_intervals: number;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  timezone: string;
}

export interface LearningOverview {
  total_courses_enrolled: number;
  courses_completed: number;
  courses_in_progress: number;
  total_learning_hours: number;
  average_completion_rate: number;
  skill_level: SkillLevel;
  learning_velocity: number; // courses per month
  next_milestone: Milestone;
}

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  target_date: Date;
  progress_percentage: number;
  reward_points: number;
}

export interface CurrentCourse {
  course_id: string;
  course_name: string;
  instructor_name: string;
  course_thumbnail: string;
  progress_percentage: number;
  last_accessed: Date;
  next_lesson: NextLesson;
  estimated_completion: Date;
  difficulty_level: DifficultyLevel;
  course_rating: number;
  time_spent: number; // minutes
  modules_completed: number;
  total_modules: number;
  upcoming_deadlines: Deadline[];
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export interface NextLesson {
  lesson_id: string;
  lesson_title: string;
  lesson_type: LessonType;
  estimated_duration: number; // minutes
  prerequisites_met: boolean;
}

export enum LessonType {
  VIDEO = 'video',
  QUIZ = 'quiz',
  ASSIGNMENT = 'assignment',
  READING = 'reading',
  INTERACTIVE = 'interactive',
  LIVE_SESSION = 'live_session'
}

export interface Deadline {
  id: string;
  title: string;
  type: DeadlineType;
  due_date: Date;
  priority: Priority;
  completion_status: CompletionStatus;
}

export enum DeadlineType {
  ASSIGNMENT = 'assignment',
  QUIZ = 'quiz',
  PROJECT = 'project',
  LIVE_SESSION = 'live_session'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum CompletionStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}

export interface RecommendedCourse {
  course_id: string;
  course_name: string;
  instructor_name: string;
  course_thumbnail: string;
  recommendation_score: number;
  recommendation_reasons: RecommendationReason[];
  difficulty_level: DifficultyLevel;
  estimated_duration: number; // hours
  course_rating: number;
  student_count: number;
  price: number;
  currency: string;
  tags: string[];
  learning_outcomes: string[];
}

export interface RecommendationReason {
  type: RecommendationReasonType;
  description: string;
  confidence_score: number;
}

export enum RecommendationReasonType {
  SKILL_GAP = 'skill_gap',
  LEARNING_PATH = 'learning_path',
  SIMILAR_STUDENTS = 'similar_students',
  INSTRUCTOR_MATCH = 'instructor_match',
  TRENDING = 'trending',
  PREREQUISITE = 'prerequisite',
  CAREER_GOAL = 'career_goal'
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  total_courses: number;
  completed_courses: number;
  estimated_completion_time: number; // months
  difficulty_progression: DifficultyLevel[];
  current_stage: PathStage;
  next_recommended_course: RecommendedCourse;
  skill_tree: SkillNode[];
}

export interface PathStage {
  stage_number: number;
  stage_name: string;
  stage_description: string;
  required_courses: string[];
  optional_courses: string[];
  completion_criteria: CompletionCriteria;
}

export interface CompletionCriteria {
  minimum_score: number;
  required_assignments: number;
  time_limit?: number; // days
}

export interface SkillNode {
  skill_id: string;
  skill_name: string;
  skill_level: number; // 0-100
  prerequisites: string[];
  unlocked_skills: string[];
  associated_courses: string[];
  mastery_criteria: MasteryCriteria;
}

export interface MasteryCriteria {
  minimum_practice_hours: number;
  required_projects: number;
  assessment_score: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon_url: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points_awarded: number;
  unlocked_at: Date;
  progress_percentage: number;
  requirements: AchievementRequirement[];
}

export enum AchievementCategory {
  COMPLETION = 'completion',
  STREAK = 'streak',
  SKILL = 'skill',
  SOCIAL = 'social',
  SPEED = 'speed',
  QUALITY = 'quality'
}

export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export interface AchievementRequirement {
  type: string;
  target_value: number;
  current_value: number;
  description: string;
}

export interface SocialLearning {
  study_groups: StudyGroup[];
  peer_connections: PeerConnection[];
  discussion_participation: DiscussionParticipation;
  mentorship: MentorshipInfo;
  leaderboards: LeaderboardEntry[];
  collaborative_projects: CollaborativeProject[];
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  course_id: string;
  member_count: number;
  is_member: boolean;
  activity_level: ActivityLevel;
  next_session: Date;
  group_avatar: string;
}

export enum ActivityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export interface PeerConnection {
  peer_id: string;
  peer_name: string;
  peer_avatar: string;
  connection_type: ConnectionType;
  shared_courses: number;
  study_compatibility: number; // 0-100
  last_interaction: Date;
}

export enum ConnectionType {
  STUDY_BUDDY = 'study_buddy',
  MENTOR = 'mentor',
  MENTEE = 'mentee',
  CLASSMATE = 'classmate',
  FRIEND = 'friend'
}

export interface DiscussionParticipation {
  total_posts: number;
  helpful_answers: number;
  questions_asked: number;
  reputation_score: number;
  active_discussions: ActiveDiscussion[];
}

export interface ActiveDiscussion {
  discussion_id: string;
  title: string;
  course_name: string;
  last_activity: Date;
  unread_messages: number;
  your_participation: ParticipationType;
}

export enum ParticipationType {
  CREATOR = 'creator',
  ACTIVE_PARTICIPANT = 'active_participant',
  OBSERVER = 'observer',
  MODERATOR = 'moderator'
}

export interface MentorshipInfo {
  is_mentor: boolean;
  is_mentee: boolean;
  mentor_details?: MentorDetails;
  mentee_details?: MenteeDetails;
  mentorship_requests: MentorshipRequest[];
}

export interface MentorDetails {
  mentor_id: string;
  mentor_name: string;
  mentor_avatar: string;
  expertise_areas: string[];
  mentorship_start_date: Date;
  next_session: Date;
  total_sessions: number;
}

export interface MenteeDetails {
  mentee_count: number;
  active_mentees: MenteeInfo[];
  mentorship_rating: number;
  total_mentorship_hours: number;
}

export interface MenteeInfo {
  mentee_id: string;
  mentee_name: string;
  mentee_avatar: string;
  learning_goals: string[];
  progress_summary: string;
}

export interface MentorshipRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  request_type: MentorshipRequestType;
  message: string;
  status: RequestStatus;
  created_at: Date;
}

export enum MentorshipRequestType {
  BECOME_MENTOR = 'become_mentor',
  FIND_MENTOR = 'find_mentor',
  JOIN_MENTORSHIP = 'join_mentorship'
}

export enum RequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

export interface LeaderboardEntry {
  leaderboard_type: LeaderboardType;
  student_rank: number;
  total_participants: number;
  score: number;
  score_type: string;
  time_period: TimePeriod;
  top_performers: TopPerformer[];
}

export enum LeaderboardType {
  COURSE_COMPLETION = 'course_completion',
  STUDY_STREAK = 'study_streak',
  QUIZ_SCORES = 'quiz_scores',
  DISCUSSION_PARTICIPATION = 'discussion_participation',
  PEER_HELP = 'peer_help'
}

export enum TimePeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time'
}

export interface TopPerformer {
  student_id: string;
  student_name: string;
  student_avatar: string;
  rank: number;
  score: number;
}

export interface CollaborativeProject {
  id: string;
  title: string;
  description: string;
  course_id: string;
  team_members: TeamMember[];
  project_status: ProjectStatus;
  deadline: Date;
  progress_percentage: number;
  your_role: ProjectRole;
}

export interface TeamMember {
  student_id: string;
  student_name: string;
  student_avatar: string;
  role: ProjectRole;
  contribution_score: number;
}

export enum ProjectStatus {
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ProjectRole {
  LEADER = 'leader',
  DEVELOPER = 'developer',
  DESIGNER = 'designer',
  RESEARCHER = 'researcher',
  TESTER = 'tester'
}

export interface UpcomingSession {
  id: string;
  title: string;
  type: SessionType;
  course_name: string;
  instructor_name: string;
  scheduled_start: Date;
  scheduled_end: Date;
  is_registered: boolean;
  session_url?: string;
  preparation_materials: string[];
}

export enum SessionType {
  LIVE_CLASS = 'live_class',
  OFFICE_HOURS = 'office_hours',
  STUDY_GROUP = 'study_group',
  WEBINAR = 'webinar',
  WORKSHOP = 'workshop'
}

export interface RecentActivity {
  id: string;
  activity_type: ActivityType;
  title: string;
  description: string;
  course_name?: string;
  timestamp: Date;
  points_earned?: number;
  related_content?: RelatedContent;
}

export enum ActivityType {
  LESSON_COMPLETED = 'lesson_completed',
  QUIZ_PASSED = 'quiz_passed',
  ASSIGNMENT_SUBMITTED = 'assignment_submitted',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  DISCUSSION_POSTED = 'discussion_posted',
  PEER_HELPED = 'peer_helped',
  COURSE_ENROLLED = 'course_enrolled',
  MILESTONE_REACHED = 'milestone_reached'
}

export interface RelatedContent {
  content_id: string;
  content_type: string;
  content_title: string;
  content_url: string;
}

export interface ProgressAnalytics {
  learning_velocity: LearningVelocity;
  skill_development: SkillDevelopment;
  engagement_patterns: EngagementPattern[];
  performance_trends: PerformanceTrend[];
  time_allocation: TimeAllocation;
  comparative_analysis: ComparativeAnalysis;
}

export interface LearningVelocity {
  current_pace: number; // lessons per week
  target_pace: number;
  pace_trend: TrendDirection;
  efficiency_score: number; // 0-100
  bottlenecks: LearningBottleneck[];
}

export enum TrendDirection {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable'
}

export interface LearningBottleneck {
  area: string;
  impact_score: number;
  suggested_actions: string[];
}

export interface SkillDevelopment {
  skill_progression: SkillProgression[];
  strength_areas: string[];
  improvement_areas: string[];
  skill_gaps: SkillGap[];
  recommended_focus: string[];
}

export interface SkillProgression {
  skill_name: string;
  current_level: number;
  previous_level: number;
  growth_rate: number;
  mastery_timeline: Date;
}

export interface SkillGap {
  skill_name: string;
  current_level: number;
  target_level: number;
  priority: Priority;
  recommended_courses: string[];
}

export interface EngagementPattern {
  pattern_type: EngagementPatternType;
  frequency: number;
  optimal_times: TimeSlot[];
  engagement_score: number;
  recommendations: string[];
}

export enum EngagementPatternType {
  DAILY_ACTIVITY = 'daily_activity',
  WEEKLY_PATTERN = 'weekly_pattern',
  CONTENT_PREFERENCE = 'content_preference',
  INTERACTION_STYLE = 'interaction_style'
}

export interface PerformanceTrend {
  metric: PerformanceMetric;
  current_value: number;
  previous_value: number;
  trend_direction: TrendDirection;
  trend_strength: number; // 0-100
  forecast: PerformanceForecast;
}

export enum PerformanceMetric {
  QUIZ_SCORES = 'quiz_scores',
  ASSIGNMENT_GRADES = 'assignment_grades',
  COMPLETION_RATE = 'completion_rate',
  ENGAGEMENT_LEVEL = 'engagement_level',
  RETENTION_RATE = 'retention_rate'
}

export interface PerformanceForecast {
  predicted_value: number;
  confidence_interval: number;
  forecast_date: Date;
}

export interface TimeAllocation {
  total_study_time: number; // minutes this week
  time_by_course: CourseTimeAllocation[];
  time_by_activity: ActivityTimeAllocation[];
  optimal_schedule: OptimalSchedule;
  time_efficiency: number; // 0-100
}

export interface CourseTimeAllocation {
  course_id: string;
  course_name: string;
  time_spent: number; // minutes
  percentage_of_total: number;
  efficiency_rating: number;
}

export interface ActivityTimeAllocation {
  activity_type: string;
  time_spent: number; // minutes
  percentage_of_total: number;
  productivity_score: number;
}

export interface OptimalSchedule {
  recommended_daily_minutes: number;
  best_study_times: TimeSlot[];
  break_recommendations: BreakRecommendation[];
  focus_sessions: FocusSession[];
}

export interface BreakRecommendation {
  after_minutes: number;
  break_duration: number;
  break_type: BreakType;
}

export enum BreakType {
  SHORT_BREAK = 'short_break',
  LONG_BREAK = 'long_break',
  ACTIVE_BREAK = 'active_break',
  MINDFUL_BREAK = 'mindful_break'
}

export interface FocusSession {
  duration: number; // minutes
  recommended_content: string[];
  difficulty_level: DifficultyLevel;
  break_intervals: number[];
}

export interface ComparativeAnalysis {
  peer_comparison: PeerComparison;
  cohort_ranking: CohortRanking;
  improvement_potential: ImprovementPotential;
}

export interface PeerComparison {
  similar_students: SimilarStudent[];
  performance_percentile: number;
  areas_ahead: string[];
  areas_behind: string[];
}

export interface SimilarStudent {
  anonymized_id: string;
  similarity_score: number;
  performance_metrics: PerformanceComparison[];
}

export interface PerformanceComparison {
  metric: string;
  your_value: number;
  peer_value: number;
  difference_percentage: number;
}

export interface CohortRanking {
  overall_rank: number;
  total_students: number;
  percentile: number;
  ranking_by_metric: MetricRanking[];
}

export interface MetricRanking {
  metric: string;
  rank: number;
  score: number;
  percentile: number;
}

export interface ImprovementPotential {
  quick_wins: QuickWin[];
  long_term_goals: LongTermGoal[];
  personalized_recommendations: PersonalizedRecommendation[];
}

export interface QuickWin {
  area: string;
  potential_improvement: number;
  effort_required: EffortLevel;
  estimated_time: number; // days
  action_steps: string[];
}

export enum EffortLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface LongTermGoal {
  goal: string;
  target_timeline: number; // months
  milestones: GoalMilestone[];
  success_metrics: string[];
}

export interface GoalMilestone {
  milestone: string;
  target_date: Date;
  completion_criteria: string[];
}

export interface PersonalizedRecommendation {
  type: RecommendationType;
  title: string;
  description: string;
  priority: Priority;
  expected_impact: ImpactLevel;
  implementation_steps: string[];
}

export enum RecommendationType {
  STUDY_HABIT = 'study_habit',
  CONTENT_FOCUS = 'content_focus',
  SOCIAL_LEARNING = 'social_learning',
  SKILL_DEVELOPMENT = 'skill_development',
  TIME_MANAGEMENT = 'time_management'
}

export enum ImpactLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export interface StudyStreak {
  current_streak: number; // days
  longest_streak: number; // days
  streak_goal: number; // days
  streak_history: StreakHistory[];
  streak_rewards: StreakReward[];
  motivation_message: string;
}

export interface StreakHistory {
  date: Date;
  study_minutes: number;
  streak_day: number;
  activities_completed: number;
}

export interface StreakReward {
  streak_milestone: number;
  reward_type: RewardType;
  reward_description: string;
  points_awarded: number;
  unlocked: boolean;
}

export enum RewardType {
  BADGE = 'badge',
  POINTS = 'points',
  CERTIFICATE = 'certificate',
  DISCOUNT = 'discount',
  FEATURE_UNLOCK = 'feature_unlock'
}

export interface PersonalizedInsight {
  id: string;
  insight_type: InsightType;
  title: string;
  description: string;
  data_points: DataPoint[];
  actionable_recommendations: string[];
  confidence_score: number;
  generated_at: Date;
  expires_at?: Date;
}

export enum InsightType {
  LEARNING_PATTERN = 'learning_pattern',
  PERFORMANCE_INSIGHT = 'performance_insight',
  ENGAGEMENT_INSIGHT = 'engagement_insight',
  SKILL_INSIGHT = 'skill_insight',
  SOCIAL_INSIGHT = 'social_insight',
  GOAL_INSIGHT = 'goal_insight'
}

export interface DataPoint {
  metric: string;
  value: number;
  context: string;
  trend: TrendDirection;
}