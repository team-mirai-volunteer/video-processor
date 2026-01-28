import type { Result } from '@shared/domain/types/result.js';

/**
 * 字幕のスタイル設定
 */
export interface SubtitleStyle {
  /** フォントファミリー */
  fontFamily?: string;
  /** フォントサイズ（ピクセル） */
  fontSize?: number;
  /** フォント色（#RRGGBB形式） */
  fontColor?: string;
  /** アウトライン色（#RRGGBB形式） */
  outlineColor?: string;
  /** アウトラインの太さ（ピクセル） */
  outlineWidth?: number;
  /** シャドウ色（#RRGGBB形式） */
  shadowColor?: string;
  /** シャドウのX方向オフセット */
  shadowOffsetX?: number;
  /** シャドウのY方向オフセット */
  shadowOffsetY?: number;
  /** テキストの水平位置（'left' | 'center' | 'right'） */
  alignment?: 'left' | 'center' | 'right';
  /** 太字 */
  bold?: boolean;
}

/**
 * 字幕画像生成リクエストパラメータ
 */
export interface SubtitleGenerateParams {
  /** 字幕テキスト */
  text: string;
  /** 出力画像の幅（ピクセル） */
  width: number;
  /** 出力画像の高さ（ピクセル） */
  height: number;
  /** 字幕の垂直位置（画像上端からの割合、0-1、デフォルト: 0.8） */
  verticalPosition?: number;
  /** 左右のパディング（ピクセル） */
  horizontalPadding?: number;
  /** スタイル設定 */
  style?: SubtitleStyle;
}

/**
 * 字幕画像生成結果
 */
export interface SubtitleGenerateResult {
  /** 生成された画像データ（透明背景PNG） */
  imageBuffer: Buffer;
  /** 画像の幅（ピクセル） */
  width: number;
  /** 画像の高さ（ピクセル） */
  height: number;
  /** 画像フォーマット（常に'png'） */
  format: 'png';
}

/**
 * 字幕画像バッチ生成パラメータ
 */
export interface SubtitleBatchGenerateParams {
  /** 字幕テキスト一覧 */
  texts: string[];
  /** 出力画像の幅（ピクセル） */
  width: number;
  /** 出力画像の高さ（ピクセル） */
  height: number;
  /** 字幕の垂直位置（画像上端からの割合、0-1、デフォルト: 0.8） */
  verticalPosition?: number;
  /** 左右のパディング（ピクセル） */
  horizontalPadding?: number;
  /** スタイル設定 */
  style?: SubtitleStyle;
}

/**
 * 字幕画像バッチ生成結果
 */
export interface SubtitleBatchGenerateResult {
  /** 生成された画像一覧（入力テキストと同じ順序） */
  images: SubtitleGenerateResult[];
}

/**
 * 字幕生成 Gateway エラー
 */
export type SubtitleGeneratorGatewayError =
  | { type: 'INVALID_TEXT'; message: string }
  | { type: 'INVALID_DIMENSIONS'; message: string }
  | { type: 'FONT_NOT_FOUND'; fontFamily: string }
  | { type: 'FFMPEG_ERROR'; message: string; stderr?: string }
  | { type: 'GENERATION_FAILED'; message: string };

/**
 * Subtitle Generator Gateway
 * FFmpegを使用した字幕画像生成を行うインターフェース
 */
export interface SubtitleGeneratorGateway {
  /**
   * 字幕テキストから透明背景の画像を生成する
   * @param params 生成パラメータ
   * @returns 生成結果またはエラー
   */
  generate(
    params: SubtitleGenerateParams
  ): Promise<Result<SubtitleGenerateResult, SubtitleGeneratorGatewayError>>;

  /**
   * 複数の字幕テキストから画像をバッチ生成する
   * @param params バッチ生成パラメータ
   * @returns バッチ生成結果またはエラー
   */
  generateBatch(
    params: SubtitleBatchGenerateParams
  ): Promise<Result<SubtitleBatchGenerateResult, SubtitleGeneratorGatewayError>>;

  /**
   * 利用可能なフォント一覧を取得する
   * @returns フォントファミリー名の配列
   */
  listAvailableFonts(): Promise<string[]>;

  /**
   * デフォルトのスタイル設定を取得する
   * @returns デフォルトスタイル
   */
  getDefaultStyle(): SubtitleStyle;
}
