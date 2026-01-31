import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';
import { prisma } from '@shared/infrastructure/database/connection.js';
import {
  AiGenerationError,
  NotFoundError,
  ValidationError,
} from '@shorts-gen/application/errors/errors.js';
import {
  type GenerateImagePromptsInput,
  GenerateImagePromptsUseCase,
} from '@shorts-gen/application/usecases/generate-image-prompts.usecase.js';
import {
  type GenerateImageForSceneInput,
  type GenerateImagesForScriptInput,
  GenerateImagesUseCase,
  type ImageStorageGateway,
} from '@shorts-gen/application/usecases/generate-images.usecase.js';
import { NanoBananaImageGenClient } from '@shorts-gen/infrastructure/clients/nano-banana-image-gen.client.js';
import { OpenAiAgenticClient } from '@shorts-gen/infrastructure/clients/openai-agentic.client.js';
import { ShortsSceneAssetRepository } from '@shorts-gen/infrastructure/repositories/scene-asset.repository.js';
import { ShortsSceneRepository } from '@shorts-gen/infrastructure/repositories/scene.repository.js';
import { ShortsScriptRepository } from '@shorts-gen/infrastructure/repositories/script.repository.js';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: ExpressRouter = Router();

// Initialize repositories
const scriptRepository = new ShortsScriptRepository(prisma);
const sceneRepository = new ShortsSceneRepository(prisma);
const sceneAssetRepository = new ShortsSceneAssetRepository(prisma);

// Initialize gateways based on environment
function createTempStorageGateway(): TempStorageGateway {
  if (process.env.TEMP_STORAGE_TYPE === 'local') {
    return new LocalTempStorageClient();
  }
  return new GcsClient();
}

// Singleton storage gateway for URL signing
let storageGateway: TempStorageGateway | null = null;

function getStorageGateway(): TempStorageGateway {
  if (!storageGateway) {
    storageGateway = createTempStorageGateway();
  }
  return storageGateway;
}

/**
 * Convert GCS URI to signed URL for browser access
 */
async function toSignedUrl(gcsUri: string | null | undefined): Promise<string | null> {
  if (!gcsUri) return null;
  // Only convert gs:// or local:// URIs
  if (!gcsUri.startsWith('gs://') && !gcsUri.startsWith('local://')) {
    return gcsUri;
  }
  return getStorageGateway().getSignedUrl(gcsUri);
}

/**
 * Create ImageStorageGateway adapter using GCS/local storage
 */
function createImageStorageGateway(): ImageStorageGateway {
  const tempStorage = getStorageGateway();

  return {
    async uploadFile(params) {
      // Generate path: shorts-gen/images/{filename}
      const storagePath = `shorts-gen/images/${params.name}`;

      const result = await tempStorage.upload({
        videoId: storagePath,
        content: params.content,
      });

      return {
        id: storagePath,
        webViewLink: result.gcsUri, // Return GCS URI (will be converted to signed URL later)
      };
    },
  };
}

// Initialize clients (lazy initialization to allow env vars to be set)
let generateImagePromptsUseCase: GenerateImagePromptsUseCase | null = null;
let generateImagesUseCase: GenerateImagesUseCase | null = null;

function getGenerateImagePromptsUseCase(): GenerateImagePromptsUseCase {
  if (!generateImagePromptsUseCase) {
    const agenticAiGateway = new OpenAiAgenticClient();

    generateImagePromptsUseCase = new GenerateImagePromptsUseCase({
      sceneRepository,
      scriptRepository,
      agenticAiGateway,
    });
  }
  return generateImagePromptsUseCase;
}

function getGenerateImagesUseCase(): GenerateImagesUseCase {
  if (!generateImagesUseCase) {
    const imageGenGateway = new NanoBananaImageGenClient();
    const storageGateway = createImageStorageGateway();

    generateImagesUseCase = new GenerateImagesUseCase({
      sceneRepository,
      sceneAssetRepository,
      imageGenGateway,
      storageGateway,
      generateId: () => uuidv4(),
    });
  }
  return generateImagesUseCase;
}

/**
 * Request body for image prompt generation
 */
interface GenerateImagePromptsRequest {
  /** Optional: style hint for prompt generation */
  styleHint?: string;
  /** Optional: specific scene IDs to process */
  sceneIds?: string[];
}

/**
 * Request body for image generation
 */
interface GenerateImagesRequest {
  /** Optional: output folder ID for storing images */
  outputFolderId?: string;
}

/**
 * POST /api/shorts-gen/scripts/:scriptId/image-prompts
 * Generate image prompts for all image_gen scenes in a script
 */
