import clipVideoRoutes from '@clip-video/presentation/routes/index.js';
import { type Router as ExpressRouter, Router } from 'express';
import healthRouter from './health.js';

const router: ExpressRouter = Router();

// Health check
router.use('/health', healthRouter);

// Clip-Video context routes
router.use(clipVideoRoutes);

export default router;
