import type {
  ComposedVideoProgressPhase,
  ComposedVideoStatus,
  ShortsComposedVideo,
} from '../models/composed-video.js';

/**
 * ShortsComposedVideo Repository Gateway
 * 合成動画の永続化を行うインターフェース
 */
export interface ShortsComposedVideoRepositoryGateway {
  /**
   * 合成動画を保存する（新規作成または更新）
   * @param composedVideo 合成動画
   */
  save(composedVideo: ShortsComposedVideo): Promise<void>;

  /**
   * 進捗を更新する（軽量な部分更新）
   * @param id 合成動画ID
   * @param phase 進捗フェーズ
   * @param percent 進捗パーセンテージ (0-100)
   */
  updateProgress(id: string, phase: ComposedVideoProgressPhase, percent: number): Promise<void>;

  /**
   * IDで合成動画を検索する
   * @param id 合成動画ID
   * @returns 合成動画またはnull
   */
  findById(id: string): Promise<ShortsComposedVideo | null>;

  /**
   * プロジェクトIDで合成動画を検索する
   * @param projectId プロジェクトID
   * @returns 合成動画またはnull
   */
  findByProjectId(projectId: string): Promise<ShortsComposedVideo | null>;

  /**
   * 台本IDで合成動画を検索する
   * @param scriptId 台本ID
   * @returns 合成動画またはnull
   */
  findByScriptId(scriptId: string): Promise<ShortsComposedVideo | null>;

  /**
   * ステータスで合成動画を検索する
   * @param status ステータス
   * @returns 合成動画一覧
   */
  findByStatus(status: ComposedVideoStatus): Promise<ShortsComposedVideo[]>;

  /**
   * 合成動画を削除する
   * @param id 合成動画ID
   */
  delete(id: string): Promise<void>;

  /**
   * プロジェクトの合成動画を全て削除する
   * @param projectId プロジェクトID
   */
  deleteByProjectId(projectId: string): Promise<void>;
}
