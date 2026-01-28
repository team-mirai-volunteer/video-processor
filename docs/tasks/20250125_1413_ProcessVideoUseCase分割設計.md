# ProcessVideoUseCase 分割設計

## 目的

ユーザーが以下の状態を実現するため:
1. **1回のトランスクリプト作成 → 複数回の切り抜き試行**: トランスクリプトを一度作れば、異なる切り抜き箇所を何度も試せる
2. **処理時間・コスト最適化**: トランスクリプト作成と動画切り抜きを別タイミングで実行し、リソース効率を向上
3. **エラー時の再実行効率化**: 切り抜き失敗時にトランスクリプト作成からやり直さずに済む

## 現状の課題

### 現在のProcessVideoUseCaseの処理フロー

```
execute(processingJobId)
├── 1. Google Driveから動画ダウンロード (Buffer)
├── 2. 音声抽出 (FFmpeg)
├── 3. 文字起こし (Speech-to-Text Batch API)
├── 4. AI分析 (切り抜き箇所提案)
├── 5. 切り抜き動画作成 (FFmpeg)
└── 6. Google Driveにアップロード
```

**問題点**:
- 処理が一体化しており、途中から再開できない
- 切り抜き失敗時に文字起こしからやり直しが必要
- 異なる切り抜き条件で試すたびに全処理が必要
- 動画データはメモリ上のみで保持され、処理完了後は消失

### 動画ファイルの現在の扱い

| 段階 | 保存場所 | 永続性 |
|------|----------|--------|
| Google Driveからダウンロード | メモリ (Buffer) | 処理中のみ |
| FFmpeg処理時 | OS一時ディレクトリ | 処理後に削除 |
| 切り抜き動画 | Google Drive | 永続 |

## 設計方針

### UseCase分割（既存は削除）

```
[現在]
ProcessVideoUseCase  ─→  削除

[新規]
CreateTranscriptUseCase  ─→  トランスクリプト作成
ExtractClipsUseCase      ─→  切り抜き動画作成
```

### フェーズ1: CreateTranscriptUseCase

**責務**: 動画URLからタイムスタンプ付きトランスクリプトを作成・保存

**入力**:
- `videoId` (既存のVideoレコード)

**処理フロー**:
```
1. Google Driveから動画ダウンロード
2. GCSに動画を一時保存（後続処理で再利用）
3. 音声抽出
4. Speech-to-Text実行
5. TranscriptionをDBに保存
6. Videoステータス更新 (transcribed)
```

**出力**:
- DB: Transcriptionレコード（新規テーブル）
- GCS: 一時保存された動画ファイル（ライフサイクルで自動削除）

### フェーズ2: ExtractClipsUseCase

**責務**: トランスクリプト済み動画から切り抜き動画を作成

**入力**:
- `videoId`
- `clipInstructions` (切り抜き指示)

**処理フロー**:
```
1. Transcriptionを取得
2. AI分析（切り抜き箇所提案）
3. GCSから動画を取得（なければGoogle Driveから再ダウンロード）
4. 切り抜き動画作成
5. Google Driveにアップロード
6. Clipレコード作成
```

**出力**:
- Google Drive: 切り抜き動画
- DB: Clipレコード

## データモデル変更

### 新規テーブル: Transcription

```prisma
model Transcription {
  id              String   @id @default(uuid())
  videoId         String   @unique @map("video_id")
  fullText        String   @map("full_text")
  segments        Json     // TranscriptionSegment[]
  languageCode    String   @map("language_code")
  durationSeconds Decimal  @map("duration_seconds") @db.Decimal(10, 3)
  createdAt       DateTime @default(now()) @map("created_at")

  video Video @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@map("transcriptions")
}
```

### Videoテーブル変更

```prisma
model Video {
  // 既存フィールド...

  // 追加フィールド
  gcsUri          String?  @map("gcs_uri")          // GCS一時保存先
  gcsExpiresAt    DateTime? @map("gcs_expires_at")  // GCS有効期限

  // リレーション追加
  transcription   Transcription?
}
```

