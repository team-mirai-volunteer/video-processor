# CLAUDE.md

video-processor: Google Drive動画をAIで分析し、ショート動画に自動切り抜きするツール

## Quick Reference

```bash
# 開発
pnpm dev              # frontend + backend 同時起動
pnpm lint             # Biomeでlint
pnpm lint:fix         # lint + 自動修正
pnpm typecheck        # TypeScript型チェック

# Backend (apps/backend)
pnpm --filter backend test:unit         # ユニットテスト
pnpm --filter backend test:integration  # 統合テスト (要DB)
pnpm --filter backend db:studio         # Prisma Studio

# Frontend (apps/webapp)
pnpm --filter @video-processor/webapp test:e2e  # Playwright E2E
```

## Architecture

pnpm monorepo構成:
- `apps/webapp` - Next.js (App Router) + shadcn/ui + Tailwind
- `apps/backend` - Express + Prisma + DDD構成
- `apps/shared` - 共通型定義

### Backend Bounded Contexts

`apps/backend/src/contexts/` に複数のBCが存在:
- `clip-video` - 動画クリップ切り出し機能
- `shorts-gen` - ショート動画生成機能
- `shared` - BC間共有コード

### Backend DDD Layers (各BC内)

```
presentation/  → routes, middleware (薄く保つ)
application/   → usecases, services (throw errors)
domain/        → models, services, gateways (Result型で表現)
infrastructure/→ repositories, clients (throw errors)
```

詳細: [docs/backend-architecture-guide.md](docs/backend-architecture-guide.md)

## Coding Standards

- **Formatter/Linter**: Biome (single quotes, semicolons, 2 spaces)
- **Domain層エラー**: Result型 `{ success: true, value } | { success: false, error }`
- **他層エラー**: throw → presentation層でハンドリング
- **テスト**: domain/application → unit, infrastructure → integration, webapp → e2e

## Git Hooks

- **pre-push hook**: lint, typecheckが自動実行される
- **失敗時の対応**: hookエラーはスキップせず必ず修正する
  - 作業に直接関係ないエラーでも修正対象
  - あまりにも複雑な場合のみ質問する
  - `--no-verify`でのスキップは原則禁止

## Test Guidelines

| Layer | Test Type | Command |
|-------|-----------|---------|
| domain, application | unit (mock) | `pnpm --filter backend test:unit` |
| infrastructure | integration | `pnpm --filter backend test:integration` |
| webapp | e2e (Playwright) | `pnpm --filter @video-processor/webapp test:e2e` |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, shadcn/ui, Tailwind |
| Backend | Express, Prisma, TypeScript |
| AI | Gemini (via Vercel AI SDK) |
| Video | FFmpeg |
| Storage | Google Drive API |
| Infra | Cloud Run, Cloud SQL, Terraform |

## Key Files

- [docs/backend-architecture-guide.md](docs/backend-architecture-guide.md) - バックエンドアーキテクチャルール
- [docs/backend-testing-guide.md](docs/backend-testing-guide.md) - テストガイドライン
- [docs/shorts-gen-feature-spec.md](docs/shorts-gen-feature-spec.md) - ショート動画生成機能仕様
- [biome.json](biome.json) - lint/format設定

### shorts-gen機能の修正時に読むべきガイド

| 修正対象 | 読むべきガイド |
|----------|----------------|
| バックエンド (API, UseCase, Repository等) | [docs/backend-shorts-gen-guide.md](docs/backend-shorts-gen-guide.md) |
| フロントエンド (UI, 状態管理, Server Action等) | [docs/frontend-shorts-gen-guide.md](docs/frontend-shorts-gen-guide.md) |

これらのガイドには、ディレクトリ構成・レイヤー間依存・主要な型・修正時のポイントがまとまっている。
