import { Router, Request, Response } from 'express';
import multer from 'multer';
import { MediaService } from '../services/MediaService';
import { Db } from 'mongodb';

export function createMediaRoutes(db: Db): Router {
  const router = Router();
  const mediaService = new MediaService(db);

  // Configure multer for memory storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    }
  });

  // Upload media file
  router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'No file provided'
          }
        });
      }

      // Validate file
      const validation = mediaService.validateFile(req.file);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'File validation failed',
            details: validation.errors
          }
        });
      }

      const userId = req.body.userId || 'anonymous';
      const folder = req.body.folder || 'uploads';
      const generateFormats = req.body.generateFormats === 'true';
      const optimize = req.body.optimize !== 'false'; // Default to true

      const media = await mediaService.uploadFile(req.file, {
        userId,
        folder,
        generateFormats,
        optimize
      });

      res.status(201).json({
        success: true,
        data: media
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'UPLOAD_ERROR',
          message: 'Failed to upload file',
          details: error.message
        }
      });
    }
  });

  // Get media by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const media = await mediaService.getMediaById(req.params.id);
      
      if (!media) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Media not found'
          }
        });
      }

      res.json({
        success: true,
        data: media
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch media',
          details: error.message
        }
      });
    }
  });

  // Get media by user
  router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
      const mediaList = await mediaService.getMediaByUser(req.params.userId);
      
      res.json({
        success: true,
        data: mediaList
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch user media',
          details: error.message
        }
      });
    }
  });

  // Update media metadata
  router.put('/:id/metadata', async (req: Request, res: Response) => {
    try {
      const { alt, caption } = req.body;
      
      const media = await mediaService.updateMediaMetadata(req.params.id, { alt, caption });
      
      if (!media) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Media not found'
          }
        });
      }

      res.json({
        success: true,
        data: media
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to update media metadata',
          details: error.message
        }
      });
    }
  });

  // Delete media
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await mediaService.deleteMedia(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Media not found'
          }
        });
      }

      res.json({
        success: true,
        message: 'Media deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DELETE_ERROR',
          message: 'Failed to delete media',
          details: error.message
        }
      });
    }
  });

  return router;
}
