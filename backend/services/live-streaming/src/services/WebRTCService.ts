import { v4 as uuidv4 } from 'uuid';
import { logger, redisClient } from '../index';
import { WebRTCPeer, MediaServerConfig } from '../types';

/**
 * WebRTC Service
 * Manages WebRTC connections, peer management, and media routing
 * Uses SFU (Selective Forwarding Unit) architecture for scalability
 */
class WebRTCService {
  private peers: Map<string, WebRTCPeer> = new Map();
  private sessionPeers: Map<string, Set<string>> = new Map();
  private config: MediaServerConfig;

  constructor() {
    this.config = {
      listenIp: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
      announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
      minPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000'),
      maxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '49999')
    };

    logger.info('WebRTC Service initialized', { config: this.config });
  }

  /**
   * Create a new peer connection
   */
  async createPeer(
    userId: string,
    sessionId: string,
    rtpCapabilities: any
  ): Promise<WebRTCPeer> {
    const peerId = uuidv4();
    
    const peer: WebRTCPeer = {
      id: peerId,
      userId,
      sessionId,
      transportId: uuidv4(),
      consumerIds: [],
      rtpCapabilities
    };

    this.peers.set(peerId, peer);

    // Add peer to session
    if (!this.sessionPeers.has(sessionId)) {
      this.sessionPeers.set(sessionId, new Set());
    }
    this.sessionPeers.get(sessionId)!.add(peerId);

    // Store in Redis for distributed systems
    await this.storePeerInRedis(peer);

    logger.info('Peer created', { peerId, userId, sessionId });
    return peer;
  }

  /**
   * Remove a peer connection
   */
  async removePeer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      logger.warn('Peer not found for removal', { peerId });
      return;
    }

    // Remove from session
    const sessionPeers = this.sessionPeers.get(peer.sessionId);
    if (sessionPeers) {
      sessionPeers.delete(peerId);
      if (sessionPeers.size === 0) {
        this.sessionPeers.delete(peer.sessionId);
      }
    }

    // Remove from memory
    this.peers.delete(peerId);

    // Remove from Redis
    await this.removePeerFromRedis(peerId);

    logger.info('Peer removed', { peerId, userId: peer.userId });
  }

  /**
   * Get all peers in a session
   */
  getSessionPeers(sessionId: string): WebRTCPeer[] {
    const peerIds = this.sessionPeers.get(sessionId);
    if (!peerIds) {
      return [];
    }

    return Array.from(peerIds)
      .map(id => this.peers.get(id))
      .filter((peer): peer is WebRTCPeer => peer !== undefined);
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): WebRTCPeer | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Get peer by user ID and session ID
   */
  getPeerByUser(userId: string, sessionId: string): WebRTCPeer | undefined {
    const peers = this.getSessionPeers(sessionId);
    return peers.find(peer => peer.userId === userId);
  }

  /**
   * Create producer (for sending media)
   */
  async createProducer(
    peerId: string,
    kind: 'audio' | 'video',
    rtpParameters: any
  ): Promise<string> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const producerId = uuidv4();
    peer.producerId = producerId;

    logger.info('Producer created', { peerId, producerId, kind });
    return producerId;
  }

  /**
   * Create consumer (for receiving media)
   */
  async createConsumer(
    peerId: string,
    producerId: string,
    rtpCapabilities: any
  ): Promise<string> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const consumerId = uuidv4();
    peer.consumerIds.push(consumerId);

    logger.info('Consumer created', { peerId, consumerId, producerId });
    return consumerId;
  }

  /**
   * Handle ICE candidate
   */
  async handleIceCandidate(
    peerId: string,
    candidate: any
  ): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    logger.debug('ICE candidate received', { peerId });
    // In production, forward to mediasoup or other media server
  }

  /**
   * Get RTP capabilities for the media server
   */
  getRtpCapabilities(): any {
    // Return mediasoup router RTP capabilities
    // This is a simplified version - in production, get from actual mediasoup router
    return {
      codecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f'
          }
        }
      ],
      headerExtensions: [
        {
          kind: 'audio',
          uri: 'urn:ietf:params:rtp-hdrext:ssrc-audio-level',
          preferredId: 1
        },
        {
          kind: 'video',
          uri: 'urn:ietf:params:rtp-hdrext:toffset',
          preferredId: 2
        }
      ]
    };
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): any {
    const peers = this.getSessionPeers(sessionId);
    
    return {
      totalPeers: peers.length,
      producers: peers.filter(p => p.producerId).length,
      consumers: peers.reduce((sum, p) => sum + p.consumerIds.length, 0),
      timestamp: new Date()
    };
  }

  /**
   * Store peer in Redis for distributed systems
   */
  private async storePeerInRedis(peer: WebRTCPeer): Promise<void> {
    try {
      const key = `webrtc:peer:${peer.id}`;
      await redisClient.setEx(
        key,
        3600, // 1 hour TTL
        JSON.stringify(peer)
      );
    } catch (error) {
      logger.error('Failed to store peer in Redis', { error, peerId: peer.id });
    }
  }

  /**
   * Remove peer from Redis
   */
  private async removePeerFromRedis(peerId: string): Promise<void> {
    try {
      const key = `webrtc:peer:${peerId}`;
      await redisClient.del(key);
    } catch (error) {
      logger.error('Failed to remove peer from Redis', { error, peerId });
    }
  }

  /**
   * Clean up inactive peers
   */
  async cleanupInactivePeers(sessionId: string): Promise<void> {
    const peers = this.getSessionPeers(sessionId);
    logger.info('Cleaning up inactive peers', { 
      sessionId, 
      peerCount: peers.length 
    });

    for (const peer of peers) {
      await this.removePeer(peer.id);
    }
  }
}

export default new WebRTCService();
