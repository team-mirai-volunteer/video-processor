import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { ImageGenGateway, ReferenceImage } from '../../domain/gateways/image-gen.gateway.js';
import type { ShortsReferenceCharacterRepositoryGateway } from '../../domain/gateways/reference-character-repository.gateway.js';
import type { ShortsSceneAssetRepositoryGateway } from '../../domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '../../domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '../../domain/gateways/script-repository.gateway.js';
import { ShortsSceneAsset } from '../../domain/models/scene-asset.js';
import type { ShortsScene } from '../../domain/models/scene.js';
import { NotFoundError, ValidationError } from '../errors/errors.js';

const log = createLogger('GenerateImagesUseCase');

/**
 * Input for generating images for an entire script
 */
export interface GenerateImagesForScriptInput {
  scriptId: string;
  /** Output folder ID for storing generated images */
  outputFolderId?: string;
}

/**
 * Input for generating image for a single scene
 */
export interface GenerateImageForSceneInput {
  sceneId: string;
  /** Output folder ID for storing generated image */
  outputFolderId?: string;
}

/**
 * Generated image result for a single scene
 */
export interface GeneratedImageResult {
  sceneId: string;
  assetId: string;
  fileUrl: string;
  success: boolean;
  error?: string;
}

/**
 * Result of generating images
 */
export interface GenerateImagesResult {
  scriptId?: string;
  results: GeneratedImageResult[];
  successCount: number;
  failureCount: number;
  skippedCount: number;
}

/**
 * Storage gateway interface for uploading and downloading images
 * Uses shared storage gateway pattern
 */
export interface ImageStorageGateway {
  uploadFile(params: {
    name: string;
    mimeType: string;
    content: Buffer;
    parentFolderId?: string;
  }): Promise<{
    id: string;
    webViewLink: string;
  }>;
  /** Download file from storage (for reference images) */
  downloadFile?(gcsUri: string): Promise<Buffer>;
}

/**
 * Dependencies for GenerateImagesUseCase
 */
export interface GenerateImagesUseCaseDeps {
  sceneRepository: ShortsSceneRepositoryGateway;
  sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  imageGenGateway: ImageGenGateway;
  storageGateway: ImageStorageGateway;
  generateId: () => string;
  /** Default resolution width for generated images (default: 1080) */
  defaultWidth?: number;
  /** Default resolution height for generated images (default: 1920) */
  defaultHeight?: number;
  /** Script repository for getting projectId (optional, for reference character support) */
  scriptRepository?: ShortsScriptRepositoryGateway;
  /** Reference character repository (optional) */
  referenceCharacterRepository?: ShortsReferenceCharacterRepositoryGateway;
}

/**
 * UseCase for generating background images for scenes
 * Handles image generation using AI and stores results as scene assets
 */
export class GenerateImagesUseCase {
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  private readonly imageGenGateway: ImageGenGateway;
  private readonly storageGateway: ImageStorageGateway;
  private readonly generateId: () => string;
  private readonly defaultWidth: number;
  private readonly defaultHeight: number;
  private readonly scriptRepository?: ShortsScriptRepositoryGateway;
  private readonly referenceCharacterRepository?: ShortsReferenceCharacterRepositoryGateway;

  constructor(deps: GenerateImagesUseCaseDeps) {
    this.sceneRepository = deps.sceneRepository;
    this.sceneAssetRepository = deps.sceneAssetRepository;
    this.imageGenGateway = deps.imageGenGateway;
    this.storageGateway = deps.storageGateway;
    this.generateId = deps.generateId;
    this.defaultWidth = deps.defaultWidth ?? 1080;
    this.defaultHeight = deps.defaultHeight ?? 1920;
    this.scriptRepository = deps.scriptRepository;
    this.referenceCharacterRepository = deps.referenceCharacterRepository;
  }

