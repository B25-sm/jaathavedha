import crypto from 'crypto';
import { Logger } from '@sai-mahendra/utils';

/**
 * EncryptionService - Handles data encryption at rest and field-level encryption
 * Implements AES-256-GCM encryption with key rotation support
 * Requirements: 11.1 (Encryption at rest), 11.6 (Field-level encryption)
 */
export class EncryptionService {
  private algorithm: string;
  private masterKey: Buffer;
  private keyVersion: number;

  constructor() {
    this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
    const masterKeyString = process.env.MASTER_ENCRYPTION_KEY;
    
    if (!masterKeyString || masterKeyString.length < 32) {
      throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
    }
    
    // Derive a 32-byte key from the master key
    this.masterKey = crypto.scryptSync(masterKeyString, 'salt', 32);
    this.keyVersion = 1; // Track key version for rotation
  }

  /**
   * Encrypt sensitive data with AES-256-GCM
   * Returns base64-encoded encrypted data with IV and auth tag
   */
  encrypt(plaintext: string): string {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag for GCM mode
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, key version, and encrypted data
      const result = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted,
        keyVersion: this.keyVersion
      };
      
      // Return as base64-encoded JSON
      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      Logger.error('Encryption failed', error as Error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   */
  decrypt(encryptedData: string): string {
    try {
      // Decode base64 and parse JSON
      const data = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
      
      const iv = Buffer.from(data.iv, 'hex');
      const authTag = Buffer.from(data.authTag, 'hex');
      const encrypted = data.encrypted;
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      Logger.error('Decryption failed', error as Error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt specific fields in an object
   * Used for field-level encryption of sensitive user data
   */
  encryptFields<T extends Record<string, any>>(
    data: T,
    fieldsToEncrypt: (keyof T)[]
  ): T {
    const result = { ...data };
    
    for (const field of fieldsToEncrypt) {
      if (result[field] !== undefined && result[field] !== null) {
        const value = String(result[field]);
        result[field] = this.encrypt(value) as any;
      }
    }
    
    return result;
  }

  /**
   * Decrypt specific fields in an object
   */
  decryptFields<T extends Record<string, any>>(
    data: T,
    fieldsToDecrypt: (keyof T)[]
  ): T {
    const result = { ...data };
    
    for (const field of fieldsToDecrypt) {
      if (result[field] !== undefined && result[field] !== null) {
        try {
          result[field] = this.decrypt(String(result[field])) as any;
        } catch (error) {
          Logger.warn(`Failed to decrypt field: ${String(field)}`);
          // Keep encrypted value if decryption fails
        }
      }
    }
    
    return result;
  }

  /**
   * Hash sensitive data (one-way, for passwords, etc.)
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Verify data integrity using HMAC
   */
  generateHMAC(data: string): string {
    return crypto
      .createHmac('sha256', this.masterKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHMAC(data: string, signature: string): boolean {
    const expectedSignature = this.generateHMAC(data);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get current key version for rotation tracking
   */
  getKeyVersion(): number {
    return this.keyVersion;
  }

  /**
   * Rotate encryption key (for key rotation policy)
   * In production, this would fetch a new key from KMS
   */
  async rotateKey(newMasterKey: string): Promise<void> {
    if (newMasterKey.length < 32) {
      throw new Error('New master key must be at least 32 characters');
    }
    
    this.masterKey = crypto.scryptSync(newMasterKey, 'salt', 32);
    this.keyVersion++;
    
    Logger.info(`Encryption key rotated to version ${this.keyVersion}`);
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
