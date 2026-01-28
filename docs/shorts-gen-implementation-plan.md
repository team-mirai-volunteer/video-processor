# shorts-gen 実装計画

## テストポリシー

本実装計画のテストに関しては、以下のガイドラインに従ってください：

- [Backend Architecture Guide](https://github.com/team-mirai-volunteer/video-processor/blob/develop/docs/backend-architecture-guide.md)
- [Backend Testing Guide](https://github.com/team-mirai-volunteer/video-processor/blob/develop/docs/backend-testing-guide.md)

### 全タスク共通の注意事項

> ⚠️ **PR作成前チェック**: 各タスク完了後、PRを作成する前に以下がローカルで通ることを確認してください：
> - `pnpm typecheck` - 型チェック
> - `pnpm lint` - Lint
> - `pnpm test` - テスト

---

## 並列実行ガイド（Claude Code Web用）

### Wave全体像

```
[Wave 1] A1 → A2 → A3（1人・直列）

[Wave 2] B1, B2, B3, B4, B5, B6, B7（7並列）
         E1, E2（2並列・API不要なので先行）

[Wave 3] C1〜C9（9並列）※B完了次第

[Wave 4] D1〜D8（8並列）※各Cの完了次第

[Wave 5] E3〜E7（5並列）※各Dの完了次第

[Wave 6] F1, F2（2並列）
```

---

## タスクID早見表

| Wave | ID | 内容 | 依存 |
|------|----|------|------|
| 1 | A1 | Prismaスキーマ追加 | - |
| 1 | A2 | Domain models定義 | A1 |
| 1 | A3 | Gateway interfaces定義 | A2 |
| 2 | B1 | Fish Audio TTSクライアント + integration test | A3 |
| 2 | B2 | nano banana 画像生成クライアント + integration test | A3 |
| 2 | B3 | OpenAI Agenticクライアント（Vercel AI SDK）+ integration test | A3 |
| 2 | B4 | FFmpeg字幕画像生成 + integration test | A3 |
| 2 | B5 | FFmpeg Compose + integration test | A3 |
| 2 | B6 | Prisma Repository実装（7個） | A1, A2 |
| 2 | B7 | Asset Registry（素材管理JSON + client） | - |
| 2 | E1 | 共通UIコンポーネント（ステップカード、進捗表示） | - |
| 2 | E2 | チャットUIコンポーネント | - |
| 3 | C1 | CreateProjectUseCase | B6 |
| 3 | C2 | GeneratePlanningUseCase | B3, B6 |
| 3 | C3 | GenerateScriptUseCase | B3, B6 |
| 3 | C4 | SynthesizeVoiceUseCase | B1, B6 |
| 3 | C5 | GenerateSubtitlesUseCase | B4, B6 |
| 3 | C6 | GenerateImagePromptsUseCase | B3, B6 |
| 3 | C7 | GenerateImagesUseCase | B2, B6 |
| 3 | C8 | ComposeVideoUseCase | B5, B6, B7 |
| 3 | C9 | GeneratePublishTextUseCase | B3, B6 |
| 4 | D1 | project.routes.ts | C1 |
| 4 | D2 | planning.routes.ts (SSE) | C2 |
| 4 | D3 | script.routes.ts (SSE) | C3 |
| 4 | D4 | voice.routes.ts | C4 |
| 4 | D5 | subtitle.routes.ts | C5 |
| 4 | D6 | image.routes.ts | C6, C7 |
| 4 | D7 | compose.routes.ts | C8 |
| 4 | D8 | publish.routes.ts | C9 |
| 5 | E3 | プロジェクト一覧・作成ページ | D1, E1 |
| 5 | E4 | 企画書生成UI（チャット + SSE） | D2, E2 |
| 5 | E5 | 台本生成UI（チャット + SSE） | D3, E2 |
| 5 | E6 | 素材生成UI（3列並列表示） | D4, D5, D6, E1 |
| 5 | E7 | Compose・公開テキストUI | D7, D8, E1 |
| 6 | F1 | E2Eテスト | E全完了 |
| 6 | F2 | 最終ドキュメント整備 | 全完了 |

---

## Phase詳細

### Phase A: 基盤設計（直列）

#### A1: Prismaスキーマ追加

```prisma
// 追加するテーブル
ShortsProject        // 企画ルート
ShortsPlanning       // 企画書
ShortsScript         // 台本
ShortsScene          // シーン
ShortsSceneAsset     // 生成アセット（音声/字幕画像/画像）
ShortsComposedVideo  // 合成動画
ShortsPublishText    // 公開テキスト
```

#### A2: Domain models定義

```
apps/backend/src/contexts/shorts-gen/domain/models/
├── project.ts
├── planning.ts
├── script.ts
├── scene.ts
├── scene-asset.ts
├── composed-video.ts
├── publish-text.ts
└── index.ts
```

> ⚠️ **テスト必須**: 各モデルに対してユニットテストを作成してください。

#### A3: Gateway interfaces定義

```
apps/backend/src/contexts/shorts-gen/domain/gateways/
├── tts.gateway.ts           # TTS（+STS考慮）
├── image-gen.gateway.ts     # 画像生成
├── agentic-ai.gateway.ts    # Agentic AI（tool use対応）
├── video-compose.gateway.ts # 動画合成
├── subtitle-generator.gateway.ts # 字幕画像生成
├── *-repository.ts          # 各エンティティのリポジトリIF
└── index.ts
```

---

### Phase B: Infrastructure層（7並列）

#### B1: Fish Audio TTS Client

- API仕様を調査（WebSearch）
- TTS/STS両対応を検討
- integration test必須

#### B2: nano banana ImageGen Client

- API仕様を調査（WebSearch）
- ドキュメント化
- integration test必須

#### B3: OpenAI Agentic Client

- **Vercel AI SDK** 使用
- tool use（function calling）対応
- ストリーミング対応（AsyncIterable）
- integration test必須

#### B4: FFmpeg Subtitle Generator

- 透明背景PNG生成
- drawtext filter使用
- integration test必須

#### B5: FFmpeg Compose Client

- 複数シーン結合
- 字幕overlay
- BGM合成（amix）
- integration test必須

#### B6: Prisma Repository実装

- 7エンティティ分のCRUD

#### B7: Asset Registry

- `assets/videos/` - ありもの動画
- `assets/bgm/` - BGM
- `asset-registry.json` - 対応表
- AssetRegistryClient - キー→パス解決

---

### Phase C: Application層（9並列）

各UseCaseは依存するGateway/Repositoryを注入。

> ⚠️ **テスト必須**: 各UseCaseに対してユニットテストを作成してください。Gateway/Repositoryはモックを使用します。

---

### Phase D: Presentation層（8並列）

- SSE対応: D2, D3
- 個別シーン再実行API含む

---

### Phase E: Frontend

#### E1: 共通UIコンポーネント
- StepCard（縦連なりのステップ表示）
- ProgressIndicator（進捗表示）

#### E2: チャットUIコンポーネント
- SSE対応メッセージストリーム
- ユーザー入力 + AI応答表示

#### E3〜E7: 各ページ実装

---

### Phase F: 統合

- E2Eテスト（Playwright）
- ドキュメント整備

---

## 指示例

### 単一タスク

```
A1を実行してください。
機能仕様: docs/shorts-gen-feature-spec.md
実装計画: docs/shorts-gen-implementation-plan.md
```

### 並列タスク

```
Wave 2を並列実行してください。
タスク: B1, B2, B3, B4, B5, B6, B7, E1, E2
機能仕様: docs/shorts-gen-feature-spec.md
実装計画: docs/shorts-gen-implementation-plan.md
```

---

## ディレクトリ構造

```
apps/backend/src/contexts/shorts-gen/
├── domain/
│   ├── models/
│   ├── gateways/
│   └── services/
├── application/
│   ├── usecases/
│   └── errors/
├── infrastructure/
│   ├── repositories/
│   ├── clients/
│   └── assets/
│       ├── videos/
│       ├── bgm/
│       └── asset-registry.json
└── presentation/
    └── routes/

apps/webapp/
├── app/shorts-gen/
│   ├── page.tsx              # 一覧
│   └── [projectId]/
│       └── page.tsx          # 生成フロー
└── components/shorts-gen/
    ├── step-card.tsx
    ├── progress-indicator.tsx
    └── chat/
        └── chat-ui.tsx
```

---

## 技術メモ

### SSE実装

```typescript
// Backend
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
for await (const chunk of aiStream) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

// Frontend
const response = await fetch(url);
const reader = response.body.getReader();
```

### Agentic Tool Use

```typescript
const tools = [
  {
    name: 'save_planning',
    description: '企画書を保存する',
    parameters: { markdownContent: { type: 'string' } }
  }
];

// AIがtool_callを返したらDBに保存
if (response.tool_calls) {
  await planningRepository.save(projectId, call.arguments);
}
```
