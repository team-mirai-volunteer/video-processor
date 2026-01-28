import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';
import { prisma } from '@shared/infrastructure/database/connection.js';
import {
  SynthesizeVoiceError,
  type SynthesizeVoiceInput,
  SynthesizeVoiceUseCase,
} from '@shorts-gen/application/usecases/synthesize-voice.usecase.js';
import { FishAudioTtsClient } from '@shorts-gen/infrastructure/clients/fish-audio-tts.client.js';
import { ShortsSceneAssetRepository } from '@shorts-gen/infrastructure/repositories/scene-asset.repository.js';
import { ShortsSceneRepository } from '@shorts-gen/infrastructure/repositories/scene.repository.js';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: ExpressRouter = Router();

// Initialize repositories
const sceneRepository = new ShortsSceneRepository(prisma);
const sceneAssetRepository = new ShortsSceneAssetRepository(prisma);

// Initialize gateways based on environment
function createTempStorageGateway(): TempStorageGateway {
  if (process.env.TEMP_STORAGE_TYPE === 'local') {
    return new LocalTempStorageClient();
  }
  return new GcsClient();
}

// Initialize clients (lazy initialization to allow env vars to be set)
let synthesizeVoiceUseCase: SynthesizeVoiceUseCase | null = null;

function getSynthesizeVoiceUseCase(): SynthesizeVoiceUseCase {
  if (!synthesizeVoiceUseCase) {
    const ttsGateway = new FishAudioTtsClient();
    const storageGateway = createTempStorageGateway();

    synthesizeVoiceUseCase = new SynthesizeVoiceUseCase({
      ttsGateway,
      sceneRepository,
      sceneAssetRepository,
      storageGateway,
      generateId: () => uuidv4(),
    });
  }
  return synthesizeVoiceUseCase;
}

/**
 * Request body for voice synthesis
 */
interface SynthesizeVoiceRequest {
  /** Optional: specific scene IDs to regenerate */
  sceneIds?: string[];
  /** Optional: voice model ID to use for TTS */
  voiceModelId?: string;
}

/**
 * POST /api/shorts-gen/scripts/:scriptId/voice
 * Synthesize voice for all scenes in a script
 */
router.post('/scripts/:scriptId/voice', async (req, res, next) => {
  try {
    const { scriptId } = req.params;
    const body = req.body as SynthesizeVoiceRequest;

    const input: SynthesizeVoiceInput = {
      scriptId: scriptId ?? '',
      sceneIds: body.sceneIds,
      voiceModelId: body.voiceModelId,
    };

    const useCase = getSynthesizeVoiceUseCase();
    const result = await useCase.execute(input);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof SynthesizeVoiceError) {
      const statusCode = getStatusCodeForVoiceError(error.type);
      res.status(statusCode).json({
        error: error.type,
        message: error.message,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/shorts-gen/scenes/:sceneId/voice
 * Regenerate voice for a single scene
 */
router.post('/scenes/:sceneId/voice', async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    const body = req.body as Pick<SynthesizeVoiceRequest, 'voiceModelId'>;

    // Get the scene to find the scriptId
    const scene = await sceneRepository.findById(sceneId ?? '');
    if (!scene) {
      res.status(404).json({
        error: 'SCENE_NOT_FOUND',
        message: `Scene not found: ${sceneId}`,
      });
      return;
    }

    const input: SynthesizeVoiceInput = {
      scriptId: scene.scriptId,
      sceneIds: [sceneId ?? ''],
      voiceModelId: body.voiceModelId,
    };

    const useCase = getSynthesizeVoiceUseCase();
    const result = await useCase.execute(input);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof SynthesizeVoiceError) {
      const statusCode = getStatusCodeForVoiceError(error.type);
      res.status(statusCode).json({
        error: error.type,
        message: error.message,
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/shorts-gen/scripts/:scriptId/voice
 * Get voice assets for all scenes in a script
 */
router.get('/scripts/:scriptId/voice', async (req, res, next) => {
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

    // Get voice assets for all scenes
    const sceneIds = scenes.map((s) => s.id);
    const assets = await sceneAssetRepository.findBySceneIds(sceneIds);

    // Filter to voice assets only
    const voiceAssets = assets.filter((a) => a.assetType === 'voice');

    // Group by scene
    const assetsByScene = new Map<
      string,
      { assetId: string; fileUrl: string; durationMs: number }
    >();
    for (const asset of voiceAssets) {
      assetsByScene.set(asset.sceneId, {
        assetId: asset.id,
        fileUrl: asset.fileUrl,
        durationMs: asset.durationMs ?? 0,
      });
    }

    // Build response
    const sceneVoices = scenes.map((scene) => {
      const asset = assetsByScene.get(scene.id);
      return {
        sceneId: scene.id,
        sceneOrder: scene.order,
        hasVoice: !!asset,
        hasVoiceText: !!scene.voiceText,
        asset: asset ?? null,
      };
    });

    res.status(200).json({
      scriptId,
      totalScenes: scenes.length,
      scenesWithVoice: voiceAssets.length,
      sceneVoices,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Map error types to HTTP status codes
 */
function getStatusCodeForVoiceError(
  errorType: 'SCRIPT_NOT_FOUND' | 'NO_SCENES_FOUND' | 'SCENE_NOT_FOUND' | 'INVALID_INPUT'
): number {
  switch (errorType) {
    case 'SCRIPT_NOT_FOUND':
    case 'NO_SCENES_FOUND':
    case 'SCENE_NOT_FOUND':
      return 404;
    case 'INVALID_INPUT':
      return 400;
    default:
      return 500;
  }
}

export default router;
