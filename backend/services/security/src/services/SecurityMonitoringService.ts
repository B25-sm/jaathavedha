import { Logger } from '@sai-mahendra/utils';
import Redis from 'ioredis';
import { MongoClient, Db } from 'mongodb';

/**
 * SecurityMonitoringService - Real-time security event logging and monitoring
 * Requirements: 11.7 (Security monitoring), 11.8 (Intrusion detection)
 */
export class SecurityMonitoringService {
  private redis: Redis;
  private mongoClient: MongoClient;
  private db: Db | null = null;
  private alertWebhookUrl: string;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.mongoClient = new MongoClient(
      process.env.MONGODB_URL || 'mongodb://localhost:27017'
    );
    this.alertWebhookUrl = process.env.ALERT_WEBHOOK_URL || '';
    
    this.initializeMongoDB();
  }

  /**
   * Initialize MongoDB connection
   */
  private async initializeMongoDB(): Promise<void> {
    try {
      await this.mongoClient.connect();
      this.db = this.mongoClient.db('sai_mahendra_security');
      Logger.info('Security monitoring connected to MongoDB');
    } catch (error) {
      Logger.error('Failed to connect to MongoDB', error as Error);
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      const enrichedEvent = {
        ...event,
        timestamp: new Date(),
        id: this.generateEventId()
      };

      // Store in MongoDB for long-term analysis
      if (this.db) {
        await this.db.collection('security_events').insertOne(enrichedEvent);
      }

      // Store in Redis for real-time monitoring
      await this.redis.lpush(
        'security:events:recent',
        JSON.stringify(enrichedEvent)
      );
      await this.redis.ltrim('security:events:recent', 0, 999); // Keep last 1000 events

      // Increment event counter
      await this.redis.hincrby(
        'security:event_counts',
        event.type,
        1
      );

      // Check if event requires immediate alert
      if (this.isHighSeverityEvent(event)) {
        await this.sendAlert(enrichedEvent);
      }

      Logger.info(`Security event logged: ${event.type}`, { eventId: enrichedEvent.id });
    } catch (error) {
      Logger.error('Failed to log security event', error as Error);
    }
  }

  /**
   * Log authentication attempt
   */
  async logAuthAttempt(attempt: AuthAttempt): Promise<void> {
    const event: SecurityEvent = {
      type: attempt.success ? 'auth_success' : 'auth_failure',
      severity: attempt.success ? 'info' : 'warning',
      userId: attempt.userId,
      ipAddress: attempt.ipAddress,
      userAgent: attempt.userAgent,
      details: {
        method: attempt.method,
        reason: attempt.reason
      }
    };

    await this.logSecurityEvent(event);

    // Track failed login attempts for brute force detection
    if (!attempt.success) {
      await this.trackFailedLogin(attempt.userId || attempt.ipAddress, attempt.ipAddress);
    }
  }

  /**
   * Track failed login attempts for brute force detection
   */
  private async trackFailedLogin(identifier: string, ipAddress: string): Promise<void> {
    const key = `security:failed_logins:${identifier}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, 900); // 15 minutes

    // Alert if threshold exceeded
    if (count >= 5) {
      await this.logSecurityEvent({
        type: 'brute_force_detected',
        severity: 'critical',
        userId: identifier,
        ipAddress,
        details: {
          attemptCount: count,
          timeWindow: '15 minutes'
        }
      });

      // Block IP temporarily
      await this.blockIP(ipAddress, 3600); // 1 hour
    }
  }

  /**
   * Block IP address temporarily
   */
  async blockIP(ipAddress: string, durationSeconds: number): Promise<void> {
    await this.redis.setex(
      `security:blocked_ip:${ipAddress}`,
      durationSeconds,
      'blocked'
    );

    Logger.warn(`IP address blocked: ${ipAddress} for ${durationSeconds}s`);
  }

  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    const blocked = await this.redis.get(`security:blocked_ip:${ipAddress}`);
    return blocked !== null;
  }

  /**
   * Log data access event
   */
  async logDataAccess(access: DataAccessEvent): Promise<void> {
    const event: SecurityEvent = {
      type: 'data_access',
      severity: access.sensitiveData ? 'warning' : 'info',
      userId: access.userId,
      ipAddress: access.ipAddress,
      details: {
        resource: access.resource,
        action: access.action,
        sensitiveData: access.sensitiveData,
        recordCount: access.recordCount
      }
    };

    await this.logSecurityEvent(event);
  }

  /**
   * Log permission change
   */
  async logPermissionChange(change: PermissionChange): Promise<void> {
    const event: SecurityEvent = {
      type: 'permission_change',
      severity: 'warning',
      userId: change.adminUserId,
      details: {
        targetUserId: change.targetUserId,
        oldRole: change.oldRole,
        newRole: change.newRole,
        reason: change.reason
      }
    };

    await this.logSecurityEvent(event);
  }

  /**
   * Detect anomalous user behavior
   */
  async detectAnomalies(userId: string): Promise<AnomalyDetectionResult> {
    try {
      // Get user's recent activity
      const recentEvents = await this.getUserRecentEvents(userId, 100);

      const anomalies: string[] = [];

      // Check for unusual access patterns
      const accessTimes = recentEvents.map(e => new Date(e.timestamp).getHours());
      const unusualTime = this.detectUnusualAccessTime(accessTimes);
      if (unusualTime) {
        anomalies.push('Unusual access time detected');
      }

      // Check for rapid successive requests
      const rapidRequests = this.detectRapidRequests(recentEvents);
      if (rapidRequests) {
        anomalies.push('Rapid successive requests detected');
      }

      // Check for access from multiple locations
      const multipleLocations = this.detectMultipleLocations(recentEvents);
      if (multipleLocations) {
        anomalies.push('Access from multiple geographic locations');
      }

      // Check for unusual data access volume
      const unusualVolume = this.detectUnusualDataVolume(recentEvents);
      if (unusualVolume) {
        anomalies.push('Unusual data access volume');
      }

      if (anomalies.length > 0) {
        await this.logSecurityEvent({
          type: 'anomaly_detected',
          severity: 'warning',
          userId,
          details: {
            anomalies,
            eventCount: recentEvents.length
          }
        });
      }

      return {
        userId,
        anomaliesDetected: anomalies.length > 0,
        anomalies,
        riskScore: this.calculateRiskScore(anomalies.length)
      };
    } catch (error) {
      Logger.error('Anomaly detection failed', error as Error);
      return {
        userId,
        anomaliesDetected: false,
        anomalies: [],
        riskScore: 0
      };
    }
  }

  /**
   * Get user's recent security events
   */
  private async getUserRecentEvents(userId: string, limit: number): Promise<any[]> {
    if (!this.db) return [];

    return await this.db
      .collection('security_events')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Detect unusual access time
   */
  private detectUnusualAccessTime(accessTimes: number[]): boolean {
    // Check if user is accessing during unusual hours (2 AM - 5 AM)
    const unusualHours = accessTimes.filter(h => h >= 2 && h <= 5);
    return unusualHours.length > accessTimes.length * 0.3;
  }

  /**
   * Detect rapid successive requests
   */
  private detectRapidRequests(events: any[]): boolean {
    if (events.length < 10) return false;

    const recentEvents = events.slice(0, 10);
    const timestamps = recentEvents.map(e => new Date(e.timestamp).getTime());
    const timeSpan = timestamps[0] - timestamps[timestamps.length - 1];

    // More than 10 requests in 1 minute
    return timeSpan < 60000;
  }

  /**
   * Detect access from multiple locations
   */
  private detectMultipleLocations(events: any[]): boolean {
    const uniqueIPs = new Set(events.map(e => e.ipAddress).filter(Boolean));
    return uniqueIPs.size > 3;
  }

  /**
   * Detect unusual data access volume
   */
  private detectUnusualDataVolume(events: any[]): boolean {
    const dataAccessEvents = events.filter(e => e.type === 'data_access');
    const totalRecords = dataAccessEvents.reduce(
      (sum, e) => sum + (e.details?.recordCount || 0),
      0
    );

    // More than 1000 records accessed
    return totalRecords > 1000;
  }

  /**
   * Calculate risk score based on anomalies
   */
  private calculateRiskScore(anomalyCount: number): number {
    return Math.min(anomalyCount * 25, 100);
  }

  /**
   * Check if event is high severity
   */
  private isHighSeverityEvent(event: SecurityEvent): boolean {
    return event.severity === 'critical' || event.severity === 'high';
  }

  /**
   * Send alert for high severity events
   */
  private async sendAlert(event: SecurityEvent): Promise<void> {
    try {
      if (!this.alertWebhookUrl) {
        Logger.warn('Alert webhook URL not configured');
        return;
      }

      const alertPayload = {
        title: `Security Alert: ${event.type}`,
        severity: event.severity,
        timestamp: event.timestamp,
        details: event.details,
        userId: event.userId,
        ipAddress: event.ipAddress
      };

      // In production, send to webhook (Slack, PagerDuty, etc.)
      Logger.warn('Security alert triggered', alertPayload);

      // Store alert in Redis for dashboard
      await this.redis.lpush(
        'security:alerts',
        JSON.stringify(alertPayload)
      );
      await this.redis.ltrim('security:alerts', 0, 99); // Keep last 100 alerts
    } catch (error) {
      Logger.error('Failed to send security alert', error as Error);
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get security dashboard metrics
   */
  async getDashboardMetrics(): Promise<SecurityDashboardMetrics> {
    try {
      // Get event counts
      const eventCounts = await this.redis.hgetall('security:event_counts');

      // Get recent alerts
      const alertsData = await this.redis.lrange('security:alerts', 0, 9);
      const recentAlerts = alertsData.map(a => JSON.parse(a));

      // Get blocked IPs
      const blockedIPKeys = await this.redis.keys('security:blocked_ip:*');
      const blockedIPs = blockedIPKeys.map(k => k.replace('security:blocked_ip:', ''));

      // Get event statistics from MongoDB
      let totalEvents = 0;
      let criticalEvents = 0;

      if (this.db) {
        totalEvents = await this.db.collection('security_events').countDocuments();
        criticalEvents = await this.db
          .collection('security_events')
          .countDocuments({ severity: 'critical' });
      }

      return {
        totalEvents,
        criticalEvents,
        eventCounts: eventCounts as Record<string, string>,
        recentAlerts,
        blockedIPs,
        timestamp: new Date()
      };
    } catch (error) {
      Logger.error('Failed to get dashboard metrics', error as Error);
      throw error;
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.redis.quit();
    await this.mongoClient.close();
  }
}

// Types
interface SecurityEvent {
  type: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
  timestamp?: Date;
  id?: string;
}

interface AuthAttempt {
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  method: string;
  reason?: string;
}

interface DataAccessEvent {
  userId: string;
  ipAddress: string;
  resource: string;
  action: string;
  sensitiveData: boolean;
  recordCount?: number;
}

interface PermissionChange {
  adminUserId: string;
  targetUserId: string;
  oldRole: string;
  newRole: string;
  reason?: string;
}

interface AnomalyDetectionResult {
  userId: string;
  anomaliesDetected: boolean;
  anomalies: string[];
  riskScore: number;
}

interface SecurityDashboardMetrics {
  totalEvents: number;
  criticalEvents: number;
  eventCounts: Record<string, string>;
  recentAlerts: any[];
  blockedIPs: string[];
  timestamp: Date;
}

// Singleton instance
export const securityMonitoringService = new SecurityMonitoringService();
