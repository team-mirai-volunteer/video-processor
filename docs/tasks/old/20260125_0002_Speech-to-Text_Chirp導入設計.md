# Google Speech-to-Text v2 (Chirp) 導入設計

## 目的

動画処理フローにおいて、**文字起こしの精度向上**と**処理コストの最適化**を実現するため。

現状のGeminiマルチモーダル入力（動画URL直接渡し）では：
- 文字起こし精度がLLMの汎用性に依存している
- 動画全体をLLMに渡すコストが高い
- 長時間動画でのタイムスタンプ精度に限界がある

## スコープ

本設計では以下を対象とする：

1. **domain層**: `TranscriptionGateway` インターフェース定義
2. **infrastructure層**: `SpeechToTextClient` 実装
3. **infrastructure層**: `FFmpegClient` への音声抽出メソッド追加
4. **統合テスト**: 上記クライアントのintegration test

**スコープ外**:
- `ProcessVideoUseCase` の改修（本設計承認後に別途実施）
- `GeminiClient` の改修（文字起こし済みテキストを受け取る形への変更）

---

## 新しい処理フロー（概要）

```
現状:
  動画URL → Gemini（動画分析 + 文字起こし + クリップ選定）

改善後:
  動画ダウンロード → FFmpeg音声抽出 → Speech-to-Text (Chirp)
                                            ↓
                                      タイムスタンプ付き文字起こし
                                            ↓
                              Gemini（テキストベースでクリップ選定）
```

---

## 1. Domain層: TranscriptionGateway

### 1.1 ファイル配置

```
apps/backend/src/domain/gateways/transcription.gateway.ts
```

### 1.2 インターフェース定義

```typescript
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
```

### 1.3 設計判断

| 項目 | 決定 | 理由 |
|------|------|------|
| セグメント粒度 | 単語/フレーズ単位 | Chirpのword_time_offsetsを活用し、クリップ切り出し時の精度を確保 |
| 音声フォーマット | WAV/FLAC | Speech-to-Text APIの推奨フォーマット。FLACは圧縮率が高く長時間音声向き |
| 言語指定 | オプショナル | 日本語メインだが、自動検出も可能にしておく |

---

## 2. Infrastructure層: SpeechToTextClient

### 2.1 ファイル配置

```
apps/backend/src/infrastructure/clients/speech-to-text.client.ts
```

### 2.2 使用API

**Google Cloud Speech-to-Text API v2** を使用

- モデル: `chirp` (最新の高精度モデル)
- 特徴:
  - 100以上の言語をサポート
  - 単語レベルのタイムスタンプ
  - 高い文字起こし精度

### 2.3 依存パッケージ

```json
{
  "@google-cloud/speech": "^6.x"
}
```

### 2.4 環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `GOOGLE_CLOUD_PROJECT` | GCPプロジェクトID | `video-processor-prod` |
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントキーのパス | `/path/to/key.json` |
| `SPEECH_TO_TEXT_LOCATION` | リージョン（省略時: `asia-northeast1`） | `asia-northeast1` |

### 2.5 実装方針

1. **長時間音声対応**: 60秒を超える音声は `LongRunningRecognize` を使用
2. **エラーハンドリング**: API制限・タイムアウトを適切にハンドリング
3. **リトライ**: 一時的なエラーに対するexponential backoff

---

## 3. Infrastructure層: FFmpegClient 拡張

### 3.1 追加メソッド

`VideoProcessingService` インターフェースに以下を追加：

```typescript
// apps/backend/src/application/services/video-processing.service.ts に追加

/**
 * 動画から音声を抽出
 * @param videoBuffer 動画データ
 * @param format 出力フォーマット ('wav' | 'flac')
 * @returns 音声データ
 */
extractAudio(
  videoBuffer: Buffer,
  format: 'wav' | 'flac'
): Promise<Buffer>;
```

### 3.2 FFmpegコマンド

