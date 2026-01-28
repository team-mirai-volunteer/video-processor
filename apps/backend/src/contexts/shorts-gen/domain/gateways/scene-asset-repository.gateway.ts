import type { AssetType, ShortsSceneAsset } from '../models/scene-asset.js';

/**
 * ShortsSceneAsset Repository Gateway
 * シーンアセットの永続化を行うインターフェース
 */
export interface ShortsSceneAssetRepositoryGateway {
  /**
   * アセットを保存する（新規作成または更新）
   * @param asset アセット
   */
  save(asset: ShortsSceneAsset): Promise<void>;

  /**
   * 複数のアセットを一括保存する
   * @param assets アセット一覧
   */
  saveMany(assets: ShortsSceneAsset[]): Promise<void>;

  /**
   * IDでアセットを検索する
   * @param id アセットID
   * @returns アセットまたはnull
   */
  findById(id: string): Promise<ShortsSceneAsset | null>;

  /**
   * シーンIDでアセット一覧を取得する
   * @param sceneId シーンID
   * @returns アセット一覧
   */
  findBySceneId(sceneId: string): Promise<ShortsSceneAsset[]>;

  /**
   * シーンIDとアセットタイプでアセットを取得する
   * @param sceneId シーンID
   * @param assetType アセットタイプ
   * @returns アセット一覧
   */
  findBySceneIdAndType(sceneId: string, assetType: AssetType): Promise<ShortsSceneAsset[]>;

  /**
   * 複数シーンのアセットを一括取得する
   * @param sceneIds シーンID一覧
   * @returns アセット一覧（シーンIDでグループ化されていない）
   */
  findBySceneIds(sceneIds: string[]): Promise<ShortsSceneAsset[]>;

  /**
   * アセットを削除する
   * @param id アセットID
   */
  delete(id: string): Promise<void>;

  /**
   * シーンのアセットを全て削除する
   * @param sceneId シーンID
   */
  deleteBySceneId(sceneId: string): Promise<void>;

  /**
   * シーンIDとアセットタイプでアセットを削除する
   * @param sceneId シーンID
   * @param assetType アセットタイプ
   */
  deleteBySceneIdAndType(sceneId: string, assetType: AssetType): Promise<void>;
}
