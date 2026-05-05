import { Router } from 'express';
import { getDatabase, getRedis } from '@sai-mahendra/database';
import { PushNotificationService } from '../services/PushNotificationService';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { userId, deviceId, deviceToken, platform, deviceInfo } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const pushService = new PushNotificationService(db, redis);
    const result = await pushService.registerDevice(userId, deviceId, deviceToken, platform, deviceInfo);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/unregister', async (req, res, next) => {
  try {
    const { userId, deviceId } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const pushService = new PushNotificationService(db, redis);
    await pushService.unregisterDevice(userId, deviceId);
    res.json({ success: true, message: 'Device unregistered' });
  } catch (error) {
    next(error);
  }
});

router.post('/send', async (req, res, next) => {
  try {
    const { userId, notification } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const pushService = new PushNotificationService(db, redis);
    const result = await pushService.sendNotification(userId, notification);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/send-bulk', async (req, res, next) => {
  try {
    const { userIds, notification } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const pushService = new PushNotificationService(db, redis);
    const result = await pushService.sendBulkNotifications(userIds, notification);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/:deviceId/preferences', async (req, res, next) => {
  try {
    const { userId, deviceId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const pushService = new PushNotificationService(db, redis);
    const preferences = await pushService.getPreferences(userId, deviceId);
    res.json({ success: true, data: preferences });
  } catch (error) {
    next(error);
  }
});

router.put('/:userId/:deviceId/preferences', async (req, res, next) => {
  try {
    const { userId, deviceId } = req.params;
    const preferences = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const pushService = new PushNotificationService(db, redis);
    const result = await pushService.updatePreferences(userId, deviceId, preferences);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/:notificationId/opened', async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const pushService = new PushNotificationService(db, redis);
    await pushService.trackNotificationOpened(notificationId);
    res.json({ success: true, message: 'Notification opened tracked' });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/history', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;
    const db = getDatabase();
    const redis = getRedis();
    const pushService = new PushNotificationService(db, redis);
    const history = await pushService.getNotificationHistory(userId, limit ? parseInt(limit as string) : 50);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

export default router;
