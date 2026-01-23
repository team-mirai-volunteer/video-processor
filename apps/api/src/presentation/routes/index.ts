import { Router, type Router as RouterType } from 'express';
import healthRouter from './health.js';
import videosRouter from './videos.js';
import clipsRouter from './clips.js';

const router: RouterType = Router();

// Health check
router.use('/health', healthRouter);

// API routes
router.use('/api/videos', videosRouter);
router.use('/api/clips', clipsRouter);

export default router;
