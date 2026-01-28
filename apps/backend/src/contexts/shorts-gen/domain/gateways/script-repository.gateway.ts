import type { ShortsScript } from '../models/script.js';

/**
 * ShortsScript Repository Gateway
 * 台本の永続化を行うインターフェース
 */
export interface ShortsScriptRepositoryGateway {
  /**
   * 台本を保存する（新規作成または更新）
   * @param script 台本
   */
  save(script: ShortsScript): Promise<void>;

  /**
   * IDで台本を検索する
   * @param id 台本ID
   * @returns 台本またはnull
   */
  findById(id: string): Promise<ShortsScript | null>;

  /**
   * プロジェクトIDで台本を検索する
   * @param projectId プロジェクトID
   * @returns 台本またはnull（1プロジェクト1台本）
   */
  findByProjectId(projectId: string): Promise<ShortsScript | null>;

  /**
   * 企画書IDで台本を検索する
   * @param planningId 企画書ID
   * @returns 台本一覧
   */
  findByPlanningId(planningId: string): Promise<ShortsScript[]>;

  /**
   * 台本を削除する（関連シーンも削除）
   * @param id 台本ID
   */
  delete(id: string): Promise<void>;

  /**
   * プロジェクトの台本を全て削除する
   * @param projectId プロジェクトID
   */
  deleteByProjectId(projectId: string): Promise<void>;
}
