# Backend Architecture Guide

video-processor バックエンドの設計ルール。

---

## 目次

1. [ディレクトリ構造](#ディレクトリ構造)
2. [Gateway と Client の関係](#gateway-と-client-の関係)
3. [依存関係ルール](#依存関係ルール)
4. [エラーハンドリング](#エラーハンドリング)
5. [チェックリスト](#チェックリスト)

---

## ディレクトリ構造

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
│   │   │   └── gateways/              # Context固有のGatewayインターフェース
│   │   ├── infrastructure/            # Context固有のrepositories, data
│   │   │   ├── repositories/
│   │   │   └── data/
│   │   └── presentation/              # Routes
│   │       └── routes/
│   │
│   └── shared/                        # Shared (複数コンテキストで共有)
│       ├── domain/
│       │   └── types/                 # Result<T,E> など共通型
│       ├── infrastructure/
│       │   ├── clients/               # 外部サービスクライアント（複数Gatewayを実装）
│       │   ├── database/              # Prisma connection & schema
│       │   └── logging/               # Logger
│       └── presentation/
│           └── middleware/            # error-handler, api-key-auth, logger
│
└── index.ts                           # Express app entry point
```

---

## Gateway と Client の関係

**原則: Gateway はドメイン層、Client はインフラ層**

ドメインが外部サービスに依存するのではなく、外部サービスがドメインに適合する。

| 種類 | 配置 | 説明 |
|------|------|------|
| Gateway インターフェース | `contexts/{context}/domain/gateways/` | ドメインの言葉で定義 |
| Client 実装 | `contexts/shared/infrastructure/clients/` | 複数 Gateway を実装可能 |
| Repository インターフェース | `contexts/{context}/domain/gateways/` | Context 固有 |
| Repository 実装 | `contexts/{context}/infrastructure/repositories/` | Context 固有 |

### Client は複数の Gateway を実装できる

```typescript
// clip-video/domain/gateways/video-processing.gateway.ts
interface VideoProcessingGateway {
  extractClip(source: string, start: number, end: number): Promise<string>;
  getDuration(path: string): Promise<number>;
}

// short-video-gen/domain/gateways/video-composition.gateway.ts (将来)
interface VideoCompositionGateway {
  composeFromImages(images: ImageFrame[], fps: number): Promise<string>;
  addAudioTrack(video: string, audio: string): Promise<string>;
}

// shared/infrastructure/clients/ffmpeg.client.ts
class FFmpegClient implements VideoProcessingGateway, VideoCompositionGateway {
  async extractClip(...) { /* ... */ }
  async getDuration(...) { /* ... */ }
  async composeFromImages(...) { /* ... */ }
  async addAudioTrack(...) { /* ... */ }
}
```

各 Context では自分の Gateway 型としてのみ認識:

```typescript
// clip-video の usecase
class ExtractClipsUseCase {
  constructor(private videoProcessing: VideoProcessingGateway) {}
}

// short-video-gen の usecase
class GenerateVideoUseCase {
  constructor(private videoComposition: VideoCompositionGateway) {}
}
```

### 共有 Client 一覧

| Client | clip-video Gateway | short-video-gen Gateway (予定) |
|--------|-------------------|-------------------------------|
| `FFmpegClient` | `VideoProcessingGateway` | `VideoCompositionGateway` |
| `OpenAIClient` | `AiGateway` | `ImageGenerationGateway` |
| `GoogleDriveClient` | `StorageGateway` | `AssetStorageGateway` |

---

## 依存関係ルール

| From | To | 許可 | 備考 |
|------|----|------|------|
| domain | application, infrastructure | ✗ | ドメインは最内層 |
| domain | shared/domain/types | ✓ | Result 型等 |
| application | domain | ✓ | |
| application | infrastructure | ✗ | Gateway 経由で使用 |
| application | shared/logging | ✓ | cross-cutting |
| infrastructure | domain/gateways | ✓ | Gateway を実装 |
| infrastructure | shared/clients | ✓ | |
| Context A | Context B | ✗ | Context 間は独立 |
| shared | 特定の Context | ✗ | shared は汎用 |

これらのルールは `.dependency-cruiser.cjs` で自動検証される。

---

## エラーハンドリング

| 層 | 方式 | 理由 |
|----|------|------|
| domain | `Result<T, E>` 型を返す | 明示的にエラーを表現 |
| application | throw `ApplicationError` | HTTP ステータスと対応 |
| infrastructure | throw | 技術的エラー |
| presentation | catch → HTTP response | 全エラーをここで変換 |

```typescript
// Domain層
function validate(data: Input): Result<Output, ValidationError> {
  if (!data.title) {
    return { success: false, error: new ValidationError('title required') };
  }
  return { success: true, value: transform(data) };
}

// Application層での変換
const result = validate(data);
if (!result.success) {
  throw new BadRequestError(result.error.message);
}
```

---

## チェックリスト

### コードレビュー時

- [ ] Gateway はドメインの言葉で定義されているか
- [ ] Application は Infrastructure に直接依存していないか
- [ ] Context 間の直接依存がないか
- [ ] shared にビジネスロジックが含まれていないか
- [ ] Domain 層のエラーは Result 型を使っているか

### 新機能追加時

- [ ] 適切な Context に配置したか
- [ ] Gateway インターフェースを先に定義したか（外部サービス連携時）
- [ ] テストを書いたか
