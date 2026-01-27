# Bounded Context 移行プラン

## 概要

現在の `apps/backend/src` 配下のコードを Bounded Context パターンに再構成する。
最初のコンテキストとして `clip-video` を導入し、将来的に他のコンテキストを追加できる基盤を作る。

## 目標構造

```
apps/backend/src/
├── contexts/
│   ├── clip-video/                    # Clip Video Bounded Context
│   │   ├── application/               # Use cases
│   │   │   ├── usecases/
│   │   │   └── errors/
│   │   ├── domain/                    # Domain models, services, gateways
│   │   │   ├── models/
│   │   │   ├── services/
│   │   │   ├── gateways/
│   │   │   └── types/
│   │   ├── infrastructure/            # Context固有のrepositories
│   │   │   └── repositories/
│   │   └── presentation/              # Routes, middleware
│   │       ├── routes/
│   │       └── middleware/
│   │
│   └── shared/                        # Shared Context (複数コンテキストで共有)
│       ├── infrastructure/
│       │   ├── clients/               # 外部サービスクライアント
│       │   │   ├── google-drive.client.ts
│       │   │   ├── gcs.client.ts
│       │   │   ├── speech-to-text.client.ts
│       │   │   ├── ffmpeg.client.ts
│       │   │   ├── openai.client.ts
│       │   │   └── local-*.client.ts
│       │   ├── database/              # Prisma connection
│       │   └── logging/               # Logger
│       └── types/                     # 共通型定義
│
├── index.ts                           # Express app entry point
└── bootstrap.ts                       # DI container / context 初期化
```

## 現状分析

### 現在の構造
```
apps/backend/src/
├── application/usecases/    # 11 use cases
├── domain/
│   ├── models/              # 5 models (Video, Clip, Transcription, etc.)
│   ├── services/            # 4 services
│   ├── gateways/            # 10 gateway interfaces
│   └── types/               # Result type
├── infrastructure/
│   ├── clients/             # 7 external clients
│   ├── repositories/        # 5 repositories
│   ├── database/            # Prisma
│   ├── logging/             # Logger
│   └── data/                # Config data
└── presentation/
    ├── routes/              # 3 routers
    └── middleware/          # Error handler, auth, logger
```

### 移行対象の分類

| 現在の場所 | 移行先 | 備考 |
|-----------|--------|------|
| `domain/models/*` | `contexts/clip-video/domain/models/` | 全て clip-video 固有 |
| `domain/services/*` | `contexts/clip-video/domain/services/` | 全て clip-video 固有 |
| `domain/gateways/*-repository.gateway.ts` | `contexts/clip-video/domain/gateways/` | Repository gateway は context 固有 |
| `domain/gateways/{ai,storage,temp-storage,transcription,video-processing}.gateway.ts` | `contexts/shared/domain/gateways/` または `contexts/clip-video/domain/gateways/` | 要検討 |
| `domain/types/` | `contexts/clip-video/domain/types/` | Result型は共通化も可 |
| `application/usecases/*` | `contexts/clip-video/application/usecases/` | 全て clip-video 固有 |
| `application/errors/*` | `contexts/clip-video/application/errors/` | |
| `infrastructure/repositories/*` | `contexts/clip-video/infrastructure/repositories/` | Context 固有 |
| `infrastructure/clients/*` | `contexts/shared/infrastructure/clients/` | 共有リソース |
| `infrastructure/database/*` | `contexts/shared/infrastructure/database/` | 共有リソース |
| `infrastructure/logging/*` | `contexts/shared/infrastructure/logging/` | Cross-cutting concern |
| `infrastructure/data/*` | `contexts/clip-video/infrastructure/data/` または shared | 要検討 |
| `presentation/routes/*` | `contexts/clip-video/presentation/routes/` | Context 固有 |
| `presentation/middleware/*` | `contexts/shared/presentation/middleware/` または context 固有 | 要検討 |

---

