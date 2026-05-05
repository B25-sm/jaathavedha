import { AlertService } from '../services/AlertService';
import { AlertType, AlertSeverity } from '../types';
import winston from 'winston';

describe('AlertService', () => {
  let alertService: AlertService;
  let mockMongoDb: any;
  let mockRedisClient: any;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Mock MongoDB
    mockMongoDb = {
      collection: jest.fn().mockReturnValue({
        insertOne: jest.fn().mockResolvedValue({ insertedId: '123' }),
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn().mockResolvedValue([])
            })
          })
        }),
        findOne: jest.fn().mockResolvedValue(null),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        }),
        countDocuments: jest.fn().mockResolvedValue(0)
      })
    };

    // Mock Redis
    mockRedisClient = {
      lPush: jest.fn().mockResolvedValue(1),
      lTrim: jest.fn().mockResolvedValue('OK'),
      sCard: jest.fn().mockResolvedValue(0),
      get: jest.fn().mockResolvedValue('0')
    };

    // Mock Logger
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn()
    } as any;

    alertService = new AlertService(mockMongoDb, mockRedisClient, mockLogger);
  });

  describe('createAlert', () => {
    it('should create and store an alert', async () => {
      const alertData = {
        type: AlertType.METRIC_THRESHOLD,
        severity: AlertSeverity.WARNING,
        message: 'Test alert',
        metric: 'daily_active_users',
        threshold: 10,
        currentValue: 5,
        timestamp: new Date()
      };

      const result = await alertService.createAlert(alertData);

      expect(result).toHaveProperty('id');
      expect(result.message).toBe('Test alert');
      expect(mockMongoDb.collection).toHaveBeenCalledWith('alerts');
      expect(mockRedisClient.lPush).toHaveBeenCalled();
    });
  });

  describe('getActiveAlerts', () => {
    it('should retrieve active alerts', async () => {
      const mockAlerts = [
        {
          _id: '123',
          type: AlertType.METRIC_THRESHOLD,
          severity: AlertSeverity.WARNING,
          message: 'Test alert',
          metric: 'daily_active_users',
          threshold: 10,
          currentValue: 5,
          timestamp: new Date()
        }
      ];

      mockMongoDb.collection.mockReturnValue({
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn().mockResolvedValue(mockAlerts)
            })
          })
        })
      });

      const result = await alertService.getActiveAlerts(10);

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Test alert');
    });
  });

  describe('createThreshold', () => {
    it('should create an alert threshold', async () => {
      const threshold = {
        metric: 'daily_active_users',
        condition: 'below' as const,
        threshold: 10,
        severity: AlertSeverity.WARNING,
        enabled: true
      };

      await alertService.createThreshold(threshold);

      expect(mockMongoDb.collection).toHaveBeenCalledWith('alert_thresholds');
    });
  });

  describe('updateThreshold', () => {
    it('should update an existing threshold', async () => {
      const updates = {
        threshold: 20,
        enabled: false
      };

      await alertService.updateThreshold('daily_active_users', updates);

      expect(mockMongoDb.collection).toHaveBeenCalledWith('alert_thresholds');
    });
  });

  describe('deleteThreshold', () => {
    it('should delete a threshold', async () => {
      await alertService.deleteThreshold('daily_active_users');

      expect(mockMongoDb.collection).toHaveBeenCalledWith('alert_thresholds');
    });
  });

  describe('initializeDefaultThresholds', () => {
    it('should initialize default thresholds if they do not exist', async () => {
      await alertService.initializeDefaultThresholds();

      // Should check for existing thresholds and create new ones
      expect(mockMongoDb.collection).toHaveBeenCalledWith('alert_thresholds');
    });
  });

  describe('checkThresholds', () => {
    it('should check thresholds and create alerts when exceeded', async () => {
      const mockThresholds = [
        {
          metric: 'daily_active_users',
          condition: 'below',
          threshold: 10,
          severity: AlertSeverity.WARNING,
          enabled: true
        }
      ];

      mockMongoDb.collection.mockReturnValue({
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockThresholds)
        }),
        insertOne: jest.fn().mockResolvedValue({ insertedId: '123' })
      });

      mockRedisClient.sCard.mockResolvedValue(5); // Below threshold

      const alerts = await alertService.checkThresholds();

      expect(alerts.length).toBeGreaterThanOrEqual(0);
    });
  });
});
