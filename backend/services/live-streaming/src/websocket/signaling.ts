import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../index';

interface SessionParticipant {
  socketId: string;
  userId: string;
  userName: string;
  role: 'instructor' | 'student' | 'co-host';
  isMuted: boolean;
  isVideoOn: boolean;
  isSharingScreen: boolean;
}

// Store active sessions and participants
const activeSessions = new Map<string, Map<string, SessionParticipant>>();

export function setupWebRTCSignaling(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // ==================== SESSION MANAGEMENT ====================

    /**
     * Join a live session
     */
    socket.on('join-session', (data: { 
      sessionId: string; 
      userId: string; 
      userName: string; 
      role: 'instructor' | 'student' | 'co-host' 
    }) => {
      const { sessionId, userId, userName, role } = data;

      // Join the session room
      socket.join(sessionId);

      // Store participant info
      if (!activeSessions.has(sessionId)) {
        activeSessions.set(sessionId, new Map());
      }

      const participants = activeSessions.get(sessionId)!;
      participants.set(userId, {
        socketId: socket.id,
        userId,
        userName,
        role,
        isMuted: false,
        isVideoOn: true,
        isSharingScreen: false
      });

      // Notify others in the session
      socket.to(sessionId).emit('user-joined', {
        userId,
        userName,
        role,
        socketId: socket.id
      });

      // Send current participants list to the new user
      const participantsList = Array.from(participants.values());
      socket.emit('participants-list', participantsList);

      logger.info('User joined session', { sessionId, userId, userName, role });
    });

    /**
     * Leave a session
     */
    socket.on('leave-session', (data: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = data;

      socket.leave(sessionId);

      const participants = activeSessions.get(sessionId);
      if (participants) {
        participants.delete(userId);
        if (participants.size === 0) {
          activeSessions.delete(sessionId);
        }
      }

      socket.to(sessionId).emit('user-left', { userId });

      logger.info('User left session', { sessionId, userId });
    });

    // ==================== WEBRTC SIGNALING ====================

    /**
     * Send WebRTC offer
     */
    socket.on('offer', (data: { sessionId: string; targetUserId: string; offer: any }) => {
      const { sessionId, targetUserId, offer } = data;

      const participants = activeSessions.get(sessionId);
      const targetParticipant = participants?.get(targetUserId);

      if (targetParticipant) {
        io.to(targetParticipant.socketId).emit('offer', {
          from: socket.id,
          offer
        });
      }
    });

    /**
     * Send WebRTC answer
     */
    socket.on('answer', (data: { sessionId: string; targetUserId: string; answer: any }) => {
      const { sessionId, targetUserId, answer } = data;

      const participants = activeSessions.get(sessionId);
      const targetParticipant = participants?.get(targetUserId);

      if (targetParticipant) {
        io.to(targetParticipant.socketId).emit('answer', {
          from: socket.id,
          answer
        });
      }
    });

    /**
     * Send ICE candidate
     */
    socket.on('ice-candidate', (data: { 
      sessionId: string; 
      targetUserId: string; 
      candidate: any 
    }) => {
      const { sessionId, targetUserId, candidate } = data;

      const participants = activeSessions.get(sessionId);
      const targetParticipant = participants?.get(targetUserId);

      if (targetParticipant) {
        io.to(targetParticipant.socketId).emit('ice-candidate', {
          from: socket.id,
          candidate
        });
      }
    });

    // ==================== CHAT EVENTS ====================

    /**
     * Real-time chat message
     */
    socket.on('chat:send', (data: { sessionId: string; message: any }) => {
      const { sessionId, message } = data;
      socket.to(sessionId).emit('chat:message', message);
    });

    /**
     * Typing indicator
     */
    socket.on('chat:typing', (data: { sessionId: string; userName: string; isTyping: boolean }) => {
      const { sessionId, userName, isTyping } = data;
      socket.to(sessionId).emit('chat:typing', { userName, isTyping });
    });

    // ==================== Q&A EVENTS ====================

    /**
     * New question asked
     */
    socket.on('qa:question', (data: { sessionId: string; question: any }) => {
      const { sessionId, question } = data;
      socket.to(sessionId).emit('qa:question', question);
    });

    /**
     * Question answered
     */
    socket.on('qa:answered', (data: { sessionId: string; question: any }) => {
      const { sessionId, question } = data;
      socket.to(sessionId).emit('qa:answered', question);
    });

    /**
     * Question upvoted
     */
    socket.on('qa:upvoted', (data: { sessionId: string; questionId: string; upvotes: number }) => {
      const { sessionId, questionId, upvotes } = data;
      socket.to(sessionId).emit('qa:upvoted', { questionId, upvotes });
    });

    // ==================== POLL EVENTS ====================

    /**
     * New poll created
     */
    socket.on('poll:created', (data: { sessionId: string; poll: any }) => {
      const { sessionId, poll } = data;
      socket.to(sessionId).emit('poll:created', poll);
    });

    /**
     * Poll updated (new vote)
     */
    socket.on('poll:updated', (data: { sessionId: string; poll: any }) => {
      const { sessionId, poll } = data;
      socket.to(sessionId).emit('poll:updated', poll);
    });

    /**
     * Poll closed
     */
    socket.on('poll:closed', (data: { sessionId: string; pollId: string }) => {
      const { sessionId, pollId } = data;
      socket.to(sessionId).emit('poll:closed', { pollId });
    });

    // ==================== HAND RAISE EVENTS ====================

    /**
     * Hand raised
     */
    socket.on('hand:raised', (data: { sessionId: string; handRaise: any }) => {
      const { sessionId, handRaise } = data;
      socket.to(sessionId).emit('hand:raised', handRaise);
    });

    /**
     * Hand lowered
     */
    socket.on('hand:lowered', (data: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = data;
      socket.to(sessionId).emit('hand:lowered', { userId });
    });

    /**
     * Hand raise accepted
     */
    socket.on('hand:accepted', (data: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = data;
      io.to(sessionId).emit('hand:accepted', { userId });
    });

    /**
     * Hand raise declined
     */
    socket.on('hand:declined', (data: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = data;
      io.to(sessionId).emit('hand:declined', { userId });
    });

    // ==================== SCREEN SHARING EVENTS ====================

    /**
     * Screen sharing started
     */
    socket.on('screen:started', (data: { sessionId: string; userId: string; shareType: string }) => {
      const { sessionId, userId, shareType } = data;

      const participants = activeSessions.get(sessionId);
      const participant = participants?.get(userId);
      if (participant) {
        participant.isSharingScreen = true;
      }

      socket.to(sessionId).emit('screen:started', { userId, shareType });
    });

    /**
     * Screen sharing stopped
     */
    socket.on('screen:stopped', (data: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = data;

      const participants = activeSessions.get(sessionId);
      const participant = participants?.get(userId);
      if (participant) {
        participant.isSharingScreen = false;
      }

      socket.to(sessionId).emit('screen:stopped', { userId });
    });

    // ==================== PRESENTATION EVENTS ====================

    /**
     * Presentation uploaded
     */
    socket.on('presentation:uploaded', (data: { sessionId: string; presentation: any }) => {
      const { sessionId, presentation } = data;
      socket.to(sessionId).emit('presentation:uploaded', presentation);
    });

    /**
     * Presentation slide changed
     */
    socket.on('presentation:slide-changed', (data: { 
      sessionId: string; 
      presentationId: string; 
      slideNumber: number 
    }) => {
      const { sessionId, presentationId, slideNumber } = data;
      socket.to(sessionId).emit('presentation:slide-changed', { presentationId, slideNumber });
    });

    /**
     * Presentation annotation
     */
    socket.on('presentation:annotation', (data: { 
      sessionId: string; 
      presentationId: string; 
      slideNumber: number;
      annotation: any 
    }) => {
      const { sessionId, presentationId, slideNumber, annotation } = data;
      socket.to(sessionId).emit('presentation:annotation', { 
        presentationId, 
        slideNumber, 
        annotation 
      });
    });

    // ==================== PARTICIPANT MANAGEMENT EVENTS ====================

    /**
     * Participant muted/unmuted
     */
    socket.on('participant:mute', (data: { 
      sessionId: string; 
      userId: string; 
      isMuted: boolean 
    }) => {
      const { sessionId, userId, isMuted } = data;

      const participants = activeSessions.get(sessionId);
      const participant = participants?.get(userId);
      if (participant) {
        participant.isMuted = isMuted;
      }

      io.to(sessionId).emit('participant:mute', { userId, isMuted });
    });

    /**
     * Participant video toggled
     */
    socket.on('participant:video', (data: { 
      sessionId: string; 
      userId: string; 
      isVideoOn: boolean 
    }) => {
      const { sessionId, userId, isVideoOn } = data;

      const participants = activeSessions.get(sessionId);
      const participant = participants?.get(userId);
      if (participant) {
        participant.isVideoOn = isVideoOn;
      }

      io.to(sessionId).emit('participant:video', { userId, isVideoOn });
    });

    /**
     * Participant removed
     */
    socket.on('participant:removed', (data: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = data;

      const participants = activeSessions.get(sessionId);
      const participant = participants?.get(userId);
      
      if (participant) {
        // Disconnect the participant
        io.to(participant.socketId).emit('session:kicked', { 
          reason: 'Removed by instructor' 
        });
        
        participants.delete(userId);
      }

      socket.to(sessionId).emit('participant:removed', { userId });
    });

    // ==================== REACTION EVENTS ====================

    /**
     * Real-time reaction
     */
    socket.on('reaction:sent', (data: { 
      sessionId: string; 
      userId: string; 
      userName: string;
      reactionType: string 
    }) => {
      const { sessionId, userId, userName, reactionType } = data;
      socket.to(sessionId).emit('reaction:sent', { userId, userName, reactionType });
    });

    // ==================== BREAKOUT ROOM EVENTS ====================

    /**
     * Breakout room created
     */
    socket.on('breakout:created', (data: { sessionId: string; room: any }) => {
      const { sessionId, room } = data;
      socket.to(sessionId).emit('breakout:created', room);
    });

    /**
     * User assigned to breakout room
     */
    socket.on('breakout:assigned', (data: { 
      sessionId: string; 
      roomId: string; 
      userId: string 
    }) => {
      const { sessionId, roomId, userId } = data;

      const participants = activeSessions.get(sessionId);
      const participant = participants?.get(userId);

      if (participant) {
        io.to(participant.socketId).emit('breakout:assigned', { roomId });
      }
    });

    // ==================== SURVEY EVENTS ====================

    /**
     * Survey created
     */
    socket.on('survey:created', (data: { sessionId: string; survey: any }) => {
      const { sessionId, survey } = data;
      socket.to(sessionId).emit('survey:created', survey);
    });

    // ==================== DISCONNECT ====================

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });

      // Remove from all sessions
      activeSessions.forEach((participants, sessionId) => {
        participants.forEach((participant, userId) => {
          if (participant.socketId === socket.id) {
            participants.delete(userId);
            socket.to(sessionId).emit('user-left', { userId });
            
            if (participants.size === 0) {
              activeSessions.delete(sessionId);
            }
          }
        });
      });
    });
  });

  logger.info('WebRTC signaling and interactive features initialized');
}

/**
 * Get active participants in a session
 */
export function getSessionParticipants(sessionId: string): SessionParticipant[] {
  const participants = activeSessions.get(sessionId);
  return participants ? Array.from(participants.values()) : [];
}

/**
 * Get participant count for a session
 */
export function getParticipantCount(sessionId: string): number {
  const participants = activeSessions.get(sessionId);
  return participants ? participants.size : 0;
}

