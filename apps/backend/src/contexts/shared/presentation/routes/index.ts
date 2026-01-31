import { type Router as ExpressRouter, Router } from 'express';
import healthRouter from './health.js';
import localFilesRouter from './local-files.js';

const router: ExpressRouter = Router();

// Health check
router.use('/health', healthRouter);

// Local file server (development only)
router.use('/api/local-files', localFilesRouter);

export default router;
