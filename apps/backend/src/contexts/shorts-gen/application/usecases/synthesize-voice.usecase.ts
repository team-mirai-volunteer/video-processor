import { Readable } from 'node:stream';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { ShortsSceneAssetRepositoryGateway } from '@shorts-gen/domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { TtsGateway, TtsGatewayError } from '@shorts-gen/domain/gateways/tts.gateway.js';
import { ShortsSceneAsset } from '@shorts-gen/domain/models/scene-asset.js';
import type { ShortsScene } from '@shorts-gen/domain/models/scene.js';

const log = createLogger('SynthesizeVoiceUseCase');

/**
 * Dependencies for SynthesizeVoiceUseCase
 */
export interface SynthesizeVoiceUseCaseDeps {
  /** TTS gateway for voice synthesis */
  ttsGateway: TtsGateway;
  /** Scene repository for fetching scenes */
  sceneRepository: ShortsSceneRepositoryGateway;
  /** Scene asset repository for saving voice assets */
  sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  /** Storage gateway for uploading audio files */
  storageGateway: TempStorageGateway;
  /** ID generator function */
  generateId: () => string;
}

/**
 * Input parameters for voice synthesis
 */
export interface SynthesizeVoiceInput {
  /** Script ID to synthesize voices for all scenes */
  scriptId: string;
  /** Optional: specific scene IDs to regenerate (for individual scene regeneration) */
  sceneIds?: string[];
  /** Optional: voice model ID to use for TTS */
  voiceModelId?: string;
}

/**
 * Result for a single scene voice synthesis
 */
export interface SceneVoiceSynthesisResult {
  /** Scene ID */
  sceneId: string;
  /** Scene order */
  sceneOrder: number;
  /** Generated asset ID */
  assetId: string;
  /** GCS URI of the voice file */
  fileUrl: string;
  /** Voice duration in milliseconds */
  durationMs: number;
  /** Whether synthesis was skipped (no voiceText) */
  skipped: boolean;
  /** Skip reason if skipped */
  skipReason?: string;
}

/**
 * Error details for failed scene synthesis
 */
export interface SceneSynthesisError {
  /** Scene ID that failed */
  sceneId: string;
  /** Scene order */
  sceneOrder: number;
  /** Error type */
  errorType: TtsGatewayError['type'] | 'ASSET_CREATION_FAILED' | 'STORAGE_UPLOAD_FAILED';
  /** Error message */
  message: string;
}

/**
 * Output from voice synthesis
 */
export interface SynthesizeVoiceOutput {
  /** Script ID that was processed */
  scriptId: string;
  /** Total number of scenes */
  totalScenes: number;
  /** Number of scenes with voice text */
  scenesWithVoice: number;
  /** Number of successfully synthesized scenes */
  successCount: number;
  /** Number of skipped scenes (no voice text or silence duration specified) */
  skippedCount: number;
  /** Number of failed scenes */
  failedCount: number;
  /** Results for each scene */
  results: SceneVoiceSynthesisResult[];
  /** Errors for failed scenes */
  errors: SceneSynthesisError[];
}

/**
 * UseCase error types
 */
export class SynthesizeVoiceError extends Error {
  constructor(
    public readonly type:
      | 'SCRIPT_NOT_FOUND'
      | 'NO_SCENES_FOUND'
      | 'SCENE_NOT_FOUND'
      | 'INVALID_INPUT',
    message: string
  ) {
    super(message);
    this.name = 'SynthesizeVoiceError';
  }
}

/**
 * UseCase for synthesizing voice from scene texts
 *
 * This UseCase:
 * 1. Fetches scenes for a given script
 * 2. For each scene with voiceText, synthesizes voice using TTS
 * 3. Uploads the generated audio to storage
 * 4. Creates and saves ShortsSceneAsset records
 *
 * Supports:
 * - Full script synthesis (all scenes)
 * - Individual scene regeneration (specific sceneIds)
 */
export class SynthesizeVoiceUseCase {
  private readonly ttsGateway: TtsGateway;
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  private readonly storageGateway: TempStorageGateway;
  private readonly generateId: () => string;

