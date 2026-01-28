import type { ShortsPlanning } from '../models/planning.js';

/**
 * ShortsPlanning Repository Gateway
 * 企画書の永続化を行うインターフェース
 */
export interface ShortsPlanningRepositoryGateway {
  /**
   * 企画書を保存する（新規作成または更新）
   * @param planning 企画書
   */
  save(planning: ShortsPlanning): Promise<void>;

  /**
   * IDで企画書を検索する
   * @param id 企画書ID
   * @returns 企画書またはnull
   */
  findById(id: string): Promise<ShortsPlanning | null>;

  /**
   * プロジェクトIDで企画書を検索する
   * @param projectId プロジェクトID
   * @returns 企画書またはnull（1プロジェクト1企画書）
   */
  findByProjectId(projectId: string): Promise<ShortsPlanning | null>;

  /**
   * プロジェクトIDで企画書の全バージョンを取得する
   * @param projectId プロジェクトID
   * @returns 企画書一覧（バージョン降順）
   */
  findAllVersionsByProjectId(projectId: string): Promise<ShortsPlanning[]>;

  /**
   * 企画書を削除する
   * @param id 企画書ID
   */
  delete(id: string): Promise<void>;

  /**
   * プロジェクトの企画書を全て削除する
   * @param projectId プロジェクトID
   */
  deleteByProjectId(projectId: string): Promise<void>;
}
