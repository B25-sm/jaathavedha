import { EncryptionService } from '../services/EncryptionService';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeAll(() => {
    // Set up test environment
    process.env.MASTER_ENCRYPTION_KEY = 'test-master-key-for-unit-testing-min-32-chars';
    process.env.ENCRYPTION_ALGORITHM = 'aes-256-gcm';
    encryptionService = new EncryptionService();
  });

  describe('encrypt and decrypt', () => {
    test('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive user data';
      
      const encrypted = encryptionService.encrypt(plaintext);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('should handle empty strings', () => {
      const plaintext = '';
      
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'test data';
      
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);
      
      // Different IVs should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same plaintext
      expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    test('should throw error for invalid encrypted data', () => {
      expect(() => {
        encryptionService.decrypt('invalid-encrypted-data');
      }).toThrow();
    });
  });

  describe('encryptFields and decryptFields', () => {
    test('should encrypt specific fields in an object', () => {
      const data = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111'
      };

      const encrypted = encryptionService.encryptFields(data, ['ssn', 'creditCard']);
      
      expect(encrypted.id).toBe(data.id);
      expect(encrypted.name).toBe(data.name);
      expect(encrypted.email).toBe(data.email);
      expect(encrypted.ssn).not.toBe(data.ssn);
      expect(encrypted.creditCard).not.toBe(data.creditCard);
    });

    test('should decrypt specific fields in an object', () => {
      const data = {
        id: '123',
        name: 'John Doe',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111'
      };

      const encrypted = encryptionService.encryptFields(data, ['ssn', 'creditCard']);
      const decrypted = encryptionService.decryptFields(encrypted, ['ssn', 'creditCard']);
      
      expect(decrypted.ssn).toBe(data.ssn);
      expect(decrypted.creditCard).toBe(data.creditCard);
    });

    test('should handle null and undefined fields', () => {
      const data = {
        field1: 'value1',
        field2: null,
        field3: undefined
      };

      const encrypted = encryptionService.encryptFields(data, ['field1', 'field2', 'field3']);
      
      expect(encrypted.field1).not.toBe(data.field1);
      expect(encrypted.field2).toBeNull();
      expect(encrypted.field3).toBeUndefined();
    });
  });

  describe('hash', () => {
    test('should generate consistent hash for same input', () => {
      const data = 'test data';
      
      const hash1 = encryptionService.hash(data);
      const hash2 = encryptionService.hash(data);
      
      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different inputs', () => {
      const hash1 = encryptionService.hash('data1');
      const hash2 = encryptionService.hash('data2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateToken', () => {
    test('should generate random tokens', () => {
      const token1 = encryptionService.generateToken();
      const token2 = encryptionService.generateToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
    });

    test('should generate tokens of specified length', () => {
      const token = encryptionService.generateToken(16);
      
      // Hex encoding doubles the length
      expect(token.length).toBe(32);
    });
  });

  describe('HMAC', () => {
    test('should generate and verify HMAC correctly', () => {
      const data = 'important data';
      
      const signature = encryptionService.generateHMAC(data);
      const isValid = encryptionService.verifyHMAC(data, signature);
      
      expect(isValid).toBe(true);
    });

    test('should reject invalid HMAC', () => {
      const data = 'important data';
      const signature = encryptionService.generateHMAC(data);
      
      const isValid = encryptionService.verifyHMAC('tampered data', signature);
      
      expect(isValid).toBe(false);
    });

    test('should reject tampered signature', () => {
      const data = 'important data';
      const signature = encryptionService.generateHMAC(data);
      const tamperedSignature = signature.substring(0, signature.length - 1) + 'x';
      
      const isValid = encryptionService.verifyHMAC(data, tamperedSignature);
      
      expect(isValid).toBe(false);
    });
  });

  describe('getKeyVersion', () => {
    test('should return current key version', () => {
      const version = encryptionService.getKeyVersion();
      
      expect(version).toBeGreaterThan(0);
      expect(typeof version).toBe('number');
    });
  });
});