## 移行フェーズ

### Phase 1: 準備 (ツール設定・テスト基盤)

#### 1.1 ディレクトリ構造の作成
```bash
mkdir -p apps/backend/src/contexts/clip-video/{application,domain,infrastructure,presentation}
mkdir -p apps/backend/src/contexts/shared/infrastructure
```

#### 1.2 TypeScript 設定更新

**`apps/backend/tsconfig.json`** - paths 追加
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@clip-video/*": ["./src/contexts/clip-video/*"],
      "@shared/*": ["./src/contexts/shared/*"]
    }
  }
}
```

#### 1.3 Vitest 設定更新

**`apps/backend/vitest.config.ts`**
```typescript
export default defineConfig({
  test: {
    // 既存設定に追加
    alias: {
      '@clip-video': path.resolve(__dirname, './src/contexts/clip-video'),
      '@shared': path.resolve(__dirname, './src/contexts/shared'),
    },
  },
});
```

#### 1.4 Dependency Cruiser 設定更新

**`apps/backend/.dependency-cruiser.cjs`** - Bounded Context 用ルール追加

```javascript
// 追加するルール
{
  // Context間の依存ルール
  name: 'context-isolation',
  severity: 'error',
  comment: 'Bounded contexts should not depend on each other directly',
  from: { path: '^src/contexts/clip-video' },
  to: {
    path: '^src/contexts/',
    pathNot: [
      '^src/contexts/clip-video',
      '^src/contexts/shared'
    ]
  },
},
{
  // Shared context は他のcontextに依存してはいけない
  name: 'shared-context-independence',
  severity: 'error',
  comment: 'Shared context must not depend on specific bounded contexts',
  from: { path: '^src/contexts/shared' },
  to: {
    path: '^src/contexts/',
    pathNot: '^src/contexts/shared'
  },
},
// DDD層ルールを context 配下に適用
{
  name: 'clip-video-domain-isolation',
  severity: 'error',
  from: { path: '^src/contexts/clip-video/domain' },
  to: {
    path: '^src/contexts/clip-video/(application|infrastructure|presentation)'
  },
},
{
  name: 'clip-video-application-cannot-depend-on-infra',
  severity: 'error',
  from: { path: '^src/contexts/clip-video/application' },
  to: {
    path: '^src/contexts/clip-video/infrastructure',
    pathNot: '^src/contexts/shared/infrastructure/logging/'
  },
},
```

#### 1.5 Knip 設定更新

**`knip.json`**
```json
{
  "workspaces": {
    "apps/backend": {
      "project": ["src/**/*.ts"],
      "entry": [
        "src/index.ts",
        "src/contexts/*/presentation/routes/*.ts"
      ],
      "ignore": [
        "src/**/*.test.ts",
        "test/**/*.ts"
      ]
    }
  }
}
```

#### 1.6 テストディレクトリ構造の更新

```
apps/backend/test/
├── unit/
│   └── contexts/
│       └── clip-video/
│           ├── application/usecases/
│           └── domain/
│               ├── models/
│               └── services/
├── integration/
│   └── contexts/
│       ├── clip-video/
│       │   └── infrastructure/repositories/
│       └── shared/
│           └── infrastructure/clients/
└── e2e/
    └── api.test.ts
