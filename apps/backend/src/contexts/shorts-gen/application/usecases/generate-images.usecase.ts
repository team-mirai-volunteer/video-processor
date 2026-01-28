import type { ImageGenGateway } from '../../domain/gateways/image-gen.gateway.js';
import type { ShortsSceneAssetRepositoryGateway } from '../../domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '../../domain/gateways/scene-repository.gateway.js';
import { ShortsSceneAsset } from '../../domain/models/scene-asset.js';
import type { ShortsScene } from '../../domain/models/scene.js';
import { NotFoundError, ValidationError } from '../errors/errors.js';

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
 * Storage gateway interface for uploading images
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

  constructor(deps: GenerateImagesUseCaseDeps) {
    this.sceneRepository = deps.sceneRepository;
    this.sceneAssetRepository = deps.sceneAssetRepository;
    this.imageGenGateway = deps.imageGenGateway;
    this.storageGateway = deps.storageGateway;
    this.generateId = deps.generateId;
    this.defaultWidth = deps.defaultWidth ?? 1080;
    this.defaultHeight = deps.defaultHeight ?? 1920;
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
      const result = await this.generateImageForScene(scene, outputFolderId);
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

    const result = await this.generateImageForScene(scene, outputFolderId);

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
    outputFolderId?: string
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

      // Generate image using AI
      const imageResult = await this.imageGenGateway.generate({
        prompt: imagePrompt,
        width: this.defaultWidth,
        height: this.defaultHeight,
        style: scene.imageStyleHint ?? undefined,
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
}
