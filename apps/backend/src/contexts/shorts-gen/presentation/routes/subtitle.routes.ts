import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';
import { prisma } from '@shared/infrastructure/database/connection.js';
import { GenerateSubtitlesError } from '@shorts-gen/application/errors/generate-subtitles.errors.js';
import {
  type GenerateSubtitlesInput,
  GenerateSubtitlesUseCase,
} from '@shorts-gen/application/usecases/generate-subtitles.usecase.js';
import type { AssetStorageGateway } from '@shorts-gen/domain/gateways/asset-storage.gateway.js';
import type { SubtitleStyle } from '@shorts-gen/domain/gateways/subtitle-generator.gateway.js';
import { FFmpegSubtitleGeneratorClient } from '@shorts-gen/infrastructure/clients/ffmpeg-subtitle-generator.client.js';
import { ShortsProjectRepository } from '@shorts-gen/infrastructure/repositories/project.repository.js';
import { ShortsSceneAssetRepository } from '@shorts-gen/infrastructure/repositories/scene-asset.repository.js';
import { ShortsSceneRepository } from '@shorts-gen/infrastructure/repositories/scene.repository.js';
import { ShortsScriptRepository } from '@shorts-gen/infrastructure/repositories/script.repository.js';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: ExpressRouter = Router();

// Initialize repositories
const scriptRepository = new ShortsScriptRepository(prisma);
const projectRepository = new ShortsProjectRepository(prisma);
const sceneRepository = new ShortsSceneRepository(prisma);
const sceneAssetRepository = new ShortsSceneAssetRepository(prisma);

/**
 * Create AssetStorageGateway adapter from TempStorageGateway
 * This wraps the TempStorage interface to match AssetStorageGateway
 */
function createAssetStorageGateway(): AssetStorageGateway {
  const isLocal = process.env.TEMP_STORAGE_TYPE === 'local';
  const tempStorage = isLocal ? new LocalTempStorageClient() : new GcsClient();

  return {
    async upload(params) {
      const result = await tempStorage.upload({
        videoId: params.path,
        content: params.content,
      });
      return {
        url: result.gcsUri,
        gcsUri: result.gcsUri,
      };
    },
    async download(gcsUri: string) {
      return tempStorage.download(gcsUri);
    },
    async delete(_gcsUri: string) {
      // TempStorageGateway doesn't have delete, but files expire automatically
      // For local storage, we could implement cleanup if needed
    },
    async exists(gcsUri: string) {
      return tempStorage.exists(gcsUri);
    },
  };
}

// Initialize clients (lazy initialization to allow env vars to be set)
let generateSubtitlesUseCase: GenerateSubtitlesUseCase | null = null;

function getGenerateSubtitlesUseCase(): GenerateSubtitlesUseCase {
  if (!generateSubtitlesUseCase) {
    const subtitleGenerator = new FFmpegSubtitleGeneratorClient();
    const assetStorage = createAssetStorageGateway();

    generateSubtitlesUseCase = new GenerateSubtitlesUseCase({
      scriptRepository,
      projectRepository,
      sceneRepository,
      sceneAssetRepository,
      subtitleGenerator,
      assetStorage,
      generateId: () => uuidv4(),
    });
  }
  return generateSubtitlesUseCase;
}

/**
 * Request body for subtitle generation
 */
interface GenerateSubtitlesRequest {
  /** Optional: subtitle style settings */
  subtitleStyle?: SubtitleStyle;
  /** Optional: vertical position (0-1, default 0.8 = bottom) */
  verticalPosition?: number;
  /** Optional: specific scene IDs to regenerate */
  sceneIds?: string[];
}

/**
 * POST /api/shorts-gen/scripts/:scriptId/subtitles
 * Generate subtitle images for all scenes in a script
 */