```bash
# WAV出力 (16kHz mono, 16bit)
ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 output.wav

# FLAC出力 (16kHz mono)
ffmpeg -i input.mp4 -vn -acodec flac -ar 16000 -ac 1 output.flac
```

### 3.3 設計判断

| 項目 | 決定 | 理由 |
|------|------|------|
| サンプルレート | 16kHz | Speech-to-Text推奨値、音声認識に十分な品質 |
| チャンネル数 | モノラル | 音声認識にステレオは不要 |
| フォーマット | WAV/FLAC選択可 | 短い音声はWAV、長い音声はFLACで圧縮 |

---

## 4. 統合テスト設計

### 4.1 テストファイル配置

```
apps/backend/test/integration/infrastructure/clients/
├── speech-to-text.client.test.ts
└── ffmpeg.client.test.ts  # 既存に追加
```

### 4.2 SpeechToTextClient テストケース

| テストケース | 内容 | 前提条件 |
|-------------|------|----------|
| 短い日本語音声の文字起こし | 10秒程度のWAVファイルを文字起こし | `GOOGLE_APPLICATION_CREDENTIALS` が設定済み |
| タイムスタンプ取得確認 | セグメントにstart/endTimeが含まれること | 同上 |
| 長時間音声のLongRunning処理 | 60秒超の音声でLongRunningRecognizeが動作すること | 同上 |
| 不正な音声データのエラー | 壊れたデータでエラーがthrowされること | 同上 |

### 4.3 FFmpegClient（音声抽出）テストケース

| テストケース | 内容 | 前提条件 |
|-------------|------|----------|
| MP4からWAV抽出 | 動画からWAV音声を抽出できること | FFmpegがインストール済み |
| MP4からFLAC抽出 | 動画からFLAC音声を抽出できること | 同上 |
| 出力音声の仕様確認 | 16kHz/mono/16bit であること | 同上 |

### 4.4 テスト用リソース

```
apps/backend/test/fixtures/
├── sample-10s.mp4    # 10秒の日本語音声付き動画
└── sample-10s.wav    # 上記から抽出した音声（比較用）
```

### 4.5 テスト実行条件

- `GOOGLE_APPLICATION_CREDENTIALS` が設定されている場合のみSpeech-to-Textテストを実行
- FFmpegがパスに存在する場合のみFFmpegテストを実行
- CI環境ではSecret設定により制御

---

## 5. 実装ファイル一覧

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `apps/backend/src/domain/gateways/transcription.gateway.ts` | 新規 | 文字起こしゲートウェイIF |
| `apps/backend/src/infrastructure/clients/speech-to-text.client.ts` | 新規 | Speech-to-Text実装 |
| `apps/backend/src/application/services/video-processing.service.ts` | 修正 | `extractAudio`メソッド追加 |
| `apps/backend/src/infrastructure/clients/ffmpeg.client.ts` | 修正 | `extractAudio`実装 |
| `apps/backend/test/integration/infrastructure/clients/speech-to-text.client.test.ts` | 新規 | Speech-to-Text統合テスト |
| `apps/backend/test/integration/infrastructure/clients/ffmpeg.client.test.ts` | 新規 | FFmpeg統合テスト |
| `apps/backend/test/fixtures/sample-10s.mp4` | 新規 | テスト用動画 |

---

## 6. 依存関係の追加

`apps/backend/package.json` に追加:

```json
{
  "dependencies": {
    "@google-cloud/speech": "^6.7.0"
  }
}
```

---

## 7. 次のステップ（本設計スコープ外）

本設計の実装完了後、以下を別途実施：

1. `ProcessVideoUseCase` の改修
   - 音声抽出 → 文字起こし → Geminiの流れに変更
2. `GeminiClient` の改修
   - 動画URLではなく、文字起こしテキストを受け取る形に変更
3. `ClipExtractionResponse` の拡張
   - Geminiがセグメントのタイムスタンプを参照できるようプロンプト改修
