import { type Router as ExpressRouter, Router } from 'express';
import imageRouter from './image.routes.js';
import planningRouter from './planning.routes.js';
import projectRouter from './project.routes.js';
import scriptRouter from './script.routes.js';
import subtitleRouter from './subtitle.routes.js';
import voiceRouter from './voice.routes.js';

const router: ExpressRouter = Router();

// shorts-gen API routes
router.use('/api/shorts-gen/projects', projectRouter);
router.use('/api/shorts-gen/projects', planningRouter);
router.use('/api/shorts-gen/projects', scriptRouter);
router.use('/api/shorts-gen', voiceRouter);
router.use('/api/shorts-gen', subtitleRouter);
router.use('/api/shorts-gen', imageRouter);

export default router;