### Videoステータス変更

```
[現在]
pending → processing → completed/failed

[変更後]
pending → transcribing → transcribed → extracting → completed/failed
```

| ステータス | 説明 |
|-----------|------|
| pending | 動画登録済み、処理待ち |
| transcribing | トランスクリプト作成中 |
| transcribed | トランスクリプト完了、切り抜き待ち |
| extracting | 切り抜き動画作成中 |
| completed | 全処理完了 |
| failed | エラー発生 |

## GCS一時保存設計

### バケット設計

- **バケット名**: `{project-id}-video-processor-temp`
- **ライフサイクルポリシー**: 7日後に自動削除
- **パス**: `videos/{videoId}/original.mp4`

### TempStorageGateway（新規）

```typescript
// domain/gateways/temp-storage.gateway.ts
export interface TempStorageGateway {
  upload(params: {
    videoId: string;
    content: Buffer;
  }): Promise<{ gcsUri: string; expiresAt: Date }>;

  download(gcsUri: string): Promise<Buffer>;

  exists(gcsUri: string): Promise<boolean>;
}
```

### フォールバック戦略

```typescript
async getVideoBuffer(video: Video): Promise<Buffer> {
  // 1. GCSに存在するか確認
  if (video.gcsUri && await this.existsInTempStorage(video.gcsUri)) {
    return this.downloadFromTempStorage(video.gcsUri);
  }

  // 2. なければGoogle Driveから再ダウンロード
  const buffer = await this.downloadFile(video.googleDriveFileId);

  // 3. GCSに保存（次回のため）
  const { gcsUri, expiresAt } = await this.uploadToTempStorage({
    videoId: video.id,
    content: buffer,
    filename: 'original.mp4',
  });

  // 4. VideoレコードにGCS情報を保存
  await this.videoRepository.save(video.withGcsInfo(gcsUri, expiresAt));

  return buffer;
}
```

## API設計

### 削除するエンドポイント

```
POST /api/processing-jobs  ─→  削除
```

### 変更するエンドポイント

```
POST /api/videos
  - 動画登録のみ（処理は開始しない）
  - リクエスト: { googleDriveUrl }  ← clipInstructions削除
  - レスポンス: { id, googleDriveFileId, googleDriveUrl, status, createdAt }
```

### 新規エンドポイント

```
POST /api/videos/:videoId/transcribe
  - CreateTranscriptUseCaseを実行
  - レスポンス: { videoId, status }

POST /api/videos/:videoId/extract-clips
  - ExtractClipsUseCaseを実行
  - リクエスト: { clipInstructions }
  - レスポンス: { videoId, status }

GET /api/videos/:videoId/transcription
  - トランスクリプト取得
  - レスポンス: { id, videoId, fullText, segments, languageCode, durationSeconds }
```

## エラーパターン

### CreateTranscriptUseCase

| エラーコード | 説明 | severity |
|-------------|------|----------|
| `VIDEO_NOT_FOUND` | 指定されたvideoIdが存在しない | error |
| `VIDEO_DOWNLOAD_FAILED` | Google Driveからのダウンロード失敗 | error |
| `AUDIO_EXTRACTION_FAILED` | FFmpegでの音声抽出失敗 | error |
| `TRANSCRIPTION_FAILED` | Speech-to-Text API失敗 | error |
| `GCS_UPLOAD_FAILED` | GCSへの一時保存失敗 | warning |

### ExtractClipsUseCase

| エラーコード | 説明 | severity |
|-------------|------|----------|
| `VIDEO_NOT_FOUND` | 指定されたvideoIdが存在しない | error |
| `TRANSCRIPTION_NOT_FOUND` | トランスクリプトが未作成 | error |
| `AI_ANALYSIS_FAILED` | AI分析失敗 | error |
| `VIDEO_FETCH_FAILED` | GCS/Google Driveからの動画取得失敗 | error |
| `CLIP_EXTRACTION_FAILED` | FFmpegでの切り抜き失敗 | error |
| `CLIP_UPLOAD_FAILED` | Google Driveへのアップロード失敗 | error |

