import { type Router as ExpressRouter, Router } from 'express';
import composeRouter from './compose.routes.js';
import planningRouter from './planning.routes.js';
import projectRouter from './project.routes.js';
import publishRouter from './publish.routes.js';
import scriptRouter from './script.routes.js';

const router: ExpressRouter = Router();

// shorts-gen API routes
router.use('/api/shorts-gen/projects', projectRouter);
router.use('/api/shorts-gen/projects', planningRouter);
router.use('/api/shorts-gen/projects', scriptRouter);

// Compose video routes
router.use('/api/shorts-gen/compose', composeRouter);

// Publish text routes
router.use('/api/shorts-gen/publish', publishRouter);

export default router;
