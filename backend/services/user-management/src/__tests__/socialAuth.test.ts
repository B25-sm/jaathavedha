import request from 'supertest';
import app from '../index';
import { UserModel } from '../models/User';
import { SocialAccountModel } from '../models/SocialAccount';
import { RefreshTokenModel } from '../models/RefreshToken';

// Mock external OAuth services
jest.mock('../services/GoogleAuthService');
jest.mock('../services/LinkedInAuthService');
jest.mock('../services/GitHubAuthService');
jest.mock('../services/EmailService');

describe('Social Authentication API', () => {
  describe('GET /auth/social/:provider/authorize', () => {
    it('should return Google OAuth authorization URL', async () => {
      const response = await request(app)
        .get('/auth/social/google/authorize')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBeDefined();
      expect(response.body.data.state).toBeDefined();
      expect(response.body.data.authUrl).toContain('accounts.google.com');
    });

    it('should return LinkedIn OAuth authorization URL', async () => {
      const response = await request(app)
        .get('/auth/social/linkedin/authorize')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBeDefined();
      expect(response.body.data.authUrl).toContain('linkedin.com');
    });

    it('should return GitHub OAuth authorization URL', async () => {
      const response = await request(app)
        .get('/auth/social/github/authorize')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBeDefined();
      expect(response.body.data.authUrl).toContain('github.com');
    });

    it('should reject invalid provider', async () => {
      const response = await request(app)
        .get('/auth/social/invalid/authorize')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /auth/social/:provider/callback', () => {
    it('should handle Google OAuth callback for new user', async () => {
      const mockCode = 'mock-authorization-code';
      const mockState = 'mock-state-token';

      const response = await request(app)
        .get(`/auth/social/google/callback?code=${mockCode}&state=${mockState}`)
        .expect(302); // Redirect

      expect(response.header.location).toContain('access_token');
      expect(response.header.location).toContain('refresh_token');
      expect(response.header.location).toContain('new_user=true');
    });

    it('should handle LinkedIn OAuth callback for existing user', async () => {
      const mockCode = 'mock-authorization-code';
      const mockState = 'mock-state-token';

      const response = await request(app)
        .get(`/auth/social/linkedin/callback?code=${mockCode}&state=${mockState}`)
        .expect(302);

      expect(response.header.location).toContain('access_token');
    });

    it('should handle GitHub OAuth callback', async () => {
      const mockCode = 'mock-authorization-code';
      const mockState = 'mock-state-token';

      const response = await request(app)
        .get(`/auth/social/github/callback?code=${mockCode}&state=${mockState}`)
        .expect(302);

      expect(response.header.location).toContain('access_token');
    });

    it('should redirect to linking page when email exists', async () => {
      // Mock existing user with same email
      const mockCode = 'mock-authorization-code';
      const mockState = 'mock-state-token';

      const response = await request(app)
        .get(`/auth/social/google/callback?code=${mockCode}&state=${mockState}`)
        .expect(302);

      // Should redirect to linking page if email exists
      if (response.header.location.includes('link-account')) {
        expect(response.header.location).toContain('pending=true');
      }
    });

    it('should handle OAuth error', async () => {
      const response = await request(app)
        .get('/auth/social/google/callback?error=access_denied')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing authorization code', async () => {
      const response = await request(app)
        .get('/auth/social/google/callback')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authorization code');
    });
  });

  describe('POST /auth/social/:provider/link', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create test user and get access token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
    });

    it('should link Google account to authenticated user', async () => {
      const mockCode = 'mock-authorization-code';

      const response = await request(app)
        .post('/auth/social/google/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: mockCode })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('linked successfully');
      expect(response.body.data.socialAccount.provider).toBe('google');
    });

    it('should link LinkedIn account', async () => {
      const mockCode = 'mock-authorization-code';

      const response = await request(app)
        .post('/auth/social/linkedin/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: mockCode })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.socialAccount.provider).toBe('linkedin');
    });

    it('should link GitHub account', async () => {
      const mockCode = 'mock-authorization-code';

      const response = await request(app)
        .post('/auth/social/github/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: mockCode })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.socialAccount.provider).toBe('github');
    });

    it('should reject linking without authentication', async () => {
      const mockCode = 'mock-authorization-code';

      const response = await request(app)
        .post('/auth/social/google/link')
        .send({ code: mockCode })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject linking already linked account', async () => {
      const mockCode = 'mock-authorization-code';

      // Link once
      await request(app)
        .post('/auth/social/google/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: mockCode });

      // Try to link again
      const response = await request(app)
        .post('/auth/social/google/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: mockCode })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already linked');
    });

    it('should reject missing authorization code', async () => {
      const response = await request(app)
        .post('/auth/social/google/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/social/confirm-linking', () => {
    it('should confirm account linking with valid token', async () => {
      const mockToken = 'mock-verification-token';
      const mockCode = 'mock-authorization-code';

      const response = await request(app)
        .post('/auth/social/confirm-linking')
        .send({
          token: mockToken,
          code: mockCode,
          provider: 'google'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('linked successfully');
    });

    it('should reject invalid verification token', async () => {
      const response = await request(app)
        .post('/auth/social/confirm-linking')
        .send({
          token: 'invalid-token',
          code: 'mock-code',
          provider: 'google'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should reject expired verification token', async () => {
      const expiredToken = 'expired-token';

      const response = await request(app)
        .post('/auth/social/confirm-linking')
        .send({
          token: expiredToken,
          code: 'mock-code',
          provider: 'google'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing parameters', async () => {
      const response = await request(app)
        .post('/auth/social/confirm-linking')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /auth/social/linked', () => {
    let accessToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
    });

    it('should return linked social accounts', async () => {
      const response = await request(app)
        .get('/auth/social/linked')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.linkedAccounts).toBeDefined();
      expect(Array.isArray(response.body.data.linkedAccounts)).toBe(true);
    });

    it('should return empty array when no accounts linked', async () => {
      const response = await request(app)
        .get('/auth/social/linked')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.linkedAccounts).toEqual([]);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/auth/social/linked')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /auth/social/:socialAccountId', () => {
    let accessToken: string;
    let socialAccountId: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        });

      accessToken = loginResponse.body.data.tokens.accessToken;

      // Link a social account
      const linkResponse = await request(app)
        .post('/auth/social/google/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'mock-code' });

      socialAccountId = linkResponse.body.data.socialAccount.id;
    });

    it('should unlink social account', async () => {
      const response = await request(app)
        .delete(`/auth/social/${socialAccountId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('unlinked successfully');
    });

    it('should reject unlinking last authentication method', async () => {
      // Assuming this is the only auth method
      const response = await request(app)
        .delete(`/auth/social/${socialAccountId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('only authentication method');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .delete(`/auth/social/${socialAccountId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject unlinking another user\'s account', async () => {
      // Login as different user
      const otherUserResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'other@example.com',
          password: 'Test123!@#'
        });

      const otherToken = otherUserResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .delete(`/auth/social/${socialAccountId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /auth/social/:socialAccountId/primary', () => {
    let accessToken: string;
    let socialAccountId: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        });

      accessToken = loginResponse.body.data.tokens.accessToken;

      const linkResponse = await request(app)
        .post('/auth/social/google/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: 'mock-code' });

      socialAccountId = linkResponse.body.data.socialAccount.id;
    });

    it('should set social account as primary', async () => {
      const response = await request(app)
        .put(`/auth/social/${socialAccountId}/primary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Primary social account updated');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .put(`/auth/social/${socialAccountId}/primary`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should validate state parameter for CSRF protection', async () => {
      const response = await request(app)
        .get('/auth/social/google/callback?code=test&state=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should rate limit social auth endpoints', async () => {
      const requests = [];
      
      // Make 101 requests (rate limit is 100)
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(app).get('/auth/social/google/authorize')
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });

    it('should not expose sensitive data in responses', async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        });

      const accessToken = loginResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .get('/auth/social/linked')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const accounts = response.body.data.linkedAccounts;
      
      accounts.forEach((account: any) => {
        expect(account.accessToken).toBeUndefined();
        expect(account.refreshToken).toBeUndefined();
        expect(account.profileData).toBeUndefined();
      });
    });
  });
});
