import { Logger } from '@sai-mahendra/utils';
import { Pool } from 'pg';
import { MongoClient, Db } from 'mongodb';
import { encryptionService } from './EncryptionService';

/**
 * GDPRComplianceService - Implements GDPR compliance features
 * Requirements: 11.4 (Data portability, right to erasure), 11.5 (Consent management)
 */
export class GDPRComplianceService {
  private pgPool: Pool;
  private mongoClient: MongoClient;
  private db: Db | null = null;

  constructor() {
    this.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    this.mongoClient = new MongoClient(
      process.env.MONGODB_URL || 'mongodb://localhost:27017'
    );

    this.initializeMongoDB();
  }

  /**
   * Initialize MongoDB connection
   */
  private async initializeMongoDB(): Promise<void> {
    try {
      await this.mongoClient.connect();
      this.db = this.mongoClient.db('sai_mahendra_gdpr');
      Logger.info('GDPR service connected to MongoDB');
    } catch (error) {
      Logger.error('Failed to connect to MongoDB', error as Error);
    }
  }

  /**
   * Export all user data (GDPR Right to Data Portability)
   * Requirement: 11.4
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    try {
      Logger.info(`Exporting data for user: ${userId}`);

      // Get user profile data
      const userData = await this.getUserProfile(userId);

      // Get enrollment data
      const enrollments = await this.getUserEnrollments(userId);

      // Get payment history
      const payments = await this.getUserPayments(userId);

      // Get contact inquiries
      const inquiries = await this.getUserInquiries(userId);

      // Get user progress and activity
      const progress = await this.getUserProgress(userId);

      // Get consent records
      const consents = await this.getUserConsents(userId);

      // Get analytics data (anonymized)
      const analytics = await this.getUserAnalytics(userId);

      const exportData: UserDataExport = {
        userId,
        exportDate: new Date(),
        profile: userData,
        enrollments,
        payments,
        inquiries,
        progress,
        consents,
        analytics
      };

      // Log export request
      await this.logGDPRAction({
        userId,
        action: 'data_export',
        timestamp: new Date(),
        status: 'completed'
      });

      return exportData;
    } catch (error) {
      Logger.error('Failed to export user data', error as Error);
      throw new Error('Data export failed');
    }
  }

  /**
   * Delete all user data (GDPR Right to Erasure)
   * Requirement: 11.4
   */
  async deleteUserData(userId: string, reason: string): Promise<DataDeletionResult> {
    const client = await this.pgPool.connect();

    try {
      Logger.warn(`Deleting data for user: ${userId}, reason: ${reason}`);

      await client.query('BEGIN');

      const deletionResults: Record<string, number> = {};

      // Delete from users table (soft delete - mark as deleted)
      const userResult = await client.query(
        `UPDATE users SET 
          status = 'deleted',
          email = $1,
          first_name = 'Deleted',
          last_name = 'User',
          phone = NULL,
          updated_at = NOW()
        WHERE id = $2`,
        [`deleted_${userId}@deleted.local`, userId]
      );
      deletionResults.users = userResult.rowCount || 0;

      // Delete enrollments (keep for legal/financial records but anonymize)
      const enrollmentResult = await client.query(
        `UPDATE enrollments SET 
          user_id = NULL,
          updated_at = NOW()
        WHERE user_id = $1`,
        [userId]
      );
      deletionResults.enrollments = enrollmentResult.rowCount || 0;

      // Anonymize payment records (keep for financial compliance)
      const paymentResult = await client.query(
        `UPDATE payments SET 
          user_id = NULL,
          updated_at = NOW()
        WHERE user_id = $1`,
        [userId]
      );
      deletionResults.payments = paymentResult.rowCount || 0;

      // Delete contact inquiries
      const inquiryResult = await client.query(
        `DELETE FROM contact_inquiries WHERE user_id = $1`,
        [userId]
      );
      deletionResults.inquiries = inquiryResult.rowCount || 0;

      // Delete user progress
      const progressResult = await client.query(
        `DELETE FROM user_progress WHERE user_id = $1`,
        [userId]
      );
      deletionResults.progress = progressResult.rowCount || 0;

      // Delete from MongoDB collections
      if (this.db) {
        // Delete analytics events
        const analyticsResult = await this.db
          .collection('analytics_events')
          .deleteMany({ userId });
        deletionResults.analytics = analyticsResult.deletedCount;

        // Delete content interactions
        const contentResult = await this.db
          .collection('content_interactions')
          .deleteMany({ userId });
        deletionResults.content = contentResult.deletedCount;
      }

      await client.query('COMMIT');

      // Log deletion
      await this.logGDPRAction({
        userId,
        action: 'data_deletion',
        timestamp: new Date(),
        status: 'completed',
        reason,
        details: deletionResults
      });

      Logger.info(`User data deleted successfully: ${userId}`);

      return {
        userId,
        deletionDate: new Date(),
        reason,
        recordsDeleted: deletionResults,
        success: true
      };
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Failed to delete user data', error as Error);

      await this.logGDPRAction({
        userId,
        action: 'data_deletion',
        timestamp: new Date(),
        status: 'failed',
        reason,
        error: (error as Error).message
      });

      throw new Error('Data deletion failed');
    } finally {
      client.release();
    }
  }