### エラー型定義

```typescript
// apps/backend/src/application/errors/transcript.errors.ts
export const TRANSCRIPT_ERROR_CODES = {
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  VIDEO_DOWNLOAD_FAILED: 'VIDEO_DOWNLOAD_FAILED',
  AUDIO_EXTRACTION_FAILED: 'AUDIO_EXTRACTION_FAILED',
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  GCS_UPLOAD_FAILED: 'GCS_UPLOAD_FAILED',
} as const;

export type TranscriptErrorCode = typeof TRANSCRIPT_ERROR_CODES[keyof typeof TRANSCRIPT_ERROR_CODES];

export interface TranscriptError {
  path: string;
  code: TranscriptErrorCode;
  message: string;
  severity: 'error' | 'warning';
}
```

## UI変更

### 現在のフロー

```
/submit
  └── フォーム: URL + 切り抜き指示 → 一括で処理開始
```

### 新しいフロー

```
/submit
  └── フォーム: URLのみ → 動画登録

/videos/:id
  └── ステータス: pending
      └── ボタン: 「トランスクリプト作成」

/videos/:id
  └── ステータス: transcribed
      └── トランスクリプト表示（タイムスタンプ付き）
      └── フォーム: 切り抜き指示 → 「切り抜き作成」ボタン
```

### UI変更箇所

| ファイル | 変更内容 |
|----------|----------|
| `apps/webapp/src/components/features/video-form/submit-form.tsx` | clipInstructions入力欄を削除、URLのみに |
| `apps/webapp/src/app/videos/[id]/page.tsx` | トランスクリプト表示、切り抜き指示フォーム追加 |
| `apps/webapp/src/lib/api-client.ts` | 新APIメソッド追加 |
| `apps/shared/types/api.ts` | 新API型定義追加 |
| `apps/shared/types/video.ts` | VideoStatus拡張、Transcription型追加 |

## 実装ファイル一覧

### 新規作成

| ファイル | 説明 |
|----------|------|
| `application/usecases/create-transcript.usecase.ts` | フェーズ1 UseCase |
| `application/usecases/extract-clips.usecase.ts` | フェーズ2 UseCase |
| `application/errors/transcript.errors.ts` | エラー定義 |
| `application/errors/clip.errors.ts` | エラー定義 |
| `domain/gateways/temp-storage.gateway.ts` | GCS一時保存Gateway |
| `domain/gateways/transcription-repository.gateway.ts` | Transcriptionリポジトリ |
| `infrastructure/clients/gcs.client.ts` | GCSクライアント実装 |
| `infrastructure/repositories/transcription.repository.ts` | Transcriptionリポジトリ実装 |
| `presentation/routes/transcript.routes.ts` | トランスクリプトAPI |

### 変更

| ファイル | 変更内容 |
|----------|----------|
| `schema.prisma` | Transcriptionテーブル追加、Video拡張 |
| `domain/models/video.ts` | GCS情報フィールド追加 |

### 削除

| ファイル | 理由 |
|----------|------|
| `application/usecases/process-video.usecase.ts` | 新UseCaseに置き換え |
| `presentation/routes/processing-job.routes.ts` | API削除 |

---

# 並列実装計画

2つの独立したAIセッションで並列実装できるよう、以下のように分割する。

## 共通の前提作業（どちらかが先に実施）

以下は依存関係があるため、セッションA or Bのどちらかが最初に実施する。

### 1. DBマイグレーション

```bash
# schema.prisma の変更
# - Transcriptionテーブル追加
# - VideoにgcsUri, gcsExpiresAt追加
# - VideoとTranscriptionのリレーション追加

pnpm --filter backend db:migrate
```

**変更ファイル**:
- `apps/backend/src/infrastructure/database/prisma/schema.prisma`

