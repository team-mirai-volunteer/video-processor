import type { Result } from '@shared/domain/types/result.js';
import type { SubtitleFontSize } from '@video-processor/shared';
import type { ClipSubtitleSegment } from '../models/clip-subtitle.js';

/**
 * 字幕のスタイル設定（shorts-gen の SubtitleStyle と同等）
 */
export interface SubtitleStyle {
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  alignment?: 'left' | 'center' | 'right';
  bold?: boolean;
}

/**
 * 字幕合成のエラー型
 */
export type ClipSubtitleComposeError =
  | { type: 'INPUT_VIDEO_NOT_FOUND'; message: string }
  | { type: 'INVALID_SEGMENTS'; message: string }
  | { type: 'FFMPEG_ERROR'; message: string; stderr?: string }
  | { type: 'SUBTITLE_GENERATION_ERROR'; message: string }
  | { type: 'COMPOSE_FAILED'; message: string };

/**
 * フォーマット変換パラメータ（字幕合成と同時に1パスで実行）
 */
export interface FormatConversionParams {
  /** 変換先の幅 */
  targetWidth: number;
  /** 変換先の高さ */
  targetHeight: number;
  /** パディング色（hex, e.g. '#000000'） */
  paddingColor: string;
}

/**
 * 字幕合成のパラメータ
 */
export interface ClipSubtitleComposeParams {
  /** 入力動画のパス（ローカルまたはGCS） */
  inputVideoPath: string;
  /** 字幕セグメント一覧 */
  segments: ClipSubtitleSegment[];
  /** 出力動画のパス */
  outputPath: string;
  /** 動画の幅（ピクセル） */
  width: number;
  /** 動画の高さ（ピクセル） */
  height: number;
  /** 字幕スタイル設定（省略時はデフォルト） */
  style?: SubtitleStyle;
  /** 字幕フォントサイズ（省略時は 'medium'） */
  fontSize?: SubtitleFontSize;
  /** 進捗コールバック（0-100の割合で呼ばれる） */
  onProgress?: (percent: number) => void;
  /** フォーマット変換（指定時はscale+pad+drawtextを1パスで実行） */
  formatConversion?: FormatConversionParams;
}

/**
 * 字幕合成の結果
 */
export interface ClipSubtitleComposeResult {
  /** 合成後の動画の長さ（秒） */
  durationSeconds: number;
  /** 出力動画のパス */
  outputPath: string;
}

/**
 * 動画の寸法情報
 */
export interface VideoDimensions {
  width: number;
  height: number;
}

/**
 * ClipSubtitle Composer Gateway
 * クリップ動画に字幕を焼き込む処理を担当するインターフェース
 */
export interface ClipSubtitleComposerGateway {
  /**
   * 動画の寸法を取得する
   * @param videoPath 動画ファイルのパス
   * @returns 動画の幅と高さ
   */
  getVideoDimensions(videoPath: string): Promise<VideoDimensions>;

  /**
   * クリップ動画に字幕を合成する
   * @param params 合成パラメータ
   * @returns 合成結果またはエラー
   */
  compose(
    params: ClipSubtitleComposeParams
  ): Promise<Result<ClipSubtitleComposeResult, ClipSubtitleComposeError>>;
}
