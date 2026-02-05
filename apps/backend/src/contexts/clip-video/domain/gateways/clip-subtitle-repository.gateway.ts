import type { ClipSubtitle } from '../models/clip-subtitle.js';

/**
 * ClipSubtitle Repository Gateway
 * 字幕データの永続化を担当するインターフェース
 */
export interface ClipSubtitleRepositoryGateway {
  /**
   * 字幕を保存する（新規作成または更新）
   */
  save(subtitle: ClipSubtitle): Promise<void>;

  /**
   * クリップIDで字幕を検索する
   */
  findByClipId(clipId: string): Promise<ClipSubtitle | null>;

  /**
   * 字幕を削除する
   */
  delete(clipId: string): Promise<void>;
}