  /**
   * Generate images for all scenes in a script
   */
  async executeForScript(input: GenerateImagesForScriptInput): Promise<GenerateImagesResult> {
    const { scriptId, outputFolderId } = input;

    // Get all scenes for the script
    const scenes = await this.sceneRepository.findByScriptId(scriptId);
    if (scenes.length === 0) {
      throw new NotFoundError('Scenes for script', scriptId);
    }

    // Get reference images for the project (if available)
    const referenceImages = await this.getReferenceImagesForScript(scriptId);

    // Filter scenes that need image generation
    const scenesToGenerate = scenes.filter(
      (scene) => scene.visualType === 'image_gen' && scene.imagePrompt
    );

    const results: GeneratedImageResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    const skippedCount = scenes.length - scenesToGenerate.length;

    // Generate images for each scene
    for (const scene of scenesToGenerate) {
      const result = await this.generateImageForScene(scene, outputFolderId, referenceImages);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return {
      scriptId,
      results,
      successCount,
      failureCount,
      skippedCount,
    };
  }

  /**
   * Generate image for a single scene (for re-generation)
   */
  async executeForScene(input: GenerateImageForSceneInput): Promise<GenerateImagesResult> {
    const { sceneId, outputFolderId } = input;

    // Get the scene
    const scene = await this.sceneRepository.findById(sceneId);
    if (!scene) {
      throw new NotFoundError('Scene', sceneId);
    }

    // Validate that the scene requires image generation
    if (scene.visualType !== 'image_gen') {
      throw new ValidationError(
        `Scene ${sceneId} does not require image generation (visualType: ${scene.visualType})`
      );
    }

    if (!scene.imagePrompt) {
      throw new ValidationError(
        `Scene ${sceneId} does not have an image prompt. Generate image prompts first.`
      );
    }

    // Get reference images for the scene's script (if available)
    const referenceImages = await this.getReferenceImagesForScene(sceneId);

    const result = await this.generateImageForScene(scene, outputFolderId, referenceImages);

    return {
      results: [result],
      successCount: result.success ? 1 : 0,
      failureCount: result.success ? 0 : 1,
      skippedCount: 0,
    };
  }

  /**
   * Generate image for a single scene
   */
  private async generateImageForScene(
    scene: ShortsScene,
    outputFolderId?: string,
    referenceImages?: ReferenceImage[]
  ): Promise<GeneratedImageResult> {
    try {
      // Ensure imagePrompt exists (caller should have validated this)
      const imagePrompt = scene.imagePrompt;
      if (!imagePrompt) {
        return {
          sceneId: scene.id,
          assetId: '',
          fileUrl: '',
          success: false,
          error: 'Image prompt is missing',
        };
      }

      // Delete existing background_image assets for this scene
      await this.sceneAssetRepository.deleteBySceneIdAndType(scene.id, 'background_image');

      // Generate image using AI with reference images
      const imageResult = await this.imageGenGateway.generate({
        prompt: imagePrompt,
        width: this.defaultWidth,
        height: this.defaultHeight,
        style: scene.imageStyleHint ?? undefined,
        referenceImages:
          referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
      });

      if (!imageResult.success) {
        return {
          sceneId: scene.id,
          assetId: '',
          fileUrl: '',
          success: false,
          error: this.formatImageGenError(imageResult.error),
        };
      }

      // Upload image to storage
      const fileName = `scene_${scene.id}_background.${imageResult.value.format}`;
      const mimeType = `image/${imageResult.value.format}`;

      const uploadedFile = await this.storageGateway.uploadFile({
        name: fileName,
        mimeType,
        content: imageResult.value.imageBuffer,
        parentFolderId: outputFolderId,
      });

      // Create scene asset
      const assetResult = ShortsSceneAsset.create(
        {
          sceneId: scene.id,
          assetType: 'background_image',
          fileUrl: uploadedFile.webViewLink,
        },
        this.generateId
      );

      if (!assetResult.success) {
        return {
          sceneId: scene.id,
          assetId: '',
          fileUrl: uploadedFile.webViewLink,
          success: false,
          error: `Failed to create asset: ${assetResult.error.message}`,
        };
      }

      // Save asset to repository
      await this.sceneAssetRepository.save(assetResult.value);

      return {
        sceneId: scene.id,
        assetId: assetResult.value.id,
        fileUrl: uploadedFile.webViewLink,
        success: true,
      };
    } catch (error) {
      return {
        sceneId: scene.id,
        assetId: '',
        fileUrl: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format image generation error message
   */
  private formatImageGenError(error: {
    type: string;
    message?: string;
    statusCode?: number;
    retryAfterMs?: number;
  }): string {
    switch (error.type) {
      case 'INVALID_PROMPT':
        return `Invalid prompt: ${error.message}`;
      case 'INVALID_DIMENSIONS':
        return `Invalid dimensions: ${error.message}`;
      case 'CONTENT_POLICY_VIOLATION':
        return `Content policy violation: ${error.message}`;
      case 'GENERATION_FAILED':
        return `Generation failed: ${error.message}`;
      case 'RATE_LIMIT_EXCEEDED':
        return `Rate limit exceeded${error.retryAfterMs ? `. Retry after ${error.retryAfterMs}ms` : ''}`;
      case 'API_ERROR':
        return `API error (${error.statusCode}): ${error.message}`;
      default:
        return `Unknown error: ${error.type}`;
    }
  }

  /**
   * Get reference images for a script's project
   */
  private async getReferenceImagesForScript(scriptId: string): Promise<ReferenceImage[]> {
    // If repositories are not available, return empty array
    if (!this.scriptRepository || !this.referenceCharacterRepository) {
      return [];
    }

    // Get the script to find projectId
    const script = await this.scriptRepository.findById(scriptId);
    if (!script) {
      return [];
    }

    return this.downloadReferenceImages(script.projectId);
  }

  /**
   * Get reference images for a scene (via its script's project)
   */
  private async getReferenceImagesForScene(sceneId: string): Promise<ReferenceImage[]> {
    // If repositories are not available, return empty array
    if (!this.scriptRepository || !this.referenceCharacterRepository) {
      return [];
    }

    // Get the scene to find scriptId
    const scene = await this.sceneRepository.findById(sceneId);
    if (!scene) {
      return [];
    }

    // Get the script to find projectId
    const script = await this.scriptRepository.findById(scene.scriptId);
    if (!script) {
      return [];
    }

    return this.downloadReferenceImages(script.projectId);
  }

  /**
   * Download reference character images for a project
   */
  private async downloadReferenceImages(projectId: string): Promise<ReferenceImage[]> {
    if (!this.referenceCharacterRepository || !this.storageGateway.downloadFile) {
      return [];
    }

    // Get reference characters for the project
    const characters = await this.referenceCharacterRepository.findByProjectId(projectId);
    if (characters.length === 0) {
      return [];
    }

    log.info('Downloading reference character images', {
      projectId,
      characterCount: characters.length,
    });

    const referenceImages: ReferenceImage[] = [];

    for (const character of characters) {
      try {
        // Download the image from storage
        const imageBuffer = await this.storageGateway.downloadFile(character.imageUrl);

        // Determine MIME type from URL
        const mimeType = character.imageUrl.toLowerCase().includes('.png')
          ? 'image/png'
          : 'image/jpeg';

        referenceImages.push({
          imageBuffer,
          mimeType,
        });

        log.debug('Downloaded reference image', {
          characterId: character.id,
          mimeType,
          bufferSize: imageBuffer.length,
        });
      } catch (error) {
        log.warn('Failed to download reference image', {
          characterId: character.id,
          imageUrl: character.imageUrl,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other images even if one fails
      }
    }

    log.info('Reference images downloaded', {
      projectId,
      downloadedCount: referenceImages.length,
      requestedCount: characters.length,
    });

    return referenceImages;
  }
}