router.post('/scripts/:scriptId/image-prompts', async (req, res, next) => {
  try {
    const { scriptId } = req.params;
    const body = req.body as GenerateImagePromptsRequest;

    const input: GenerateImagePromptsInput = {
      scriptId: scriptId ?? '',
      styleHint: body.styleHint,
      sceneIds: body.sceneIds,
    };

    const useCase = getGenerateImagePromptsUseCase();
    const result = await useCase.execute(input);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
      return;
    }
    if (error instanceof AiGenerationError) {
      res.status(500).json({
        error: 'AI_GENERATION_ERROR',
        message: error.message,
        originalError: error.originalError,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/shorts-gen/scenes/:sceneId/image-prompts
 * Regenerate image prompt for a single scene
 */
router.post('/scenes/:sceneId/image-prompts', async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    const body = req.body as Pick<GenerateImagePromptsRequest, 'styleHint'>;

    // Get the scene to find the scriptId
    const scene = await sceneRepository.findById(sceneId ?? '');
    if (!scene) {
      res.status(404).json({
        error: 'SCENE_NOT_FOUND',
        message: `Scene not found: ${sceneId}`,
      });
      return;
    }

    const input: GenerateImagePromptsInput = {
      scriptId: scene.scriptId,
      styleHint: body.styleHint,
      sceneIds: [sceneId ?? ''],
    };

    const useCase = getGenerateImagePromptsUseCase();
    const result = await useCase.execute(input);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
      return;
    }
    if (error instanceof AiGenerationError) {
      res.status(500).json({
        error: 'AI_GENERATION_ERROR',
        message: error.message,
        originalError: error.originalError,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/shorts-gen/scripts/:scriptId/images
 * Generate background images for all image_gen scenes in a script
 */
router.post('/scripts/:scriptId/images', async (req, res, next) => {
  try {
    const { scriptId } = req.params;
    const body = req.body as GenerateImagesRequest;

    const input: GenerateImagesForScriptInput = {
      scriptId: scriptId ?? '',
      outputFolderId: body.outputFolderId,
    };

    const useCase = getGenerateImagesUseCase();
    const result = await useCase.executeForScript(input);

    // Convert GCS URIs to signed URLs for browser access
    const resultsWithSignedUrls = await Promise.all(
      result.results.map(async (r) => ({
        ...r,
        fileUrl: (await toSignedUrl(r.fileUrl)) ?? r.fileUrl,
      }))
    );

    res.status(200).json({
      ...result,
      results: resultsWithSignedUrls,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/shorts-gen/scenes/:sceneId/images
 * Regenerate background image for a single scene
 */
router.post('/scenes/:sceneId/images', async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    const body = req.body as GenerateImagesRequest;

    const input: GenerateImageForSceneInput = {
      sceneId: sceneId ?? '',
      outputFolderId: body.outputFolderId,
    };

    const useCase = getGenerateImagesUseCase();
    const result = await useCase.executeForScene(input);

    // Convert GCS URIs to signed URLs for browser access
    const resultsWithSignedUrls = await Promise.all(
      result.results.map(async (r) => ({
        ...r,
        fileUrl: (await toSignedUrl(r.fileUrl)) ?? r.fileUrl,
      }))
    );

    res.status(200).json({
      ...result,
      results: resultsWithSignedUrls,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
      return;
    }
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/shorts-gen/scripts/:scriptId/images
 * Get image assets and prompts for all scenes in a script
 */
router.get('/scripts/:scriptId/images', async (req, res, next) => {
  try {
    const { scriptId } = req.params;

    // Get all scenes for the script
    const scenes = await sceneRepository.findByScriptId(scriptId ?? '');
    if (scenes.length === 0) {
      res.status(404).json({
        error: 'NO_SCENES_FOUND',
        message: `No scenes found for script: ${scriptId}`,
      });
      return;
    }

    // Get background_image assets for all scenes
    const sceneIds = scenes.map((s) => s.id);
    const assets = await sceneAssetRepository.findBySceneIds(sceneIds);

    // Filter to background_image assets only
    const imageAssets = assets.filter((a) => a.assetType === 'background_image');

    // Group by scene and convert to signed URLs
    const assetsByScene = new Map<string, { assetId: string; fileUrl: string }>();
    for (const asset of imageAssets) {
      const signedUrl = await toSignedUrl(asset.fileUrl);
      assetsByScene.set(asset.sceneId, {
        assetId: asset.id,
        fileUrl: signedUrl ?? asset.fileUrl, // fallback to original URL
      });
    }

    // Filter scenes that require image generation
    const imageGenScenes = scenes.filter((s) => s.visualType === 'image_gen');

    // Build response
    const sceneImages = imageGenScenes.map((scene) => {
      const asset = assetsByScene.get(scene.id);
      return {
        sceneId: scene.id,
        sceneOrder: scene.order,
        visualType: scene.visualType,
        hasImagePrompt: !!scene.imagePrompt,
        imagePrompt: scene.imagePrompt ?? null,
        imageStyleHint: scene.imageStyleHint ?? null,
        hasImage: !!asset,
        asset: asset ?? null,
      };
    });

    // Count statistics
    const withPrompt = sceneImages.filter((s) => s.hasImagePrompt).length;
    const withImage = sceneImages.filter((s) => s.hasImage).length;

    res.status(200).json({
      scriptId,
      totalScenes: scenes.length,
      imageGenScenes: imageGenScenes.length,
      scenesWithPrompt: withPrompt,
      scenesWithImage: withImage,
      sceneImages,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/scripts/:scriptId/image-prompts
 * Get image prompts for all scenes in a script
 */
router.get('/scripts/:scriptId/image-prompts', async (req, res, next) => {
  try {
    const { scriptId } = req.params;

    // Get all scenes for the script
    const scenes = await sceneRepository.findByScriptId(scriptId ?? '');
    if (scenes.length === 0) {
      res.status(404).json({
        error: 'NO_SCENES_FOUND',
        message: `No scenes found for script: ${scriptId}`,
      });
      return;
    }

    // Filter scenes that require image generation
    const imageGenScenes = scenes.filter((s) => s.visualType === 'image_gen');

    // Build response
    const prompts = imageGenScenes.map((scene) => ({
      sceneId: scene.id,
      sceneOrder: scene.order,
      summary: scene.summary,
      hasImagePrompt: !!scene.imagePrompt,
      imagePrompt: scene.imagePrompt ?? null,
      imageStyleHint: scene.imageStyleHint ?? null,
    }));

    res.status(200).json({
      scriptId,
      totalScenes: scenes.length,
      imageGenScenes: imageGenScenes.length,
      scenesWithPrompt: prompts.filter((p) => p.hasImagePrompt).length,
      prompts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
