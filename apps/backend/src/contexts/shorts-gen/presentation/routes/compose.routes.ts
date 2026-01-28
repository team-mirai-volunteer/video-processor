import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';
import { prisma } from '@shared/infrastructure/database/connection.js';
import { logger } from '@shared/infrastructure/logging/logger.js';
import {
  type ComposeVideoInput,
  type ComposeVideoOutput,
  ComposeVideoUseCase,
} from '@shorts-gen/application/usecases/compose-video.usecase.js';
import {
  AssetRegistryClient,
  FFmpegComposeClient,
} from '@shorts-gen/infrastructure/clients/index.js';
import {
  ShortsComposedVideoRepository,
  ShortsProjectRepository,
  ShortsSceneAssetRepository,
  ShortsSceneRepository,
} from '@shorts-gen/infrastructure/repositories/index.js';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: ExpressRouter = Router();

// Initialize repositories
const projectRepository = new ShortsProjectRepository(prisma);
const sceneRepository = new ShortsSceneRepository(prisma);
const sceneAssetRepository = new ShortsSceneAssetRepository(prisma);
const composedVideoRepository = new ShortsComposedVideoRepository(prisma);

// Initialize gateways
function createTempStorageGateway(): TempStorageGateway {
  if (process.env.TEMP_STORAGE_TYPE === 'local') {
    return new LocalTempStorageClient();
  }
  return new GcsClient();
}

const tempStorageGateway = createTempStorageGateway();
const videoComposeGateway = new FFmpegComposeClient();
const assetRegistryGateway = new AssetRegistryClient();

// Initialize use case
const composeVideoUseCase = new ComposeVideoUseCase({
  projectRepository,
  sceneRepository,
  sceneAssetRepository,
  composedVideoRepository,
  videoComposeGateway,
  assetRegistryGateway,
  tempStorageGateway,
  generateId: () => uuidv4(),
});

/**
 * Request body for composing video
 */
interface ComposeVideoRequest {
  projectId: string;
  scriptId: string;
  bgmKey?: string | null;
}

/**
 * Response for composed video
 */
interface ComposeVideoResponse {
  composedVideoId: string;
  fileUrl: string;
  durationSeconds: number;
}

/**
 * Response for getting composed video
 */
interface GetComposedVideoResponse {
  id: string;
  projectId: string;
  scriptId: string;
  fileUrl: string | null;
  durationSeconds: number | null;
  status: string;
  errorMessage: string | null;
  bgmKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/shorts-gen/compose
 * Start video composition for a project
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body as ComposeVideoRequest;

    if (!body.projectId || !body.scriptId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'projectId and scriptId are required',
      });
      return;
    }

    const input: ComposeVideoInput = {
      projectId: body.projectId,
      scriptId: body.scriptId,
      bgmKey: body.bgmKey,
    };

    // Return immediately with 202 Accepted, then process in background
    res.status(202).json({
      message: 'Video composition started',
      projectId: body.projectId,
      scriptId: body.scriptId,
    });

    // Execute composition in background (fire and forget)
    composeVideoUseCase.execute(input).catch((error) => {
      logger.error('[ComposeRoutes] Background composition failed', error as Error, {
        projectId: body.projectId,
        scriptId: body.scriptId,
      });
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/shorts-gen/compose/sync
 * Start video composition and wait for completion (synchronous)
 */
router.post('/sync', async (req, res, next) => {
  try {
    const body = req.body as ComposeVideoRequest;

    if (!body.projectId || !body.scriptId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'projectId and scriptId are required',
      });
      return;
    }

    const input: ComposeVideoInput = {
      projectId: body.projectId,
      scriptId: body.scriptId,
      bgmKey: body.bgmKey,
    };

    const result: ComposeVideoOutput = await composeVideoUseCase.execute(input);

    const response: ComposeVideoResponse = {
      composedVideoId: result.composedVideoId,
      fileUrl: result.fileUrl,
      durationSeconds: result.durationSeconds,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/compose/project/:projectId
 * Get composed video by project ID
 */
router.get('/project/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'projectId is required',
      });
      return;
    }

    const composedVideo = await composedVideoRepository.findByProjectId(projectId);

    if (!composedVideo) {
      res.status(404).json({
        error: 'Not Found',
        message: `Composed video for project ${projectId} not found`,
      });
      return;
    }

    const response: GetComposedVideoResponse = {
      id: composedVideo.id,
      projectId: composedVideo.projectId,
      scriptId: composedVideo.scriptId,
      fileUrl: composedVideo.fileUrl,
      durationSeconds: composedVideo.durationSeconds,
      status: composedVideo.status,
      errorMessage: composedVideo.errorMessage,
      bgmKey: composedVideo.bgmKey,
      createdAt: composedVideo.createdAt.toISOString(),
      updatedAt: composedVideo.updatedAt.toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/compose/script/:scriptId
 * Get composed video by script ID
 */
router.get('/script/:scriptId', async (req, res, next) => {
  try {
    const { scriptId } = req.params;

    if (!scriptId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'scriptId is required',
      });
      return;
    }

    const composedVideo = await composedVideoRepository.findByScriptId(scriptId);

    if (!composedVideo) {
      res.status(404).json({
        error: 'Not Found',
        message: `Composed video for script ${scriptId} not found`,
      });
      return;
    }

    const response: GetComposedVideoResponse = {
      id: composedVideo.id,
      projectId: composedVideo.projectId,
      scriptId: composedVideo.scriptId,
      fileUrl: composedVideo.fileUrl,
      durationSeconds: composedVideo.durationSeconds,
      status: composedVideo.status,
      errorMessage: composedVideo.errorMessage,
      bgmKey: composedVideo.bgmKey,
      createdAt: composedVideo.createdAt.toISOString(),
      updatedAt: composedVideo.updatedAt.toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/compose/:id
 * Get composed video by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'id is required',
      });
      return;
    }

    const composedVideo = await composedVideoRepository.findById(id);

    if (!composedVideo) {
      res.status(404).json({
        error: 'Not Found',
        message: `Composed video ${id} not found`,
      });
      return;
    }

    const response: GetComposedVideoResponse = {
      id: composedVideo.id,
      projectId: composedVideo.projectId,
      scriptId: composedVideo.scriptId,
      fileUrl: composedVideo.fileUrl,
      durationSeconds: composedVideo.durationSeconds,
      status: composedVideo.status,
      errorMessage: composedVideo.errorMessage,
      bgmKey: composedVideo.bgmKey,
      createdAt: composedVideo.createdAt.toISOString(),
      updatedAt: composedVideo.updatedAt.toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/shorts-gen/compose/:id
 * Delete composed video by ID
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'id is required',
      });
      return;
    }

    const composedVideo = await composedVideoRepository.findById(id);

    if (!composedVideo) {
      res.status(404).json({
        error: 'Not Found',
        message: `Composed video ${id} not found`,
      });
      return;
    }

    await composedVideoRepository.delete(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
