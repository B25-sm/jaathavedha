import { Router } from 'express';
import { getDatabase, getRedis } from '@sai-mahendra/database';
import { SyncService } from '../services/SyncService';

const router = Router();

router.post('/progress', async (req, res, next) => {
  try {
    const { userId, deviceId, data } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const syncService = new SyncService(db, redis);
    const result = await syncService.syncProgress(userId, deviceId, data);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/notes', async (req, res, next) => {
  try {
    const { userId, deviceId, notes } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const syncService = new SyncService(db, redis);
    const result = await syncService.syncNotes(userId, deviceId, notes);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/bookmarks', async (req, res, next) => {
  try {
    const { userId, deviceId, bookmarks } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const syncService = new SyncService(db, redis);
    const result = await syncService.syncBookmarks(userId, deviceId, bookmarks);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/:deviceId/status', async (req, res, next) => {
  try {
    const { userId, deviceId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const syncService = new SyncService(db, redis);
    const status = await syncService.getSyncStatus(userId, deviceId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

router.post('/full', async (req, res, next) => {
  try {
    const { userId, syncRequest } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const syncService = new SyncService(db, redis);
    const result = await syncService.performSync(userId, syncRequest);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