  /**
   * Anonymize user data for analytics
   * Requirement: 11.4
   */
  async anonymizeUserData(userId: string): Promise<void> {
    try {
      Logger.info(`Anonymizing data for user: ${userId}`);

      // Generate anonymous ID
      const anonymousId = `anon_${encryptionService.hash(userId).substring(0, 16)}`;

      // Update analytics data with anonymous ID
      if (this.db) {
        await this.db.collection('analytics_events').updateMany(
          { userId },
          { $set: { userId: anonymousId, anonymized: true } }
        );
      }

      Logger.info(`User data anonymized: ${userId} -> ${anonymousId}`);
    } catch (error) {
      Logger.error('Failed to anonymize user data', error as Error);
      throw error;
    }
  }

  /**
   * Record user consent
   * Requirement: 11.5
   */
  async recordConsent(consent: ConsentRecord): Promise<void> {
    try {
      const result = await this.pgPool.query(
        `INSERT INTO user_consents 
          (user_id, consent_type, granted, purpose, version, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id`,
        [
          consent.userId,
          consent.consentType,
          consent.granted,
          consent.purpose,
          consent.version,
          consent.ipAddress,
          consent.userAgent
        ]
      );

      Logger.info(`Consent recorded: ${consent.consentType} for user ${consent.userId}`);

      // Log GDPR action
      await this.logGDPRAction({
        userId: consent.userId,
        action: 'consent_recorded',
        timestamp: new Date(),
        status: 'completed',
        details: {
          consentType: consent.consentType,
          granted: consent.granted
        }
      });
    } catch (error) {
      Logger.error('Failed to record consent', error as Error);
      throw error;
    }
  }

  /**
   * Get user consent status
   * Requirement: 11.5
   */
  async getUserConsentStatus(userId: string): Promise<ConsentStatus> {
    try {
      const result = await this.pgPool.query(
        `SELECT consent_type, granted, purpose, version, created_at
        FROM user_consents
        WHERE user_id = $1
        ORDER BY created_at DESC`,
        [userId]
      );

      const consents: Record<string, boolean> = {};
      const details: ConsentRecord[] = [];

      for (const row of result.rows) {
        // Get latest consent for each type
        if (!(row.consent_type in consents)) {
          consents[row.consent_type] = row.granted;
        }

        details.push({
          userId,
          consentType: row.consent_type,
          granted: row.granted,
          purpose: row.purpose,
          version: row.version,
          timestamp: row.created_at
        });
      }

      return {
        userId,
        consents,
        details,
        lastUpdated: details[0]?.timestamp || null
      };
    } catch (error) {
      Logger.error('Failed to get consent status', error as Error);
      throw error;
    }
  }

