# Vibe (Whisper) 文字起こし統合設計

## 目的

現行のGoogle Cloud Speech-to-Text API (Chirp 2) に加え、**Vibe (Whisper)** を新しい文字起こしバックエンドとして追加し、以下を実現する：

1. **コスト削減**: Vibeはローカル/オンプレミスで動作し、APIコストが発生しない
2. **プライバシー**: データがクラウドに送信されない（オフライン処理）
3. **高速処理**: GPU活用による高速な文字起こし（RTX 3060で1時間の音声を2.5分で処理）
4. **選択肢の提供**: 用途に応じてGoogle/Vibeを切り替え可能

## Vibeとは

[Vibe](https://github.com/thewh1teagle/vibe) は、OpenAI Whisperモデルを使用したオープンソースの文字起こしツール。

### 主な特徴

| 特徴 | 詳細 |
|------|------|
| オフライン動作 | データは外部に送信されない |
| マルチ言語対応 | 日本語を含む100以上の言語をサポート |
| GPU最適化 | NVIDIA, AMD, Intel GPUに対応 |
| 出力形式 | SRT, VTT, TXT, HTML, PDF, JSON, DOCX |
| CLI対応 | コマンドラインから直接実行可能 |
| HTTP API | `--server`モードでREST API提供（Swagger docs付き） |
| バッチ処理 | 複数ファイルの同時処理対応 |

### 技術スタック

- **エンジン**: whisper.cpp
- **フレームワーク**: Tauri (Rust + Web)
- **モデル**: OpenAI Whisper (ggml形式)

---

## スコープ

### 対象

1. **domain層**: `TranscriptionGateway` の既存インターフェースをそのまま利用
2. **infrastructure層**: `VibeClient` 新規実装（HTTP API方式）
3. **設定**: 環境変数による実装切り替え機構
4. **統合テスト**: VibeClientのintegration test

### スコープ外

- Vibe自体のインストール・デプロイ設計（別途ドキュメント）
- GUIアプリケーションとしてのVibe連携
- リアルタイムストリーミング文字起こし

---

## アーキテクチャ

### 現行構成

```
TranscriptionGateway (interface)
         ↓
SpeechToTextClient (Google Cloud Speech-to-Text v2 / Chirp 2)
```

### 新構成

```
TranscriptionGateway (interface)
         ↓
    ┌────┴────┐
    ↓         ↓
SpeechToTextClient    VibeClient
(Google Chirp 2)      (Whisper via HTTP API)
    ↓                     ↓
  GCP API            Vibe Server
                   (localhost:3022)
```

### 切り替え方式

```typescript
// 環境変数 TRANSCRIPTION_PROVIDER で切り替え
// "google" (default) | "vibe"

const transcriptionGateway: TranscriptionGateway =
  process.env.TRANSCRIPTION_PROVIDER === 'vibe'
    ? new VibeClient()
    : new SpeechToTextClient();
```

---

## 1. Domain層: TranscriptionGateway（変更なし）

既存の `TranscriptionGateway` インターフェースをそのまま利用する。

```typescript
// apps/backend/src/domain/gateways/transcription.gateway.ts
// 既存のまま変更不要

export interface TranscriptionGateway {
  transcribe(params: TranscribeParams): Promise<TranscriptionResult>;
  transcribeLongAudio(params: TranscribeParams): Promise<TranscriptionResult>;
  transcribeLongAudioFromGcsUri(params: TranscribeFromGcsParams): Promise<TranscriptionResult>;
}
```

### インターフェース互換性

| メソッド | Google実装 | Vibe実装 |
|----------|-----------|----------|
| `transcribe` | 同期API (10MB以下) | HTTP API |
| `transcribeLongAudio` | Batch API (GCS経由) | HTTP API (サイズ制限なし) |
| `transcribeLongAudioFromGcsUri` | Batch API (GCS URI) | GCSダウンロード→HTTP API |

---

## 2. Infrastructure層: VibeClient 新規実装

### 2.1 ファイル配置

```
apps/backend/src/infrastructure/clients/vibe.client.ts
```

### 2.2 Vibe HTTP API 仕様

Vibeを `--server` オプションで起動すると、HTTP APIが提供される。

```bash
# Vibe サーバー起動
vibe --server
# → http://localhost:3022 でAPI提供
# → http://localhost:3022/docs でSwagger UI
```

#### API エンドポイント（推定）

```
POST /transcribe
Content-Type: multipart/form-data

Parameters:
- file: 音声/動画ファイル
- language: 言語コード (optional, e.g., "ja")
- model: モデルパス (optional)
- format: 出力形式 (optional, default: "json")
- word_timestamps: 単語タイムスタンプ有効化 (optional)

Response (JSON format):
{
  "text": "全文テキスト",
  "segments": [
    {
      "text": "セグメントテキスト",
      "start": 0.0,
      "end": 2.5,
      "words": [
        { "word": "こんにちは", "start": 0.0, "end": 0.5, "probability": 0.95 }
      ]
    }
  ],
  "language": "ja"
}
```

### 2.3 実装設計

```typescript
// apps/backend/src/infrastructure/clients/vibe.client.ts

import FormData from 'form-data';
import type {
  TranscribeParams,
  TranscribeFromGcsParams,
  TranscriptionGateway,
  TranscriptionResult,
  TranscriptionSegment,
} from '../../domain/gateways/transcription.gateway.js';

interface VibeWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

interface VibeSegment {
  text: string;
  start: number;
  end: number;
  words?: VibeWord[];
}

interface VibeResponse {
  text: string;
  segments: VibeSegment[];
  language: string;
}

export class VibeClient implements TranscriptionGateway {
  private readonly baseUrl: string;
  private readonly modelPath: string | undefined;
  private readonly defaultLanguage: string;

  constructor() {
    this.baseUrl = process.env.VIBE_API_URL ?? 'http://localhost:3022';
    this.modelPath = process.env.VIBE_MODEL_PATH;
    this.defaultLanguage = process.env.VIBE_DEFAULT_LANGUAGE ?? 'ja';
  }

  /**
   * 音声ファイルから文字起こしを実行
   */
  async transcribe(params: TranscribeParams): Promise<TranscriptionResult> {
    return this.transcribeWithVibe(params.audioBuffer, params.languageCode);
  }

  /**
   * 長時間音声ファイルから文字起こしを実行
   * Vibeはファイルサイズ制限がないため、同じ処理
   */
  async transcribeLongAudio(params: TranscribeParams): Promise<TranscriptionResult> {
    return this.transcribeWithVibe(params.audioBuffer, params.languageCode);
  }

  /**
   * GCS上の音声ファイルから文字起こしを実行
   * GCSからダウンロードしてVibeで処理
   */
  async transcribeLongAudioFromGcsUri(
    params: TranscribeFromGcsParams
  ): Promise<TranscriptionResult> {
    const audioBuffer = await this.downloadFromGcs(params.gcsUri);
    return this.transcribeWithVibe(audioBuffer, params.languageCode);
  }

  private async transcribeWithVibe(
    audioBuffer: Buffer,
    languageCode?: string
  ): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });
    formData.append('language', this.mapLanguageCode(languageCode));
    formData.append('format', 'json');
    formData.append('word_timestamps', 'true');

    if (this.modelPath) {
      formData.append('model', this.modelPath);
    }

    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      body: formData as unknown as BodyInit,
      headers: formData.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Vibe API error: ${response.status} ${response.statusText}`);
    }

    const vibeResult: VibeResponse = await response.json();
    return this.convertToTranscriptionResult(vibeResult);
  }

  private convertToTranscriptionResult(vibeResult: VibeResponse): TranscriptionResult {
    const segments: TranscriptionSegment[] = [];
    let maxEndTime = 0;

    for (const segment of vibeResult.segments) {
      // 単語レベルのタイムスタンプがある場合はそれを使用
      if (segment.words && segment.words.length > 0) {
        for (const word of segment.words) {
          segments.push({
            text: word.word,
            startTimeSeconds: word.start,
            endTimeSeconds: word.end,
            confidence: word.probability,
          });
          if (word.end > maxEndTime) {
            maxEndTime = word.end;
          }
        }
      } else {
        // セグメントレベルのタイムスタンプを使用
        segments.push({
          text: segment.text,
          startTimeSeconds: segment.start,
          endTimeSeconds: segment.end,
          confidence: 1.0, // Whisperはセグメントレベルの確信度を提供しない場合がある
        });
        if (segment.end > maxEndTime) {
          maxEndTime = segment.end;
        }
      }
    }

    return {
      fullText: vibeResult.text,
      segments,
      languageCode: this.mapToLanguageCode(vibeResult.language),
      durationSeconds: maxEndTime,
    };
  }

  /**
   * 言語コードをVibe形式に変換
   * Google: "ja-JP" → Vibe: "ja"
   */
  private mapLanguageCode(languageCode?: string): string {
    if (!languageCode) return this.defaultLanguage;
    // "ja-JP" → "ja"
    return languageCode.split('-')[0];
  }

  /**
   * Vibe言語コードをGoogle形式に変換
   * Vibe: "ja" → Google: "ja-JP"
   */
  private mapToLanguageCode(vibeLanguage: string): string {
    const mapping: Record<string, string> = {
      ja: 'ja-JP',
      en: 'en-US',
      zh: 'zh-CN',
      ko: 'ko-KR',
      // 必要に応じて追加
    };
    return mapping[vibeLanguage] ?? vibeLanguage;
  }

  /**
   * GCSからファイルをダウンロード
   */
  private async downloadFromGcs(gcsUri: string): Promise<Buffer> {
    // GCS URI解析: gs://bucket/path → bucket, path
    const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid GCS URI: ${gcsUri}`);
    }

    const [, bucket, path] = match;
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const [buffer] = await storage.bucket(bucket).file(path).download();
    return buffer;
  }
}
```

### 2.4 環境変数

| 変数名 | 説明 | デフォルト値 | 例 |
|--------|------|--------------|-----|
| `TRANSCRIPTION_PROVIDER` | 使用するプロバイダー | `google` | `vibe` |
| `VIBE_API_URL` | Vibe HTTP APIのURL | `http://localhost:3022` | `http://vibe-server:3022` |
| `VIBE_MODEL_PATH` | 使用するWhisperモデルのパス | (なし、デフォルトモデル) | `/models/ggml-large-v3.bin` |
| `VIBE_DEFAULT_LANGUAGE` | デフォルト言語 | `ja` | `en` |

---

## 3. Provider Factory パターン

### 3.1 ファイル配置

```
apps/backend/src/infrastructure/factories/transcription-gateway.factory.ts
```

### 3.2 実装設計

```typescript
// apps/backend/src/infrastructure/factories/transcription-gateway.factory.ts

import type { TranscriptionGateway } from '../../domain/gateways/transcription.gateway.js';
import { SpeechToTextClient } from '../clients/speech-to-text.client.js';
import { VibeClient } from '../clients/vibe.client.js';

export type TranscriptionProvider = 'google' | 'vibe';

export function createTranscriptionGateway(
  provider?: TranscriptionProvider
): TranscriptionGateway {
  const selectedProvider = provider ??
    (process.env.TRANSCRIPTION_PROVIDER as TranscriptionProvider) ??
    'google';

  switch (selectedProvider) {
    case 'vibe':
      return new VibeClient();
    case 'google':
    default:
      return new SpeechToTextClient();
  }
}
```

### 3.3 DI Container への登録

```typescript
// apps/backend/src/infrastructure/di/container.ts (抜粋)

import { createTranscriptionGateway } from '../factories/transcription-gateway.factory.js';

// 既存の登録を変更
container.register('TranscriptionGateway', {
  useFactory: () => createTranscriptionGateway(),
});
```

---

## 4. 統合テスト設計

### 4.1 ファイル配置

```
apps/backend/test/integration/infrastructure/clients/vibe.client.test.ts
```

### 4.2 テストケース

| テストケース | 内容 | 前提条件 |
|-------------|------|----------|
| 短い日本語音声の文字起こし | 10秒程度のWAVファイルを文字起こし | Vibeサーバーが起動中 |
| タイムスタンプ取得確認 | セグメントにstart/endTimeが含まれること | 同上 |
| 単語レベルタイムスタンプ | word_timestamps有効時に単語単位の結果を返すこと | 同上 |
| 長時間音声の処理 | 5分以上の音声が正常に処理されること | 同上 |
| GCS URIからの処理 | GCSの音声ファイルを正常に処理できること | Vibeサーバー + GCS認証情報 |
| 言語コード変換 | ja-JP ↔ ja の変換が正しいこと | 同上 |

### 4.3 テスト実行条件

```typescript
// test/integration/infrastructure/clients/vibe.client.test.ts

const VIBE_API_URL = process.env.VIBE_API_URL ?? 'http://localhost:3022';

describe('VibeClient Integration Tests', () => {
  let vibeAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetch(`${VIBE_API_URL}/health`);
      vibeAvailable = response.ok;
    } catch {
      vibeAvailable = false;
    }
  });

  const itIfVibeAvailable = vibeAvailable ? it : it.skip;

  itIfVibeAvailable('should transcribe short Japanese audio', async () => {
    // テスト実装
  });
});
```

---

## 5. 比較表

### 5.1 機能比較

| 機能 | Google Speech-to-Text | Vibe (Whisper) |
|------|----------------------|----------------|
| オフライン動作 | No | Yes |
| APIコスト | あり（従量課金） | なし |
| セットアップ | GCP設定のみ | サーバーデプロイ必要 |
| 処理速度 | 高速 | GPU依存（GPU有りで高速） |
| 最大音声長 | 480分 | 制限なし |
| 言語自動検出 | Yes | Yes |
| 単語タイムスタンプ | Yes | Yes |
| カスタム辞書 | Yes (Speech Adaptation) | No (プロンプトで対応) |
| 精度 | 非常に高い (Chirp 2) | 高い (Whisper large-v3) |

### 5.2 ユースケース別推奨

| ユースケース | 推奨プロバイダー | 理由 |
|-------------|-----------------|------|
| 本番環境・高精度重視 | Google | Chirp 2の精度、SLA、Speech Adaptation |
| 開発環境・コスト削減 | Vibe | APIコストなし、ローカル実行 |
| オフライン要件あり | Vibe | データがクラウドに送信されない |
| 大量処理・バッチ | Vibe | 従量課金なし |
| 日本語固有名詞重視 | Google | Speech Adaptationで辞書登録可能 |

---

## 6. Vibeサーバーデプロイ設計（概要）

### 6.1 Docker Compose 構成例

```yaml
# docker-compose.vibe.yml

version: '3.8'

services:
  vibe:
    image: ghcr.io/thewh1teagle/vibe:latest  # 要確認
    ports:
      - "3022:3022"
    volumes:
      - ./models:/models:ro
    environment:
      - VIBE_MODEL=/models/ggml-large-v3.bin
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    command: ["--server", "--host", "0.0.0.0"]
```

### 6.2 Cloud Run（GPU）デプロイ

```bash
# GPU付きCloud Runでのデプロイ（要確認）
gcloud run deploy vibe-server \
  --image=ghcr.io/thewh1teagle/vibe:latest \
  --cpu=4 \
  --memory=16Gi \
  --gpu=1 \
  --gpu-type=nvidia-l4 \
  --port=3022 \
  --allow-unauthenticated
```

---

## 7. 実装ファイル一覧

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `apps/backend/src/infrastructure/clients/vibe.client.ts` | 新規 | Vibe HTTP API クライアント |
| `apps/backend/src/infrastructure/factories/transcription-gateway.factory.ts` | 新規 | プロバイダーファクトリー |
| `apps/backend/test/integration/infrastructure/clients/vibe.client.test.ts` | 新規 | Vibe統合テスト |
| `apps/backend/src/infrastructure/di/container.ts` | 修正 | DIコンテナへの登録変更 |

---

## 8. 移行計画

### Phase 1: 実装・テスト

1. `VibeClient` 実装
2. `TranscriptionGatewayFactory` 実装
3. 統合テスト作成・実行
4. 開発環境でVibeサーバー起動・動作確認

### Phase 2: 開発環境導入

1. 開発環境に `TRANSCRIPTION_PROVIDER=vibe` を設定
2. チームで動作検証
3. 品質比較（Google vs Vibe）

### Phase 3: 本番環境（オプション）

1. Vibeサーバーの本番デプロイ設計
2. 負荷テスト・耐障害性検証
3. フォールバック機構の実装（Vibe障害時にGoogleへ切り替え）

---

## 9. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Vibe HTTP API仕様の変更 | クライアント動作不能 | バージョン固定、APIレスポンス検証 |
| Vibeサーバーダウン | 文字起こし失敗 | フォールバック機構、ヘルスチェック |
| 精度がGoogleより低い | 品質低下 | 用途に応じた使い分け、LLM精緻化で補完 |
| GPU不足時の処理遅延 | タイムアウト | タイムアウト設定、キュー管理 |

---

## 10. 参考リンク

- [Vibe GitHub](https://github.com/thewh1teagle/vibe)
- [Vibe 公式サイト](https://thewh1teagle.github.io/vibe/)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- [OpenAI Whisper](https://github.com/openai/whisper)
