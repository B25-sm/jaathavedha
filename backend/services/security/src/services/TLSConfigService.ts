import https from 'https';
import fs from 'fs';
import { Logger } from '@sai-mahendra/utils';

/**
 * TLSConfigService - Manages TLS 1.3 configuration for secure communications
 * Requirements: 11.2 (TLS 1.3 for all service communications)
 */
export class TLSConfigService {
  private tlsEnabled: boolean;
  private certPath: string;
  private keyPath: string;
  private minVersion: string;

  constructor() {
    this.tlsEnabled = process.env.TLS_ENABLED === 'true';
    this.certPath = process.env.TLS_CERT_PATH || '/etc/ssl/certs/server.crt';
    this.keyPath = process.env.TLS_KEY_PATH || '/etc/ssl/private/server.key';
    this.minVersion = process.env.TLS_MIN_VERSION || 'TLSv1.3';
  }

  /**
   * Get HTTPS server options with TLS 1.3 configuration
   */
  getHTTPSOptions(): https.ServerOptions | null {
    if (!this.tlsEnabled) {
      Logger.warn('TLS is disabled. This should only be used in development.');
      return null;
    }

    try {
      const options: https.ServerOptions = {
        cert: fs.readFileSync(this.certPath),
        key: fs.readFileSync(this.keyPath),
        minVersion: this.minVersion as any,
        maxVersion: 'TLSv1.3',
        ciphers: this.getSecureCipherSuites(),
        honorCipherOrder: true,
        secureOptions: this.getSecureOptions()
      };

      Logger.info(`TLS configured with minimum version: ${this.minVersion}`);
      return options;
    } catch (error) {
      Logger.error('Failed to load TLS certificates', error as Error);
      throw new Error('TLS configuration failed');
    }
  }

  /**
   * Get secure cipher suites for TLS 1.3
   */
  private getSecureCipherSuites(): string {
    // TLS 1.3 cipher suites (most secure)
    return [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      // TLS 1.2 fallback (if needed)
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256'
    ].join(':');
  }

  /**
   * Get secure options flags
   */
  private getSecureOptions(): number {
    const crypto = require('crypto');
    
    // Disable insecure protocols and features
    return (
      crypto.constants.SSL_OP_NO_SSLv2 |
      crypto.constants.SSL_OP_NO_SSLv3 |
      crypto.constants.SSL_OP_NO_TLSv1 |
      crypto.constants.SSL_OP_NO_TLSv1_1 |
      crypto.constants.SSL_OP_NO_COMPRESSION
    );
  }

  /**
   * Validate TLS configuration
   */
  validateConfiguration(): boolean {
    if (!this.tlsEnabled) {
      return true; // Skip validation if TLS is disabled
    }

    try {
      // Check if certificate files exist
      if (!fs.existsSync(this.certPath)) {
        Logger.error(`TLS certificate not found: ${this.certPath}`);
        return false;
      }

      if (!fs.existsSync(this.keyPath)) {
        Logger.error(`TLS private key not found: ${this.keyPath}`);
        return false;
      }

      // Validate minimum TLS version
      const validVersions = ['TLSv1.2', 'TLSv1.3'];
      if (!validVersions.includes(this.minVersion)) {
        Logger.error(`Invalid TLS version: ${this.minVersion}`);
        return false;
      }

      Logger.info('TLS configuration validated successfully');
      return true;
    } catch (error) {
      Logger.error('TLS configuration validation failed', error as Error);
      return false;
    }
  }

  /**
   * Generate self-signed certificate for development
   */
  async generateSelfSignedCert(): Promise<void> {
    const { execSync } = require('child_process');
    
    try {
      Logger.info('Generating self-signed certificate for development...');
      
      // Create directories if they don't exist
      const certDir = this.certPath.substring(0, this.certPath.lastIndexOf('/'));
      const keyDir = this.keyPath.substring(0, this.keyPath.lastIndexOf('/'));
      
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
      }
      
      if (!fs.existsSync(keyDir)) {
        fs.mkdirSync(keyDir, { recursive: true });
      }
      
      // Generate self-signed certificate
      execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${this.keyPath} -out ${this.certPath} -days 365 -nodes -subj "/CN=localhost"`);
      
      Logger.info('Self-signed certificate generated successfully');
    } catch (error) {
      Logger.error('Failed to generate self-signed certificate', error as Error);
      throw error;
    }
  }

  /**
   * Get TLS configuration for inter-service communication
   */
  getClientTLSOptions(): https.RequestOptions {
    return {
      minVersion: this.minVersion as any,
      maxVersion: 'TLSv1.3',
      ciphers: this.getSecureCipherSuites(),
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    };
  }

  /**
   * Check if TLS is enabled
   */
  isTLSEnabled(): boolean {
    return this.tlsEnabled;
  }
}

// Singleton instance
export const tlsConfigService = new TLSConfigService();
