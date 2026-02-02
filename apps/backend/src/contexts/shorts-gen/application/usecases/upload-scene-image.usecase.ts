import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { ShortsSceneAssetRepositoryGateway } from '../../domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '../../domain/gateways/scene-repository.gateway.js';
import { ShortsSceneAsset } from '../../domain/models/scene-asset.js';
import { NotFoundError, ValidationError } from '../errors/errors.js';

const log = createLogger('UploadSceneImageUseCase');

/**
 * Input for uploading scene image
 */
export interface UploadSceneImageInput {
  sceneId: string;
  file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
  };
}

/**
 * Result of uploading scene image
 */
export interface UploadSceneImageResult {
  assetId: string;
  fileUrl: string;
}

/**
 * Dependencies for UploadSceneImageUseCase
 */
export interface UploadSceneImageUseCaseDeps {
  sceneRepository: ShortsSceneRepositoryGateway;
  sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  tempStorageGateway: TempStorageGateway;
  generateId: () => string;
}

/**
 * Map MIME type to file extension
 */
function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

/**
 * UseCase for uploading background image for a scene
 * Handles file upload to storage and creates scene asset
 */
export class UploadSceneImageUseCase {
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  private readonly tempStorageGateway: TempStorageGateway;
  private readonly generateId: () => string;

  constructor(deps: UploadSceneImageUseCaseDeps) {
    this.sceneRepository = deps.sceneRepository;
    this.sceneAssetRepository = deps.sceneAssetRepository;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.generateId = deps.generateId;
  }

  /**
   * Execute the use case
   */
  async execute(input: UploadSceneImageInput): Promise<UploadSceneImageResult> {
    const { sceneId, file } = input;

    log.info('Uploading scene image', { sceneId, mimetype: file.mimetype });

    // 1. Verify scene exists
    const scene = await this.sceneRepository.findById(sceneId);
    if (!scene) {
      throw new NotFoundError('Scene', sceneId);
    }

    // 2. Validate scene visual type
    if (scene.visualType !== 'image_gen') {
      throw new ValidationError(
        `Scene ${sceneId} does not support image upload (visualType: ${scene.visualType}). Only image_gen scenes are supported.`
      );
    }

    // 3. Upload file to storage
    const extension = getExtensionFromMimeType(file.mimetype);
    const fileId = this.generateId();
    const storagePath = `shorts-gen/images/scene_${sceneId}_uploaded_${fileId}.${extension}`;

    const uploadResult = await this.tempStorageGateway.upload({
      videoId: storagePath,
      content: file.buffer,
    });

    log.info('Image uploaded to storage', { sceneId, gcsUri: uploadResult.gcsUri });

    // 4. Delete existing background_image assets for this scene
    await this.sceneAssetRepository.deleteBySceneIdAndType(sceneId, 'background_image');

    // 5. Create new asset
    const assetResult = ShortsSceneAsset.create(
      {
        sceneId,
        assetType: 'background_image',
        fileUrl: uploadResult.gcsUri,
        metadata: {
          sourceType: 'uploaded',
          originalFilename: file.originalname,
          mimeType: file.mimetype,
        },
      },
      this.generateId
    );

    if (!assetResult.success) {
      throw new ValidationError(`Failed to create asset: ${assetResult.error.message}`);
    }

    // 6. Save asset to repository
    await this.sceneAssetRepository.save(assetResult.value);

    // 7. Generate signed URL for response
    const signedUrl = await this.tempStorageGateway.getSignedUrl(uploadResult.gcsUri);

    log.info('Scene image uploaded successfully', {
      sceneId,
      assetId: assetResult.value.id,
    });

    return {
      assetId: assetResult.value.id,
      fileUrl: signedUrl,
    };
  }
}
