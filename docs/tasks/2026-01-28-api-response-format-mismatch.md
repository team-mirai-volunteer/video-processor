# API Response Format Mismatch Issue

## Date
2026-01-28

## Summary
shorts-gen APIエンドポイントのレスポンス形式が、shared typesで定義された形式と一致していなかった。

## Root Cause

### Timeline
1. **529dad5** (08:17): フロントエンド実装時に `apps/shared/types/shorts-gen.ts` で API レスポンス型を定義
2. **2575cfd** (09:46): バックエンド実装時に、shared types を参照せずにルートを実装

### 問題の詳細

**Shared Types (期待される形式)**:
```typescript
// apps/shared/types/shorts-gen.ts
interface CreateShortsProjectResponse {
  data: ShortsProject;  // ← "data" wrapper が必要
}

interface GetShortsProjectsResponse {
  data: ShortsProjectSummary[];  // ← "data" wrapper が必要
}

interface GetShortsProjectResponse {
  data: ShortsProject;  // ← "data" wrapper が必要
}
```

**Backend Implementation (実際の形式)**:
```typescript
// project.routes.ts - 修正前
res.status(201).json(result);  // ← wrapper なしで直接返していた
res.json({ projects: [...], total, page, limit });  // ← "data" ではなく "projects"
```

### なぜ発生したか

1. **Contract-First Development の不徹底**: shared types が定義されていたが、バックエンド実装時に参照されなかった
2. **型チェックの欠如**: バックエンドは shared types を import していなかったため、型の不一致がコンパイル時に検出されなかった
3. **別セッションでの開発**: フロントエンドとバックエンドが別のセッションで開発され、レビュープロセスがなかった

## Impact

- プロジェクト作成時に 404 エラー表示（実際は成功していたが `response.data` が undefined）
- プロジェクト詳細ページで `Cannot read properties of undefined (reading 'title')` エラー

## Solution

### 修正対象

| File | Endpoint | Issue |
|------|----------|-------|
| `project.routes.ts` | `POST /` | `{ data: result }` wrapper 追加 |
| `project.routes.ts` | `GET /` | `{ data: [...] }` 形式に変更、`hasPlan`/`hasScript`/`hasComposedVideo` 追加 |
| `project.routes.ts` | `GET /:projectId` | `{ data: {...} }` wrapper 追加 |
| `project.routes.ts` | `PATCH /:projectId` | `{ data: {...} }` wrapper 追加 |

### 再発防止策

1. **Shared Types の参照を必須化**: バックエンドルートで shared types を import し、レスポンス型を明示的に指定
2. **API Contract Test の追加**: shared types に基づいたレスポンス形式のテストを追加
3. **開発ガイドラインの更新**: CLAUDE.md に API 実装時のチェックリストを追加

## Files Modified

- `apps/backend/src/contexts/shorts-gen/presentation/routes/project.routes.ts`
