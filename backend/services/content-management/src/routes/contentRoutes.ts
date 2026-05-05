import { Router, Request, Response } from 'express';
import { ContentService } from '../services/ContentService';
import { Db } from 'mongodb';
import Joi from 'joi';

export function createContentRoutes(db: Db): Router {
  const router = Router();
  const contentService = new ContentService(db);

  // Validation schemas
  const testimonialSchema = Joi.object({
    name: Joi.string().required().max(100),
    role: Joi.string().required().max(100),
    company: Joi.string().required().max(100),
    content: Joi.string().required().max(1000),
    rating: Joi.number().integer().min(1).max(5).required(),
    image: Joi.string().uri().optional(),
    isActive: Joi.boolean().default(true),
    order: Joi.number().integer().default(0)
  });

  const heroContentSchema = Joi.object({
    title: Joi.string().required().max(200),
    subtitle: Joi.string().required().max(300),
    ctaText: Joi.string().required().max(50),
    ctaLink: Joi.string().uri().required(),
    backgroundImage: Joi.string().uri().optional(),
    isActive: Joi.boolean().default(true)
  });

  const contentSchema = Joi.object({
    type: Joi.string().valid('testimonial', 'hero', 'marketing', 'course_description', 'blog_post').required(),
    title: Joi.string().required().max(200),
    content: Joi.string().required(),
    metadata: Joi.object().default({}),
    status: Joi.string().valid('draft', 'pending_review', 'approved', 'published', 'archived').default('draft'),
    createdBy: Joi.string().required()
  });

  // Testimonial endpoints
  router.post('/testimonials', async (req: Request, res: Response) => {
    try {
      const { error, value } = testimonialSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: error.details[0].message
          }
        });
      }

      const testimonial = await contentService.createTestimonial(value);
      res.status(201).json({
        success: true,
        data: testimonial
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to create testimonial',
          details: error.message
        }
      });
    }
  });

  router.get('/testimonials', async (req: Request, res: Response) => {
    try {
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const testimonials = await contentService.getTestimonials({ isActive });
      
      res.json({
        success: true,
        data: testimonials
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch testimonials',
          details: error.message
        }
      });
    }
  });

  router.get('/testimonials/:id', async (req: Request, res: Response) => {
    try {
      const testimonial = await contentService.getTestimonialById(req.params.id);
      
      if (!testimonial) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Testimonial not found'
          }
        });
      }

      res.json({
        success: true,
        data: testimonial
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch testimonial',
          details: error.message
        }
      });
    }
  });

  router.put('/testimonials/:id', async (req: Request, res: Response) => {
    try {
      const { error, value } = testimonialSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: error.details[0].message
          }
        });
      }

      const testimonial = await contentService.updateTestimonial(req.params.id, value);
      
      if (!testimonial) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Testimonial not found'
          }
        });
      }

      res.json({
        success: true,
        data: testimonial
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to update testimonial',
          details: error.message
        }
      });
    }
  });

  router.delete('/testimonials/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await contentService.deleteTestimonial(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Testimonial not found'
          }
        });
      }

      res.json({
        success: true,
        message: 'Testimonial deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to delete testimonial',
          details: error.message
        }
      });
    }
  });

  // Hero content endpoints
  router.get('/hero', async (req: Request, res: Response) => {
    try {
      const hero = await contentService.getActiveHeroContent();
      
      res.json({
        success: true,
        data: hero || {
          title: 'Transform Your Career with AI & Full-Stack Development',
          subtitle: 'Master cutting-edge technologies with industry experts',
          ctaText: 'Start Learning Today',
          ctaLink: '/programs',
          backgroundImage: null
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch hero content',
          details: error.message
        }
      });
    }
  });

  router.put('/hero', async (req: Request, res: Response) => {
    try {
      const { error, value } = heroContentSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: error.details[0].message
          }
        });
      }

      const hero = await contentService.updateHeroContent(value);
      
      res.json({
        success: true,
        data: hero
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to update hero content',
          details: error.message
        }
      });
    }
  });

  // Generic content endpoints
  router.post('/content', async (req: Request, res: Response) => {
    try {
      const { error, value } = contentSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: error.details[0].message
          }
        });
      }

      // Validate rich text content
      const validation = contentService.validateRichTextContent(value.content);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Content validation failed',
            details: validation.errors
          }
        });
      }

      const content = await contentService.createContent(value);
      res.status(201).json({
        success: true,
        data: content
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to create content',
          details: error.message
        }
      });
    }
  });

  router.get('/content/:id', async (req: Request, res: Response) => {
    try {
      const content = await contentService.getContentById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Content not found'
          }
        });
      }

      res.json({
        success: true,
        data: content
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch content',
          details: error.message
        }
      });
    }
  });

  router.put('/content/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId || 'system';
      
      if (req.body.content) {
        const validation = contentService.validateRichTextContent(req.body.content);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Content validation failed',
              details: validation.errors
            }
          });
        }
      }

      const content = await contentService.updateContent(req.params.id, req.body, userId);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Content not found'
          }
        });
      }

      res.json({
        success: true,
        data: content
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to update content',
          details: error.message
        }
      });
    }
  });

  router.delete('/content/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await contentService.deleteContent(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Content not found'
          }
        });
      }

      res.json({
        success: true,
        message: 'Content deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to delete content',
          details: error.message
        }
      });
    }
  });

  // Content versioning endpoints
  router.get('/content/:id/versions', async (req: Request, res: Response) => {
    try {
      const versions = await contentService.getContentVersions(req.params.id);
      
      res.json({
        success: true,
        data: versions
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch content versions',
          details: error.message
        }
      });
    }
  });

  router.post('/content/:id/revert/:version', async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId || 'system';
      const version = parseInt(req.params.version);
      
      const content = await contentService.revertToVersion(req.params.id, version, userId);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Content or version not found'
          }
        });
      }

      res.json({
        success: true,
        data: content,
        message: `Content reverted to version ${version}`
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to revert content',
          details: error.message
        }
      });
    }
  });

  // Content preview endpoint
  router.get('/content/:id/preview', async (req: Request, res: Response) => {
    try {
      const content = await contentService.previewContent(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Content not found'
          }
        });
      }

      res.json({
        success: true,
        data: content
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to preview content',
          details: error.message
        }
      });
    }
  });

  // Approval workflow endpoints
  router.post('/content/:id/request-approval', async (req: Request, res: Response) => {
    try {
      const { requestedBy } = req.body;
      
      if (!requestedBy) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'requestedBy is required'
          }
        });
      }

      const approval = await contentService.createApprovalRequest({
        contentId: req.params.id,
        status: 'pending' as any,
        requestedBy
      });

      res.status(201).json({
        success: true,
        data: approval
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to create approval request',
          details: error.message
        }
      });
    }
  });

  router.post('/approvals/:id/approve', async (req: Request, res: Response) => {
    try {
      const { reviewerId, comments } = req.body;
      
      if (!reviewerId) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'reviewerId is required'
          }
        });
      }

      const approval = await contentService.approveContent(req.params.id, reviewerId, comments);
      
      if (!approval) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Approval request not found'
          }
        });
      }

      res.json({
        success: true,
        data: approval
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to approve content',
          details: error.message
        }
      });
    }
  });

  router.post('/approvals/:id/reject', async (req: Request, res: Response) => {
    try {
      const { reviewerId, comments } = req.body;
      
      if (!reviewerId || !comments) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'reviewerId and comments are required'
          }
        });
      }

      const approval = await contentService.rejectContent(req.params.id, reviewerId, comments);
      
      if (!approval) {
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: 'Approval request not found'
          }
        });
      }

      res.json({
        success: true,
        data: approval
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to reject content',
          details: error.message
        }
      });
    }
  });

  router.get('/approvals/pending', async (req: Request, res: Response) => {
    try {
      const approvals = await contentService.getPendingApprovals();
      
      res.json({
        success: true,
        data: approvals
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to fetch pending approvals',
          details: error.message
        }
      });
    }
  });

  return router;
}
