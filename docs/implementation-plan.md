# Video Processor 実装計画書

## 1. システム概要

### 1.1 目的
Google Drive上の長尺動画をAIで分析し、指定された箇所を20-60秒のショート動画として自動切り抜きするツール。

### 1.2 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js (App Router) + Vercel |
| バックエンド | Cloud Run + TypeScript |
| データベース | Cloud SQL (PostgreSQL) |
| AI/LLM | Gemini (via Vercel AI SDK) |
| 動画処理 | FFmpeg |
| ストレージ | Google Drive API |
| インフラ | Terraform |
| モノレポ | pnpm workspaces |
| リンター | Biome |
| テスト | Jest + Playwright |

### 1.3 システム構成図

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Vercel                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Next.js Frontend                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │  動画登録   │  │  処理状況   │  │   結果一覧表示      │   │  │
│  │  │   画面     │  │   画面     │  │      画面          │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                    Vercel AI SDK (Gemini)                           │
└──────────────────────────────┼───────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Google Cloud                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     Cloud Run                                 │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │              Backend API (TypeScript)                   │  │  │
│  │  │                                                         │  │  │
│  │  │  presentation/  →  application/  →  domain/  →  infra/  │  │  │
│  │  │                                                         │  │  │
│  │  │  + FFmpeg (動画カット処理)                              │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                    │                          │                      │
│                    ▼                          ▼                      │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐     │
│  │      Cloud SQL          │    │      Google Drive API       │     │
│  │     (PostgreSQL)        │    │   (サービスアカウント認証)   │     │
│  │                         │    │                             │     │
│  │  - videos               │    │  - 動画ダウンロード         │     │
│  │  - clips                │    │  - ショート動画アップロード │     │
│  │  - processing_jobs      │    │  - メタファイル作成         │     │
│  └─────────────────────────┘    └─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. ディレクトリ構成

```
video-processor/
├── apps/
│   ├── web/                          # Next.js フロントエンド
│   │   ├── app/                      # App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # トップ（動画一覧）
│   │   │   ├── videos/
│   │   │   │   ├── page.tsx          # 動画一覧
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # 動画詳細・クリップ一覧
│   │   │   └── submit/
│   │   │       └── page.tsx          # 動画登録フォーム
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn components
│   │   │   └── features/
│   │   │       ├── video-form/
│   │   │       ├── video-list/
│   │   │       └── clip-list/
│   │   ├── lib/
│   │   │   ├── api-client.ts         # Backend API client
│   │   │   └── utils.ts
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── api/                          # Cloud Run バックエンド
│       ├── src/
│       │   ├── index.ts              # エントリーポイント
│       │   ├── presentation/
│       │   │   ├── routes/
│       │   │   │   ├── index.ts
│       │   │   │   ├── videos.ts
│       │   │   │   ├── clips.ts
│       │   │   │   └── health.ts
│       │   │   └── middleware/
│       │   │       ├── error-handler.ts
│       │   │       └── logger.ts
│       │   ├── application/
│       │   │   ├── usecases/
│       │   │   │   ├── submit-video.usecase.ts
│       │   │   │   ├── process-video.usecase.ts
│       │   │   │   ├── get-videos.usecase.ts
│       │   │   │   └── get-clips.usecase.ts
│       │   │   └── services/
│       │   │       └── video-processing.service.ts
│       │   ├── domain/
│       │   │   ├── models/
│       │   │   │   ├── video.ts
│       │   │   │   ├── clip.ts
│       │   │   │   └── processing-job.ts
│       │   │   ├── services/
│       │   │   │   └── timestamp-extractor.service.ts
│       │   │   └── gateways/
│       │   │       ├── video-repository.gateway.ts
│       │   │       ├── clip-repository.gateway.ts
│       │   │       ├── storage.gateway.ts
│       │   │       └── ai.gateway.ts
│       │   └── infrastructure/
│       │       ├── repositories/
│       │       │   ├── video.repository.ts
│       │       │   ├── clip.repository.ts
│       │       │   └── processing-job.repository.ts
│       │       ├── clients/
│       │       │   ├── google-drive.client.ts
│       │       │   ├── gemini.client.ts
│       │       │   └── ffmpeg.client.ts
│       │       └── database/
│       │           ├── prisma/
│       │           │   └── schema.prisma
│       │           └── connection.ts
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   └── shared/                       # 共通型定義・ユーティリティ
│       ├── src/
│       │   ├── types/
│       │   │   ├── video.ts
│       │   │   ├── clip.ts
│       │   │   └── api.ts
│       │   └── utils/
│       │       └── google-drive.ts
│       └── package.json
│
├── infrastructure/
│   └── terraform/
│       ├── environments/
│       │   ├── prod/
│       │   │   ├── main.tf
│       │   │   ├── variables.tf
│       │   │   ├── terraform.tfvars
│       │   │   └── outputs.tf
│       │   └── dev/                  # 将来用
│       │       └── ...
│       └── modules/
│           ├── cloud-run/
│           │   ├── main.tf
│           │   ├── variables.tf
│           │   └── outputs.tf
│           ├── cloud-sql/
│           │   ├── main.tf
│           │   ├── variables.tf
│           │   └── outputs.tf
│           ├── networking/
│           │   ├── main.tf
│           │   ├── variables.tf
│           │   └── outputs.tf
│           └── iam/
│               ├── main.tf
│               ├── variables.tf
│               └── outputs.tf
│
├── docs/
│   ├── initial-architecture.md
│   ├── implementation-plan.md        # 本ドキュメント
│   └── api-specification.md
│
├── pnpm-workspace.yaml
├── package.json
├── biome.json
├── tsconfig.json
└── README.md
```

