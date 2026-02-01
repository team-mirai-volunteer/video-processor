# E2Eテスト リアルバックエンド設計書

## 概要

現在のE2Eテストは `NEXT_PUBLIC_USE_MOCK=true` によるクライアント側モックで動作しているが、これを実際のバックエンドに接続し、シードデータを使用する方式に変更する。

## 現実性評価: **Yes（現実的）**

### 理由

1. **既存インフラが整備済み**
   - Docker Compose でPostgreSQL起動済み
   - Prisma によるDB操作が確立
   - Backend の起動スクリプト完備

2. **外部依存の分離が可能**
   - Google Drive API → モック化可能
   - Gemini AI → モック化可能
   - FFmpeg → テスト用動画で対応可能

3. **テストデータ管理が容易**
   - Prisma の `deleteMany()` でクリーンアップ
   - モデル定義が明確

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     E2E Test Runner                         │
│                    (Playwright)                             │
└─────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Frontend     │ │    Backend      │ │   Test DB       │
│  (Next.js)      │ │  (Express)      │ │  (PostgreSQL)   │
│  localhost:3000 │ │  localhost:8080 │ │  localhost:5433 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                  │                  │
         │                  ▼                  │
         │          ┌─────────────────┐        │
         └─────────►│  Real API       │◄───────┘
                    │  /api/videos    │
                    └─────────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
            ┌─────────────┐ ┌─────────────┐
            │ Mock Drive  │ │ Mock Gemini │
            │   Client    │ │   Client    │
            └─────────────┘ └─────────────┘
```

---

## 実装計画

### Phase 1: テスト用データベース環境

#### 1.1 docker-compose.test.yml

```yaml
# apps/backend/docker-compose.test.yml
services:
  db-test:
    image: postgres:15
    container_name: video-processor-db-test
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: video_processor_test
    ports:
      - "5433:5432"  # 開発用DBと分離
    tmpfs:
      - /var/lib/postgresql/data  # RAMディスクで高速化
```

#### 1.2 テスト用環境変数

```env
# apps/backend/.env.test
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/video_processor_test
PORT=8081
CORS_ORIGIN=http://localhost:3000
NODE_ENV=test

# 外部サービスモック有効化
USE_MOCK_GOOGLE_DRIVE=true
USE_MOCK_GEMINI=true
```

---

### Phase 2: シードデータ

#### 2.1 シードスクリプト

```typescript
// apps/backend/prisma/seed-e2e.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedE2E() {
  // クリーンアップ（依存関係順）
  await prisma.refinedTranscription.deleteMany();
  await prisma.transcription.deleteMany();
  await prisma.clip.deleteMany();
  await prisma.processingJob.deleteMany();
  await prisma.video.deleteMany();

  // 動画データ作成
  const videos = await Promise.all([
    // 1. 完了済み動画（クリップ・文字起こしあり）
    prisma.video.create({
      data: {
        id: 'e2e-video-completed',
        googleDriveFileId: 'e2e-drive-file-1',
        googleDriveUrl: 'https://drive.google.com/file/d/e2e-drive-file-1/view',
        title: 'E2Eテスト動画 - 完了',
        description: 'E2Eテスト用の完了済み動画',
        durationSeconds: 600,
        fileSizeBytes: 100000000n,
        status: 'completed',
        clips: {
          create: [
            {
              id: 'e2e-clip-1',
              title: 'クリップ1',
              startTimeSeconds: 0,
              endTimeSeconds: 30,
              durationSeconds: 30,
              status: 'completed',
              googleDriveFileId: 'e2e-clip-drive-1',
              googleDriveUrl: 'https://drive.google.com/file/d/e2e-clip-1/view',
            },
            {
              id: 'e2e-clip-2',
              title: 'クリップ2',
              startTimeSeconds: 60,
              endTimeSeconds: 120,
              durationSeconds: 60,
              status: 'completed',
              googleDriveFileId: 'e2e-clip-drive-2',
              googleDriveUrl: 'https://drive.google.com/file/d/e2e-clip-2/view',
            },
          ],
        },
        transcription: {
          create: {
            id: 'e2e-transcription-1',
            fullText: 'これはE2Eテスト用の文字起こしです。テスト動画の内容を表しています。',
            segments: [
              { start: 0, end: 5, text: 'これはE2Eテスト用の' },
              { start: 5, end: 10, text: '文字起こしです。' },
              { start: 10, end: 15, text: 'テスト動画の内容を表しています。' },
            ],
            languageCode: 'ja',
            durationSeconds: 15,
          },
        },
        processingJobs: {
          create: {
            id: 'e2e-job-1',
            clipInstructions: '面白い部分を切り抜いて',
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date(),
          },
        },
      },
    }),

    // 2. 処理中動画
    prisma.video.create({
      data: {
        id: 'e2e-video-processing',
        googleDriveFileId: 'e2e-drive-file-2',
        googleDriveUrl: 'https://drive.google.com/file/d/e2e-drive-file-2/view',
        title: 'E2Eテスト動画 - 処理中',
        status: 'transcribing',
        durationSeconds: 300,
        fileSizeBytes: 50000000n,
      },
    }),

    // 3. 未処理動画
    prisma.video.create({
      data: {
        id: 'e2e-video-pending',
        googleDriveFileId: 'e2e-drive-file-3',
        googleDriveUrl: 'https://drive.google.com/file/d/e2e-drive-file-3/view',
        title: 'E2Eテスト動画 - 未処理',
        status: 'pending',
      },
    }),

    // 4. エラー動画
    prisma.video.create({
      data: {
        id: 'e2e-video-error',
        googleDriveFileId: 'e2e-drive-file-4',
        googleDriveUrl: 'https://drive.google.com/file/d/e2e-drive-file-4/view',
        title: 'E2Eテスト動画 - エラー',
        status: 'failed',
        errorMessage: 'テスト用のエラーメッセージ',
      },
    }),
  ]);

  console.log(`Seeded ${videos.length} videos for E2E tests`);
  return videos;
}

