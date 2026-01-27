# Backend Architecture Guide

video-processor バックエンドの設計ルール。

---

## ディレクトリ構造

```
apps/backend/src/
├── contexts/
│   ├── clip-video/                    # Clip Video Context
│   │   ├── application/usecases/
│   │   ├── application/errors/
│   │   ├── domain/models/
│   │   ├── domain/services/
│   │   ├── domain/gateways/           # Context固有のGateway
│   │   ├── infrastructure/repositories/
│   │   ├── infrastructure/data/
│   │   └── presentation/routes/
│   │
│   └── shared/
│       ├── domain/types/              # Result<T,E>
│       ├── infrastructure/clients/    # 外部サービスClient
│       ├── infrastructure/database/   # Prisma
│       ├── infrastructure/logging/
│       └── presentation/middleware/
│
└── index.ts
```

---

## Gateway と Client の関係

**原則: Gateway はドメイン、Client はインフラ**

| 種類 | 配置 | 説明 |
|------|------|------|
| Gateway インターフェース | `contexts/{context}/domain/gateways/` | ドメインの言葉で定義 |
| Client 実装 | `contexts/shared/infrastructure/clients/` | 複数 Gateway を実装可能 |
| Repository インターフェース | `contexts/{context}/domain/gateways/` | Context 固有 |
| Repository 実装 | `contexts/{context}/infrastructure/repositories/` | Context 固有 |

**Client は複数の Gateway を実装できる:**

```typescript
// clip-video/domain/gateways/
interface VideoProcessingGateway {
  extractClip(source: string, start: number, end: number): Promise<string>;
}

// short-video-gen/domain/gateways/ (将来)
interface VideoCompositionGateway {
  composeFromImages(images: ImageFrame[], fps: number): Promise<string>;
}

// shared/infrastructure/clients/
class FFmpegClient implements VideoProcessingGateway, VideoCompositionGateway {
  async extractClip(...) { /* ... */ }
  async composeFromImages(...) { /* ... */ }
}
```

---

## 依存関係ルール

| From | To | 許可 |
|------|----|------|
| domain | application, infrastructure | ✗ |
| domain | shared/domain/types | ✓ |
| application | domain | ✓ |
| application | infrastructure | ✗ (Gateway経由) |
| application | shared/logging | ✓ |
| infrastructure | domain/gateways | ✓ |
| infrastructure | shared/clients | ✓ |
| Context A | Context B | ✗ |
| shared | 特定の Context | ✗ |

---

## エラーハンドリング

| 層 | 方式 |
|----|------|
| domain | `Result<T, E>` 型を返す |
| application | throw `ApplicationError` |
| infrastructure | throw |
| presentation | catch → HTTP response |

---

## チェックリスト

### コードレビュー時
- [ ] Gateway はドメインの言葉で定義されているか
- [ ] Application は Infrastructure に直接依存していないか
- [ ] Context 間の直接依存がないか
- [ ] shared にビジネスロジックが含まれていないか

### 新機能追加時
- [ ] Gateway インターフェースを先に定義したか（外部サービス連携時）
- [ ] Domain 層のエラーは Result 型を使っているか
