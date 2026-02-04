# shorts-gen バックエンド開発ガイド

shorts-gen機能のバックエンド修正用コンテキスト

## ディレクトリ構成

```
apps/backend/src/contexts/shorts-gen/
├── presentation/routes/         # APIエンドポイント
│   ├── project.routes.ts        # プロジェクトCRUD
│   ├── planning.routes.ts       # 企画書生成 (SSE)
│   ├── script.routes.ts         # 台本生成 (SSE)
│   ├── voice.routes.ts          # 音声合成
│   ├── subtitle.routes.ts       # 字幕生成
│   ├── image.routes.ts          # 画像生成
│   ├── compose.routes.ts        # 動画合成
│   └── publish.routes.ts        # 公開テキスト生成
│
├── application/usecases/        # ビジネスロジック
│   ├── create-project.usecase.ts
│   ├── generate-planning.usecase.ts
│   ├── generate-script.usecase.ts
│   ├── create-manual-script.usecase.ts
│   ├── add-scene.usecase.ts
│   ├── synthesize-voice.usecase.ts
│   ├── generate-subtitles.usecase.ts
│   ├── generate-image-prompts.usecase.ts
│   ├── generate-images.usecase.ts
│   ├── compose-video.usecase.ts
│   └── generate-publish-text.usecase.ts
│
├── domain/
│   ├── models/                  # ドメインモデル
│   │   ├── project.ts
│   │   ├── planning.ts
│   │   ├── script.ts
│   │   ├── scene.ts
│   │   ├── scene-asset.ts
│   │   ├── composed-video.ts
│   │   └── publish-text.ts
│   │
│   └── gateways/                # インターフェース定義
│       ├── project-repository.gateway.ts
│       ├── planning-repository.gateway.ts
│       ├── script-repository.gateway.ts
│       ├── scene-repository.gateway.ts
│       ├── scene-asset-repository.gateway.ts
│       ├── composed-video-repository.gateway.ts
│       ├── publish-text-repository.gateway.ts
│       ├── agentic-ai.gateway.ts        # LLM対話
│       ├── tts.gateway.ts               # 音声合成
│       ├── image-gen.gateway.ts         # 画像生成
│       ├── video-compose.gateway.ts     # 動画合成
│       └── asset-registry.gateway.ts    # GCS等のアセット管理
│
└── infrastructure/
    ├── repositories/            # Gateway実装 (Prisma)
    │   ├── project.repository.ts
    │   ├── planning.repository.ts
    │   ├── script.repository.ts
    │   ├── scene.repository.ts
    │   ├── scene-asset.repository.ts
    │   ├── composed-video.repository.ts
    │   └── publish-text.repository.ts
    │
    └── clients/                 # 外部サービス実装
        ├── openai-agentic.client.ts     # LLM (Agentic)
        ├── fish-audio-tts.client.ts     # TTS
        ├── nano-banana-image-gen.client.ts  # 画像生成
        ├── ffmpeg-compose.client.ts     # 動画合成
        ├── ffmpeg-subtitle-generator.client.ts  # 字幕画像
        └── asset-registry.client.ts     # GCS
```

## ステップと実装の対応

| Step | Route | UseCase | 外部Client |
|------|-------|---------|------------|
| ① プロジェクト作成 | project.routes | create-project | - |
| ② 企画書生成 | planning.routes | generate-planning | openai-agentic |
| ③ 台本生成 | script.routes | generate-script | openai-agentic |
| ④ 音声合成 | voice.routes | synthesize-voice | fish-audio-tts |
| ⑤ 字幕生成 | subtitle.routes | generate-subtitles | ffmpeg-subtitle-generator |
| ⑥ 画像プロンプト | image.routes | generate-image-prompts | openai-agentic |
| ⑦ 画像生成 | image.routes | generate-images | nano-banana-image-gen |
| ⑧ 動画合成 | compose.routes | compose-video | ffmpeg-compose |
| ⑨ 公開テキスト | publish.routes | generate-publish-text | openai-agentic |

## レイヤー間の依存

```
Route → UseCase → Gateway(interface) ← Repository/Client(実装)
```

- **UseCase**: Gatewayインターフェースにのみ依存
- **Repository/Client**: Gatewayを実装、Prisma/外部APIに依存
- **DI**: routesでインスタンス化して注入

---

## BFF（Backend For Frontend）経由の必須要件

### 方針

**フロントエンドからExpressバックエンドへの直接リクエストは禁止**

簡易的な認証のため、すべてのリクエストは必ず **Next.js BFF層** を経由する。

```
[Browser]
    ↓ (認証不要)
[Next.js BFF層]  ← API Routes / Server Actions
    ↓ X-API-Key ヘッダー付与
[Express Backend]
    ↓ X-API-Key 検証 (apiKeyAuth middleware)
[処理実行]
```

### 認証の仕組み

| 環境変数 | 用途 |
|----------|------|
| `BACKEND_API_KEY` (webapp側) | BFFからバックエンドへのリクエスト時にX-API-Keyヘッダーに設定 |
| `WEBAPP_API_KEY` (backend側) | バックエンドでX-API-Keyヘッダーを検証 |

