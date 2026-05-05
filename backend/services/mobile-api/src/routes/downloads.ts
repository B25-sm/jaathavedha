import { Router } from 'express';
import { getDatabase, getRedis } from '@sai-mahendra/database';
import { DownloadService } from '../services/DownloadService';

const router = Router();

router.post('/request', async (req, res, next) => {
  try {
    const { userId, deviceId, contentType, contentId, courseId, quality, wifiOnly } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const downloadService = new DownloadService(db, redis);
    const result = await downloadService.requestDownload(userId, deviceId, {
      contentType,
      contentId,
      courseId,
      quality,
      wifiOnly,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/:deviceId/list', async (req, res, next) => {
  try {
    const { userId, deviceId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const downloadService = new DownloadService(db, redis);
    const downloads = await downloadService.getDownloads(userId, deviceId);
    res.json({ success: true, data: downloads });
  } catch (error) {
    next(error);
  }
});

router.put('/:downloadId/progress', async (req, res, next) => {
  try {
    const { downloadId } = req.params;
    const { progress, downloadedBytes } = req.body;
    const db = getDatabase();
    const redis = getRedis();
    const downloadService = new DownloadService(db, redis);
    await downloadService.updateProgress(downloadId, progress, downloadedBytes);
    res.json({ success: true, message: 'Progress updated' });
  } catch (error) {
    next(error);
  }
});

router.put('/:downloadId/pause', async (req, res, next) => {
  try {
    const { downloadId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const downloadService = new DownloadService(db, redis);
    await downloadService.pauseDownload(downloadId);
    res.json({ success: true, message: 'Download paused' });
  } catch (error) {
    next(error);
  }
});

router.put('/:downloadId/resume', async (req, res, next) => {
  try {
    const { downloadId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const downloadService = new DownloadService(db, redis);
    await downloadService.resumeDownload(downloadId);
    res.json({ success: true, message: 'Download resumed' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:downloadId', async (req, res, next) => {
  try {
    const { downloadId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const downloadService = new DownloadService(db, redis);
    await downloadService.deleteDownload(downloadId);
    res.json({ success: true, message: 'Download deleted' });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/:deviceId/offline', async (req, res, next) => {
  try {
    const { userId, deviceId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const downloadService = new DownloadService(db, redis);
    const content = await downloadService.getOfflineContent(userId, deviceId);
    res.json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/:deviceId/storage', async (req, res, next) => {
  try {
    const { userId, deviceId } = req.params;
    const db = getDatabase();
    const redis = getRedis();
    const downloadService = new DownloadService(db, redis);
    const storage = await downloadService.getStorageInfo(userId, deviceId);
    res.json({ success: true, data: storage });
  } catch (error) {
    next(error);
  }
});

export default router;
