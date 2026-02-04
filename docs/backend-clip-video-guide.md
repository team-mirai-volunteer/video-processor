# clip-video バックエンド開発ガイド

clip-video機能のバックエンド修正用コンテキスト

## ディレクトリ構成

```
apps/backend/src/contexts/clip-video/
├── presentation/routes/         # APIエンドポイント
│   ├── index.ts                 # ルートエントリーポイント
│   ├── videos.ts                # ビデオCRUD・処理実行
│   └── clips.ts                 # クリップ取得
│
├── application/
│   ├── errors/                  # エラー定義
│   │   ├── errors.ts            # 基本エラー (Validation, NotFound, Conflict)
│   │   └── clip.errors.ts       # クリップ抽出特有のエラーコード
│   │
│   └── usecases/                # ビジネスロジック
│       ├── submit-video.usecase.ts        # Google Drive URLからビデオ登録
│       ├── get-videos.usecase.ts          # ビデオ一覧取得
│       ├── get-video.usecase.ts           # ビデオ詳細取得
│       ├── delete-video.usecase.ts        # ビデオ削除
│       ├── reset-video.usecase.ts         # ビデオを初期状態にリセット
│       ├── cache-video.usecase.ts         # Google Drive → GCS キャッシュ
│       ├── extract-audio.usecase.ts       # キャッシュビデオから音声抽出
│       ├── create-transcript.usecase.ts   # 音声抽出→トランスクリプション統合
│       ├── transcribe-audio.usecase.ts    # Speech-to-Text でテキスト化
│       ├── refine-transcript.usecase.ts   # AIで固有名詞修正・文単位整形
│       ├── extract-clips.usecase.ts       # AI分析でクリップ位置特定・抽出
│       ├── get-clips.usecase.ts           # ビデオ/クリップ単位で取得
│       └── get-all-clips.usecase.ts       # 全クリップ取得（ページネーション）
│
├── domain/
│   ├── models/                  # ドメインモデル
│   │   ├── video.ts             # ビデオエンティティ
│   │   ├── clip.ts              # クリップエンティティ
│   │   ├── transcription.ts     # 音声認識結果
│   │   ├── refined-transcription.ts  # 精製されたトランスクリプション
│   │   └── processing-job.ts    # クリップ抽出処理ジョブ
│   │
│   ├── services/                # ドメインサービス
│   │   ├── clip-analysis-prompt.service.ts       # クリップ分析AIプロンプト生成・解析
│   │   ├── transcript-refinement-prompt.service.ts  # トランスクリプト精製プロンプト
│   │   ├── srt-converter.service.ts              # SRT字幕フォーマット変換
│   │   └── timestamp-extractor.service.ts        # AIレスポンスからタイムスタンプ抽出
│   │
│   └── gateways/                # インターフェース定義
│       ├── video-repository.gateway.ts
│       ├── clip-repository.gateway.ts
│       ├── transcription-repository.gateway.ts
│       ├── refined-transcription-repository.gateway.ts
│       ├── processing-job-repository.gateway.ts
│       ├── transcription.gateway.ts      # Speech-to-Text API (shared再エクスポート)
│       ├── ai.gateway.ts                 # AI API (shared再エクスポート)
│       ├── storage.gateway.ts            # Google Drive/GCS (shared再エクスポート)
│       ├── temp-storage.gateway.ts       # 一時ストレージ (shared再エクスポート)
│       └── video-processing.gateway.ts   # FFmpeg処理 (shared再エクスポート)
│
└── infrastructure/
    └── repositories/            # Gateway実装 (Prisma)
        ├── video.repository.ts
        ├── clip.repository.ts
        ├── transcription.repository.ts
        ├── refined-transcription.repository.ts
        └── processing-job.repository.ts
```

## 処理フローと実装の対応

### メイン処理フロー

```
ビデオ登録 → キャッシュ → 音声抽出 → トランスクリプション作成
                                      ↓
                              トランスクリプション精製 → クリップ抽出 → アップロード
```

### ステップと実装の対応

| Step | Route | UseCase | 外部Gateway |
|------|-------|---------|-------------|
| ① ビデオ登録 | POST /api/videos | submit-video | storage (Google Drive) |
| ② キャッシュ | PATCH /api/videos/:id/cache | cache-video | storage (GCS) |
| ③ 音声抽出 | PATCH /api/videos/:id/extract-audio | extract-audio | video-processing (FFmpeg) |
| ④ トランスクリプション | PATCH /api/videos/:id/transcribe | transcribe-audio | transcription (Speech-to-Text) |
| ⑤ 精製 | PATCH /api/videos/:id/refine | refine-transcript | ai (Gemini) |
| ⑥ クリップ抽出 | PATCH /api/videos/:id/extract-clips | extract-clips | ai (Gemini), video-processing (FFmpeg) |

### 統合処理

| Route | UseCase | 説明 |
|-------|---------|------|
| PATCH /api/videos/:id/create-transcript | create-transcript | ③〜④を一括実行 |

## レイヤー間の依存

```
Route → UseCase → Gateway(interface) ← Repository/Client(実装)
```

- **UseCase**: Gatewayインターフェースにのみ依存
- **Repository**: Gatewayを実装、Prismaに依存
- **Client**: shared BCのクライアント実装を利用（AI, Storage, FFmpeg等）
- **DI**: routesでインスタンス化して注入

## 主要な型 (domain/models)

