import type { Result } from '@shared/domain/types/result.js';

/**
 * 動画アセットの情報
 */
export interface VideoAssetInfo {
  /** アセットキー */
  key: string;
  /** ファイルの絶対パス */
  absolutePath: string;
  /** 説明 */
  description: string;
  /** 動画の長さ（ミリ秒） */
  durationMs: number;
}

/**
 * BGMアセットの情報
 */
export interface BgmAssetInfo {
  /** アセットキー */
  key: string;
  /** ファイルの絶対パス */
  absolutePath: string;
  /** 説明 */
  description: string;
}

/**
 * 声アセットの情報
 */
export interface VoiceAssetInfo {
  /** アセットキー */
  key: string;
  /** 環境変数から解決された音声モデルID */
  modelId: string;
  /** 表示名 */
  name: string;
  /** 説明 */
  description: string;
}

/**
 * アセット取得エラー
 */
export type AssetRegistryError =
  | { type: 'ASSET_NOT_FOUND'; key: string; assetType: 'video' | 'bgm' | 'voice' }
  | { type: 'FILE_NOT_FOUND'; path: string }
  | { type: 'REGISTRY_LOAD_ERROR'; message: string }
  | { type: 'ENV_VAR_NOT_FOUND'; envKey: string };

/**
 * Asset Registry Gateway
 * 素材（動画・BGM・声）の管理とパス解決を行うインターフェース
 */
export interface AssetRegistryGateway {
  /**
   * 動画アセットを取得する
   * @param key 動画アセットのキー
   * @returns 動画アセット情報またはエラー
   */
  getVideoAsset(key: string): Result<VideoAssetInfo, AssetRegistryError>;

  /**
   * BGMアセットを取得する
   * @param key BGMアセットのキー
   * @returns BGMアセット情報またはエラー
   */
  getBgmAsset(key: string): Result<BgmAssetInfo, AssetRegistryError>;

  /**
   * 声アセットを取得する
   * @param key 声アセットのキー
   * @returns 声アセット情報またはエラー
   */
  getVoiceAsset(key: string): Result<VoiceAssetInfo, AssetRegistryError>;

  /**
   * 利用可能な全動画アセットのキー一覧を取得する
   * @returns 動画アセットキーの配列
   */
  listVideoAssetKeys(): string[];

  /**
   * 利用可能な全BGMアセットのキー一覧を取得する
   * @returns BGMアセットキーの配列
   */
  listBgmAssetKeys(): string[];

  /**
   * 利用可能な全声アセット一覧を取得する
   * @returns 声アセット情報の配列
   */
  listVoiceAssets(): VoiceAssetInfo[];

  /**
   * アセットファイルが存在するか確認する
   * @param key アセットキー
   * @param assetType アセットタイプ
   * @returns 存在すればtrue
   */
  assetExists(key: string, assetType: 'video' | 'bgm'): boolean;
}
