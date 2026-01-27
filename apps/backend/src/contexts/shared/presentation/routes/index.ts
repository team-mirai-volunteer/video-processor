import { type Router as ExpressRouter, Router } from 'express';
import healthRouter from './health.js';

const router: ExpressRouter = Router();

// Health check
router.use('/health', healthRouter);

export default router;
