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
 * アセット取得エラー
 */
export type AssetRegistryError =
  | { type: 'ASSET_NOT_FOUND'; key: string; assetType: 'video' | 'bgm' }
  | { type: 'FILE_NOT_FOUND'; path: string }
  | { type: 'REGISTRY_LOAD_ERROR'; message: string };

/**
 * Asset Registry Gateway
 * 素材（動画・BGM）の管理とパス解決を行うインターフェース
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
   * アセットファイルが存在するか確認する
   * @param key アセットキー
   * @param assetType アセットタイプ
   * @returns 存在すればtrue
   */
  assetExists(key: string, assetType: 'video' | 'bgm'): boolean;
}