### 2. 共有型定義の更新

**変更ファイル**:
- `apps/shared/types/video.ts` - VideoStatus拡張（transcribing, transcribed, extracting追加）
- `apps/shared/types/api.ts` - 新API型定義
- `apps/shared/types/index.ts` - エクスポート追加

---

## セッションA: CreateTranscriptUseCase + 関連API

### スコープ

トランスクリプト作成機能の実装（バックエンド + フロントエンド）

### 実装順序

1. **Domain層**
   - `domain/gateways/temp-storage.gateway.ts` - GCS一時保存Gateway
   - `domain/gateways/transcription-repository.gateway.ts` - Transcriptionリポジトリ
   - `domain/models/transcription.ts` - Transcriptionドメインモデル
   - `domain/models/video.ts` - GCS情報フィールド追加

2. **Infrastructure層**
   - `infrastructure/clients/gcs.client.ts` - GCSクライアント実装
   - `infrastructure/repositories/transcription.repository.ts` - Transcriptionリポジトリ実装
   - `infrastructure/repositories/video.repository.ts` - GCS情報対応

3. **Application層**
   - `application/usecases/create-transcript.usecase.ts` - UseCase実装
   - `application/errors/transcript.errors.ts` - エラー定義

4. **Presentation層**
   - `presentation/routes/video.routes.ts` - POST /api/videos/:videoId/transcribe 追加
   - `presentation/routes/video.routes.ts` - GET /api/videos/:videoId/transcription 追加

5. **Frontend**
   - `apps/webapp/src/lib/api-client.ts` - transcribe, getTranscription メソッド追加
   - `apps/webapp/src/app/videos/[id]/page.tsx` - トランスクリプト表示セクション追加
   - `apps/webapp/src/app/videos/[id]/page.tsx` - 「トランスクリプト作成」ボタン追加

6. **テスト**
   - `application/usecases/__tests__/create-transcript.usecase.test.ts`

### 成果物

- トランスクリプト作成API（POST /api/videos/:videoId/transcribe）
- トランスクリプト取得API（GET /api/videos/:videoId/transcription）
- 動画詳細画面にトランスクリプト表示・作成ボタン

### 依存しないもの（セッションBの成果物を使わない）

- ExtractClipsUseCase
- 切り抜き指示フォーム
- 登録フォームの変更

---

## セッションB: ExtractClipsUseCase + 関連API + UI全体改修

### スコープ

切り抜き作成機能の実装 + UI全体のフロー変更

### 実装順序

1. **Application層**
   - `application/usecases/extract-clips.usecase.ts` - UseCase実装
   - `application/errors/clip.errors.ts` - エラー定義

2. **Presentation層**
   - `presentation/routes/video.routes.ts` - POST /api/videos/:videoId/extract-clips 追加
   - `presentation/routes/video.routes.ts` - POST /api/videos 変更（clipInstructions削除）
   - `presentation/routes/processing-job.routes.ts` - 削除

3. **既存コード削除**
   - `application/usecases/process-video.usecase.ts` - 削除

4. **Frontend - 登録フォーム変更**
   - `apps/webapp/src/components/features/video-form/submit-form.tsx` - clipInstructions入力欄削除
   - `apps/webapp/src/lib/api-client.ts` - submitVideo変更、extractClipsメソッド追加

5. **Frontend - 詳細画面変更**
   - `apps/webapp/src/app/videos/[id]/page.tsx` - 切り抜き指示フォーム追加
   - `apps/webapp/src/app/videos/[id]/page.tsx` - ステータスに応じたUI切り替え

6. **テスト**
   - `application/usecases/__tests__/extract-clips.usecase.test.ts`

### 成果物

- 切り抜き作成API（POST /api/videos/:videoId/extract-clips）
- 動画登録API変更（clipInstructions削除）
- 登録フォームのシンプル化（URLのみ）
- 詳細画面での切り抜き指示入力フォーム

