import { type Router as ExpressRouter, Router } from 'express';
import clipsRouter from './clips.js';
import videosRouter from './videos.js';

const router: ExpressRouter = Router();

// API routes
router.use('/api/videos', videosRouter);
router.use('/api', clipsRouter);

export default router;
