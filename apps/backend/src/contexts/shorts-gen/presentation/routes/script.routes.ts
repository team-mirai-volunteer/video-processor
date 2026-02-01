import { prisma } from '@shared/infrastructure/database/connection.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import { NotFoundError, ValidationError } from '@shorts-gen/application/errors/errors.js';
import { AddSceneUseCase } from '@shorts-gen/application/usecases/add-scene.usecase.js';
import { CreateManualScriptUseCase } from '@shorts-gen/application/usecases/create-manual-script.usecase.js';
import {
  type GenerateScriptInput,
  GenerateScriptUseCase,
} from '@shorts-gen/application/usecases/generate-script.usecase.js';
import type { ChatMessage } from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { VisualType } from '@shorts-gen/domain/models/scene.js';
import { AnthropicAgenticClient } from '@shorts-gen/infrastructure/clients/anthropic-agentic.client.js';
import { AssetRegistryClient } from '@shorts-gen/infrastructure/clients/asset-registry.client.js';
import { ShortsPlanningRepository } from '@shorts-gen/infrastructure/repositories/planning.repository.js';
import { ShortsSceneRepository } from '@shorts-gen/infrastructure/repositories/scene.repository.js';
import { ShortsScriptRepository } from '@shorts-gen/infrastructure/repositories/script.repository.js';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('ScriptRoutes');
const router: ExpressRouter = Router();

// Initialize repositories and clients
const planningRepository = new ShortsPlanningRepository(prisma);
const scriptRepository = new ShortsScriptRepository(prisma);
const sceneRepository = new ShortsSceneRepository(prisma);
const agenticAiGateway = new AnthropicAgenticClient();
const assetRegistryGateway = new AssetRegistryClient();

// Initialize use cases
const generateScriptUseCase = new GenerateScriptUseCase({
  agenticAiGateway,
  planningRepository,
  scriptRepository,
  sceneRepository,
  assetRegistryGateway,
  generateId: () => uuidv4(),
});

const createManualScriptUseCase = new CreateManualScriptUseCase({
  planningRepository,
  scriptRepository,
  sceneRepository,
  generateId: () => uuidv4(),
});

const addSceneUseCase = new AddSceneUseCase({
  scriptRepository,
  sceneRepository,
  generateId: () => uuidv4(),
});

/**
 * Request body for generating script
 */
interface GenerateScriptRequest {
  planningId: string;
  userMessage?: string;
  conversationHistory?: ChatMessage[];
}

/**
 * Request body for updating a scene
 */
interface UpdateSceneRequest {
  summary?: string;
  visualType?: VisualType;
  voiceText?: string | null;
  subtitles?: string[];
  silenceDurationMs?: number | null;
  stockVideoKey?: string | null;
  solidColor?: string | null;
  imagePrompt?: string | null;
  imageStyleHint?: string | null;
  order?: number;
}

/**
 * Request body for creating manual script
 */
interface CreateManualScriptRequest {
  planningId: string;
}

/**
 * Request body for adding a scene
 */
interface AddSceneRequest {
  summary: string;
  visualType: VisualType;
  voiceText?: string | null;
  subtitles?: string[];
  silenceDurationMs?: number | null;
  stockVideoKey?: string | null;
  solidColor?: string | null;
  imageStyleHint?: string | null;
  order?: number;
}

/**
 * POST /api/shorts-gen/projects/:projectId/script
 * Create an empty script for manual editing
 */
