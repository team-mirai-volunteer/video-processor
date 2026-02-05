/**
 * 字幕1行の最大文字数
 */
export const SUBTITLE_MAX_CHARS_PER_LINE = 16;

/**
 * 字幕の最大行数
 */
export const SUBTITLE_MAX_LINES = 2;

/**
 * Clip subtitle segment
 * 字幕の1セグメント（画面に表示される1単位）
 * lines: 字幕テキストの配列（1行16文字以内、最大2行）
 */
export interface ClipSubtitleSegment {
  index: number;
  lines: string[];
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
