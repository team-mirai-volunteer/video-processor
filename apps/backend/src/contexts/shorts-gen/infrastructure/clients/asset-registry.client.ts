import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Result } from '@shared/domain/types/result.js';
import { err, ok } from '@shared/domain/types/result.js';
import type {
  AssetRegistryError,
  AssetRegistryGateway,
  BgmAssetInfo,
  VideoAssetInfo,
  VoiceAssetInfo,
} from '../../domain/gateways/asset-registry.gateway.js';

/**
 * asset-registry.json の動画アセット定義
 */
interface VideoAssetDefinition {
  path: string;
  description: string;
  durationMs: number;
}

/**
 * asset-registry.json のBGMアセット定義
 */
interface BgmAssetDefinition {
  path: string;
  description: string;
}

/**
 * asset-registry.json の声アセット定義
 */
interface VoiceAssetDefinition {
  envKey: string;
  name: string;
  description: string;
}

/**
 * asset-registry.json のスキーマ
 */
interface AssetRegistry {
  videos: Record<string, VideoAssetDefinition>;
  bgm: Record<string, BgmAssetDefinition>;
  voices: Record<string, VoiceAssetDefinition>;
}

/**
 * Asset Registry Client
 * asset-registry.json を読み込み、キーからパスを解決する
 */
export class AssetRegistryClient implements AssetRegistryGateway {
  private readonly assetsDir: string;
  private registry: AssetRegistry | null = null;

  /**
   * @param assetsDir assetsディレクトリの絶対パス（省略時はデフォルトパス）
   */
  constructor(assetsDir?: string) {
    this.assetsDir = assetsDir ?? path.join(import.meta.dirname, '../assets');
  }

  /**
   * レジストリをロードする（遅延ロード）
   */
  private loadRegistry(): Result<AssetRegistry, AssetRegistryError> {
    if (this.registry) {
      return ok(this.registry);
    }

    const registryPath = path.join(this.assetsDir, 'asset-registry.json');

    try {
      if (!fs.existsSync(registryPath)) {
        return err({
          type: 'REGISTRY_LOAD_ERROR',
          message: `Registry file not found: ${registryPath}`,
        });
      }

      const content = fs.readFileSync(registryPath, 'utf-8');
      this.registry = JSON.parse(content) as AssetRegistry;
      return ok(this.registry);
    } catch (error) {
      return err({
        type: 'REGISTRY_LOAD_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 動画アセットを取得する
   */
  getVideoAsset(key: string): Result<VideoAssetInfo, AssetRegistryError> {
    const registryResult = this.loadRegistry();
    if (!registryResult.success) {
      return registryResult;
    }

    const registry = registryResult.value;
    const videoDefinition = registry.videos[key];

    if (!videoDefinition) {
      return err({
        type: 'ASSET_NOT_FOUND',
        key,
        assetType: 'video',
      });
    }

    const absolutePath = path.join(this.assetsDir, videoDefinition.path);

    if (!fs.existsSync(absolutePath)) {
      return err({
        type: 'FILE_NOT_FOUND',
        path: absolutePath,
      });
    }

    return ok({
      key,
      absolutePath,
      description: videoDefinition.description,
      durationMs: videoDefinition.durationMs,
    });
  }

  /**
   * BGMアセットを取得する
   */
  getBgmAsset(key: string): Result<BgmAssetInfo, AssetRegistryError> {
    const registryResult = this.loadRegistry();
    if (!registryResult.success) {
      return registryResult;
    }

    const registry = registryResult.value;
    const bgmDefinition = registry.bgm[key];

    if (!bgmDefinition) {
      return err({
        type: 'ASSET_NOT_FOUND',
        key,
        assetType: 'bgm',
      });
    }

    const absolutePath = path.join(this.assetsDir, bgmDefinition.path);

    if (!fs.existsSync(absolutePath)) {
      return err({
        type: 'FILE_NOT_FOUND',
        path: absolutePath,
      });
    }

    return ok({
      key,
      absolutePath,
      description: bgmDefinition.description,
    });
  }

  /**
   * 利用可能な全動画アセットのキー一覧を取得する
   */
  listVideoAssetKeys(): string[] {
    const registryResult = this.loadRegistry();
    if (!registryResult.success) {
      return [];
    }
    return Object.keys(registryResult.value.videos);
  }

  /**
   * 利用可能な全BGMアセットのキー一覧を取得する
   */
  listBgmAssetKeys(): string[] {
    const registryResult = this.loadRegistry();
    if (!registryResult.success) {
      return [];
    }
    return Object.keys(registryResult.value.bgm);
  }

  /**
   * 声アセットを取得する
   */
  getVoiceAsset(key: string): Result<VoiceAssetInfo, AssetRegistryError> {
    const registryResult = this.loadRegistry();
    if (!registryResult.success) {
      return registryResult;
    }

    const registry = registryResult.value;
    const voiceDefinition = registry.voices?.[key];

    if (!voiceDefinition) {
      return err({
        type: 'ASSET_NOT_FOUND',
        key,
        assetType: 'voice',
      });
    }

    // 環境変数からモデルIDを取得
    const modelId = process.env[voiceDefinition.envKey];
    if (!modelId) {
      // フォールバック: 既存の FISH_AUDIO_DEFAULT_VOICE_MODEL_ID を使用
      const fallbackModelId = process.env.FISH_AUDIO_DEFAULT_VOICE_MODEL_ID;
      if (!fallbackModelId) {
        return err({
          type: 'ENV_VAR_NOT_FOUND',
          envKey: voiceDefinition.envKey,
        });
      }
      return ok({
        key,
        modelId: fallbackModelId,
        name: voiceDefinition.name,
        description: voiceDefinition.description,
      });
    }

    return ok({
      key,
      modelId,
      name: voiceDefinition.name,
      description: voiceDefinition.description,
    });
  }

  /**
   * 利用可能な全声アセット一覧を取得する
   */
  listVoiceAssets(): VoiceAssetInfo[] {
    const registryResult = this.loadRegistry();
    if (!registryResult.success) {
      return [];
    }

    const voices = registryResult.value.voices ?? {};
    const result: VoiceAssetInfo[] = [];

    for (const key of Object.keys(voices)) {
      const voiceResult = this.getVoiceAsset(key);
      if (voiceResult.success) {
        result.push(voiceResult.value);
      }
    }

    return result;
  }

  /**
   * アセットファイルが存在するか確認する
   */
  assetExists(key: string, assetType: 'video' | 'bgm'): boolean {
    if (assetType === 'video') {
      const result = this.getVideoAsset(key);
      return result.success;
    }
    const result = this.getBgmAsset(key);
    return result.success;
  }

  /**
   * 内部キャッシュをクリアする（主にテスト用）
   */
  clearCache(): void {
    this.registry = null;
  }
}
