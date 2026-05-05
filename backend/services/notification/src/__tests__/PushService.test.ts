import { PushService } from '../services/PushService';
import { PushNotification, NotificationStatus } from '../types';

// Mock Redis client
const mockRedisClient = {
  hSet: jest.fn(),
  hGetAll: jest.fn(),
  hDel: jest.fn(),
  sAdd: jest.fn(),
  expire: jest.fn()
} as any;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
} as any;

describe('PushService', () => {
  let pushService: PushService;

  beforeEach(() => {
    jest.clearAllMocks();
    pushService = new PushService(mockRedisClient, mockLogger);
  });

  describe('registerDeviceToken', () => {
    it('should register device token for user', async () => {
      await pushService.registerDeviceToken('user_123', 'token_abc', 'web');

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'user:user_123:push_tokens',
        'token_abc',
        expect.stringContaining('web')
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'user:user_123:push_tokens',
        90 * 24 * 60 * 60
      );
    });

    it('should handle different platforms', async () => {
      await pushService.registerDeviceToken('user_123', 'token_ios', 'ios');
      await pushService.registerDeviceToken('user_123', 'token_android', 'android');

      expect(mockRedisClient.hSet).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserTokens', () => {
    it('should fetch user device tokens', async () => {
      const mockTokens = {
        'token_1': JSON.stringify({ token: 'token_1', platform: 'web' }),
        'token_2': JSON.stringify({ token: 'token_2', platform: 'ios' })
      };

      mockRedisClient.hGetAll.mockResolvedValue(mockTokens);

      const tokens = await pushService.getUserTokens('user_123');

      expect(tokens).toEqual(['token_1', 'token_2']);
    });

    it('should return empty array if no tokens found', async () => {
      mockRedisClient.hGetAll.mockResolvedValue({});

      const tokens = await pushService.getUserTokens('user_123');

      expect(tokens).toEqual([]);
    });
  });

  describe('removeDeviceToken', () => {
    it('should remove device token', async () => {
      await pushService.removeDeviceToken('user_123', 'token_abc');

      expect(mockRedisClient.hDel).toHaveBeenCalledWith(
        'user:user_123:push_tokens',
        'token_abc'
      );
    });
  });

  describe('schedulePushNotification', () => {
    it('should schedule push notification', async () => {
      const notification: PushNotification = {
        tokens: ['token_1', 'token_2'],
        title: 'Test Notification',
        body: 'Test body',
        data: { key: 'value' }
      };

      const scheduledFor = new Date(Date.now() + 3600000); // 1 hour from now

      const result = await pushService.schedulePushNotification(notification, scheduledFor);

      expect(result.jobId).toBeDefined();
      expect(mockRedisClient.hSet).toHaveBeenCalled();
      expect(mockRedisClient.expire).toHaveBeenCalled();
    });
  });

  describe('trackDelivery', () => {
    it('should track push notification delivery', async () => {
      await pushService.trackDelivery('msg_123', NotificationStatus.SENT);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'push:tracking:msg_123',
        expect.objectContaining({
          messageId: 'msg_123',
          status: NotificationStatus.SENT
        })
      );
    });

    it('should include metadata in tracking', async () => {
      const metadata = { deviceType: 'ios', appVersion: '1.0.0' };

      await pushService.trackDelivery('msg_123', NotificationStatus.DELIVERED, metadata);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'push:tracking:msg_123',
        expect.objectContaining(metadata)
      );
    });
  });
});