```

---

### Phase 2: Shared Context の移行

#### 2.1 Infrastructure clients の移行

移行順序（依存関係を考慮）:
1. `logging/` → `contexts/shared/infrastructure/logging/`
2. `database/` → `contexts/shared/infrastructure/database/`
3. `clients/` → `contexts/shared/infrastructure/clients/`

#### 2.2 移行ファイル一覧

| 現在 | 移行先 |
|------|--------|
| `infrastructure/logging/*` | `contexts/shared/infrastructure/logging/` |
| `infrastructure/database/*` | `contexts/shared/infrastructure/database/` |
| `infrastructure/clients/google-drive.client.ts` | `contexts/shared/infrastructure/clients/` |
| `infrastructure/clients/gcs.client.ts` | `contexts/shared/infrastructure/clients/` |
| `infrastructure/clients/speech-to-text.client.ts` | `contexts/shared/infrastructure/clients/` |
| `infrastructure/clients/ffmpeg.client.ts` | `contexts/shared/infrastructure/clients/` |
| `infrastructure/clients/openai.client.ts` | `contexts/shared/infrastructure/clients/` |
| `infrastructure/clients/local-*.client.ts` | `contexts/shared/infrastructure/clients/` |

#### 2.3 エクスポートの整理

**`contexts/shared/infrastructure/index.ts`** (barrel file)
```typescript
export * from './logging/logger.js';
export * from './database/connection.js';
export * from './clients/google-drive.client.js';
// ... etc
```

---

### Phase 3: Clip-Video Context の移行

#### 3.1 Domain 層の移行

移行順序:
1. `domain/types/` → `contexts/clip-video/domain/types/`
2. `domain/models/` → `contexts/clip-video/domain/models/`
3. `domain/gateways/` → `contexts/clip-video/domain/gateways/`
4. `domain/services/` → `contexts/clip-video/domain/services/`

#### 3.2 Application 層の移行

1. `application/errors/` → `contexts/clip-video/application/errors/`
2. `application/usecases/` → `contexts/clip-video/application/usecases/`

#### 3.3 Infrastructure 層の移行 (Repositories のみ)

| 現在 | 移行先 |
|------|--------|
| `infrastructure/repositories/video.repository.ts` | `contexts/clip-video/infrastructure/repositories/` |
| `infrastructure/repositories/clip.repository.ts` | `contexts/clip-video/infrastructure/repositories/` |
| `infrastructure/repositories/transcription.repository.ts` | `contexts/clip-video/infrastructure/repositories/` |
| `infrastructure/repositories/refined-transcription.repository.ts` | `contexts/clip-video/infrastructure/repositories/` |
| `infrastructure/repositories/processing-job.repository.ts` | `contexts/clip-video/infrastructure/repositories/` |

#### 3.4 Presentation 層の移行

| 現在 | 移行先 |
|------|--------|
| `presentation/routes/videos.ts` | `contexts/clip-video/presentation/routes/` |
| `presentation/routes/clips.ts` | `contexts/clip-video/presentation/routes/` |
| `presentation/routes/health.ts` | `contexts/shared/presentation/routes/` |
| `presentation/routes/index.ts` | エントリーポイントとして残す or 再構成 |
| `presentation/middleware/*` | `contexts/shared/presentation/middleware/` |

---

### Phase 4: Import パスの更新

すべてのファイルで import パスを更新:

```typescript
// Before
import { Video } from '../../../domain/models/video.js';
import { logger } from '../../../infrastructure/logging/logger.js';

// After
import { Video } from '@clip-video/domain/models/video.js';
import { logger } from '@shared/infrastructure/logging/logger.js';
```

---

### Phase 5: テストの移行

#### 5.1 Unit テストの移行

| 現在 | 移行先 |
|------|--------|
| `test/unit/domain/models/*` | `test/unit/contexts/clip-video/domain/models/` |
| `test/unit/domain/services/*` | `test/unit/contexts/clip-video/domain/services/` |
| `test/unit/application/usecases/*` | `test/unit/contexts/clip-video/application/usecases/` |
| `test/unit/infrastructure/clients/*` | `test/unit/contexts/shared/infrastructure/clients/` |

#### 5.2 Integration テストの移行

| 現在 | 移行先 |
|------|--------|
| `test/integration/infrastructure/repositories/*` | `test/integration/contexts/clip-video/infrastructure/repositories/` |
| `test/integration/infrastructure/clients/*` | `test/integration/contexts/shared/infrastructure/clients/` |
| `test/integration/application/usecases/*` | `test/integration/contexts/clip-video/application/usecases/` |

#### 5.3 テストの import パス更新

テスト内の import も新しいパスに更新。

---

### Phase 6: クリーンアップと検証

#### 6.1 旧ディレクトリの削除
```bash
rm -rf apps/backend/src/application
rm -rf apps/backend/src/domain
rm -rf apps/backend/src/infrastructure
rm -rf apps/backend/src/presentation
```

#### 6.2 全テスト実行
```bash
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter backend test:e2e
```

#### 6.3 ツール検証
```bash
pnpm --filter backend dep-cruise
pnpm knip
pnpm --filter backend typecheck
pnpm --filter backend lint
```

---

## 検討事項・質問

### Q1: Gateway インターフェースの配置

外部サービス用の Gateway インターフェース（`AiGateway`, `StorageGateway` など）は:
- **Option A**: `contexts/shared/domain/gateways/` に配置（複数コンテキストで共有可能）
- **Option B**: `contexts/clip-video/domain/gateways/` に配置し、他のコンテキストは独自定義

→ **推奨: Option A** - 外部サービスの抽象化は共有する方が一貫性がある

### Q2: Result 型の配置

- **Option A**: `contexts/shared/domain/types/result.ts`
- **Option B**: 各コンテキストで独自定義

→ **推奨: Option A** - 基本的な型は共有

### Q3: Middleware の配置

- `error-handler`, `api-key-auth`, `request-logger` は shared に置くか？
- Context 固有の middleware が出てきた場合は context 内に配置

→ **推奨**: 現状は全て shared。将来 context 固有が出たら分離

### Q4: Prisma Schema の配置

現在 `infrastructure/database/prisma/schema.prisma` にある。
- **Option A**: `contexts/shared/infrastructure/database/prisma/`
- **Option B**: ルートレベル `apps/backend/prisma/`

→ **推奨: Option A** - 既存構造を維持しつつ shared に移動

### Q5: infrastructure/data/ の配置

`proper-noun-dictionary.json` など設定データ:
- clip-video 固有なら `contexts/clip-video/infrastructure/data/`
- 共通なら `contexts/shared/infrastructure/data/`

→ **要確認**: 現在の使用箇所を確認

---

## 移行チェックリスト

### Phase 1: 準備
- [ ] ディレクトリ構造作成
- [ ] tsconfig.json paths 更新
- [ ] tsconfig.check.json 更新
- [ ] vitest.config.ts alias 追加
- [ ] .dependency-cruiser.cjs ルール更新
- [ ] knip.json entry points 更新
- [ ] テストディレクトリ構造作成

### Phase 2: Shared Context
- [ ] logging/ 移行
- [ ] database/ 移行
- [ ] clients/ 移行
- [ ] barrel file (index.ts) 作成

### Phase 3: Clip-Video Context
- [ ] domain/types 移行
- [ ] domain/models 移行
- [ ] domain/gateways 移行
- [ ] domain/services 移行
- [ ] application/errors 移行
- [ ] application/usecases 移行
- [ ] infrastructure/repositories 移行
- [ ] presentation/routes 移行

### Phase 4: Import パス更新
- [ ] 全ソースファイルの import 更新
- [ ] 全テストファイルの import 更新

### Phase 5: テスト移行
- [ ] unit テスト移行
- [ ] integration テスト移行
- [ ] e2e テスト確認

### Phase 6: 検証
- [ ] pnpm --filter backend typecheck
- [ ] pnpm --filter backend lint
- [ ] pnpm --filter backend test:unit
- [ ] pnpm --filter backend test:integration
- [ ] pnpm --filter backend test:e2e
- [ ] pnpm --filter backend dep-cruise
- [ ] pnpm knip
- [ ] 旧ディレクトリ削除

---

## 次のステップ

1. 上記の検討事項について決定
2. Phase 1 から順次実行
3. 各 Phase 完了後にテスト実行して動作確認

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-01-27 | 初版作成 |