```typescript
// Video
Video {
  id, googleDriveFileId, googleDriveUrl,
  status: VideoStatus,           // 'pending' | 'caching' | 'cached' | 'transcribing' | 'transcribed' | 'extracting_clips' | 'completed' | 'error'
  transcriptionPhase: TranscriptionPhase | null,  // 詳細な進捗フェーズ
  durationSeconds: number | null,
  gcsUri: string | null,         // キャッシュ済みビデオのGCS URI
  audioGcsUri: string | null,    // 抽出済み音声のGCS URI
}

// Clip
Clip {
  id, videoId,
  startTimeSeconds, endTimeSeconds, durationSeconds,  // 20〜60秒
  status: ClipStatus,            // 'pending' | 'uploading' | 'uploaded' | 'error'
  googleDriveFileId: string | null,
  googleDriveUrl: string | null,
}

// Transcription
Transcription {
  id, videoId, fullText, languageCode, durationSeconds,
  segments: TranscriptionSegment[],  // { text, startTimeSeconds, endTimeSeconds, confidence }
}

// RefinedTranscription
RefinedTranscription {
  id, videoId, dictionaryVersion,
  sentences: RefinedSentence[],  // { text, startTimeSeconds, endTimeSeconds, originalSegmentIndices }
}

// ProcessingJob
ProcessingJob {
  id, videoId, clipInstructions,
  status: ProcessingJobStatus,   // 'pending' | 'analyzing' | 'extracting' | 'uploading' | 'completed' | 'failed'
  aiResponse: string | null,     // AI解析結果のJSON
  startedAt, completedAt,
}
```

## ドメインサービス

### ClipAnalysisPromptService

AI（Gemini）にクリップ位置を分析させるためのプロンプト生成・レスポンス解析を担当。

```typescript
class ClipAnalysisPromptService {
  // 精製トランスクリプション + クリップ指示 → AIプロンプト生成
  buildPrompt(params: ClipAnalysisPromptParams): string

  // AIレスポンス（JSON）を解析 → クリップ情報抽出
  parseResponse(response: string): ClipExtractionResponse
}
```

### TranscriptRefinementPromptService

音声認識結果をAIで校正・文単位に整形するためのプロンプト生成。

```typescript
class TranscriptRefinementPromptService {
  // 大規模セグメントをチャンク分割（LLM処理効率化）
  splitIntoChunks(segments, chunkSize): SegmentChunk[]

  // 固有名詞辞書 + セグメント → 校正プロンプト生成
  buildChunkPrompt(chunk, segments, dictionary): string
}
```

## エラーハンドリング

| 層 | 方式 |
|----|------|
| domain | `Result<T, E>` を返す |
| application | throw `ApplicationError` |
| infrastructure | throw |
| presentation | catch → HTTP response |

### エラークラス

```typescript
// 基本エラー (application/errors/errors.ts)
ValidationError   // 400
NotFoundError     // 404
ConflictError     // 409

// クリップ抽出特有のエラーコード (application/errors/clip.errors.ts)
CLIP_ERROR_CODES = {
  VIDEO_NOT_FOUND,
  TRANSCRIPTION_NOT_FOUND,
  REFINED_TRANSCRIPTION_NOT_FOUND,
  AI_ANALYSIS_FAILED,
  VIDEO_FETCH_FAILED,
  CLIP_EXTRACTION_FAILED,
  CLIP_UPLOAD_FAILED,
  GCS_DOWNLOAD_FAILED,
  TEMP_FILE_CREATION_FAILED,
  FFMPEG_EXTRACTION_FAILED,
}
```

## 共有Gateway（shared BC）

clip-video BCは、以下のGatewayをshared BCから再エクスポートして利用:

| Gateway | 用途 | 実装 (shared BC) |
|---------|------|------------------|
| `TranscriptionGateway` | Speech-to-Text API | google-speech.client.ts |
| `AiGateway` | Gemini API | gemini-ai.client.ts |
| `StorageGateway` | Google Drive / GCS | google-drive.client.ts, gcs.client.ts |
| `TempStorageGateway` | 一時ファイル管理 | temp-storage.client.ts |
| `VideoProcessingGateway` | FFmpeg処理 | ffmpeg.client.ts |

## 修正時のポイント

1. **APIエンドポイント変更**: `presentation/routes/` 配下
2. **ビジネスロジック変更**: `application/usecases/` 配下
3. **ドメインモデル変更**: `domain/models/` 配下
4. **AIプロンプト変更**: `domain/services/` 配下
5. **DB操作変更**: `infrastructure/repositories/` 配下
6. **外部API連携変更**: `contexts/shared/infrastructure/clients/` 配下

## テスト

```bash
# ユニットテスト (domain, application)
pnpm --filter backend test:unit

# 統合テスト (infrastructure)
pnpm --filter backend test:integration
```

## APIエンドポイント一覧

### Videos

| Method | Path | 説明 |
|--------|------|------|
| POST | /api/videos | ビデオ登録 |
| GET | /api/videos | ビデオ一覧（ページネーション） |
| GET | /api/videos/:id | ビデオ詳細 |
| DELETE | /api/videos/:id | ビデオ削除 |
| PATCH | /api/videos/:id/reset | 初期状態にリセット |
| PATCH | /api/videos/:id/cache | GCSキャッシュ開始 |
| PATCH | /api/videos/:id/extract-audio | 音声抽出 |
| PATCH | /api/videos/:id/transcribe | トランスクリプション作成 |
| PATCH | /api/videos/:id/create-transcript | 音声抽出〜トランスクリプション統合 |
| PATCH | /api/videos/:id/refine | トランスクリプション精製 |
| PATCH | /api/videos/:id/extract-clips | クリップ抽出 |

### Clips

| Method | Path | 説明 |
|--------|------|------|
| GET | /api/clips | 全クリップ取得（ページネーション） |
| GET | /api/videos/:videoId/clips | ビデオ別クリップ取得 |
| GET | /api/clips/:id | クリップ詳細 |
