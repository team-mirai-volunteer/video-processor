# clip-video フロントエンド開発ガイド

clip-video機能のフロントエンド修正用コンテキスト

## 主要ファイル

| ファイル | 役割 |
|----------|------|
| `apps/webapp/src/app/videos/[id]/video-detail-client.tsx` | **メインコンポーネント** - パイプライン状態管理・ポーリング・クリップ抽出 |
| `apps/webapp/src/app/videos/[id]/page.tsx` | SSRページ - 初期データ取得 (video, transcription, refinedTranscription) |
| `apps/webapp/src/app/clips/page.tsx` | クリップ一覧ページ |
| `apps/shared/types/clip-video/` | 共有型定義 (Video, Clip, Transcription, etc.) |

## ディレクトリ構成

```
apps/webapp/src/
├── app/
│   ├── clips/
│   │   └── page.tsx                      # クリップ一覧 (SSR)
│   ├── videos/[id]/
│   │   ├── page.tsx                      # ビデオ詳細 (SSR)
│   │   └── video-detail-client.tsx       # ビデオ詳細 (Client)
│   └── api/videos/[id]/progress/
│       └── route.ts                      # 進捗取得 (API Route)
│
├── components/features/
│   ├── clip-list/                        # クリップ表示
│   │   ├── clip-list.tsx                 # グリッド表示
│   │   ├── clip-card.tsx                 # 個別クリップカード
│   │   ├── clip-list-table.tsx           # テーブル表示
│   │   └── index.tsx
│   ├── processing-pipeline/              # 処理パイプラインUI
│   │   ├── processing-pipeline.tsx       # 4ステップ管理
│   │   ├── pipeline-step.tsx             # ステップ共通UI
│   │   └── index.ts
│   ├── video-list/                       # ビデオ一覧
│   │   ├── video-table.tsx
│   │   └── status-badge.tsx
│   └── transcript/                       # 文字起こし表示
│       ├── transcript-viewer.tsx
│       └── refined-transcript-view.tsx
│
└── server/
    ├── presentation/clip-video/
    │   ├── actions/                      # Server Actions
    │   │   ├── submitVideo.ts            # 動画登録
    │   │   ├── cacheVideo.ts             # キャッシュ
    │   │   ├── extractAudio.ts           # 音声抽出
    │   │   ├── transcribeAudio.ts        # 文字起こし
    │   │   ├── transcribeVideo.ts        # 全処理開始
    │   │   ├── refineTranscript.ts       # 文字起こし校正
    │   │   ├── extractClips.ts           # クリップ抽出
    │   │   ├── getVideoStatus.ts         # ステータス取得
    │   │   ├── resetVideo.ts             # リセット
    │   │   ├── deleteVideo.ts            # 削除
    │   │   └── downloadSrt.ts            # SRTダウンロード
    │   └── loaders/                      # SSRデータ取得
    │       ├── loadVideos.ts
    │       ├── loadVideo.ts
    │       ├── loadAllClips.ts
    │       ├── loadTranscription.ts
    │       └── loadRefinedTranscription.ts
    └── infrastructure/clients/
        └── backend-client.ts             # バックエンド通信
```

## パイプライン構成

| Step | 処理 | Server Action | 説明 |
|------|------|---------------|------|
| 1 | キャッシュ | `cacheVideo` | Google Drive → GCS キャッシュ |
| 2 | 音声抽出 | `extractAudio` | FFmpegで音声抽出 (FLAC) |
| 3 | 文字起こし | `transcribeAudio` | OpenAI Whisperで文字変換 |
| 4 | 校正 | `refineTranscript` | AIで文字起こしを整形・校正 |

## 状態管理 (video-detail-client.tsx)

```typescript
// 主要な状態
const [video, setVideo] = useState(initialVideo)
const [transcription, setTranscription] = useState(initialTranscription)
const [refinedTranscription, setRefinedTranscription] = useState(initialRefinedTranscription)
const [clipInstructions, setClipInstructions] = useState('')
const [multipleClips, setMultipleClips] = useState(false)
const [extracting, setExtracting] = useState(false)

// ポーリング制御
const shouldPoll = video.status === 'transcribing' || video.status === 'extracting'

useEffect(() => {
  if (shouldPoll) {
    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }
}, [shouldPoll])
```

### VideoStatus

```typescript
type VideoStatus =
  | 'pending'       // 初期状態
  | 'cached'        // キャッシュ完了
  | 'transcribing'  // 文字起こし中
  | 'transcribed'   // 文字起こし完了
  | 'extracting'    // クリップ抽出中
  | 'completed'     // 完了
  | 'failed'        // 失敗
```

## 主要な型 (apps/shared/types/clip-video/)

```typescript
// Video
Video {
  id, title, googleDriveFileId, googleDriveUrl,
  status: VideoStatus, errorMessage,
  gcsUri, audioGcsUri, createdAt, updatedAt
}

// Clip
Clip {
  id, videoId, title, startTimeSeconds, endTimeSeconds,
  durationSeconds, transcript, status: ClipStatus,
  googleDriveFileId, googleDriveUrl, errorMessage
}
ClipStatus = 'pending' | 'processing' | 'completed' | 'failed'

// Transcription
Transcription { videoId, segments: TranscriptionSegment[] }
TranscriptionSegment { start, end, text }

// RefinedTranscription
RefinedTranscription { videoId, refinedText, dictionary }

// API Request/Response
ExtractClipsRequest { clipInstructions, multipleClips? }
ExtractClipsResponse { videoId, status }
CacheVideoResponse { gcsUri, expiresAt, cached }
ExtractAudioResponse { format, audioGcsUri }
TranscribeAudioResponse { transcriptionId, segmentsCount }
```

## データフロー

```
SSR (page.tsx)
  ↓ Promise.all で並列取得
  ↓ loadVideo, loadTranscription, loadRefinedTranscription
  ↓
VideoDetailClient (初期データ受け取り)
  ↓
ProcessingPipeline
  ├─ Step 1: cacheVideo → CacheVideoResponse
  ├─ Step 2: extractAudio → ExtractAudioResponse
  ├─ Step 3: transcribeAudio → TranscribeAudioResponse
  └─ Step 4: refineTranscript → RefineTranscriptResponse
  ↓
切り抜き指示フォーム
  └─ extractClips → ポーリング開始
  ↓
ClipList (結果表示)
```

## ポーリングの流れ

```
VideoDetailClient
  ↓ shouldPoll = true の場合
  ↓ setInterval(pollStatus, 3000)
  ↓
pollStatus()
  ├─ getVideoStatus (Server Action)
  │  └─ backendClient.getVideo()
  ├─ loadTranscription (文字起こし更新)
  └─ loadRefinedTranscription (校正結果更新)
  ↓
setVideo / setTranscription / setRefinedTranscription
```

## 修正時のポイント

1. **UIの変更**: `components/features/` 配下の該当コンポーネント
   - `clip-list/` - クリップ表示
   - `processing-pipeline/` - パイプラインUI
   - `transcript/` - 文字起こし表示
   - `video-list/` - ビデオ一覧

2. **状態管理の変更**: `video-detail-client.tsx` のuseState/useEffect

3. **Server Actions の変更**: `server/presentation/clip-video/actions/`

4. **SSR初期データ**: `[id]/page.tsx` のローダー呼び出し

5. **型の変更**: `apps/shared/types/clip-video/`

6. **バックエンド連携**: `server/infrastructure/clients/backend-client.ts`
