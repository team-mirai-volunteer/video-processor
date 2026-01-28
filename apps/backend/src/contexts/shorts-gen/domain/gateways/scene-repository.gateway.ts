import type { ShortsScene } from '../models/scene.js';

/**
 * ShortsScene Repository Gateway
 * シーンの永続化を行うインターフェース
 */
export interface ShortsSceneRepositoryGateway {
  /**
   * シーンを保存する（新規作成または更新）
   * @param scene シーン
   */
  save(scene: ShortsScene): Promise<void>;

  /**
   * 複数のシーンを一括保存する
   * @param scenes シーン一覧
   */
  saveMany(scenes: ShortsScene[]): Promise<void>;

  /**
   * IDでシーンを検索する
   * @param id シーンID
   * @returns シーンまたはnull
   */
  findById(id: string): Promise<ShortsScene | null>;

  /**
   * 台本IDでシーン一覧を取得する（order順）
   * @param scriptId 台本ID
   * @returns シーン一覧
   */
  findByScriptId(scriptId: string): Promise<ShortsScene[]>;

  /**
   * 台本IDとorder番号でシーンを取得する
   * @param scriptId 台本ID
   * @param order order番号
   * @returns シーンまたはnull
   */
  findByScriptIdAndOrder(scriptId: string, order: number): Promise<ShortsScene | null>;

  /**
   * シーンを削除する（関連アセットも削除）
   * @param id シーンID
   */
  delete(id: string): Promise<void>;

  /**
   * 台本のシーンを全て削除する
   * @param scriptId 台本ID
   */
  deleteByScriptId(scriptId: string): Promise<void>;

  /**
   * 台本IDでシーン数を取得する
   * @param scriptId 台本ID
   * @returns シーン数
   */
  countByScriptId(scriptId: string): Promise<number>;
}