---

## 3. データベーススキーマ (PostgreSQL)

```sql
-- videos: 処理対象の元動画
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_drive_file_id VARCHAR(255) NOT NULL UNIQUE,
    google_drive_url TEXT NOT NULL,
    title VARCHAR(500),
    description TEXT,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- clips: 切り抜かれたショート動画
CREATE TABLE clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    google_drive_file_id VARCHAR(255),
    google_drive_url TEXT,
    title VARCHAR(500),
    start_time_seconds DECIMAL(10, 3) NOT NULL,
    end_time_seconds DECIMAL(10, 3) NOT NULL,
    duration_seconds DECIMAL(10, 3) NOT NULL,
    transcript TEXT,                               -- 文字起こし
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- processing_jobs: 処理ジョブ（リクエスト単位）
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    clip_instructions TEXT NOT NULL,              -- ユーザーが指定した切り抜き指示（自然言語）
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, analyzing, extracting, uploading, completed, failed
    ai_response TEXT,                             -- Geminiからの応答（タイムスタンプJSON）
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_clips_video_id ON clips(video_id);
CREATE INDEX idx_clips_status ON clips(status);
CREATE INDEX idx_processing_jobs_video_id ON processing_jobs(video_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
```

### Prisma Schema

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Video {
  id                String   @id @default(uuid())
  googleDriveFileId String   @unique @map("google_drive_file_id")
  googleDriveUrl    String   @map("google_drive_url")
  title             String?
  description       String?
  durationSeconds   Int?     @map("duration_seconds")
  fileSizeBytes     BigInt?  @map("file_size_bytes")
  status            String   @default("pending")
  errorMessage      String?  @map("error_message")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  clips          Clip[]
  processingJobs ProcessingJob[]

  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("videos")
}

model Clip {
  id                String   @id @default(uuid())
  videoId           String   @map("video_id")
  googleDriveFileId String?  @map("google_drive_file_id")
  googleDriveUrl    String?  @map("google_drive_url")
  title             String?
  startTimeSeconds  Decimal  @map("start_time_seconds") @db.Decimal(10, 3)
  endTimeSeconds    Decimal  @map("end_time_seconds") @db.Decimal(10, 3)
  durationSeconds   Decimal  @map("duration_seconds") @db.Decimal(10, 3)
  transcript        String?
  status            String   @default("pending")
  errorMessage      String?  @map("error_message")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  video Video @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@index([videoId])
  @@index([status])
  @@map("clips")
}

