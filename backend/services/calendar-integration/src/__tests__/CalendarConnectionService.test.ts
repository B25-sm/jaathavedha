import CalendarConnectionService from '../services/CalendarConnectionService';
import { CalendarProvider, OAuthTokens } from '../types';
import { query } from '../database';

// Mock dependencies
jest.mock('../database');
jest.mock('../utils/logger');
jest.mock('../utils/encryption', () => ({
  encrypt: jest.fn((text) => `encrypted_${text}`),
  decrypt: jest.fn((text) => text.replace('encrypted_', '')),
}));

describe('CalendarConnectionService', () => {
  let service: CalendarConnectionService;
  const mockUserId = 'user-123';
  const mockTokens: OAuthTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
  };

  beforeEach(() => {
    service = new CalendarConnectionService();
    jest.clearAllMocks();
  });

  describe('createConnection', () => {
    it('should create a new calendar connection', async () => {
      const mockResult = {
        rows: [
          {
            id: 'conn-123',
            user_id: mockUserId,
            provider: CalendarProvider.GOOGLE,
            access_token: 'encrypted_access-token',
            refresh_token: 'encrypted_refresh-token',
            token_expiry: new Date(),
            calendar_id: 'primary',
            is_active: true,
            last_sync_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      (query as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.createConnection(
        mockUserId,
        CalendarProvider.GOOGLE,
        mockTokens,
        'primary'
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.provider).toBe(CalendarProvider.GOOGLE);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO calendar_connections'),
        expect.arrayContaining([mockUserId, CalendarProvider.GOOGLE])
      );
    });

    it('should handle errors when creating connection', async () => {
      (query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        service.createConnection(mockUserId, CalendarProvider.GOOGLE, mockTokens)
      ).rejects.toThrow('Failed to create calendar connection');
    });
  });

  describe('getConnection', () => {
    it('should retrieve an existing connection', async () => {
      const mockResult = {
        rows: [
          {
            id: 'conn-123',
            user_id: mockUserId,
            provider: CalendarProvider.GOOGLE,
            access_token: 'encrypted_access-token',
            refresh_token: 'encrypted_refresh-token',
            token_expiry: new Date(),
            calendar_id: 'primary',
            is_active: true,
            last_sync_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      (query as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.getConnection(mockUserId, CalendarProvider.GOOGLE);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockUserId);
      expect(result?.provider).toBe(CalendarProvider.GOOGLE);
    });

    it('should return null when connection does not exist', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.getConnection(mockUserId, CalendarProvider.GOOGLE);

      expect(result).toBeNull();
    });
  });

  describe('getUserConnections', () => {
    it('should retrieve all active connections for a user', async () => {
      const mockResult = {
        rows: [
          {
            id: 'conn-123',
            user_id: mockUserId,
            provider: CalendarProvider.GOOGLE,
            access_token: 'encrypted_access-token',
            refresh_token: 'encrypted_refresh-token',
            token_expiry: new Date(),
            calendar_id: 'primary',
            is_active: true,
            last_sync_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'conn-456',
            user_id: mockUserId,
            provider: CalendarProvider.OUTLOOK,
            access_token: 'encrypted_access-token-2',
            refresh_token: 'encrypted_refresh-token-2',
            token_expiry: new Date(),
            calendar_id: null,
            is_active: true,
            last_sync_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      (query as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.getUserConnections(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe(CalendarProvider.GOOGLE);
      expect(result[1].provider).toBe(CalendarProvider.OUTLOOK);
    });
  });

  describe('updateTokens', () => {
    it('should update connection tokens', async () => {
      (query as jest.Mock).mockResolvedValue({ rowCount: 1 });

      await service.updateTokens(mockUserId, CalendarProvider.GOOGLE, mockTokens);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE calendar_connections'),
        expect.arrayContaining([
          expect.stringContaining('encrypted_'),
          expect.stringContaining('encrypted_'),
        ])
      );
    });
  });

  describe('deactivateConnection', () => {
    it('should deactivate a calendar connection', async () => {
      (query as jest.Mock).mockResolvedValue({ rowCount: 1 });

      await service.deactivateConnection(mockUserId, CalendarProvider.GOOGLE);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE calendar_connections'),
        expect.arrayContaining([mockUserId, CalendarProvider.GOOGLE])
      );
    });
  });

  describe('deleteConnection', () => {
    it('should delete a calendar connection', async () => {
      (query as jest.Mock).mockResolvedValue({ rowCount: 1 });

      await service.deleteConnection(mockUserId, CalendarProvider.GOOGLE);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM calendar_connections'),
        expect.arrayContaining([mockUserId, CalendarProvider.GOOGLE])
      );
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired tokens', () => {
      const expiredConnection = {
        id: 'conn-123',
        userId: mockUserId,
        provider: CalendarProvider.GOOGLE,
        accessToken: 'token',
        refreshToken: 'refresh',
        tokenExpiry: new Date(Date.now() - 1000), // Expired 1 second ago
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.isTokenExpired(expiredConnection);

      expect(result).toBe(true);
    });

    it('should return false for valid tokens', () => {
      const validConnection = {
        id: 'conn-123',
        userId: mockUserId,
        provider: CalendarProvider.GOOGLE,
        accessToken: 'token',
        refreshToken: 'refresh',
        tokenExpiry: new Date(Date.now() + 3600000), // Expires in 1 hour
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.isTokenExpired(validConnection);

      expect(result).toBe(false);
    });
  });
});
