import { type Router as ExpressRouter, Router } from 'express';
import clipsRouter from './clips.js';
import healthRouter from './health.js';
import videosRouter from './videos.js';

const router: ExpressRouter = Router();

// Health check
router.use('/health', healthRouter);

// API routes
router.use('/api/videos', videosRouter);
router.use('/api', clipsRouter);

export default router;
