import type { ShortsProject } from '../models/project.js';

/**
 * プロジェクト検索オプション
 */
export interface FindProjectsOptions {
  /** ページ番号（1始まり） */
  page: number;
  /** 1ページあたりの件数 */
  limit: number;
  /** タイトルによる絞り込み（部分一致） */
  titleFilter?: string;
}

/**
 * プロジェクト検索結果
 */
export interface FindProjectsResult {
  /** プロジェクト一覧 */
  projects: ShortsProject[];
  /** 総件数 */
  total: number;
}

/**
 * ShortsProject Repository Gateway
 * プロジェクトの永続化を行うインターフェース
 */
export interface ShortsProjectRepositoryGateway {
  /**
   * プロジェクトを保存する（新規作成または更新）
   * @param project プロジェクト
   */
  save(project: ShortsProject): Promise<void>;

  /**
   * IDでプロジェクトを検索する
   * @param id プロジェクトID
   * @returns プロジェクトまたはnull
   */
  findById(id: string): Promise<ShortsProject | null>;

  /**
   * プロジェクト一覧を検索する
   * @param options 検索オプション
   * @returns 検索結果
   */
  findMany(options: FindProjectsOptions): Promise<FindProjectsResult>;

  /**
   * プロジェクトを削除する（関連データも全て削除）
   * @param id プロジェクトID
   */
  delete(id: string): Promise<void>;

  /**
   * プロジェクトが存在するか確認する
   * @param id プロジェクトID
   * @returns 存在すればtrue
   */
  exists(id: string): Promise<boolean>;
}