export async function cleanupE2E() {
  await prisma.refinedTranscription.deleteMany();
  await prisma.transcription.deleteMany();
  await prisma.clip.deleteMany();
  await prisma.processingJob.deleteMany();
  await prisma.video.deleteMany();
  console.log('E2E test data cleaned up');
}

// CLI実行用
if (require.main === module) {
  seedE2E()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
```

---

### Phase 3: 外部サービスのモック化

#### 3.1 Google Drive Client モック

```typescript
// apps/backend/src/infrastructure/clients/google-drive.client.mock.ts
import type { StorageGateway, FileMetadata } from '@/domain/gateways/storage.gateway';

export class MockGoogleDriveClient implements StorageGateway {
  private mockFiles: Map<string, FileMetadata> = new Map([
    ['e2e-drive-file-1', {
      id: 'e2e-drive-file-1',
      name: 'E2Eテスト動画 - 完了.mp4',
      mimeType: 'video/mp4',
      size: 100000000,
      webViewLink: 'https://drive.google.com/file/d/e2e-drive-file-1/view',
    }],
    // ... 他のテストファイル
  ]);

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const file = this.mockFiles.get(fileId);
    if (!file) {
      // 新規登録テスト用: fileIdがURL形式なら新規ファイルとして扱う
      return {
        id: fileId,
        name: `New Video ${fileId}.mp4`,
        mimeType: 'video/mp4',
        size: 50000000,
        webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
      };
    }
    return file;
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    // テスト用の小さなダミー動画を返す
    const fs = await import('node:fs');
    const path = await import('node:path');
    const samplePath = path.resolve(__dirname, '../../../test/fixtures/sample.mp4');
    return fs.readFileSync(samplePath);
  }

  async uploadFile(/* ... */): Promise<{ id: string; webViewLink: string }> {
    const id = `uploaded-${Date.now()}`;
    return {
      id,
      webViewLink: `https://drive.google.com/file/d/${id}/view`,
    };
  }

  async createFolder(/* ... */): Promise<{ id: string; name: string }> {
    return { id: 'mock-folder-id', name: 'mock-folder' };
  }

  async findOrCreateFolder(/* ... */): Promise<{ id: string; name: string }> {
    return { id: 'mock-folder-id', name: 'mock-folder' };
  }
}
```

#### 3.2 依存性注入の切り替え

```typescript
// apps/backend/src/infrastructure/container.ts
import { GoogleDriveClient } from './clients/google-drive.client';
import { MockGoogleDriveClient } from './clients/google-drive.client.mock';

