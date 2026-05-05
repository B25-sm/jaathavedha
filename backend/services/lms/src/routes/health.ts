import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'lms',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
