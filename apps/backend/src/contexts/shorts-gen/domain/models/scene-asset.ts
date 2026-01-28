import { type Result, err, ok } from '@shared/domain/types/result.js';

/**
 * Asset type for a scene
 * - voice: Generated voice audio file
 * - subtitle_image: Generated subtitle image (transparent PNG)
 * - background_image: AI-generated background image
 */
export type AssetType = 'voice' | 'subtitle_image' | 'background_image';

export type ShortsSceneAssetError =
  | { type: 'INVALID_SCENE_ID'; message: string }
  | { type: 'INVALID_ASSET_TYPE'; message: string }
  | { type: 'INVALID_FILE_URL'; message: string }
  | { type: 'INVALID_DURATION'; message: string };

export interface ShortsSceneAssetMetadata {
  subtitleIndex?: number;
  [key: string]: unknown;
}

export interface ShortsSceneAssetProps {
  id: string;
  sceneId: string;
  assetType: AssetType;
  fileUrl: string;
  durationMs: number | null;
  metadata: ShortsSceneAssetMetadata | null;
  createdAt: Date;
}

export interface CreateShortsSceneAssetParams {
  sceneId: string;
  assetType: AssetType;
  fileUrl: string;
  durationMs?: number | null;
  metadata?: ShortsSceneAssetMetadata | null;
}

const VALID_ASSET_TYPES: AssetType[] = ['voice', 'subtitle_image', 'background_image'];

function isValidAssetType(type: string): type is AssetType {
  return VALID_ASSET_TYPES.includes(type as AssetType);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export class ShortsSceneAsset {
  readonly id: string;
  readonly sceneId: string;
  readonly assetType: AssetType;
  readonly fileUrl: string;
  readonly durationMs: number | null;
  readonly metadata: ShortsSceneAssetMetadata | null;
  readonly createdAt: Date;

  private constructor(props: ShortsSceneAssetProps) {
    this.id = props.id;
    this.sceneId = props.sceneId;
    this.assetType = props.assetType;
    this.fileUrl = props.fileUrl;
    this.durationMs = props.durationMs;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
  }

  /**
   * Create a new ShortsSceneAsset
   */
  static create(
    params: CreateShortsSceneAssetParams,
    generateId: () => string
  ): Result<ShortsSceneAsset, ShortsSceneAssetError> {
    if (!params.sceneId || params.sceneId.trim().length === 0) {
      return err({
        type: 'INVALID_SCENE_ID',
        message: 'Scene ID cannot be empty',
      });
    }

    if (!isValidAssetType(params.assetType)) {
      return err({
        type: 'INVALID_ASSET_TYPE',
        message: `Invalid asset type. Valid values: ${VALID_ASSET_TYPES.join(', ')}`,
      });
    }

    if (!params.fileUrl || !isValidUrl(params.fileUrl)) {
      return err({
        type: 'INVALID_FILE_URL',
        message: 'File URL must be a valid URL',
      });
    }

    // Duration validation for voice assets
    if (params.assetType === 'voice') {
      if (params.durationMs === undefined || params.durationMs === null) {
        return err({
          type: 'INVALID_DURATION',
          message: 'Duration is required for voice assets',
        });
      }
      if (params.durationMs <= 0) {
        return err({
          type: 'INVALID_DURATION',
          message: 'Duration must be a positive number',
        });
      }
    }

    return ok(
      new ShortsSceneAsset({
        id: generateId(),
        sceneId: params.sceneId.trim(),
        assetType: params.assetType,
        fileUrl: params.fileUrl,
        durationMs: params.durationMs ?? null,
        metadata: params.metadata ?? null,
        createdAt: new Date(),
      })
    );
  }

  /**
   * Reconstruct ShortsSceneAsset from database
   */
  static fromProps(props: ShortsSceneAssetProps): ShortsSceneAsset {
    return new ShortsSceneAsset(props);
  }

  /**
   * Check if this is a voice asset
   */
  isVoice(): boolean {
    return this.assetType === 'voice';
  }

  /**
   * Check if this is a subtitle image asset
   */
  isSubtitleImage(): boolean {
    return this.assetType === 'subtitle_image';
  }

  /**
   * Check if this is a background image asset
   */
  isBackgroundImage(): boolean {
    return this.assetType === 'background_image';
  }

  /**
   * Convert to plain object
   */
  toProps(): ShortsSceneAssetProps {
    return {
      id: this.id,
      sceneId: this.sceneId,
      assetType: this.assetType,
      fileUrl: this.fileUrl,
      durationMs: this.durationMs,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}