export function createStorageGateway(): StorageGateway {
  if (process.env.USE_MOCK_GOOGLE_DRIVE === 'true') {
    return new MockGoogleDriveClient();
  }
  return new GoogleDriveClient();
}
```

---

### Phase 4: Playwright設定の更新

#### 4.1 新しいPlaywright設定

```typescript
// apps/webapp/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const useRealBackend = process.env.E2E_USE_REAL_BACKEND === 'true';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: !useRealBackend,  // リアルバックエンド時は並列実行を制限
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: useRealBackend ? 1 : undefined,  // DBの競合を避ける
  reporter: 'html',

  globalSetup: useRealBackend ? './test/e2e/global-setup.ts' : undefined,
  globalTeardown: useRealBackend ? './test/e2e/global-teardown.ts' : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // firefox, webkit は必要に応じて
  ],

  webServer: useRealBackend
    ? [
        // Backend サーバー
        {
          command: 'pnpm --filter backend dev:test',
          url: 'http://localhost:8081/health',
          reuseExistingServer: !process.env.CI,
          env: {
            DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/video_processor_test',
            PORT: '8081',
            USE_MOCK_GOOGLE_DRIVE: 'true',
            USE_MOCK_GEMINI: 'true',
          },
        },
        // Frontend サーバー
        {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          env: {
            NEXT_PUBLIC_API_URL: 'http://localhost:8081',
            NEXT_PUBLIC_USE_MOCK: 'false',  // モック無効化
          },
        },
      ]
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_USE_MOCK: 'true',
        },
      },
});
```

#### 4.2 Global Setup/Teardown

```typescript
// apps/webapp/test/e2e/global-setup.ts
import { execSync } from 'node:child_process';

export default async function globalSetup() {
  console.log('🚀 Starting E2E test environment...');

  // テスト用DBコンテナ起動
  execSync('docker compose -f apps/backend/docker-compose.test.yml up -d', {
    stdio: 'inherit',
  });

  // DB起動待ち
  await waitForDatabase();

  // スキーマ適用
  execSync('pnpm --filter backend db:push', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/video_processor_test',
    },
  });

  // シードデータ投入
  execSync('pnpm --filter backend db:seed:e2e', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/video_processor_test',
    },
  });

  console.log('✅ E2E test environment ready');
}

async function waitForDatabase(maxRetries = 30, intervalMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync(
        'docker exec video-processor-db-test pg_isready -U postgres',
        { stdio: 'ignore' }
      );
      return;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error('Database did not become ready');
}
```

```typescript
// apps/webapp/test/e2e/global-teardown.ts
import { execSync } from 'node:child_process';

export default async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment...');

  // テスト用DBコンテナ停止
  execSync('docker compose -f apps/backend/docker-compose.test.yml down -v', {
    stdio: 'inherit',
  });

  console.log('✅ E2E test environment cleaned up');
}
```

---

### Phase 5: テストファイルの更新

#### 5.1 テストヘルパー

```typescript
// apps/webapp/test/e2e/helpers/test-data.ts
export const E2E_TEST_DATA = {
  videos: {
    completed: {
      id: 'e2e-video-completed',
      title: 'E2Eテスト動画 - 完了',
    },
    processing: {
      id: 'e2e-video-processing',
      title: 'E2Eテスト動画 - 処理中',
    },
    pending: {
      id: 'e2e-video-pending',
      title: 'E2Eテスト動画 - 未処理',
    },
    error: {
      id: 'e2e-video-error',
      title: 'E2Eテスト動画 - エラー',
    },
  },
  clips: {
    clip1: { id: 'e2e-clip-1', title: 'クリップ1' },
    clip2: { id: 'e2e-clip-2', title: 'クリップ2' },
  },
};
```

#### 5.2 更新されたテストファイル例

```typescript
// apps/webapp/test/e2e/video-list.spec.ts
import { expect, test } from '@playwright/test';
import { E2E_TEST_DATA } from './helpers/test-data';

test.describe('Video List Page', () => {
  test('should display the video list page with seeded data', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('動画一覧');

    // シードデータの動画が表示されることを確認
    await expect(page.getByText(E2E_TEST_DATA.videos.completed.title)).toBeVisible();
    await expect(page.getByText(E2E_TEST_DATA.videos.processing.title)).toBeVisible();
    await expect(page.getByText(E2E_TEST_DATA.videos.pending.title)).toBeVisible();
  });

  test('should filter by status', async ({ page }) => {
    await page.goto('/?status=completed');

    await expect(page.getByText(E2E_TEST_DATA.videos.completed.title)).toBeVisible();
    await expect(page.getByText(E2E_TEST_DATA.videos.processing.title)).not.toBeVisible();
  });
});
```

```typescript
// apps/webapp/test/e2e/video-detail.spec.ts
import { expect, test } from '@playwright/test';
import { E2E_TEST_DATA } from './helpers/test-data';

