import { prisma } from '@shared/infrastructure/database/connection.js';
import { ValidationError } from '@shorts-gen/application/errors/errors.js';
import {
  type GeneratePublishTextInput,
  type GeneratePublishTextResult,
  GeneratePublishTextUseCase,
} from '@shorts-gen/application/usecases/generate-publish-text.usecase.js';
import type { ShortsPublishText } from '@shorts-gen/domain/models/publish-text.js';
import { OpenAiAgenticClient } from '@shorts-gen/infrastructure/clients/openai-agentic.client.js';
import {
  ShortsPlanningRepository,
  ShortsPublishTextRepository,
  ShortsSceneRepository,
  ShortsScriptRepository,
} from '@shorts-gen/infrastructure/repositories/index.js';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: ExpressRouter = Router();

// Initialize repositories
const planningRepository = new ShortsPlanningRepository(prisma);
const scriptRepository = new ShortsScriptRepository(prisma);
const sceneRepository = new ShortsSceneRepository(prisma);
const publishTextRepository = new ShortsPublishTextRepository(prisma);

// Initialize gateways
const agenticAiGateway = new OpenAiAgenticClient();

// Initialize use case
const generatePublishTextUseCase = new GeneratePublishTextUseCase({
  agenticAiGateway,
  planningRepository,
  scriptRepository,
  sceneRepository,
  publishTextRepository,
  generateId: () => uuidv4(),
});

/**
 * Request body for generating publish text
 */
interface GeneratePublishTextRequest {
  projectId: string;
}

/**
 * Response for generated publish text
 */
interface GeneratePublishTextResponse {
  publishTextId: string;
  title: string;
  description: string;
}

/**
 * Request body for updating publish text
 */
interface UpdatePublishTextRequest {
  title?: string;
  description?: string;
}

/**
 * Response for getting publish text
 */
interface GetPublishTextResponse {
  id: string;
  projectId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/shorts-gen/publish
 * Generate publish text (title and description) for a project
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body as GeneratePublishTextRequest;

    if (!body.projectId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'projectId is required',
      });
      return;
    }

    const input: GeneratePublishTextInput = {
      projectId: body.projectId,
    };

    const result: GeneratePublishTextResult = await generatePublishTextUseCase.execute(input);

    const response: GeneratePublishTextResponse = {
      publishTextId: result.publishTextId,
      title: result.title,
      description: result.description,
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/publish/project/:projectId
 * Get publish text by project ID
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

    const publishText = await publishTextRepository.findByProjectId(projectId);

    if (!publishText) {
      res.status(404).json({
        error: 'Not Found',
        message: `Publish text for project ${projectId} not found`,
      });
      return;
    }

    const response: GetPublishTextResponse = {
      id: publishText.id,
      projectId: publishText.projectId,
      title: publishText.title,
      description: publishText.description,
      createdAt: publishText.createdAt.toISOString(),
      updatedAt: publishText.updatedAt.toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/publish/:id
 * Get publish text by ID
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

    const publishText = await publishTextRepository.findById(id);

    if (!publishText) {
      res.status(404).json({
        error: 'Not Found',
        message: `Publish text ${id} not found`,
      });
      return;
    }

    const response: GetPublishTextResponse = {
      id: publishText.id,
      projectId: publishText.projectId,
      title: publishText.title,
      description: publishText.description,
      createdAt: publishText.createdAt.toISOString(),
      updatedAt: publishText.updatedAt.toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/shorts-gen/publish/:id
 * Update publish text (title and/or description)
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body as UpdatePublishTextRequest;

    if (!id) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'id is required',
      });
      return;
    }

    if (!body.title && !body.description) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'At least one of title or description is required',
      });
      return;
    }

    const existingPublishText = await publishTextRepository.findById(id);

    if (!existingPublishText) {
      res.status(404).json({
        error: 'Not Found',
        message: `Publish text ${id} not found`,
      });
      return;
    }

    let updatedPublishText: ShortsPublishText;

    if (body.title && body.description) {
      const result = existingPublishText.withContent(body.title, body.description);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedPublishText = result.value;
    } else if (body.title) {
      const result = existingPublishText.withTitle(body.title);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedPublishText = result.value;
    } else if (body.description) {
      const result = existingPublishText.withDescription(body.description);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedPublishText = result.value;
    } else {
      updatedPublishText = existingPublishText;
    }

    await publishTextRepository.save(updatedPublishText);

    const response: GetPublishTextResponse = {
      id: updatedPublishText.id,
      projectId: updatedPublishText.projectId,
      title: updatedPublishText.title,
      description: updatedPublishText.description,
      createdAt: updatedPublishText.createdAt.toISOString(),
      updatedAt: updatedPublishText.updatedAt.toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/shorts-gen/publish/:id
 * Delete publish text by ID
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

    const publishText = await publishTextRepository.findById(id);

    if (!publishText) {
      res.status(404).json({
        error: 'Not Found',
        message: `Publish text ${id} not found`,
      });
      return;
    }

    await publishTextRepository.delete(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
