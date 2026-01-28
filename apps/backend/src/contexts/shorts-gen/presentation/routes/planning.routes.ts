import { prisma } from '@shared/infrastructure/database/connection.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import { NotFoundError, ValidationError } from '@shorts-gen/application/errors/errors.js';
import {
  type GeneratePlanningInput,
  GeneratePlanningUseCase,
} from '@shorts-gen/application/usecases/generate-planning.usecase.js';
import type { ChatMessage } from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import { OpenAiAgenticClient } from '@shorts-gen/infrastructure/clients/openai-agentic.client.js';
import { ShortsPlanningRepository } from '@shorts-gen/infrastructure/repositories/planning.repository.js';
import { ShortsProjectRepository } from '@shorts-gen/infrastructure/repositories/project.repository.js';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('PlanningRoutes');
const router: ExpressRouter = Router();

// Initialize repositories and clients
const projectRepository = new ShortsProjectRepository(prisma);
const planningRepository = new ShortsPlanningRepository(prisma);
const agenticAiGateway = new OpenAiAgenticClient();

// Initialize use cases
const generatePlanningUseCase = new GeneratePlanningUseCase({
  agenticAiGateway,
  planningRepository,
  projectRepository,
  generateId: () => uuidv4(),
});

/**
 * Request body for generating planning
 */
interface GeneratePlanningRequest {
  userMessage: string;
  conversationHistory?: ChatMessage[];
}

/**
 * Request body for updating planning
 */
interface UpdatePlanningRequest {
  content: string;
}

/**
 * POST /api/shorts-gen/projects/:projectId/planning/generate
 * Generate planning using AI with SSE streaming
 */
router.post('/:projectId/planning/generate', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const body = req.body as GeneratePlanningRequest;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!body.userMessage || body.userMessage.trim().length === 0) {
      throw new ValidationError('User message is required');
    }

    log.info('Starting planning generation', { projectId });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const input: GeneratePlanningInput = {
      projectId,
      userMessage: body.userMessage,
      conversationHistory: body.conversationHistory,
    };

    try {
      // Use streaming execution
      const stream = generatePlanningUseCase.executeStream(input);

      for await (const chunk of stream) {
        const data = JSON.stringify(chunk);
        res.write(`data: ${data}\n\n`);

        // If planning was saved, log it
        if (chunk.type === 'tool_call' && 'savedPlanning' in chunk && chunk.savedPlanning) {
          log.info('Planning saved', {
            projectId,
            planningId: chunk.savedPlanning.id,
          });
        }
      }

      // Send done event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

      log.info('Planning generation completed', { projectId });
    } catch (streamError) {
      log.error('Stream error during planning generation', streamError as Error, { projectId });

      // Send error event if still connected
      if (!res.writableEnded) {
        const errorMessage =
          streamError instanceof Error ? streamError.message : 'Unknown error occurred';
        res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    // Handle non-streaming errors
    if (!res.headersSent) {
      next(error);
    } else {
      log.error('Error after headers sent', error as Error);
      res.end();
    }
  }
});

/**
 * POST /api/shorts-gen/projects/:projectId/planning/generate-sync
 * Generate planning using AI (non-streaming, synchronous)
 */
router.post('/:projectId/planning/generate-sync', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const body = req.body as GeneratePlanningRequest;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!body.userMessage || body.userMessage.trim().length === 0) {
      throw new ValidationError('User message is required');
    }

    log.info('Starting sync planning generation', { projectId });

    const input: GeneratePlanningInput = {
      projectId,
      userMessage: body.userMessage,
      conversationHistory: body.conversationHistory,
    };

    const result = await generatePlanningUseCase.execute(input);

    log.info('Sync planning generation completed', {
      projectId,
      planningId: result.savedPlanning?.id,
    });

    res.json({
      responseText: result.responseText,
      planning: result.savedPlanning
        ? {
            id: result.savedPlanning.id,
            projectId: result.savedPlanning.projectId,
            content: result.savedPlanning.content,
            version: result.savedPlanning.version,
            createdAt: result.savedPlanning.createdAt,
            updatedAt: result.savedPlanning.updatedAt,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/projects/:projectId/planning
 * Get current planning for a project
 */
router.get('/:projectId/planning', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    // Verify project exists
    const projectExists = await projectRepository.exists(projectId);
    if (!projectExists) {
      throw new NotFoundError('Project', projectId);
    }

    const planning = await planningRepository.findByProjectId(projectId);

    if (!planning) {
      throw new NotFoundError('Planning', projectId);
    }

    res.json({
      id: planning.id,
      projectId: planning.projectId,
      content: planning.content,
      version: planning.version,
      createdAt: planning.createdAt,
      updatedAt: planning.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/projects/:projectId/planning/versions
 * Get all versions of planning for a project
 */
router.get('/:projectId/planning/versions', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    // Verify project exists
    const projectExists = await projectRepository.exists(projectId);
    if (!projectExists) {
      throw new NotFoundError('Project', projectId);
    }

    const plannings = await planningRepository.findAllVersionsByProjectId(projectId);

    res.json({
      versions: plannings.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        content: p.content,
        version: p.version,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/shorts-gen/projects/:projectId/planning
 * Update planning content (manual edit)
 */
router.patch('/:projectId/planning', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const body = req.body as UpdatePlanningRequest;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!body.content || body.content.trim().length === 0) {
      throw new ValidationError('Content is required');
    }

    // Verify project exists
    const projectExists = await projectRepository.exists(projectId);
    if (!projectExists) {
      throw new NotFoundError('Project', projectId);
    }

    const planning = await planningRepository.findByProjectId(projectId);

    if (!planning) {
      throw new NotFoundError('Planning', projectId);
    }

    // Update content (increments version)
    const updateResult = planning.withContent(body.content);
    if (!updateResult.success) {
      throw new ValidationError(updateResult.error.message);
    }

    const updatedPlanning = updateResult.value;
    await planningRepository.save(updatedPlanning);

    log.info('Planning updated manually', {
      projectId,
      planningId: updatedPlanning.id,
      version: updatedPlanning.version,
    });

    res.json({
      id: updatedPlanning.id,
      projectId: updatedPlanning.projectId,
      content: updatedPlanning.content,
      version: updatedPlanning.version,
      createdAt: updatedPlanning.createdAt,
      updatedAt: updatedPlanning.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