router.post('/:projectId/script', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const body = req.body as CreateManualScriptRequest;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!body.planningId) {
      throw new ValidationError('Planning ID is required');
    }

    log.info('Creating manual script', { projectId, planningId: body.planningId });

    const result = await createManualScriptUseCase.execute({
      projectId,
      planningId: body.planningId,
    });

    res.json({
      id: result.scriptId,
      projectId: result.projectId,
      planningId: result.planningId,
      version: result.version,
      scenes: [],
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/shorts-gen/projects/:projectId/script/scenes
 * Add a scene to the script
 */
router.post('/:projectId/script/scenes', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const body = req.body as AddSceneRequest;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    // Get script for this project
    const script = await scriptRepository.findByProjectId(projectId);
    if (!script) {
      throw new NotFoundError('Script', projectId);
    }

    log.info('Adding scene to script', { projectId, scriptId: script.id });

    const result = await addSceneUseCase.execute({
      scriptId: script.id,
      summary: body.summary,
      visualType: body.visualType,
      voiceText: body.voiceText,
      subtitles: body.subtitles,
      silenceDurationMs: body.silenceDurationMs,
      stockVideoKey: body.stockVideoKey,
      solidColor: body.solidColor,
      imageStyleHint: body.imageStyleHint,
      order: body.order,
    });

    const scene = result.scene;

    res.status(201).json({
      id: scene.id,
      scriptId: scene.scriptId,
      order: scene.order,
      summary: scene.summary,
      visualType: scene.visualType,
      voiceText: scene.voiceText,
      subtitles: scene.subtitles,
      silenceDurationMs: scene.silenceDurationMs,
      stockVideoKey: scene.stockVideoKey,
      solidColor: scene.solidColor,
      imagePrompt: scene.imagePrompt,
      imageStyleHint: scene.imageStyleHint,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/shorts-gen/projects/:projectId/script/generate
 * Generate script using AI with SSE streaming
 */
router.post('/:projectId/script/generate', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const body = req.body as GenerateScriptRequest;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!body.planningId) {
      throw new ValidationError('Planning ID is required');
    }

    log.info('Starting script generation', { projectId, planningId: body.planningId });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const input: GenerateScriptInput = {
      projectId,
      planningId: body.planningId,
      userMessage: body.userMessage,
      conversationHistory: body.conversationHistory,
    };

    try {
      // Use streaming execution
      const result = await generateScriptUseCase.executeStream(input);

      for await (const chunk of result.stream) {
        const data = JSON.stringify(chunk);
        res.write(`data: ${data}\n\n`);
      }

      // Send final event with script ID if available
      const finalData = {
        type: 'done',
        scriptId: result.scriptId,
      };
      res.write(`data: ${JSON.stringify(finalData)}\n\n`);
      res.end();

      log.info('Script generation completed', {
        projectId,
        planningId: body.planningId,
        scriptId: result.scriptId,
      });
    } catch (streamError) {
      log.error('Stream error during script generation', streamError as Error, {
        projectId,
        planningId: body.planningId,
      });

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
 * POST /api/shorts-gen/projects/:projectId/script/generate-sync
 * Generate script using AI (non-streaming, synchronous)
 */
router.post('/:projectId/script/generate-sync', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const body = req.body as GenerateScriptRequest;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!body.planningId) {
      throw new ValidationError('Planning ID is required');
    }

    log.info('Starting sync script generation', { projectId, planningId: body.planningId });

    const input: GenerateScriptInput = {
      projectId,
      planningId: body.planningId,
      userMessage: body.userMessage,
      conversationHistory: body.conversationHistory,
    };

    const result = await generateScriptUseCase.execute(input);

    log.info('Sync script generation completed', {
      projectId,
      planningId: body.planningId,
      scriptId: result.scriptId,
      sceneCount: result.scenes.length,
    });

    res.json({
      scriptId: result.scriptId,
      aiResponse: result.aiResponse,
      scenes: result.scenes.map((s) => ({
        id: s.id,
        order: s.order,
        summary: s.summary,
        visualType: s.visualType,
        voiceText: s.voiceText,
        subtitles: s.subtitles,
        silenceDurationMs: s.silenceDurationMs,
        stockVideoKey: s.stockVideoKey,
        solidColor: s.solidColor,
        imagePrompt: s.imagePrompt,
        imageStyleHint: s.imageStyleHint,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/projects/:projectId/script
 * Get current script with scenes for a project
 */
router.get('/:projectId/script', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const script = await scriptRepository.findByProjectId(projectId);

    if (!script) {
      throw new NotFoundError('Script', projectId);
    }

    // Get scenes
    const scenes = await sceneRepository.findByScriptId(script.id);

    res.json({
      id: script.id,
      projectId: script.projectId,
      planningId: script.planningId,
      version: script.version,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt,
      scenes: scenes.map((s) => ({
        id: s.id,
        order: s.order,
        summary: s.summary,
        visualType: s.visualType,
        voiceText: s.voiceText,
        subtitles: s.subtitles,
        silenceDurationMs: s.silenceDurationMs,
        stockVideoKey: s.stockVideoKey,
        solidColor: s.solidColor,
        imagePrompt: s.imagePrompt,
        imageStyleHint: s.imageStyleHint,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/projects/:projectId/script/scenes/:sceneId
 * Get a specific scene
 */
router.get('/:projectId/script/scenes/:sceneId', async (req, res, next) => {
  try {
    const { projectId, sceneId } = req.params;

    if (!projectId || !sceneId) {
      throw new ValidationError('Project ID and Scene ID are required');
    }

    // Verify script exists for project
    const script = await scriptRepository.findByProjectId(projectId);
    if (!script) {
      throw new NotFoundError('Script', projectId);
    }

    const scene = await sceneRepository.findById(sceneId);

    if (!scene || scene.scriptId !== script.id) {
      throw new NotFoundError('Scene', sceneId);
    }

    res.json({
      id: scene.id,
      scriptId: scene.scriptId,
      order: scene.order,
      summary: scene.summary,
      visualType: scene.visualType,
      voiceText: scene.voiceText,
      subtitles: scene.subtitles,
      silenceDurationMs: scene.silenceDurationMs,
      stockVideoKey: scene.stockVideoKey,
      solidColor: scene.solidColor,
      imagePrompt: scene.imagePrompt,
      imageStyleHint: scene.imageStyleHint,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/shorts-gen/projects/:projectId/script/scenes/:sceneId
 * Update a scene (manual edit)
 */
router.patch('/:projectId/script/scenes/:sceneId', async (req, res, next) => {
  try {
    const { projectId, sceneId } = req.params;
    const body = req.body as UpdateSceneRequest;

    if (!projectId || !sceneId) {
      throw new ValidationError('Project ID and Scene ID are required');
    }

    // Verify script exists for project
    const script = await scriptRepository.findByProjectId(projectId);
    if (!script) {
      throw new NotFoundError('Script', projectId);
    }

    const scene = await sceneRepository.findById(sceneId);

    if (!scene || scene.scriptId !== script.id) {
      throw new NotFoundError('Scene', sceneId);
    }

    let updatedScene = scene;

    // Apply updates
    if (body.summary !== undefined) {
      const result = updatedScene.withSummary(body.summary);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedScene = result.value;
    }

    if (body.voiceText !== undefined) {
      const result = updatedScene.withVoiceText(body.voiceText);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedScene = result.value;
    }

    if (body.subtitles !== undefined) {
      const result = updatedScene.withSubtitles(body.subtitles);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedScene = result.value;
    }

    if (body.imagePrompt !== undefined) {
      updatedScene = updatedScene.withImagePrompt(body.imagePrompt);
    }

    if (body.imageStyleHint !== undefined) {
      updatedScene = updatedScene.withImageStyleHint(body.imageStyleHint);
    }

    if (body.order !== undefined) {
      const result = updatedScene.withOrder(body.order);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedScene = result.value;
    }

    // Save updates
    await sceneRepository.save(updatedScene);

    log.info('Scene updated manually', {
      projectId,
      scriptId: script.id,
      sceneId: updatedScene.id,
    });

    res.json({
      id: updatedScene.id,
      scriptId: updatedScene.scriptId,
      order: updatedScene.order,
      summary: updatedScene.summary,
      visualType: updatedScene.visualType,
      voiceText: updatedScene.voiceText,
      subtitles: updatedScene.subtitles,
      silenceDurationMs: updatedScene.silenceDurationMs,
      stockVideoKey: updatedScene.stockVideoKey,
      solidColor: updatedScene.solidColor,
      imagePrompt: updatedScene.imagePrompt,
      imageStyleHint: updatedScene.imageStyleHint,
      createdAt: updatedScene.createdAt,
      updatedAt: updatedScene.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/shorts-gen/projects/:projectId/script
 * Delete the script and all its scenes
 */
router.delete('/:projectId/script', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const script = await scriptRepository.findByProjectId(projectId);

    if (!script) {
      throw new NotFoundError('Script', projectId);
    }

    // Delete scenes first
    await sceneRepository.deleteByScriptId(script.id);

    // Delete script
    await scriptRepository.delete(script.id);

    log.info('Script deleted', { projectId, scriptId: script.id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
