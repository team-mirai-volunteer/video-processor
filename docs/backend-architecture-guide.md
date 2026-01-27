# Backend Architecture Guide

video-processor バックエンドの設計ルール。

---

## ディレクトリ構造

### Context の構成

```
contexts/
├── clip-video/          # 動画からクリップを抽出する機能
└── shared/              # 複数Contextで共有するインフラ
```

### 詳細構造

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
│   │   │   └── gateways/              # Context固有のGateway
│   │   ├── infrastructure/            # Context固有のrepositories, data
│   │   │   ├── repositories/
│   │   │   └── data/
│   │   └── presentation/              # Routes
│   │       └── routes/
│   │
│   └── shared/                        # Shared (複数コンテキストで共有)
│       ├── domain/
│       │   └── types/                 # Result<T,E>
│       ├── infrastructure/
│       │   ├── clients/               # 外部サービスClient
│       │   ├── database/              # Prisma
│       │   └── logging/
│       └── presentation/
│           └── middleware/
│
└── index.ts
```

---

## Gateway と Client の関係

**Gateway はドメイン層、Client はインフラ層**

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
}

// shared/infrastructure/clients/ffmpeg.client.ts
class FFmpegClient implements VideoProcessingGateway {
  async extractClip(...) { /* ... */ }
}

// clip-video/application/usecases/extract-clips.usecase.ts
class ExtractClipsUseCase {
  constructor(private videoProcessing: VideoProcessingGateway) {}
}
```

新しい Context を追加する場合、その Context 用の Gateway を定義し、既存の Client に実装を追加する。

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

`.dependency-cruiser.cjs` で自動検証される。

---

## エラーハンドリング

| 層 | 方式 |
|----|------|
| domain | `Result<T, E>` 型を返す |
| application | throw `ApplicationError` |
| infrastructure | throw |
| presentation | catch → HTTP response |

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
