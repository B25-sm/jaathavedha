import { v4 as uuidv4 } from 'uuid';
import Filter from 'bad-words';
import { pgPool, getMongoDb, logger } from '../index';
import {
  ChatMessage,
  ChatMessageType,
  QAQuestion,
  Poll,
  PollOption,
  PollType,
  PollVote,
  HandRaise,
  HandRaiseStatus
} from '../types';

/**
 * Interactive Service
 * Manages chat, Q&A, polls, and hand-raising features
 */
class InteractiveService {
  private profanityFilter: Filter;

  constructor() {
    this.profanityFilter = new Filter();
  }

  // ==================== CHAT METHODS ====================

  /**
   * Send a chat message
   */
  async sendChatMessage(
    sessionId: string,
    userId: string,
    userName: string,
    message: string,
    messageType: ChatMessageType = ChatMessageType.TEXT,
    moderationEnabled: boolean = false
  ): Promise<ChatMessage> {
    const messageId = uuidv4();
    
    // Apply profanity filter if moderation is enabled
    let filteredMessage = message;
    if (moderationEnabled) {
      filteredMessage = this.profanityFilter.clean(message);
    }

    const query = `
      INSERT INTO session_chat (
        id, session_id, user_id, user_name, message,
        message_type, is_pinned, is_deleted, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, false, false, NOW())
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        messageId,
        sessionId,
        userId,
        userName,
        filteredMessage,
        messageType
      ]);

      const chatMessage = this.mapRowToChatMessage(result.rows[0]);

      // Store in MongoDB for analytics
      await this.storeChatInMongo(chatMessage);

      logger.info('Chat message sent', { sessionId, userId, messageId });
      return chatMessage;
    } catch (error) {
      logger.error('Failed to send chat message', { error, sessionId, userId });
      throw new Error('Failed to send chat message');
    }
  }

  /**
   * Get chat history
   */
  async getChatHistory(
    sessionId: string,
    limit: number = 100,
    before?: Date
  ): Promise<ChatMessage[]> {
    let query = `
      SELECT * FROM session_chat 
      WHERE session_id = $1 AND is_deleted = false
    `;
    const values: any[] = [sessionId];

    if (before) {
      query += ` AND created_at < $2`;
      values.push(before);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    try {
      const result = await pgPool.query(query, values);
      return result.rows.map(row => this.mapRowToChatMessage(row)).reverse();
    } catch (error) {
      logger.error('Failed to get chat history', { error, sessionId });
      throw new Error('Failed to get chat history');
    }
  }

  /**
   * Delete a chat message
   */
  async deleteChatMessage(
    sessionId: string,
    messageId: string
  ): Promise<void> {
    const query = `
      UPDATE session_chat 
      SET is_deleted = true 
      WHERE id = $1 AND session_id = $2
    `;

    try {
      await pgPool.query(query, [messageId, sessionId]);
      logger.info('Chat message deleted', { sessionId, messageId });
    } catch (error) {
      logger.error('Failed to delete chat message', { error, sessionId, messageId });
      throw new Error('Failed to delete chat message');
    }
  }

  /**
   * Pin a chat message
   */
  async pinChatMessage(
    sessionId: string,
    messageId: string
  ): Promise<void> {
    const query = `
      UPDATE session_chat 
      SET is_pinned = true 
      WHERE id = $1 AND session_id = $2
    `;

    try {
      await pgPool.query(query, [messageId, sessionId]);
      logger.info('Chat message pinned', { sessionId, messageId });
    } catch (error) {
      logger.error('Failed to pin chat message', { error, sessionId, messageId });
      throw new Error('Failed to pin chat message');
    }
  }

  // ==================== Q&A METHODS ====================

  /**
   * Ask a question
   */
  async askQuestion(
    sessionId: string,
    userId: string,
    userName: string,
    question: string
  ): Promise<QAQuestion> {
    const questionId = uuidv4();

    const query = `
      INSERT INTO session_qa (
        id, session_id, user_id, user_name, question,
        upvotes, upvoted_by, is_answered, is_highlighted, created_at
      ) VALUES ($1, $2, $3, $4, $5, 0, '{}', false, false, NOW())
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        questionId,
        sessionId,
        userId,
        userName,
        question
      ]);

      const qaQuestion = this.mapRowToQAQuestion(result.rows[0]);

      logger.info('Question asked', { sessionId, userId, questionId });
      return qaQuestion;
    } catch (error) {
      logger.error('Failed to ask question', { error, sessionId, userId });
      throw new Error('Failed to ask question');
    }
  }

  /**
   * Answer a question
   */
  async answerQuestion(
    sessionId: string,
    questionId: string,
    answer: string,
    answeredBy: string
  ): Promise<QAQuestion> {
    const query = `
      UPDATE session_qa 
      SET answer = $1, answered_by = $2, answered_at = NOW(), is_answered = true
      WHERE id = $3 AND session_id = $4
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        answer,
        answeredBy,
        questionId,
        sessionId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Question not found');
      }

      const qaQuestion = this.mapRowToQAQuestion(result.rows[0]);

      logger.info('Question answered', { sessionId, questionId, answeredBy });
      return qaQuestion;
    } catch (error) {
      logger.error('Failed to answer question', { error, sessionId, questionId });
      throw new Error('Failed to answer question');
    }
  }

  /**
   * Upvote a question
   */
  async upvoteQuestion(
    sessionId: string,
    questionId: string,
    userId: string
  ): Promise<QAQuestion> {
    const query = `
      UPDATE session_qa 
      SET upvotes = upvotes + 1,
          upvoted_by = array_append(upvoted_by, $1)
      WHERE id = $2 AND session_id = $3 AND NOT ($1 = ANY(upvoted_by))
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [userId, questionId, sessionId]);

      if (result.rows.length === 0) {
        throw new Error('Question not found or already upvoted');
      }

      const qaQuestion = this.mapRowToQAQuestion(result.rows[0]);

      logger.info('Question upvoted', { sessionId, questionId, userId });
      return qaQuestion;
    } catch (error) {
      logger.error('Failed to upvote question', { error, sessionId, questionId });
      throw new Error('Failed to upvote question');
    }
  }

  /**
   * Get Q&A questions
   */
  async getQuestions(
    sessionId: string,
    filter?: 'all' | 'answered' | 'unanswered'
  ): Promise<QAQuestion[]> {
    let query = `SELECT * FROM session_qa WHERE session_id = $1`;
    
    if (filter === 'answered') {
      query += ` AND is_answered = true`;
    } else if (filter === 'unanswered') {
      query += ` AND is_answered = false`;
    }

    query += ` ORDER BY upvotes DESC, created_at DESC`;

    try {
      const result = await pgPool.query(query, [sessionId]);
      return result.rows.map(row => this.mapRowToQAQuestion(row));
    } catch (error) {
      logger.error('Failed to get questions', { error, sessionId });
      throw new Error('Failed to get questions');
    }
  }

  // ==================== POLL METHODS ====================

  /**
   * Create a poll
   */
  async createPoll(
    sessionId: string,
    createdBy: string,
    question: string,
    options: string[],
    pollType: PollType = PollType.MULTIPLE_CHOICE,
    isAnonymous: boolean = false,
    allowMultiple: boolean = false
  ): Promise<Poll> {
    const pollId = uuidv4();
    
    const pollOptions: PollOption[] = options.map(text => ({
      id: uuidv4(),
      text,
      votes: 0,
      percentage: 0
    }));

    const query = `
      INSERT INTO session_polls (
        id, session_id, created_by, question, options,
        poll_type, is_active, is_anonymous, allow_multiple,
        total_votes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, 0, NOW())
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        pollId,
        sessionId,
        createdBy,
        question,
        JSON.stringify(pollOptions),
        pollType,
        isAnonymous,
        allowMultiple
      ]);

      const poll = this.mapRowToPoll(result.rows[0]);

      logger.info('Poll created', { sessionId, pollId, createdBy });
      return poll;
    } catch (error) {
      logger.error('Failed to create poll', { error, sessionId });
      throw new Error('Failed to create poll');
    }
  }

  /**
   * Vote on a poll
   */
  async votePoll(
    sessionId: string,
    pollId: string,
    userId: string,
    optionIds: string[]
  ): Promise<Poll> {
    // Check if user already voted
    const checkQuery = `
      SELECT * FROM poll_votes 
      WHERE poll_id = $1 AND user_id = $2
    `;
    
    const checkResult = await pgPool.query(checkQuery, [pollId, userId]);
    
    if (checkResult.rows.length > 0) {
      throw new Error('User has already voted on this poll');
    }

    // Record vote
    const voteQuery = `
      INSERT INTO poll_votes (id, poll_id, user_id, option_ids, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;

    await pgPool.query(voteQuery, [uuidv4(), pollId, userId, optionIds]);

    // Update poll results
    const updateQuery = `
      UPDATE session_polls 
      SET total_votes = total_votes + 1
      WHERE id = $1 AND session_id = $2
      RETURNING *
    `;

    try {
      const result = await pgPool.query(updateQuery, [pollId, sessionId]);

      if (result.rows.length === 0) {
        throw new Error('Poll not found');
      }

      // Update option votes
      const poll = this.mapRowToPoll(result.rows[0]);
      const updatedOptions = poll.options.map(option => {
        if (optionIds.includes(option.id)) {
          option.votes += 1;
        }
        option.percentage = poll.totalVotes > 0 
          ? (option.votes / poll.totalVotes) * 100 
          : 0;
        return option;
      });

      poll.options = updatedOptions;

      // Save updated options
      await pgPool.query(
        'UPDATE session_polls SET options = $1 WHERE id = $2',
        [JSON.stringify(updatedOptions), pollId]
      );

      logger.info('Poll vote recorded', { sessionId, pollId, userId });
      return poll;
    } catch (error) {
      logger.error('Failed to vote on poll', { error, sessionId, pollId });
      throw new Error('Failed to vote on poll');
    }
  }

  /**
   * Close a poll
   */
  async closePoll(sessionId: string, pollId: string): Promise<Poll> {
    const query = `
      UPDATE session_polls 
      SET is_active = false, closed_at = NOW()
      WHERE id = $1 AND session_id = $2
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [pollId, sessionId]);

      if (result.rows.length === 0) {
        throw new Error('Poll not found');
      }

      const poll = this.mapRowToPoll(result.rows[0]);

      logger.info('Poll closed', { sessionId, pollId });
      return poll;
    } catch (error) {
      logger.error('Failed to close poll', { error, sessionId, pollId });
      throw new Error('Failed to close poll');
    }
  }

  /**
   * Get polls for a session
   */
  async getPolls(sessionId: string): Promise<Poll[]> {
    const query = `
      SELECT * FROM session_polls 
      WHERE session_id = $1 
      ORDER BY created_at DESC
    `;

    try {
      const result = await pgPool.query(query, [sessionId]);
      return result.rows.map(row => this.mapRowToPoll(row));
    } catch (error) {
      logger.error('Failed to get polls', { error, sessionId });
      throw new Error('Failed to get polls');
    }
  }

  // ==================== HAND RAISE METHODS ====================

  /**
   * Raise hand
   */
  async raiseHand(
    sessionId: string,
    userId: string,
    userName: string
  ): Promise<HandRaise> {
    const handRaiseId = uuidv4();

    // Get current queue position
    const countQuery = `
      SELECT COUNT(*) FROM hand_raise_queue 
      WHERE session_id = $1 AND status = 'pending'
    `;
    const countResult = await pgPool.query(countQuery, [sessionId]);
    const queuePosition = parseInt(countResult.rows[0].count) + 1;

    const query = `
      INSERT INTO hand_raise_queue (
        id, session_id, user_id, user_name, raised_at,
        status, queue_position
      ) VALUES ($1, $2, $3, $4, NOW(), 'pending', $5)
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        handRaiseId,
        sessionId,
        userId,
        userName,
        queuePosition
      ]);

      const handRaise = this.mapRowToHandRaise(result.rows[0]);

      logger.info('Hand raised', { sessionId, userId, queuePosition });
      return handRaise;
    } catch (error) {
      logger.error('Failed to raise hand', { error, sessionId, userId });
      throw new Error('Failed to raise hand');
    }
  }

  /**
   * Lower hand
   */
  async lowerHand(sessionId: string, userId: string): Promise<void> {
    const query = `
      UPDATE hand_raise_queue 
      SET status = 'cancelled'
      WHERE session_id = $1 AND user_id = $2 AND status = 'pending'
    `;

    try {
      await pgPool.query(query, [sessionId, userId]);
      logger.info('Hand lowered', { sessionId, userId });
    } catch (error) {
      logger.error('Failed to lower hand', { error, sessionId, userId });
      throw new Error('Failed to lower hand');
    }
  }

  /**
   * Accept hand raise
   */
  async acceptHandRaise(
    sessionId: string,
    userId: string
  ): Promise<HandRaise> {
    const query = `
      UPDATE hand_raise_queue 
      SET status = 'accepted', accepted_at = NOW()
      WHERE session_id = $1 AND user_id = $2 AND status = 'pending'
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [sessionId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Hand raise not found');
      }

      const handRaise = this.mapRowToHandRaise(result.rows[0]);

      logger.info('Hand raise accepted', { sessionId, userId });
      return handRaise;
    } catch (error) {
      logger.error('Failed to accept hand raise', { error, sessionId, userId });
      throw new Error('Failed to accept hand raise');
    }
  }

  /**
   * Decline hand raise
   */
  async declineHandRaise(
    sessionId: string,
    userId: string
  ): Promise<void> {
    const query = `
      UPDATE hand_raise_queue 
      SET status = 'declined', declined_at = NOW()
      WHERE session_id = $1 AND user_id = $2 AND status = 'pending'
    `;

    try {
      await pgPool.query(query, [sessionId, userId]);
      logger.info('Hand raise declined', { sessionId, userId });
    } catch (error) {
      logger.error('Failed to decline hand raise', { error, sessionId, userId });
      throw new Error('Failed to decline hand raise');
    }
  }

  /**
   * Get hand raise queue
   */
  async getHandRaiseQueue(sessionId: string): Promise<HandRaise[]> {
    const query = `
      SELECT * FROM hand_raise_queue 
      WHERE session_id = $1 AND status = 'pending'
      ORDER BY queue_position ASC
    `;

    try {
      const result = await pgPool.query(query, [sessionId]);
      return result.rows.map(row => this.mapRowToHandRaise(row));
    } catch (error) {
      logger.error('Failed to get hand raise queue', { error, sessionId });
      throw new Error('Failed to get hand raise queue');
    }
  }

  // ==================== SURVEY METHODS ====================

  /**
   * Create a survey
   */
  async createSurvey(
    sessionId: string,
    createdBy: string,
    title: string,
    description: string,
    surveyType: string,
    questions: any[],
    isAnonymous: boolean = true
  ): Promise<any> {
    const surveyId = uuidv4();

    const query = `
      INSERT INTO session_surveys (
        id, session_id, created_by, title, description,
        survey_type, questions, is_active, is_anonymous, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW())
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        surveyId,
        sessionId,
        createdBy,
        title,
        description,
        surveyType,
        JSON.stringify(questions),
        isAnonymous
      ]);

      logger.info('Survey created', { sessionId, surveyId, createdBy });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create survey', { error, sessionId });
      throw new Error('Failed to create survey');
    }
  }

  /**
   * Submit survey response
   */
  async submitSurveyResponse(
    sessionId: string,
    surveyId: string,
    userId: string,
    responses: any[]
  ): Promise<any> {
    const responseId = uuidv4();

    const query = `
      INSERT INTO survey_responses (id, survey_id, user_id, responses, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        responseId,
        surveyId,
        userId,
        JSON.stringify(responses)
      ]);

      logger.info('Survey response submitted', { sessionId, surveyId, userId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to submit survey response', { error, sessionId, surveyId });
      throw new Error('Failed to submit survey response');
    }
  }

  /**
   * Get survey results
   */
  async getSurveyResults(sessionId: string, surveyId: string): Promise<any> {
    const query = `
      SELECT 
        s.*,
        COUNT(sr.id) as total_responses
      FROM session_surveys s
      LEFT JOIN survey_responses sr ON s.id = sr.survey_id
      WHERE s.id = $1 AND s.session_id = $2
      GROUP BY s.id
    `;

    try {
      const result = await pgPool.query(query, [surveyId, sessionId]);
      
      if (result.rows.length === 0) {
        throw new Error('Survey not found');
      }

      const survey = result.rows[0];

      // Get all responses
      const responsesQuery = `
        SELECT responses FROM survey_responses WHERE survey_id = $1
      `;
      const responsesResult = await pgPool.query(responsesQuery, [surveyId]);

      return {
        ...survey,
        responses: responsesResult.rows.map(r => 
          typeof r.responses === 'string' ? JSON.parse(r.responses) : r.responses
        )
      };
    } catch (error) {
      logger.error('Failed to get survey results', { error, sessionId, surveyId });
      throw new Error('Failed to get survey results');
    }
  }

  // ==================== SCREEN SHARING METHODS ====================

  /**
   * Start screen sharing
   */
  async startScreenShare(
    sessionId: string,
    userId: string,
    userName: string,
    shareType: string = 'screen'
  ): Promise<any> {
    const shareId = uuidv4();

    const query = `
      INSERT INTO screen_sharing_sessions (
        id, session_id, user_id, user_name, share_type,
        started_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, NOW(), true)
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        shareId,
        sessionId,
        userId,
        userName,
        shareType
      ]);

      logger.info('Screen sharing started', { sessionId, userId, shareType });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to start screen sharing', { error, sessionId, userId });
      throw new Error('Failed to start screen sharing');
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(sessionId: string, userId: string): Promise<void> {
    const query = `
      UPDATE screen_sharing_sessions 
      SET is_active = false, 
          ended_at = NOW(),
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
      WHERE session_id = $1 AND user_id = $2 AND is_active = true
    `;

    try {
      await pgPool.query(query, [sessionId, userId]);
      logger.info('Screen sharing stopped', { sessionId, userId });
    } catch (error) {
      logger.error('Failed to stop screen sharing', { error, sessionId, userId });
      throw new Error('Failed to stop screen sharing');
    }
  }

  // ==================== PRESENTATION METHODS ====================

  /**
   * Upload presentation
   */
  async uploadPresentation(
    sessionId: string,
    uploadedBy: string,
    title: string,
    fileUrl: string,
    fileType: string,
    totalSlides: number
  ): Promise<any> {
    const presentationId = uuidv4();

    const query = `
      INSERT INTO session_presentations (
        id, session_id, uploaded_by, title, file_url,
        file_type, total_slides, current_slide, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, false, NOW())
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        presentationId,
        sessionId,
        uploadedBy,
        title,
        fileUrl,
        fileType,
        totalSlides
      ]);

      logger.info('Presentation uploaded', { sessionId, presentationId, uploadedBy });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to upload presentation', { error, sessionId });
      throw new Error('Failed to upload presentation');
    }
  }

  /**
   * Update presentation slide
   */
  async updatePresentationSlide(
    sessionId: string,
    presentationId: string,
    slideNumber: number
  ): Promise<any> {
    const query = `
      UPDATE session_presentations 
      SET current_slide = $1
      WHERE id = $2 AND session_id = $3
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        slideNumber,
        presentationId,
        sessionId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Presentation not found');
      }

      logger.info('Presentation slide updated', { sessionId, presentationId, slideNumber });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update presentation slide', { error, sessionId, presentationId });
      throw new Error('Failed to update presentation slide');
    }
  }

  // ==================== PARTICIPANT MANAGEMENT METHODS ====================

  /**
   * Manage participant
   */
  async manageParticipant(
    sessionId: string,
    targetUserId: string,
    actionBy: string,
    actionType: string,
    reason?: string
  ): Promise<void> {
    const actionId = uuidv4();

    const query = `
      INSERT INTO participant_actions (
        id, session_id, target_user_id, action_by,
        action_type, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;

    try {
      await pgPool.query(query, [
        actionId,
        sessionId,
        targetUserId,
        actionBy,
        actionType,
        reason
      ]);

      logger.info('Participant action recorded', { 
        sessionId, 
        targetUserId, 
        actionType, 
        actionBy 
      });
    } catch (error) {
      logger.error('Failed to manage participant', { error, sessionId, targetUserId });
      throw new Error('Failed to manage participant');
    }
  }

  // ==================== REACTION METHODS ====================

  /**
   * Send reaction
   */
  async sendReaction(
    sessionId: string,
    userId: string,
    reactionType: string
  ): Promise<any> {
    const reactionId = uuidv4();

    const query = `
      INSERT INTO session_reactions (
        id, session_id, user_id, reaction_type, timestamp
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;

    try {
      const result = await pgPool.query(query, [
        reactionId,
        sessionId,
        userId,
        reactionType
      ]);

      logger.info('Reaction sent', { sessionId, userId, reactionType });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to send reaction', { error, sessionId, userId });
      throw new Error('Failed to send reaction');
    }
  }

  // ==================== HELPER METHODS ====================

  private async storeChatInMongo(message: ChatMessage): Promise<void> {
    try {
      const db = getMongoDb();
      await db.collection('chat_messages').insertOne({
        ...message,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to store chat in MongoDB', { error });
    }
  }

  private mapRowToChatMessage(row: any): ChatMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      userName: row.user_name,
      message: row.message,
      messageType: row.message_type,
      isPinned: row.is_pinned,
      isDeleted: row.is_deleted,
      timestamp: row.created_at
    };
  }

  private mapRowToQAQuestion(row: any): QAQuestion {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      userName: row.user_name,
      question: row.question,
      answer: row.answer,
      answeredBy: row.answered_by,
      answeredAt: row.answered_at,
      upvotes: row.upvotes,
      upvotedBy: row.upvoted_by || [],
      isAnswered: row.is_answered,
      isHighlighted: row.is_highlighted,
      timestamp: row.created_at
    };
  }

  private mapRowToPoll(row: any): Poll {
    return {
      id: row.id,
      sessionId: row.session_id,
      createdBy: row.created_by,
      question: row.question,
      options: typeof row.options === 'string' 
        ? JSON.parse(row.options) 
        : row.options,
      pollType: row.poll_type,
      isActive: row.is_active,
      isAnonymous: row.is_anonymous,
      allowMultiple: row.allow_multiple,
      totalVotes: row.total_votes,
      createdAt: row.created_at,
      closedAt: row.closed_at
    };
  }

  private mapRowToHandRaise(row: any): HandRaise {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      userName: row.user_name,
      raisedAt: row.raised_at,
      acceptedAt: row.accepted_at,
      declinedAt: row.declined_at,
      status: row.status,
      queuePosition: row.queue_position
    };
  }
}

export default new InteractiveService();
