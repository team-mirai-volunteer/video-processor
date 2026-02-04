/**
 * Clip subtitle segment
 * 字幕の1セグメント（画面に表示される1単位）
 */
export interface ClipSubtitleSegment {
  index: number;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
}

/**
 * Clip subtitle status
 */
export type ClipSubtitleStatus = 'draft' | 'confirmed';

/**
 * Clip subtitle entity
 * クリップに紐づく字幕データ
 */
export interface ClipSubtitle {
  id: string;
  clipId: string;
  segments: ClipSubtitleSegment[];
  status: ClipSubtitleStatus;
  createdAt: Date;
  updatedAt: Date;
}