test.describe('Video Detail Page', () => {
  test('should display completed video with clips', async ({ page }) => {
    const { id, title } = E2E_TEST_DATA.videos.completed;
    await page.goto(`/videos/${id}`);

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('切り抜きクリップ')).toBeVisible();
    await expect(page.getByText(E2E_TEST_DATA.clips.clip1.title)).toBeVisible();
  });

  test('should display transcription for completed video', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.completed.id}`);

    await expect(page.getByText('文字起こし')).toBeVisible();
    await expect(page.getByText('これはE2Eテスト用の文字起こしです')).toBeVisible();
  });

  test('should show error message for failed video', async ({ page }) => {
    await page.goto(`/videos/${E2E_TEST_DATA.videos.error.id}`);

    await expect(page.getByText('テスト用のエラーメッセージ')).toBeVisible();
  });
});
```

```typescript
// apps/webapp/test/e2e/video-submit.spec.ts
import { expect, test } from '@playwright/test';

test.describe('Video Submit Page - Real Backend', () => {
  test('should submit a new video and redirect to detail page', async ({ page }) => {
    await page.goto('/submit');

    // 新しい動画URLを入力
    const testFileId = `test-${Date.now()}`;
    await page.getByLabel('Google Drive URL').fill(
      `https://drive.google.com/file/d/${testFileId}/view`
    );

    // 送信
    await page.getByRole('button', { name: '動画を登録' }).click();

    // 動画詳細ページへリダイレクトされることを確認
    await expect(page).toHaveURL(/\/videos\/[a-f0-9-]+/);

    // 新しい動画が表示されることを確認
    await expect(page.getByText('動画情報')).toBeVisible();
  });
});
```

---

## 実行コマンド

```bash
# モック版E2E（従来通り）
pnpm --filter @video-processor/webapp test:e2e

# リアルバックエンド版E2E
E2E_USE_REAL_BACKEND=true pnpm --filter @video-processor/webapp test:e2e

# package.json に追加するスクリプト
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:real": "E2E_USE_REAL_BACKEND=true playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:real:ui": "E2E_USE_REAL_BACKEND=true playwright test --ui"
  }
}
```

---

## CI/CD対応

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e-mock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm --filter @video-processor/webapp test:e2e

  e2e-real-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: video_processor_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm --filter backend db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5433/video_processor_test
      - run: pnpm --filter backend db:seed:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5433/video_processor_test
      - run: E2E_USE_REAL_BACKEND=true pnpm --filter @video-processor/webapp test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5433/video_processor_test
```

---

## 移行戦略

### ステップ1: 並行運用（推奨）
- 既存のモック版テストは維持
- リアルバックエンド版を追加
- 両方をCIで実行

### ステップ2: 段階的移行
1. インフラ整備（docker-compose.test.yml, seed）
2. 外部サービスモック実装
3. Playwright設定更新
4. テストファイル更新（1つずつ）
5. CI設定追加

### ステップ3: 完全移行（オプション）
- モック版を廃止
- `NEXT_PUBLIC_USE_MOCK` を削除

---

## 注意点

1. **テスト分離**: 各テストは独立して実行可能にする（beforeEachでシード再投入）
2. **並列実行**: リアルDB使用時は `workers: 1` で競合を防ぐ
3. **テスト時間**: リアルバックエンドは遅いため、CIでは必要最低限のブラウザで実行
4. **外部API**: Google Drive/GeminiはE2E環境でも必ずモック化

---

## 追加ファイル一覧

| ファイル | 用途 |
|---------|------|
| `apps/backend/docker-compose.test.yml` | テスト用DB |
| `apps/backend/.env.test` | テスト用環境変数 |
| `apps/backend/prisma/seed-e2e.ts` | E2Eシードデータ |
| `apps/backend/src/infrastructure/clients/*.mock.ts` | 外部サービスモック |
| `apps/webapp/test/e2e/global-setup.ts` | テスト前処理 |
| `apps/webapp/test/e2e/global-teardown.ts` | テスト後処理 |
| `apps/webapp/test/e2e/helpers/test-data.ts` | テストデータ定数 |