  constructor(deps: SynthesizeVoiceUseCaseDeps) {
    this.ttsGateway = deps.ttsGateway;
    this.sceneRepository = deps.sceneRepository;
    this.sceneAssetRepository = deps.sceneAssetRepository;
    this.storageGateway = deps.storageGateway;
    this.generateId = deps.generateId;
  }

  /**
   * Execute voice synthesis for scenes
   */
  async execute(input: SynthesizeVoiceInput): Promise<SynthesizeVoiceOutput> {
    log.info('Starting voice synthesis', {
      scriptId: input.scriptId,
      sceneIds: input.sceneIds,
    });

    // Validate input
    if (!input.scriptId || input.scriptId.trim().length === 0) {
      throw new SynthesizeVoiceError('INVALID_INPUT', 'Script ID is required');
    }

    // Fetch scenes
    const scenes = await this.getScenesToProcess(input);

    if (scenes.length === 0) {
      throw new SynthesizeVoiceError(
        'NO_SCENES_FOUND',
        `No scenes found for script ${input.scriptId}`
      );
    }

    log.info('Found scenes to process', {
      scriptId: input.scriptId,
      totalScenes: scenes.length,
    });

    // Process each scene
    const results: SceneVoiceSynthesisResult[] = [];
    const errors: SceneSynthesisError[] = [];

    for (const scene of scenes) {
      const result = await this.processScene(scene, input.voiceModelId);

      if ('error' in result) {
        errors.push(result.error);
      } else {
        results.push(result.result);
      }
    }

    const successCount = results.filter((r) => !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    log.info('Voice synthesis completed', {
      scriptId: input.scriptId,
      totalScenes: scenes.length,
      successCount,
      skippedCount,
      failedCount: errors.length,
    });

    return {
      scriptId: input.scriptId,
      totalScenes: scenes.length,
      scenesWithVoice: scenes.filter((s) => s.voiceText && s.voiceText.trim().length > 0).length,
      successCount,
      skippedCount,
      failedCount: errors.length,
      results,
      errors,
    };
  }

  /**
   * Get scenes to process based on input
   */
  private async getScenesToProcess(input: SynthesizeVoiceInput): Promise<ShortsScene[]> {
    if (input.sceneIds && input.sceneIds.length > 0) {
      // Specific scene regeneration
      const scenes: ShortsScene[] = [];

      for (const sceneId of input.sceneIds) {
        const scene = await this.sceneRepository.findById(sceneId);
        if (!scene) {
          throw new SynthesizeVoiceError('SCENE_NOT_FOUND', `Scene not found: ${sceneId}`);
        }
        // Verify scene belongs to the specified script
        if (scene.scriptId !== input.scriptId) {
          throw new SynthesizeVoiceError(
            'INVALID_INPUT',
            `Scene ${sceneId} does not belong to script ${input.scriptId}`
          );
        }
        scenes.push(scene);
      }

      // Sort by order
      return scenes.sort((a, b) => a.order - b.order);
    }

    // Full script synthesis - get all scenes
    const scenes = await this.sceneRepository.findByScriptId(input.scriptId);
    return scenes;
  }

  /**
   * Process a single scene for voice synthesis
   */
  private async processScene(
    scene: ShortsScene,
    voiceModelId?: string
  ): Promise<{ result: SceneVoiceSynthesisResult } | { error: SceneSynthesisError }> {
    log.debug('Processing scene', { sceneId: scene.id, order: scene.order });

    // Check if scene has voice text
    if (!scene.voiceText || scene.voiceText.trim().length === 0) {
      log.debug('Scene has no voice text, skipping', {
        sceneId: scene.id,
        hasSilenceDuration: scene.silenceDurationMs !== null,
      });

      return {
        result: {
          sceneId: scene.id,
          sceneOrder: scene.order,
          assetId: '',
          fileUrl: '',
          durationMs: scene.silenceDurationMs ?? 0,
          skipped: true,
          skipReason: 'No voice text (silence scene)',
        },
      };
    }

    // Delete existing voice asset for this scene (for regeneration)
    await this.sceneAssetRepository.deleteBySceneIdAndType(scene.id, 'voice');

    // Synthesize voice
    const synthesisResult = await this.ttsGateway.synthesize({
      text: scene.voiceText,
      voiceModelId,
    });

    if (!synthesisResult.success) {
      log.error('TTS synthesis failed', undefined, {
        sceneId: scene.id,
        ttsError: synthesisResult.error,
      });

      return {
        error: {
          sceneId: scene.id,
          sceneOrder: scene.order,
          errorType: synthesisResult.error.type,
          message: this.getErrorMessage(synthesisResult.error),
        },
      };
    }

    const { audioBuffer, durationMs, format } = synthesisResult.value;

    // Upload to storage
    let fileUrl: string;
    try {
      const audioStream = Readable.from(audioBuffer);
      const contentType = this.getContentType(format);
      const uploadResult = await this.storageGateway.uploadFromStream(
        {
          videoId: `shorts-voice/${scene.scriptId}`,
          contentType,
          path: `scene-${scene.order}-voice.${format}`,
        },
        audioStream
      );
      fileUrl = uploadResult.gcsUri;

      log.debug('Audio uploaded to storage', {
        sceneId: scene.id,
        fileUrl,
        durationMs,
      });
    } catch (uploadError) {
      log.error(
        'Failed to upload audio to storage',
        uploadError instanceof Error ? uploadError : undefined,
        { sceneId: scene.id }
      );

      return {
        error: {
          sceneId: scene.id,
          sceneOrder: scene.order,
          errorType: 'STORAGE_UPLOAD_FAILED',
          message: uploadError instanceof Error ? uploadError.message : 'Failed to upload audio',
        },
      };
    }

    // Create and save asset
    const assetResult = ShortsSceneAsset.create(
      {
        sceneId: scene.id,
        assetType: 'voice',
        fileUrl,
        durationMs,
      },
      this.generateId
    );

    if (!assetResult.success) {
      log.error('Failed to create asset', undefined, {
        sceneId: scene.id,
        assetError: assetResult.error,
      });

      return {
        error: {
          sceneId: scene.id,
          sceneOrder: scene.order,
          errorType: 'ASSET_CREATION_FAILED',
          message: assetResult.error.message,
        },
      };
    }

    const asset = assetResult.value;

    try {
      await this.sceneAssetRepository.save(asset);

      log.debug('Asset saved', {
        sceneId: scene.id,
        assetId: asset.id,
      });
    } catch (saveError) {
      log.error('Failed to save asset', saveError instanceof Error ? saveError : undefined, {
        sceneId: scene.id,
      });

      return {
        error: {
          sceneId: scene.id,
          sceneOrder: scene.order,
          errorType: 'ASSET_CREATION_FAILED',
          message: saveError instanceof Error ? saveError.message : 'Failed to save asset',
        },
      };
    }

    return {
      result: {
        sceneId: scene.id,
        sceneOrder: scene.order,
        assetId: asset.id,
        fileUrl,
        durationMs,
        skipped: false,
      },
    };
  }

  /**
   * Get MIME content type for audio format
   */
  private getContentType(format: string): string {
    switch (format) {
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'opus':
        return 'audio/opus';
      case 'pcm':
        return 'audio/pcm';
      case 'flac':
        return 'audio/flac';
      default:
        return 'audio/mpeg';
    }
  }

  /**
   * Get human-readable error message from TTS gateway error
   */
  private getErrorMessage(error: TtsGatewayError): string {
    switch (error.type) {
      case 'INVALID_TEXT':
        return `Invalid text: ${error.message}`;
      case 'VOICE_MODEL_NOT_FOUND':
        return `Voice model not found: ${error.modelId}`;
      case 'REFERENCE_AUDIO_INVALID':
        return `Invalid reference audio: ${error.message}`;
      case 'SYNTHESIS_FAILED':
        return `Synthesis failed: ${error.message}`;
      case 'RATE_LIMIT_EXCEEDED':
        return `Rate limit exceeded. Retry after ${error.retryAfterMs ?? 60000}ms`;
      case 'API_ERROR':
        return `API error (${error.statusCode}): ${error.message}`;
      default:
        return 'Unknown error';
    }
  }
}
