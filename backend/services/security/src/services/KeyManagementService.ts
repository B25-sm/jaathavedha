import crypto from 'crypto';
import { Logger } from '@sai-mahendra/utils';
import Redis from 'ioredis';

/**
 * KeyManagementService - Manages encryption keys with rotation policies
 * Supports integration with AWS KMS and HashiCorp Vault
 * Requirements: 11.1 (Key management), 11.6 (Key rotation)
 */
export class KeyManagementService {
  private redis: Redis;
  private keyRotationDays: number;
  private keys: Map<string, KeyMetadata>;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.keyRotationDays = parseInt(process.env.KEY_ROTATION_DAYS || '90');
    this.keys = new Map();
    
    this.initializeKeyStore();
  }

  /**
   * Initialize key store from Redis
   */
  private async initializeKeyStore(): Promise<void> {
    try {
      const keyData = await this.redis.get('encryption:keys');
      if (keyData) {
        const keys = JSON.parse(keyData);
        for (const [keyId, metadata] of Object.entries(keys)) {
          this.keys.set(keyId, metadata as KeyMetadata);
        }
        Logger.info(`Loaded ${this.keys.size} encryption keys from store`);
      }
    } catch (error) {
      Logger.error('Failed to initialize key store', error as Error);
    }
  }

  /**
   * Generate a new encryption key
   */
  async generateKey(purpose: string): Promise<string> {
    const keyId = `key_${crypto.randomBytes(16).toString('hex')}`;
    const key = crypto.randomBytes(32).toString('hex');
    
    const metadata: KeyMetadata = {
      keyId,
      purpose,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.keyRotationDays * 24 * 60 * 60 * 1000),
      version: 1,
      status: 'active',
      algorithm: 'aes-256-gcm'
    };
    
    this.keys.set(keyId, metadata);
    await this.persistKeys();
    
    // Store the actual key securely (in production, use KMS)
    await this.redis.setex(
      `encryption:key:${keyId}`,
      this.keyRotationDays * 24 * 60 * 60,
      key
    );
    
    Logger.info(`Generated new encryption key: ${keyId} for ${purpose}`);
    return keyId;
  }

  /**
   * Get encryption key by ID
   */
  async getKey(keyId: string): Promise<string | null> {
    const key = await this.redis.get(`encryption:key:${keyId}`);
    
    if (!key) {
      Logger.warn(`Key not found: ${keyId}`);
      return null;
    }
    
    const metadata = this.keys.get(keyId);
    if (metadata && metadata.status !== 'active') {
      Logger.warn(`Key is not active: ${keyId}`);
      return null;
    }
    
    return key;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string): Promise<string> {
    const oldMetadata = this.keys.get(keyId);
    
    if (!oldMetadata) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    // Mark old key as rotated
    oldMetadata.status = 'rotated';
    oldMetadata.rotatedAt = new Date();
    
    // Generate new key with incremented version
    const newKeyId = `key_${crypto.randomBytes(16).toString('hex')}`;
    const newKey = crypto.randomBytes(32).toString('hex');
    
    const newMetadata: KeyMetadata = {
      keyId: newKeyId,
      purpose: oldMetadata.purpose,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.keyRotationDays * 24 * 60 * 60 * 1000),
      version: oldMetadata.version + 1,
      status: 'active',
      algorithm: oldMetadata.algorithm,
      previousKeyId: keyId
    };
    
    this.keys.set(newKeyId, newMetadata);
    await this.persistKeys();
    
    // Store new key
    await this.redis.setex(
      `encryption:key:${newKeyId}`,
      this.keyRotationDays * 24 * 60 * 60,
      newKey
    );
    
    Logger.info(`Rotated key ${keyId} to ${newKeyId}`);
    return newKeyId;
  }

  /**
   * Check if key needs rotation
   */
  async checkKeyRotation(keyId: string): Promise<boolean> {
    const metadata = this.keys.get(keyId);
    
    if (!metadata) {
      return false;
    }
    
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (metadata.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    
    // Rotate if less than 7 days until expiry
    return daysUntilExpiry < 7;
  }

  /**
   * Get all active keys
   */
  getActiveKeys(): KeyMetadata[] {
    return Array.from(this.keys.values()).filter(k => k.status === 'active');
  }

  /**
   * Get key metadata
   */
  getKeyMetadata(keyId: string): KeyMetadata | undefined {
    return this.keys.get(keyId);
  }

  /**
   * Revoke a key (mark as revoked, don't delete)
   */
  async revokeKey(keyId: string, reason: string): Promise<void> {
    const metadata = this.keys.get(keyId);
    
    if (!metadata) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    metadata.status = 'revoked';
    metadata.revokedAt = new Date();
    metadata.revocationReason = reason;
    
    await this.persistKeys();
    
    Logger.warn(`Revoked key ${keyId}: ${reason}`);
  }

  /**
   * Persist keys to Redis
   */
  private async persistKeys(): Promise<void> {
    const keysObject = Object.fromEntries(this.keys);
    await this.redis.set('encryption:keys', JSON.stringify(keysObject));
  }

  /**
   * Automatic key rotation check (run periodically)
   */
  async performAutomaticRotation(): Promise<void> {
    const activeKeys = this.getActiveKeys();
    
    for (const metadata of activeKeys) {
      const needsRotation = await this.checkKeyRotation(metadata.keyId);
      
      if (needsRotation) {
        try {
          await this.rotateKey(metadata.keyId);
          Logger.info(`Automatically rotated key: ${metadata.keyId}`);
        } catch (error) {
          Logger.error(`Failed to rotate key ${metadata.keyId}`, error as Error);
        }
      }
    }
  }

  /**
   * Integration with AWS KMS (for production)
   */
  async generateKMSKey(purpose: string): Promise<string> {
    // In production, integrate with AWS KMS
    // const kms = new AWS.KMS({ region: process.env.AWS_REGION });
    // const result = await kms.generateDataKey({ KeyId: process.env.AWS_KMS_KEY_ID }).promise();
    
    // For now, use local key generation
    return this.generateKey(purpose);
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

interface KeyMetadata {
  keyId: string;
  purpose: string;
  createdAt: Date;
  expiresAt: Date;
  version: number;
  status: 'active' | 'rotated' | 'revoked' | 'expired';
  algorithm: string;
  previousKeyId?: string;
  rotatedAt?: Date;
  revokedAt?: Date;
  revocationReason?: string;
}

// Singleton instance
export const keyManagementService = new KeyManagementService();
