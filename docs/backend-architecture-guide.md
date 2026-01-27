# Backend Architecture Guide

このドキュメントは、video-processor バックエンドの設計原則と実装ガイドラインを定義する。
レビューAI・実装AIを含むすべての開発者が参照する「設計の憲法」として機能する。

---

## 目次

1. [目的と方針](#1-目的と方針)
2. [Bounded Context の設計](#2-bounded-context-の設計)
3. [レイヤー構造と責務](#3-レイヤー構造と責務)
4. [Gateway と Client の関係](#4-gateway-と-client-の関係)
5. [エラーハンドリング方針](#5-エラーハンドリング方針)
6. [依存関係ルール](#6-依存関係ルール)
7. [新機能追加の判断フロー](#7-新機能追加の判断フロー)
8. [チェックリスト](#8-チェックリスト)

---

## 1. 目的と方針

### 1.1 このガイドの目的

| 目的 | 説明 |
|------|------|
| **一貫性の確保** | 複数の開発者・AIが同じ設計判断を下せるようにする |
| **境界の明確化** | 何がどこに属するかの判断基準を提供する |
| **変更容易性** | 新機能追加時に既存コードへの影響を最小化する |

### 1.2 設計の基本方針

1. **ドメイン駆動設計（DDD）** - ビジネスロジックをドメイン層に集約
2. **Bounded Context** - 機能領域ごとにコードを分離
3. **依存性逆転の原則** - ドメインが外部に依存しない
4. **YAGNI** - 必要になるまで作らない

---

## 2. Bounded Context の設計

### 2.1 Bounded Context とは

Bounded Context は、特定のビジネス領域に関連するコードを論理的に分離する境界。
各 Context は独自の「ユビキタス言語」（ドメイン固有の用語）を持つ。

### 2.2 Context の構成

```
contexts/
├── clip-video/          # 動画からクリップを抽出する機能
├── short-video-gen/     # (将来) 画像から動画を生成する機能
└── shared/              # 複数Contextで共有するインフラ
```

### 2.3 Context 分割の判断基準

| 条件 | 判断 |
|------|------|
| 異なるビジネス目的を持つ | 別の Context |
| 同じエンティティを異なる視点で扱う | 別の Context |
| 同じユビキタス言語を共有する | 同じ Context |
| 技術的な共有のみ（DB, Logger等） | shared |

### 2.4 Context 間の関係

```
┌─────────────────┐     ┌─────────────────┐
│   clip-video    │     │ short-video-gen │
│                 │     │                 │
│  独自のdomain   │     │  独自のdomain   │
│  独自のgateway  │     │  独自のgateway  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   shared    │
              │             │
              │  clients    │
              │  database   │
              │  logging    │
              └─────────────┘
```

**重要な原則:**
- Context 間は直接依存しない
- 共有は shared を経由する
- shared は特定の Context に依存しない

---

## 3. レイヤー構造と責務

### 3.1 4層アーキテクチャ

各 Bounded Context は以下の4層で構成される:

```
presentation/    → HTTP インターフェース（薄く保つ）
application/     → ユースケースの orchestration
domain/          → ビジネスロジックの中核
infrastructure/  → 外部サービスとの接続
```

### 3.2 各層の責務

| 層 | 責務 | 含むもの | 含まないもの |
|----|------|----------|--------------|
| **presentation** | HTTPリクエスト/レスポンス変換 | routes, request validation | ビジネスロジック |
| **application** | ユースケースの実行順序制御 | usecases, application errors | ドメインルール |
| **domain** | ビジネスルールの表現 | models, services, gateways | 外部サービス呼び出し |
| **infrastructure** | 技術的実装 | repositories, (shared経由でclients) | ビジネスロジック |

### 3.3 Domain Model の設計原則

| 原則 | 説明 |
|------|------|
| **イミュータブル** | 状態変更は新しいインスタンスを返す |
| **プライベートコンストラクタ** | ファクトリメソッド経由でのみ生成 |
| **バリデーション内包** | 不正な状態のインスタンスは存在できない |
| **外部依存なし** | 純粋なビジネスロジックのみ |

```typescript
// Domain Model の基本パターン
class Video {
  private constructor(private readonly props: VideoProps) {}

  static create(input: CreateVideoInput): Result<Video, ValidationError> {
    // バリデーション
    if (!input.title) {
      return { success: false, error: new ValidationError('title required') };
    }
    return { success: true, value: new Video({ ...input }) };
  }

  // イミュータブルな更新
  withStatus(status: VideoStatus): Video {
    return new Video({ ...this.props, status });
  }
}
```

---

## 4. Gateway と Client の関係

### 4.1 基本原則: 依存性逆転

**「ドメインが外部サービスに依存するのではなく、外部サービスがドメインに適合する」**

```
Domain Layer                 Infrastructure Layer
┌────────────────────┐       ┌────────────────────┐
│                    │       │                    │
│  Gateway           │◄──────│  Client            │
│  (interface)       │       │  (implementation)  │
│                    │       │                    │
│  ドメインの言葉で   │       │  技術的な実装      │
│  定義される        │       │                    │
└────────────────────┘       └────────────────────┘
```

### 4.2 Gateway はドメインの言葉で定義する

**なぜ？**
- 各 Context は独自のユビキタス言語を持つ
- 同じ技術（FFmpeg等）でも、Context によって異なる概念として扱う

| Context | Gateway | メソッド例 | 概念 |
|---------|---------|-----------|------|
| clip-video | `VideoProcessingGateway` | `extractClip()` | クリップを抽出する |
| short-video-gen | `VideoCompositionGateway` | `composeFromImages()` | 画像から動画を合成する |

### 4.3 Client は複数の Gateway を実装できる

```typescript
// shared/infrastructure/clients/ffmpeg.client.ts
class FFmpegClient
  implements VideoProcessingGateway, VideoCompositionGateway {

  // clip-video 用
  async extractClip(...) { /* ... */ }

  // short-video-gen 用
  async composeFromImages(...) { /* ... */ }
}
```

**メリット:**
- **インターフェース分離**: 各 Context は必要なメソッドだけを知る
- **Context 間の疎結合**: 一方の Gateway 変更が他方に影響しない
- **実装の共有**: 技術的な実装コードの重複を避ける

### 4.4 配置ルール

| 種類 | 配置場所 | 理由 |
|------|----------|------|
| Gateway インターフェース | `contexts/{context}/domain/gateways/` | ドメインの一部 |
| Client 実装 | `contexts/shared/infrastructure/clients/` | 技術的実装は共有 |
| Repository インターフェース | `contexts/{context}/domain/gateways/` | Context 固有のエンティティ |
| Repository 実装 | `contexts/{context}/infrastructure/repositories/` | Context 固有 |

---

## 5. エラーハンドリング方針

### 5.1 層別のエラー表現

| 層 | エラー表現 | 理由 |
|----|-----------|------|
| **domain** | `Result<T, E>` 型 | 例外を使わず明示的に失敗を表現 |
| **application** | throw `ApplicationError` | HTTP ステータスコードと対応 |
| **infrastructure** | throw | 技術的エラーは例外で伝播 |
| **presentation** | catch & response | 全てのエラーをここで HTTP レスポンスに変換 |

### 5.2 Result 型パターン

```typescript
type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };

// Domain層での使用
function validateTimestamps(timestamps: Timestamp[]): Result<Timestamp[], ValidationError> {
  if (hasOverlap(timestamps)) {
    return { success: false, error: new ValidationError('Timestamps overlap') };
  }
  return { success: true, value: timestamps };
}

// Application層での変換
const result = validateTimestamps(timestamps);
if (!result.success) {
  throw new BadRequestError(result.error.message);
}
```

### 5.3 エラー設計の原則

| 原則 | 説明 |
|------|------|
| **早期失敗** | 不正な入力は早い段階で検出する |
| **明示的なエラー** | 何が問題かを具体的に伝える |
| **回復可能性の区別** | リトライ可能なエラーと不可能なエラーを区別する |
| **ログとレスポンスの分離** | 内部詳細はログへ、ユーザーには適切なメッセージを |

---

## 6. 依存関係ルール

### 6.1 許可される依存方向

```
presentation → application → domain ← infrastructure
                               ↑
                            shared
```

### 6.2 依存ルール一覧

| From | To | 許可 | 理由 |
|------|----|------|------|
| domain | application | ✗ | ドメインは最も内側 |
| domain | infrastructure | ✗ | ドメインは技術に依存しない |
| domain | shared/domain/types | ✓ | 共通型（Result等）は許可 |
| application | domain | ✓ | ユースケースはドメインを使う |
| application | infrastructure | ✗ | 直接依存は禁止（Gateway経由） |
| application | shared/logging | ✓ | ロギングは cross-cutting concern |
| infrastructure | domain | ✓ | Gateway を実装する |
| infrastructure | shared/clients | ✓ | 共有 Client を使用 |
| Context A | Context B | ✗ | Context 間の直接依存は禁止 |
| shared | 特定の Context | ✗ | shared は Context に依存しない |

### 6.3 dependency-cruiser による自動検証

これらのルールは `.dependency-cruiser.cjs` で自動検証される。
`pnpm --filter backend dep-cruise` で違反を検出できる。

---

## 7. 新機能追加の判断フロー

### 7.1 どの Context に追加するか

```
新機能の追加
    │
    ▼
既存の Context のビジネス目的に合致するか？
    │
    ├─ Yes → その Context に追加
    │
    └─ No → 新しい Bounded Context を検討
              │
              ▼
          十分な複雑さがあるか？
              │
              ├─ Yes → 新しい Context を作成
              │
              └─ No → 最も近い Context に追加（暫定）
```

### 7.2 どの層に追加するか

| 追加するもの | 配置先 |
|-------------|--------|
| ビジネスルール、バリデーション | domain/services |
| エンティティ、値オブジェクト | domain/models |
| 外部サービスの抽象化 | domain/gateways |
| ユースケースの実行フロー | application/usecases |
| DB アクセス | infrastructure/repositories |
| HTTP エンドポイント | presentation/routes |

### 7.3 shared に追加すべきか

```
この機能は複数の Context で使われるか？
    │
    ├─ Yes → shared に配置
    │         │
    │         └─ ただし: ビジネスロジックは含めない
    │                    技術的な実装のみ
    │
    └─ No → 特定の Context 内に配置
```

---

## 8. チェックリスト

### 8.1 コードレビュー時

- [ ] Domain Model は外部サービスに依存していないか
- [ ] Gateway はドメインの言葉で定義されているか
- [ ] Application 層は Infrastructure に直接依存していないか
- [ ] エラーハンドリングが層の方針に従っているか
- [ ] Context 間の直接依存がないか
- [ ] shared にビジネスロジックが含まれていないか

### 8.2 新機能追加時

- [ ] 適切な Context を選択したか
- [ ] 適切な層に配置したか
- [ ] Gateway インターフェースを先に定義したか（外部サービス連携時）
- [ ] Result 型を使っているか（Domain 層のエラー）
- [ ] テストを書いたか

### 8.3 リファクタリング時

- [ ] 依存方向が正しいか（dependency-cruiser で確認）
- [ ] 不要な依存を削除したか
- [ ] Context の境界が明確か

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-01-27 | 初版作成 |