### 依存するもの（セッションAの成果物を使う）

- Transcriptionテーブル（セッションAが作成）
- TempStorageGateway（セッションAが作成）
- TranscriptionRepositoryGateway（セッションAが作成）

**注意**: セッションBはセッションAの成果物（Transcriptionテーブル、TempStorageGateway）を使用するため、完全な並列ではなく、セッションAが先行して基盤を作る必要がある。ただし、セッションBは「セッションAのインターフェースが確定した時点」で開始可能。

---

## 並列実装の進め方

```
時間 →

セッションA: [共通作業: DBマイグレーション + 型定義]
             ↓
             [Domain層: TempStorageGateway, Transcription]
             ↓
             [Infra層: GCSClient, TranscriptionRepo]  ←── インターフェース確定
             ↓
             [App層: CreateTranscriptUseCase]
             ↓
             [API + Frontend: トランスクリプト表示]

セッションB:                                        [UI変更の設計・準備]
                                                    ↓
                                                    [App層: ExtractClipsUseCase]
                                                    ↓
                                                    [API変更 + 既存削除]
                                                    ↓
                                                    [Frontend: フォーム変更 + 詳細画面]
```

### 統合ポイント

セッションBがセッションAの成果物を使う箇所:
1. `ExtractClipsUseCase` が `TranscriptionRepositoryGateway` を使用
2. `ExtractClipsUseCase` が `TempStorageGateway` を使用
3. 詳細画面が `getTranscription` API を呼び出し（セッションAが実装）

### マージ時のコンフリクト注意箇所

以下のファイルは両セッションが変更する可能性がある。片方が先にマージし、もう片方がリベースする:
- `apps/webapp/src/lib/api-client.ts`
- `apps/webapp/src/app/videos/[id]/page.tsx`
- `presentation/routes/video.routes.ts`

---

## セッションA 実装ファイル一覧

| ファイル | 操作 |
|----------|------|
| `apps/backend/src/infrastructure/database/prisma/schema.prisma` | 変更 |
| `apps/backend/src/domain/gateways/temp-storage.gateway.ts` | 新規 |
| `apps/backend/src/domain/gateways/transcription-repository.gateway.ts` | 新規 |
| `apps/backend/src/domain/models/transcription.ts` | 新規 |
| `apps/backend/src/domain/models/video.ts` | 変更 |
| `apps/backend/src/infrastructure/clients/gcs.client.ts` | 新規 |
| `apps/backend/src/infrastructure/repositories/transcription.repository.ts` | 新規 |
| `apps/backend/src/infrastructure/repositories/video.repository.ts` | 変更 |
| `apps/backend/src/application/usecases/create-transcript.usecase.ts` | 新規 |
| `apps/backend/src/application/errors/transcript.errors.ts` | 新規 |
| `apps/backend/src/presentation/routes/video.routes.ts` | 変更 |
| `apps/shared/types/video.ts` | 変更 |
| `apps/shared/types/api.ts` | 変更 |
| `apps/webapp/src/lib/api-client.ts` | 変更 |
| `apps/webapp/src/app/videos/[id]/page.tsx` | 変更 |

---

## セッションB 実装ファイル一覧

| ファイル | 操作 |
|----------|------|
| `apps/backend/src/application/usecases/extract-clips.usecase.ts` | 新規 |
| `apps/backend/src/application/usecases/process-video.usecase.ts` | 削除 |
| `apps/backend/src/application/errors/clip.errors.ts` | 新規 |
| `apps/backend/src/presentation/routes/video.routes.ts` | 変更 |
| `apps/backend/src/presentation/routes/processing-job.routes.ts` | 削除 |
| `apps/webapp/src/components/features/video-form/submit-form.tsx` | 変更 |
| `apps/webapp/src/lib/api-client.ts` | 変更 |
| `apps/webapp/src/app/videos/[id]/page.tsx` | 変更 |
| `apps/shared/types/api.ts` | 変更 |