  /**
   * Withdraw consent
   * Requirement: 11.5
   */
  async withdrawConsent(
    userId: string,
    consentType: string,
    reason?: string
  ): Promise<void> {
    try {
      await this.recordConsent({
        userId,
        consentType,
        granted: false,
        purpose: `Consent withdrawn${reason ? `: ${reason}` : ''}`,
        version: '1.0'
      });

      Logger.info(`Consent withdrawn: ${consentType} for user ${userId}`);
    } catch (error) {
      Logger.error('Failed to withdraw consent', error as Error);
      throw error;
    }
  }

  /**
   * Check if user has given required consents
   */
  async hasRequiredConsents(userId: string): Promise<boolean> {
    const requiredConsents = ['terms_of_service', 'privacy_policy'];

    const status = await this.getUserConsentStatus(userId);

    for (const required of requiredConsents) {
      if (!status.consents[required]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get user profile data
   */
  private async getUserProfile(userId: string): Promise<any> {
    const result = await this.pgPool.query(
      `SELECT id, email, first_name, last_name, phone, role, created_at, updated_at
      FROM users WHERE id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get user enrollments
   */
  private async getUserEnrollments(userId: string): Promise<any[]> {
    const result = await this.pgPool.query(
      `SELECT e.*, p.name as program_name
      FROM enrollments e
      JOIN programs p ON e.program_id = p.id
      WHERE e.user_id = $1`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get user payments
   */
  private async getUserPayments(userId: string): Promise<any[]> {
    const result = await this.pgPool.query(
      `SELECT id, amount, currency, status, payment_method, created_at
      FROM payments WHERE user_id = $1`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get user inquiries
   */
  private async getUserInquiries(userId: string): Promise<any[]> {
    const result = await this.pgPool.query(
      `SELECT id, subject, message, status, created_at
      FROM contact_inquiries WHERE user_id = $1`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get user progress
   */
  private async getUserProgress(userId: string): Promise<any[]> {
    const result = await this.pgPool.query(
      `SELECT * FROM user_progress WHERE user_id = $1`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get user consents
   */
  private async getUserConsents(userId: string): Promise<any[]> {
    const result = await this.pgPool.query(
      `SELECT * FROM user_consents WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get user analytics (anonymized)
   */
  private async getUserAnalytics(userId: string): Promise<any[]> {
    if (!this.db) return [];

    return await this.db
      .collection('analytics_events')
      .find({ userId })
      .limit(1000)
      .toArray();
  }

  /**
   * Log GDPR action
   */
  private async logGDPRAction(action: GDPRAction): Promise<void> {
    if (!this.db) return;

    await this.db.collection('gdpr_actions').insertOne(action);
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.pgPool.end();
    await this.mongoClient.close();
  }
}

// Types
interface UserDataExport {
  userId: string;
  exportDate: Date;
  profile: any;
  enrollments: any[];
  payments: any[];
  inquiries: any[];
  progress: any[];
  consents: any[];
  analytics: any[];
}

interface DataDeletionResult {
  userId: string;
  deletionDate: Date;
  reason: string;
  recordsDeleted: Record<string, number>;
  success: boolean;
}

interface ConsentRecord {
  userId: string;
  consentType: string;
  granted: boolean;
  purpose: string;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}

interface ConsentStatus {
  userId: string;
  consents: Record<string, boolean>;
  details: ConsentRecord[];
  lastUpdated: Date | null;
}

interface GDPRAction {
  userId: string;
  action: string;
  timestamp: Date;
  status: string;
  reason?: string;
  details?: any;
  error?: string;
}

// Singleton instance
export const gdprComplianceService = new GDPRComplianceService();
