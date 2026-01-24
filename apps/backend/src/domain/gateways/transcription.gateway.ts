/**
 * 文字起こし結果の1セグメント
 * Speech-to-Text APIから返される単語/フレーズ単位の結果
 */
export interface TranscriptionSegment {
  /** 発話内容 */
  text: string;
  /** 開始時間（秒） */
  startTimeSeconds: number;
  /** 終了時間（秒） */
  endTimeSeconds: number;
  /** 信頼度スコア (0.0 - 1.0) */
  confidence: number;
}

/**
 * 文字起こし結果全体
 */
export interface TranscriptionResult {
  /** 全文（セグメントを結合したもの） */
  fullText: string;
  /** タイムスタンプ付きセグメント */
  segments: TranscriptionSegment[];
  /** 検出された言語コード (e.g., "ja-JP") */
  languageCode: string;
  /** 音声の総時間（秒） */
  durationSeconds: number;
}

/**
 * 文字起こしパラメータ
 */
export interface TranscribeParams {
  /** 音声データ (WAV or FLAC) */
  audioBuffer: Buffer;
  /** MIMEタイプ */
  mimeType: 'audio/wav' | 'audio/flac';
  /** サンプルレート (Hz) - 省略時は自動検出 */
  sampleRateHertz?: number;
  /** 言語ヒント (省略時は自動検出) */
  languageCode?: string;
}

/**
 * 文字起こしゲートウェイ
 */
export interface TranscriptionGateway {
  /**
   * 音声ファイルから文字起こしを実行
   * @throws TranscriptionError 文字起こし失敗時
   */
  transcribe(params: TranscribeParams): Promise<TranscriptionResult>;
}
