import type { Result } from '@shared/domain/types/result.js';

/**
 * 音声合成リクエストパラメータ
 */
export interface TtsSynthesizeParams {
  /** 読み上げるテキスト */
  text: string;
  /** 音声モデルID（話者選択） */
  voiceModelId?: string;
  /** 参照音声URL（STS用、話者の声をクローン） */
  referenceAudioUrl?: string;
}

/**
 * 音声合成結果
 */
export interface TtsSynthesizeResult {
  /** 生成された音声データ（Buffer） */
  audioBuffer: Buffer;
  /** 音声の長さ（ミリ秒） */
  durationMs: number;
  /** 音声フォーマット（例: 'mp3', 'wav'） */
  format: string;
  /** サンプルレート */
  sampleRate?: number;
}

/**
 * TTS Gateway エラー
 */
export type TtsGatewayError =
  | { type: 'INVALID_TEXT'; message: string }
  | { type: 'VOICE_MODEL_NOT_FOUND'; modelId: string }
  | { type: 'REFERENCE_AUDIO_INVALID'; message: string }
  | { type: 'SYNTHESIS_FAILED'; message: string }
  | { type: 'RATE_LIMIT_EXCEEDED'; retryAfterMs?: number }
  | { type: 'API_ERROR'; statusCode: number; message: string };

/**
 * TTS (Text-to-Speech) Gateway
 * 音声合成を行うインターフェース
 * TTS（テキスト→音声）とSTS（音声→音声、参照音声でスタイル転送）の両方をサポート
 */
export interface TtsGateway {
  /**
   * テキストから音声を合成する
   * @param params 合成パラメータ
   * @returns 合成結果またはエラー
   */
  synthesize(params: TtsSynthesizeParams): Promise<Result<TtsSynthesizeResult, TtsGatewayError>>;

  /**
   * 利用可能な音声モデル一覧を取得する
   * @returns 音声モデルID一覧
   */
  listVoiceModels(): Promise<string[]>;

  /**
   * 音声モデルが利用可能か確認する
   * @param modelId 音声モデルID
   * @returns 利用可能ならtrue
   */
  isVoiceModelAvailable(modelId: string): Promise<boolean>;
}
