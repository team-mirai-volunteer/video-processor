# shorts-gen フロントエンド開発ガイド

shorts-gen機能のフロントエンド修正用コンテキスト

## 主要ファイル

| ファイル | 役割 |
|----------|------|
| `apps/webapp/src/app/shorts-gen/[projectId]/project-detail-client.tsx` | **メインコンポーネント** - 全ステップの状態管理・オーケストレーション |
| `apps/webapp/src/app/shorts-gen/[projectId]/page.tsx` | SSRページ - 初期データ取得 (planning, script, assets) |
| `apps/webapp/src/app/shorts-gen/page.tsx` | プロジェクト一覧ページ |
| `apps/shared/types/shorts-gen.ts` | 共有型定義 (ShortsProject, ShortsScene, etc.) |

## ディレクトリ構成

```
apps/webapp/src/
├── app/shorts-gen/                    # ページ
│   ├── page.tsx                       # 一覧
│   └── [projectId]/
│       ├── page.tsx                   # 詳細 (SSR)
│       └── project-detail-client.tsx  # 詳細 (Client)
│
├── components/features/shorts-gen/    # UIコンポーネント群
│   ├── step-card.tsx                  # ステップ共通UI
│   ├── progress-indicator.tsx         # 進捗表示
│   ├── project-form/                  # プロジェクト作成
│   ├── project-list/                  # プロジェクト一覧
│   ├── planning/                      # E4 企画書生成
│   ├── script/                        # E5 台本生成
│   ├── asset-generation/              # E6-E7 素材生成 (voice/subtitle/image)
│   ├── compose/                       # E8 動画合成
│   ├── publish/                       # E9 公開テキスト
│   └── chat/                          # AIチャット (SSE)
│
├── app/api/shorts-gen/                # APIルート (バックエンドプロキシ)
│   └── projects/[projectId]/
│       ├── planning/generate/         # 企画書生成 (SSE)
│       ├── script/generate/           # 台本生成 (SSE)
│       └── scenes/[sceneId]/          # シーン更新
│
└── server/
    ├── presentation/
    │   ├── loaders/                   # SSRデータ取得
    │   │   ├── loadShortsProject.ts
    │   │   └── loadShortsProjects.ts
    │   └── actions/                   # Server Actions
    │       └── shorts-gen/            # compose, voice, image, subtitle, publishText
    └── infrastructure/clients/
        └── backend-client.ts          # バックエンド通信
```

## ステップ構成

| Step | コンポーネント | フック | 状態管理 |
|------|---------------|--------|----------|
| E4 企画書 | `planning/planning-generation-step.tsx` | - | ChatUI + SSE |
| E5 台本 | `script/script-generation-step.tsx` | `use-script-generation.ts` | ChatUI + SSE |
| E6-7 素材 | `asset-generation/asset-generation-step.tsx` | `use-asset-generation.ts` | 並列生成 |
| E8 合成 | `compose/compose-step.tsx` | `use-compose.ts` | ポーリング |
| E9 公開 | `publish/publish-text-step.tsx` | `use-publish-text.ts` | Server Action |

## StepState管理 (project-detail-client.tsx)

```typescript
type StepId = 'project' | 'planning' | 'script' | 'assets' | 'compose' | 'publish'
type StepStatus = 'pending' | 'ready' | 'running' | 'completed' | 'error'

// コールバックチェーン
handlePlanningGenerated → script を ready に
handleScriptGenerated → assets を ready に
handleAssetsComplete → compose を ready に
handleComposeComplete → publish を ready に
```

## 主要な型 (apps/shared/types/shorts-gen.ts)

```typescript
// プロジェクト
ShortsProject { id, title, aspectRatio, resolutionWidth, resolutionHeight }
ShortsProjectSummary { ...project, hasPlan, hasScript, hasComposedVideo }

// 企画書・台本
ShortsPlanning { id, projectId, content, version }
ShortsScript { id, projectId, planningId, version }
ShortsScene { id, order, summary, visualType, voiceText, subtitles[], ... }
VisualType = 'image_gen' | 'stock_video' | 'solid_color'

// アセット
SceneVoiceAsset { sceneId, sceneOrder, hasVoice, asset? }
SceneSubtitleAsset { assetId, fileUrl, subtitleIndex, subtitleText }
SceneImage { sceneId, visualType, hasImage, asset? }

// 動画合成
ComposedVideo { id, projectId, fileUrl, status, durationSeconds }
ComposedVideoStatus = 'pending' | 'processing' | 'completed' | 'failed'

// 公開テキスト
PublishText { id, projectId, title, description }
```

## データフロー

```
SSR (page.tsx)
  ↓ Promise.all で並列取得
  ↓ loadShortsProject, getShortsPlanning, getShortsScript, getAssets...
  ↓
ProjectDetailClient (初期データ受け取り)
  ↓
各ステップコンポーネント
  ├─ ChatUI → /api/shorts-gen/.../generate (SSE)
  ├─ useHook → Server Action → backend-client
  └─ コールバック → 次ステップを ready に
```

## 修正時のポイント

1. **UIの変更**: `components/features/shorts-gen/` 配下の該当コンポーネント
2. **状態管理の変更**: `project-detail-client.tsx` または各ステップの `use-*.ts` フック
3. **API連携の変更**: `app/api/shorts-gen/` (プロキシ) + `server/presentation/actions/`
4. **型の変更**: `apps/shared/types/shorts-gen.ts`
5. **SSR初期データ**: `[projectId]/page.tsx` の並列取得ロジック
