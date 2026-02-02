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
import { assetRegistry } from '../assets/asset-registry.js';

/**
 * Asset Registry Client
 * asset-registry.ts からアセット情報を取得し、キーからパスを解決する
 */
export class AssetRegistryClient implements AssetRegistryGateway {
  private readonly assetsDir: string;

  /**
   * @param assetsDir assetsディレクトリの絶対パス（省略時はデフォルトパス）
   */
  constructor(assetsDir?: string) {
    this.assetsDir = assetsDir ?? path.join(import.meta.dirname, '../assets');
  }

  /**
   * 動画アセットを取得する
   */
  getVideoAsset(key: string): Result<VideoAssetInfo, AssetRegistryError> {
    const videoDefinition = assetRegistry.videos[key];

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
    const bgmDefinition = assetRegistry.bgm[key];

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
    return Object.keys(assetRegistry.videos);
  }

  /**
   * 利用可能な全BGMアセットのキー一覧を取得する
   */
  listBgmAssetKeys(): string[] {
    return Object.keys(assetRegistry.bgm);
  }

  /**
   * 声アセットを取得する
   */
  getVoiceAsset(key: string): Result<VoiceAssetInfo, AssetRegistryError> {
    const voiceDefinition = assetRegistry.voices[key];

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
    const result: VoiceAssetInfo[] = [];

    for (const key of Object.keys(assetRegistry.voices)) {
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
}
