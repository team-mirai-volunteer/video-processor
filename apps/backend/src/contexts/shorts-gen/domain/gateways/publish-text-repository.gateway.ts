import type { ShortsPublishText } from '../models/publish-text.js';

/**
 * ShortsPublishText Repository Gateway
 * 公開テキストの永続化を行うインターフェース
 */
export interface ShortsPublishTextRepositoryGateway {
  /**
   * 公開テキストを保存する（新規作成または更新）
   * @param publishText 公開テキスト
   */
  save(publishText: ShortsPublishText): Promise<void>;

  /**
   * IDで公開テキストを検索する
   * @param id 公開テキストID
   * @returns 公開テキストまたはnull
   */
  findById(id: string): Promise<ShortsPublishText | null>;

  /**
   * プロジェクトIDで公開テキストを検索する
   * @param projectId プロジェクトID
   * @returns 公開テキストまたはnull
   */
  findByProjectId(projectId: string): Promise<ShortsPublishText | null>;

  /**
   * 公開テキストを削除する
   * @param id 公開テキストID
   */
  delete(id: string): Promise<void>;

  /**
   * プロジェクトの公開テキストを全て削除する
   * @param projectId プロジェクトID
   */
  deleteByProjectId(projectId: string): Promise<void>;
}