バックエンドの認証ミドルウェア: `apps/backend/src/contexts/shared/presentation/middleware/api-key-auth.ts`

---

## Next.js BFF層の構造

### ディレクトリ構成

```
apps/webapp/src/
├── app/api/shorts-gen/              # API Routes (BFF Proxy)
│   ├── projects/[projectId]/
│   │   ├── planning/
│   │   │   ├── route.ts             # POST: 企画直接作成
│   │   │   └── generate/route.ts    # POST: 企画AI生成 (SSE)
│   │   ├── script/
│   │   │   └── generate/route.ts    # POST: 台本AI生成 (SSE)
│   │   └── scenes/[sceneId]/
│   │       └── route.ts             # PATCH: シーン更新
│   ├── scenes/[sceneId]/
│   │   ├── voice/route.ts           # POST: 音声生成
│   │   ├── subtitles/route.ts       # POST: 字幕生成
│   │   ├── image/route.ts           # POST: 画像生成
│   │   └── image-prompt/route.ts    # POST: 画像プロンプト生成
│   └── scripts/[scriptId]/
│       ├── voice/route.ts           # POST: 全シーン音声生成
│       ├── subtitles/route.ts       # POST: 全シーン字幕生成
│       └── images/route.ts          # POST: 全シーン画像生成
│
└── server/
    ├── presentation/actions/shorts-gen/  # Server Actions
    │   ├── composeVideo.ts          # 動画合成
    │   ├── publishText.ts           # 公開テキスト
    │   └── referenceCharacter.ts    # 参照キャラクター
    │
    └── infrastructure/clients/
        └── backend-client.ts        # バックエンドAPI呼び出し共通クライアント
```

### BFF実装の2パターン

#### パターン1: API Routes（SSE/ストリーミング向け）

```typescript
// apps/webapp/src/app/api/shorts-gen/projects/[projectId]/planning/generate/route.ts
export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const body = await request.json();

  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/...`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': BACKEND_API_KEY,  // ← 認証キー付与
    },
    body: JSON.stringify(body),
  });

  // SSEをそのままプロキシ
  return new Response(response.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

#### パターン2: Server Actions（単発リクエスト向け）

```typescript
// apps/webapp/src/server/presentation/actions/shorts-gen/composeVideo.ts
'use server';

import { backendClient } from '@/server/infrastructure/clients/backend-client';

export async function composeVideo(projectId: string, scriptId: string) {
  return backendClient.composeVideo({ projectId, scriptId });
}
```

### backendClient

`apps/webapp/src/server/infrastructure/clients/backend-client.ts` がバックエンドAPI呼び出しの共通実装。

```typescript
async function fetchBackend<T>(endpoint: string, options?: FetchOptions): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': BACKEND_API_KEY,  // ← 自動付与
    },
    ...options,
  });
  return response.json();
}
```

---

## 新規エンドポイント追加時のチェックリスト

バックエンドに新しいAPIを追加する場合、**必ずBFF層も実装する**。

| 追加場所 | 実装内容 |
|----------|----------|
| **Backend** | `apps/backend/src/contexts/shorts-gen/presentation/routes/` にルート追加 |
| **BFF (API Route)** | `apps/webapp/src/app/api/shorts-gen/` にプロキシルート追加（SSE/ストリーム時） |
| **BFF (Server Action)** | `apps/webapp/src/server/presentation/actions/shorts-gen/` にアクション追加（単発時） |
| **backendClient** | `apps/webapp/src/server/infrastructure/clients/backend-client.ts` にメソッド追加 |

**BFF層を実装しないと、フロントエンドからバックエンドを呼び出せない。**

## エラーハンドリング

| 層 | 方式 |
|----|------|
| domain | `Result<T, E>` を返す |
| application | throw `ApplicationError` |
| infrastructure | throw |
| presentation | catch → HTTP response |

## 主要な型 (domain/models)

```typescript
// Project
Project { id, title, aspectRatio, resolutionWidth, resolutionHeight }

// Planning
Planning { id, projectId, content, version }

// Script & Scene
Script { id, projectId, planningId, version }
Scene { id, scriptId, order, summary, visualType, voiceText, subtitles[], silenceDurationMs }
VisualType = 'image_gen' | 'stock_video' | 'solid_color'

// Assets
SceneAsset { id, sceneId, type, fileUrl, durationMs?, ... }
AssetType = 'voice' | 'subtitle' | 'image'

// ComposedVideo
ComposedVideo { id, projectId, fileUrl, status, durationSeconds }

// PublishText
PublishText { id, projectId, title, description }
```

## 修正時のポイント

1. **APIエンドポイント変更**: `presentation/routes/` 配下
2. **ビジネスロジック変更**: `application/usecases/` 配下
3. **ドメインモデル変更**: `domain/models/` 配下
4. **外部API連携変更**: `infrastructure/clients/` 配下
5. **DB操作変更**: `infrastructure/repositories/` 配下
6. **新しいGateway追加**: `domain/gateways/` にインターフェース定義 → `infrastructure/` に実装

## テスト

```bash
# ユニットテスト (domain, application)
pnpm --filter backend test:unit

# 統合テスト (infrastructure)
pnpm --filter backend test:integration
```