router.post('/scripts/:scriptId/subtitles', async (req, res, next) => {
  try {
    const { scriptId } = req.params;
    const body = req.body as GenerateSubtitlesRequest;

    const input: GenerateSubtitlesInput = {
      scriptId: scriptId ?? '',
      subtitleStyle: body.subtitleStyle,
      verticalPosition: body.verticalPosition,
      sceneIds: body.sceneIds,
    };

    const useCase = getGenerateSubtitlesUseCase();
    const result = await useCase.execute(input);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof GenerateSubtitlesError) {
      const statusCode = getStatusCodeForSubtitleError(error.code);
      res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/shorts-gen/scenes/:sceneId/subtitles
 * Regenerate subtitle images for a single scene
 */
router.post('/scenes/:sceneId/subtitles', async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    const body = req.body as Omit<GenerateSubtitlesRequest, 'sceneIds'>;

    // Get the scene to find the scriptId
    const scene = await sceneRepository.findById(sceneId ?? '');
    if (!scene) {
      res.status(404).json({
        error: 'SCENE_NOT_FOUND',
        message: `Scene not found: ${sceneId}`,
      });
      return;
    }

    const input: GenerateSubtitlesInput = {
      scriptId: scene.scriptId,
      subtitleStyle: body.subtitleStyle,
      verticalPosition: body.verticalPosition,
      sceneIds: [sceneId ?? ''],
    };

    const useCase = getGenerateSubtitlesUseCase();
    const result = await useCase.execute(input);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof GenerateSubtitlesError) {
      const statusCode = getStatusCodeForSubtitleError(error.code);
      res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/shorts-gen/scripts/:scriptId/subtitles
 * Get subtitle assets for all scenes in a script
 */
router.get('/scripts/:scriptId/subtitles', async (req, res, next) => {
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

    // Get subtitle assets for all scenes
    const sceneIds = scenes.map((s) => s.id);
    const assets = await sceneAssetRepository.findBySceneIds(sceneIds);

    // Filter to subtitle_image assets only
    const subtitleAssets = assets.filter((a) => a.assetType === 'subtitle_image');

    // Group by scene
    const assetsByScene = new Map<
      string,
      Array<{ assetId: string; fileUrl: string; subtitleIndex: number; subtitleText: string }>
    >();
    for (const asset of subtitleAssets) {
      const existing = assetsByScene.get(asset.sceneId) ?? [];
      existing.push({
        assetId: asset.id,
        fileUrl: asset.fileUrl,
        subtitleIndex: (asset.metadata as { subtitleIndex?: number })?.subtitleIndex ?? 0,
        subtitleText: (asset.metadata as { subtitleText?: string })?.subtitleText ?? '',
      });
      assetsByScene.set(asset.sceneId, existing);
    }

    // Build response
    const sceneSubtitles = scenes.map((scene) => {
      const sceneAssets = assetsByScene.get(scene.id) ?? [];
      // Sort by subtitle index
      sceneAssets.sort((a, b) => a.subtitleIndex - b.subtitleIndex);

      return {
        sceneId: scene.id,
        sceneOrder: scene.order,
        subtitleCount: scene.subtitles.length,
        hasSubtitles: scene.subtitles.length > 0,
        assetsGenerated: sceneAssets.length,
        assets: sceneAssets,
      };
    });

    res.status(200).json({
      scriptId,
      totalScenes: scenes.length,
      scenesWithSubtitles: scenes.filter((s) => s.subtitles.length > 0).length,
      totalAssetsGenerated: subtitleAssets.length,
      sceneSubtitles,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Map error codes to HTTP status codes
 */
function getStatusCodeForSubtitleError(errorCode: string): number {
  switch (errorCode) {
    case 'SCRIPT_NOT_FOUND':
    case 'PROJECT_NOT_FOUND':
    case 'NO_SCENES':
      return 404;
    case 'NO_SUBTITLES':
      return 400;
    case 'GENERATION_FAILED':
    case 'UPLOAD_FAILED':
    case 'ASSET_SAVE_FAILED':
      return 500;
    default:
      return 500;
  }
}

export default router;
