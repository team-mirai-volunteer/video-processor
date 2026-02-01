import type { Result } from '@shared/domain/types/result.js';

/**
 * 参照画像（スタイル・キャラクター一貫性のため）
 */
export interface ReferenceImage {
  /** 画像データ（Buffer） */
  imageBuffer: Buffer;
  /** MIMEタイプ（例: 'image/png', 'image/jpeg'） */
  mimeType: string;
  /** キャラクターの説明（プロンプトに含める） */
  description?: string;
}

/**
 * 画像生成リクエストパラメータ
 */
export interface ImageGenParams {
  /** 画像生成プロンプト */
  prompt: string;
  /** ネガティブプロンプト（除外したい要素） */
  negativePrompt?: string;
  /** 画像の幅（ピクセル） */
  width: number;
  /** 画像の高さ（ピクセル） */
  height: number;
  /** スタイル指定（モデル固有） */
  style?: string;
  /** シード値（再現性のため） */
  seed?: number;
  /** 参照画像（スタイル・キャラクター一貫性のため） */
  referenceImages?: ReferenceImage[];
}

/**
 * 画像生成結果
 */
export interface ImageGenResult {
  /** 生成された画像データ（Buffer） */
  imageBuffer: Buffer;
  /** 画像フォーマット（例: 'png', 'jpg'） */
  format: string;
  /** 画像の幅（ピクセル） */
  width: number;
  /** 画像の高さ（ピクセル） */
  height: number;
  /** 使用されたシード値 */
  seed?: number;
  /** 修正されたプロンプト（安全フィルタ等） */
  revisedPrompt?: string;
}

/**
 * 画像生成 Gateway エラー
 */
export type ImageGenGatewayError =
  | { type: 'INVALID_PROMPT'; message: string }
  | { type: 'INVALID_DIMENSIONS'; message: string }
  | { type: 'CONTENT_POLICY_VIOLATION'; message: string }
  | { type: 'GENERATION_FAILED'; message: string }
  | { type: 'RATE_LIMIT_EXCEEDED'; retryAfterMs?: number }
  | { type: 'API_ERROR'; statusCode: number; message: string };

/**
 * Image Generation Gateway
 * AI画像生成を行うインターフェース
 */
export interface ImageGenGateway {
  /**
   * プロンプトから画像を生成する
   * @param params 生成パラメータ
   * @returns 生成結果またはエラー
   */
  generate(params: ImageGenParams): Promise<Result<ImageGenResult, ImageGenGatewayError>>;

  /**
   * サポートされている画像サイズ一覧を取得する
   * @returns サポートされている幅と高さの組み合わせ
   */
  getSupportedDimensions(): { width: number; height: number }[];

  /**
   * サポートされているスタイル一覧を取得する
   * @returns スタイル名の配列
   */
  getSupportedStyles(): string[];
}