model ProcessingJob {
  id               String    @id @default(uuid())
  videoId          String    @map("video_id")
  clipInstructions String    @map("clip_instructions")
  status           String    @default("pending")
  aiResponse       String?   @map("ai_response")
  errorMessage     String?   @map("error_message")
  startedAt        DateTime? @map("started_at")
  completedAt      DateTime? @map("completed_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  video Video @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@index([videoId])
  @@index([status])
  @@map("processing_jobs")
}
```

---

## 4. API仕様

### 4.1 エンドポイント一覧

| Method | Path | 説明 |
|--------|------|------|
| GET | `/health` | ヘルスチェック |
| GET | `/api/videos` | 動画一覧取得 |
| GET | `/api/videos/:id` | 動画詳細取得 |
| POST | `/api/videos` | 動画登録 & 処理開始 |
| GET | `/api/videos/:id/clips` | クリップ一覧取得 |
| GET | `/api/clips/:id` | クリップ詳細取得 |

### 4.2 詳細仕様

#### POST /api/videos
動画を登録し、切り抜き処理を開始する。

**Request:**
```json
{
  "googleDriveUrl": "https://drive.google.com/file/d/xxx/view",
  "clipInstructions": "以下の箇所を切り抜いてください：\n1. 冒頭の自己紹介部分\n2. 政策について語っている部分（約5分あたり）\n3. 質疑応答のハイライト"
}
```

**Response (202 Accepted):**
```json
{
  "id": "uuid",
  "googleDriveFileId": "xxx",
  "googleDriveUrl": "https://drive.google.com/file/d/xxx/view",
  "status": "pending",
  "processingJob": {
    "id": "uuid",
    "status": "pending",
    "clipInstructions": "..."
  },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/videos
**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `status` (optional): pending | processing | completed | failed

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "googleDriveUrl": "...",
      "title": "動画タイトル",
      "status": "completed",
      "clipCount": 5,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### GET /api/videos/:id
**Response:**
```json
{
  "id": "uuid",
  "googleDriveFileId": "xxx",
  "googleDriveUrl": "https://drive.google.com/file/d/xxx/view",
  "title": "動画タイトル",
  "description": "説明",
  "durationSeconds": 3600,
  "fileSizeBytes": 1500000000,
  "status": "completed",
  "clips": [
    {
      "id": "uuid",
      "title": "自己紹介",
      "startTimeSeconds": 0,
      "endTimeSeconds": 45,
      "durationSeconds": 45,
      "googleDriveUrl": "https://drive.google.com/file/d/yyy/view",
      "transcript": "こんにちは、チームみらいの...",
      "status": "completed"
    }
  ],
  "processingJobs": [
    {
      "id": "uuid",
      "status": "completed",
      "clipInstructions": "...",
      "completedAt": "2024-01-01T01:00:00Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T01:00:00Z"
}
```

---

## 5. 処理フロー詳細

### 5.1 動画処理フロー

```
1. [POST /api/videos] リクエスト受信
   │
   ▼
2. Google Drive URLからファイルIDを抽出
   │
   ▼
3. Video & ProcessingJob レコード作成 (status: pending)
   │
   ▼
4. 202 Accepted を返却（非同期処理開始）
   │
   ▼
5. [非同期] Google Drive APIでメタ情報取得
   │  - タイトル、説明、ファイルサイズ
   │  - 親フォルダIDも取得
   │
   ▼
6. [非同期] Gemini APIで動画分析
   │  - 動画URLとclipInstructionsを送信
   │  - タイムスタンプ情報を取得
   │
   │  Geminiへのプロンプト例:
   │  """
   │  以下のGoogle Drive動画を分析し、指定された箇所のタイムスタンプを抽出してください。
   │
   │  動画URL: {googleDriveUrl}
   │
   │  切り抜き指示:
   │  {clipInstructions}
   │
   │  以下のJSON形式で回答してください:
   │  {
   │    "clips": [
   │      {
   │        "title": "クリップのタイトル",
   │        "startTime": "00:01:30",
   │        "endTime": "00:02:15",
   │        "reason": "この箇所を選んだ理由"
   │      }
   │    ]
   │  }
   │  """
   │
   ▼
7. [非同期] Clip レコード作成
   │
   ▼
8. [非同期] Google Driveから動画ダウンロード (一時ファイル)
   │
   ▼
9. [非同期] 各クリップについて:
   │  a. FFmpegで切り抜き
   │  b. Google Driveの「ショート用」フォルダにアップロード
   │  c. Clipレコード更新 (googleDriveUrl設定)
   │
   ▼
10. [非同期] メタファイル（JSON）を「ショート用」フォルダに作成
    │  - 全クリップの情報と文字起こしを含む
    │
    ▼
11. Video status を completed に更新
```

### 5.2 Geminiプロンプト設計

```typescript
const TIMESTAMP_EXTRACTION_PROMPT = `
あなたは動画編集アシスタントです。
以下のGoogle Drive動画を分析し、ユーザーの指示に基づいて切り抜くべき箇所を特定してください。

## 動画情報
- URL: {googleDriveUrl}
- タイトル: {videoTitle}

## ユーザーの切り抜き指示
{clipInstructions}

## 出力形式
以下のJSON形式で、切り抜くべき箇所を出力してください。
各クリップは20秒〜60秒程度になるようにしてください。

\`\`\`json
{
  "clips": [
    {
      "title": "クリップの簡潔なタイトル",
      "startTime": "HH:MM:SS",
      "endTime": "HH:MM:SS",
      "transcript": "このクリップ内での発言内容（文字起こし）",
      "reason": "この箇所を選んだ理由"
    }
  ]
}
\`\`\`

## 注意事項
- 各クリップは20秒〜60秒の範囲に収めてください
- 発言の途中で切れないよう、自然な区切りを選んでください
- transcriptは可能な限り正確に書き起こしてください
`;
```

---

## 6. 環境変数

### 6.1 フロントエンド (Vercel)

```env
# Backend API
NEXT_PUBLIC_API_URL=https://api-xxxxx.a.run.app

# Vercel AI (Gemini)
GOOGLE_GENERATIVE_AI_API_KEY=xxx
```

### 6.2 バックエンド (Cloud Run)

```env
# Database
DATABASE_URL=postgresql://user:password@/dbname?host=/cloudsql/project:region:instance

# Google Cloud
GOOGLE_CLOUD_PROJECT=video-processor-prod
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Google Drive
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com

# CORS
CORS_ORIGIN=https://video-processor.vercel.app

# Environment
NODE_ENV=production
```

---

## 7. Terraform モジュール設計

### 7.1 モジュール構成

```
modules/
├── cloud-run/       # Cloud Run サービス
├── cloud-sql/       # PostgreSQL インスタンス
├── networking/      # VPC, サブネット, Cloud NAT
└── iam/            # サービスアカウント, IAM バインディング
```

### 7.2 主要リソース

#### Cloud SQL
- PostgreSQL 15
- db-f1-micro (開発) / db-custom-2-4096 (本番)
- プライベートIP
- 自動バックアップ有効

#### Cloud Run
- メモリ: 2Gi (FFmpeg用)
- CPU: 2
- タイムアウト: 3600秒 (1時間)
- 最小インスタンス: 0
- 最大インスタンス: 10
- Cloud SQL接続

#### ネットワーキング
- VPC
- サブネット (asia-northeast1)
- Cloud NAT (外部API接続用)
- Serverless VPC Access Connector

#### IAM
- Cloud Run用サービスアカウント
- Cloud SQL接続権限
- Secret Manager アクセス権限

---

## 8. 並列実装計画

### 8.1 依存関係図

```
                    ┌─────────────────┐
                    │   共通設定      │
                    │ (pnpm, biome,   │
                    │  tsconfig)      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │   packages/ │  │    apps/    │  │ infrastructure/│
    │   shared/   │  │    web/     │  │   terraform/   │
    │  (型定義)   │  │ (Frontend)  │  │              │
    └──────┬──────┘  └──────┬──────┘  └──────────────┘
           │                │                 │
           │                │          (独立して実装可能)
           ▼                ▼
    ┌─────────────────────────────┐
    │         apps/api/           │
    │        (Backend)            │
    │                             │
    │  shared型に依存              │
    │  フロントとはAPIで疎結合      │
    └─────────────────────────────┘
```

### 8.2 並列実装可能なタスク群

```
【並列グループ A】プロジェクト基盤（最初に実行）
├── A1: pnpm workspace + 共通設定 (biome, tsconfig)
├── A2: packages/shared 型定義
└── A3: Terraform基盤モジュール

【並列グループ B】アプリケーション（グループA完了後）
├── B1: Frontend (apps/web)
│   ├── Next.js初期設定
│   ├── shadcn/ui セットアップ
│   ├── ページコンポーネント
│   └── APIクライアント (モック対応)
│
├── B2: Backend (apps/api)
│   ├── Express/Fastify 初期設定
│   ├── Prisma セットアップ
│   ├── DDDレイヤー実装
│   │   ├── presentation (ルート)
│   │   ├── application (ユースケース)
│   │   ├── domain (モデル, サービス)
│   │   └── infrastructure (リポジトリ, クライアント)
│   └── Dockerfile
│
└── B3: Terraform 環境構築
    ├── modules/cloud-sql
    ├── modules/cloud-run
    ├── modules/networking
    ├── modules/iam
    └── environments/prod
```

### 8.3 タスク詳細

#### A1: プロジェクト基盤
```
- pnpm-workspace.yaml
- package.json (ルート)
- biome.json
- tsconfig.json (base)
- .gitignore
- .nvmrc
```

#### A2: 共通型定義 (packages/shared)
```
- Video, Clip, ProcessingJob 型
- API リクエスト/レスポンス型
- Google Drive URL パーサー
```

#### A3: Terraform基盤
```
- provider設定
- 変数定義
- 基本的なモジュール構造
```

#### B1: Frontend詳細
```
- next.config.js
- tailwind.config.js
- app/layout.tsx (ヘッダー、フッター)
- app/page.tsx (動画一覧)
- app/submit/page.tsx (登録フォーム)
- app/videos/[id]/page.tsx (詳細)
- components/ui/* (shadcn)
- components/features/* (機能コンポーネント)
- lib/api-client.ts
```

#### B2: Backend詳細
```
- src/index.ts (Expressエントリーポイント)
- presentation/routes/* (各エンドポイント)
- application/usecases/* (ビジネスロジック)
- domain/models/* (エンティティ)
- domain/gateways/* (インターフェース)
- infrastructure/repositories/* (DB操作)
- infrastructure/clients/* (外部サービス)
- Dockerfile
- tests/*
```

#### B3: Terraform詳細
```
- modules/cloud-sql (PostgreSQL)
- modules/cloud-run (APIサービス)
- modules/networking (VPC, NAT)
- modules/iam (サービスアカウント)
- environments/prod/main.tf
```

---

## 9. 実装優先順位

### Phase 1: 基盤（並列実行可能）
1. **A1**: pnpm workspace + 設定ファイル
2. **A2**: packages/shared 型定義
3. **A3**: Terraform modules 骨格

### Phase 2: アプリケーション（並列実行可能）
4. **B1**: Frontend 実装
5. **B2**: Backend 実装
6. **B3**: Terraform 環境構築

### Phase 3: 統合
7. 各コンポーネントの結合確認用ドキュメント作成

---

## 10. 注意事項・制約

### 10.1 Cloud Run制約
- 最大リクエストタイムアウト: 60分
- 最大メモリ: 32GB
- 最大CPU: 8
- 一時ストレージ: /tmp に最大数GB

### 10.2 Google Drive API制約
- ファイルダウンロード: 大きいファイルはチャンクダウンロード推奨
- アップロード: resumable upload推奨
- レート制限に注意

### 10.3 FFmpeg
- Cloud Runでは公式Debianイメージにffmpegをインストール
- または ffmpeg-static npm パッケージを使用

### 10.4 今回スコープ外
- 認証機能（内部ツールのため不要）
- 複数動画の一括処理
- AI自動判定での切り抜き箇所提案

---

## 11. 次のステップ

このドキュメントを確認後、並列で以下のエージェントを起動して実装を進めます：

1. **基盤エージェント**: A1, A2, A3を実装
2. **フロントエンドエージェント**: B1を実装
3. **バックエンドエージェント**: B2を実装
4. **インフラエージェント**: B3を実装

各エージェントは独立して動作し、shared型を参照することで整合性を保ちます。
