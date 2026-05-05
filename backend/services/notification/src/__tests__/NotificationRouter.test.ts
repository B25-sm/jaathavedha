import { NotificationRouter } from '../services/NotificationRouter';
import {
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  UserPreferences
} from '../types';

// Mock Redis client
const mockRedisClient = {
  hGetAll: jest.fn(),
  hSet: jest.fn(),
  expire: jest.fn()
} as any;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
} as any;

describe('NotificationRouter', () => {
  let router: NotificationRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new NotificationRouter(mockRedisClient, mockLogger);
  });

  describe('getUserPreferences', () => {
    it('should fetch user preferences from Redis', async () => {
      const mockPrefs = {
        email_transactional: 'true',
        email_marketing: 'false',
        email_engagement: 'true',
        push_enabled: 'true',
        push_quiet_start: '22:00',
        push_quiet_end: '08:00',
        updated_at: new Date().toISOString()
      };

      mockRedisClient.hGetAll.mockResolvedValue(mockPrefs);

      const prefs = await router.getUserPreferences('user_123');

      expect(prefs.email.transactional).toBe(true);
      expect(prefs.email.marketing).toBe(false);
      expect(prefs.push.enabled).toBe(true);
    });

    it('should return default preferences if none exist', async () => {
      mockRedisClient.hGetAll.mockResolvedValue({});

      const prefs = await router.getUserPreferences('user_123');

      expect(prefs.email.transactional).toBe(true);
      expect(prefs.email.marketing).toBe(true);
      expect(prefs.push.enabled).toBe(true);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences in Redis', async () => {
      const preferences: Partial<UserPreferences> = {
        email: {
          transactional: true,
          marketing: false,
          engagement: true
        },
        push: {
          enabled: false,
          quietHours: {
            start: '23:00',
            end: '07:00'
          }
        }
      };

      await router.updateUserPreferences('user_123', preferences);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'user:user_123:preferences',
        expect.objectContaining({
          email_transactional: 'true',
          email_marketing: 'false',
          push_enabled: 'false',
          push_quiet_start: '23:00'
        })
      );
    });
  });

  describe('routeNotification', () => {
    it('should route transactional notifications to email', async () => {
      mockRedisClient.hGetAll.mockResolvedValue({
        email_transactional: 'true',
        push_enabled: 'true'
      });

      const notification = {
        userId: 'user_123',
        channel: NotificationChannel.EMAIL,
        type: NotificationType.TRANSACTIONAL,
        priority: NotificationPriority.HIGH,
        status: NotificationStatus.PENDING,
        content: 'Test notification',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const channels = await router.routeNotification(notification);

      expect(channels).toContain(NotificationChannel.EMAIL);
    });

    it('should respect user marketing preferences', async () => {
      mockRedisClient.hGetAll.mockResolvedValue({
        email_marketing: 'false',
        push_enabled: 'true'
      });

      const notification = {
        userId: 'user_123',
        channel: NotificationChannel.EMAIL,
        type: NotificationType.MARKETING,
        priority: NotificationPriority.LOW,
        status: NotificationStatus.PENDING,
        content: 'Marketing notification',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const channels = await router.routeNotification(notification);

      expect(channels).not.toContain(NotificationChannel.EMAIL);
    });

    it('should filter push notifications during quiet hours', async () => {
      // Mock current time to be within quiet hours
      const now = new Date();
      now.setHours(23, 30); // 11:30 PM
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);

      mockRedisClient.hGetAll.mockResolvedValue({
        email_transactional: 'true',
        push_enabled: 'true',
        push_quiet_start: '22:00',
        push_quiet_end: '08:00'
      });

      const notification = {
        userId: 'user_123',
        channel: NotificationChannel.PUSH,
        type: NotificationType.ENGAGEMENT,
        priority: NotificationPriority.MEDIUM,
        status: NotificationStatus.PENDING,
        content: 'Engagement notification',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const channels = await router.routeNotification(notification);

      expect(channels).not.toContain(NotificationChannel.PUSH);
    });
  });

  describe('trackDelivery', () => {
    it('should track notification delivery', async () => {
      await router.trackDelivery(
        'notif_123',
        NotificationChannel.EMAIL,
        NotificationStatus.SENT
      );

      expect(mockRedisClient.hSet).toHaveBeenCalled();
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'notification:notif_123:tracking',
        30 * 24 * 60 * 60
      );
    });
  });

  describe('isWithinQuietHours', () => {
    it('should detect time within same-day quiet hours', () => {
      const result = (router as any).isWithinQuietHours('14:00', '13:00', '15:00');
      expect(result).toBe(true);
    });

    it('should detect time outside same-day quiet hours', () => {
      const result = (router as any).isWithinQuietHours('12:00', '13:00', '15:00');
      expect(result).toBe(false);
    });

    it('should handle overnight quiet hours correctly', () => {
      const result = (router as any).isWithinQuietHours('23:30', '22:00', '08:00');
      expect(result).toBe(true);
    });

    it('should handle early morning in overnight quiet hours', () => {
      const result = (router as any).isWithinQuietHours('07:00', '22:00', '08:00');
      expect(result).toBe(true);
    });

    it('should detect time outside overnight quiet hours', () => {
      const result = (router as any).isWithinQuietHours('12:00', '22:00', '08:00');
      expect(result).toBe(false);
    });
  });
});
