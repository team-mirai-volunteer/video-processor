import { type Router as ExpressRouter, Router } from 'express';
import clipSubtitlesRouter from './clip-subtitles.js';
import clipsRouter from './clips.js';
import videosRouter from './videos.js';

const router: ExpressRouter = Router();

// API routes
router.use('/api/videos', videosRouter);
router.use('/api', clipsRouter);
router.use('/api', clipSubtitlesRouter);

export default router;
