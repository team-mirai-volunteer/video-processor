import type { ShortsReferenceCharacter } from '../models/reference-character.js';

/**
 * 参照キャラクターRepository Gateway
 * 参照キャラクターの永続化を行うインターフェース
 */
export interface ShortsReferenceCharacterRepositoryGateway {
  /**
   * 参照キャラクターを保存する（新規作成または更新）
   * @param character 参照キャラクター
   */
  save(character: ShortsReferenceCharacter): Promise<void>;

  /**
   * IDで参照キャラクターを検索する
   * @param id 参照キャラクターID
   * @returns 参照キャラクターまたはnull
   */
  findById(id: string): Promise<ShortsReferenceCharacter | null>;

  /**
   * プロジェクトIDで参照キャラクターを検索する（順序でソート）
   * @param projectId プロジェクトID
   * @returns 参照キャラクターの配列
   */
  findByProjectId(projectId: string): Promise<ShortsReferenceCharacter[]>;

  /**
   * プロジェクトの参照キャラクター数を取得する
   * @param projectId プロジェクトID
   * @returns 参照キャラクター数
   */
  countByProjectId(projectId: string): Promise<number>;

  /**
   * 参照キャラクターを削除する
   * @param id 参照キャラクターID
   */
  delete(id: string): Promise<void>;

  /**
   * プロジェクトの参照キャラクターを全て削除する
   * @param projectId プロジェクトID
   */
  deleteByProjectId(projectId: string): Promise<void>;
}
