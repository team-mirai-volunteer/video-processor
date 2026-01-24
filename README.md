# Video Processor

Google Drive上の長尺動画をAIで分析し、指定箇所を20〜60秒のショート動画として自動切り抜きするツールです。

## 概要

政党「チームみらい」の広報活動を支援するために開発されました。長時間のYouTube動画から、編集経験のないサポーターでも簡単に投稿できるショート動画を自動生成します。

### 主な機能

- Google Drive上の動画URLと切り抜き指示（自然言語）を入力
- Gemini AIが動画を分析し、該当箇所のタイムスタンプを自動抽出
- FFmpegで指定箇所を切り抜き、Google Driveの「ショート用」フォルダに保存
- 文字起こしを含むメタファイルも自動生成

## システム構成

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
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Google Cloud                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     Cloud Run                                 │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │              Backend API (TypeScript)                   │  │  │
│  │  │  presentation/  →  application/  →  domain/  →  infra/  │  │  │
│  │  │  + FFmpeg (動画カット処理)                              │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                    │                          │                      │
│                    ▼                          ▼                      │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐     │
│  │      Cloud SQL          │    │      Google Drive API       │     │
│  │     (PostgreSQL)        │    │   (サービスアカウント認証)   │     │
│  └─────────────────────────┘    └─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Next.js 14 (App Router), React 18, shadcn/ui, Tailwind CSS |
| Backend | Express, Prisma, TypeScript (DDD構成) |
| AI/LLM | Gemini (via Vercel AI SDK), Google Speech-to-Text Chirp |
| 動画処理 | FFmpeg |
| Storage | Google Drive API |
| Database | PostgreSQL (Cloud SQL) |
| Infrastructure | Cloud Run, Terraform |
| Monorepo | pnpm workspaces |
| Linter/Formatter | Biome |
| Testing | Vitest, Playwright |

## ディレクトリ構成

```
video-processor/
├── apps/
│   ├── webapp/          # Next.js フロントエンド
│   ├── backend/         # Express バックエンド (DDD)
│   └── shared/          # 共通型定義
├── infrastructure/
│   └── terraform/       # インフラ構成
├── docs/                # 設計ドキュメント
├── biome.json           # Linter/Formatter設定
├── pnpm-workspace.yaml
└── package.json
```

## セットアップ

### 必要要件

- Node.js 20以上 (`.nvmrc`参照)
- pnpm 9.15.4以上
- PostgreSQL (ローカル開発用)
- FFmpeg

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/team-mirai-volunteer/video-processor.git
cd video-processor

# 依存関係をインストール
pnpm install

# 環境変数を設定
cp apps/backend/.env.example apps/backend/.env
cp apps/webapp/.env.example apps/webapp/.env
# 各.envファイルを編集

# データベースをセットアップ
pnpm --filter backend db:push
```

### 開発サーバーの起動

```bash
# フロントエンドとバックエンドを同時起動
pnpm dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## コマンド一覧

### ルート

```bash
pnpm dev              # frontend + backend 同時起動
pnpm lint             # Biomeでlintチェック
pnpm lint:fix         # lint + 自動修正
pnpm typecheck        # 全パッケージの型チェック
```

### Backend (`apps/backend`)

```bash
pnpm --filter backend dev              # 開発サーバー起動
pnpm --filter backend test:unit        # ユニットテスト
pnpm --filter backend test:integration # 統合テスト (要DB)
pnpm --filter backend db:studio        # Prisma Studio
pnpm --filter backend db:migrate       # マイグレーション実行
```

### Frontend (`apps/webapp`)

```bash
pnpm --filter @video-processor/webapp dev       # 開発サーバー起動
pnpm --filter @video-processor/webapp build     # ビルド
pnpm --filter @video-processor/webapp test:e2e  # Playwright E2Eテスト
```

## API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/health` | ヘルスチェック |
| GET | `/api/videos` | 動画一覧取得 |
| GET | `/api/videos/:id` | 動画詳細取得 |
| POST | `/api/videos` | 動画登録 & 処理開始 |
| GET | `/api/videos/:id/clips` | クリップ一覧取得 |
| GET | `/api/clips/:id` | クリップ詳細取得 |

## アーキテクチャ

### Backend DDD レイヤー構成

```
presentation/  → routes, middleware (薄く保つ)
application/   → usecases, services (throw errors)
domain/        → models, services, gateways (Result型で表現)
infrastructure/→ repositories, clients (throw errors)
```

### エラーハンドリング

| レイヤー | 方針 |
|---------|------|
| domain | Result型 `{ success: true, value } \| { success: false, error }` |
| application | throw → presentation層でハンドリング |
| infrastructure | throw → presentation層でハンドリング |

### テスト方針

| レイヤー | テスト種別 | コマンド |
|---------|-----------|----------|
| domain, application | unit (mock) | `pnpm --filter backend test:unit` |
| infrastructure | integration | `pnpm --filter backend test:integration` |
| webapp | e2e (Playwright) | `pnpm --filter @video-processor/webapp test:e2e` |

## ドキュメント

- [実装計画書](docs/implementation-plan.md) - 詳細設計・API仕様・DBスキーマ
- [初期アーキテクチャ](docs/initial-architecture.md) - 設計の背景と決定事項
- [Speech-to-Text Chirp導入設計](docs/20260125_0002_Speech-to-Text_Chirp導入設計.md)

## 環境変数

### Backend

```env
DATABASE_URL=postgresql://user:password@localhost:5432/video_processor
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
CORS_ORIGIN=http://localhost:3000
```

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
```

## コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。
