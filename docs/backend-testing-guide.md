# Backend Testing Guide

video-processor バックエンドのテスト方針。

---

## ディレクトリ構造

```
apps/backend/test/
├── unit/
│   └── contexts/
│       ├── clip-video/
│       │   ├── application/usecases/    # UseCase テスト（モック）
│       │   └── domain/
│       │       ├── models/              # Model テスト
│       │       └── services/            # Service テスト
│       └── shared/
│           └── infrastructure/clients/  # モック可能な Client テスト
│
├── integration/
│   └── contexts/
│       ├── clip-video/
│       │   ├── application/usecases/    # 複数 Client を組み合わせたテスト
│       │   └── infrastructure/
│       │       └── repositories/        # DB 接続テスト
│       └── shared/
│           └── infrastructure/clients/  # 外部サービス接続テスト
│
└── fixtures/                            # テスト用データ
```

---

## テスト種別

| 種別 | 対象 | 実行条件 | コマンド |
|------|------|----------|----------|
| unit | domain, application | 常時 | `pnpm --filter backend test:unit` |
| integration | infrastructure, application (一部) | 環境変数 | `pnpm --filter backend test:integration` |

---

## Unit テスト

**対象: domain（全部）、application（全部）**

外部依存なしで実行可能。Gateway はモックする。

### Domain 層

```typescript
// test/unit/contexts/clip-video/domain/models/video.test.ts
describe('Video', () => {
  it('should create a Video with valid Google Drive URL', () => {
    const result = Video.create({ googleDriveUrl: 'https://drive.google.com/file/d/abc123/view' }, generateId);
    expect(result.success).toBe(true);
  });
});
```

### Application 層

```typescript
// test/unit/contexts/clip-video/application/usecases/submit-video.usecase.test.ts
describe('SubmitVideoUseCase', () => {
  let useCase: SubmitVideoUseCase;
  let videoRepository: VideoRepositoryGateway;
  let storageGateway: StorageGateway;

  beforeEach(() => {
    // Gateway をモック
    videoRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      // ...
    };
    storageGateway = {
      getFileMetadata: vi.fn().mockResolvedValue({ id: 'abc123', name: 'Test.mp4' }),
      // ...
    };
    useCase = new SubmitVideoUseCase({ videoRepository, storageGateway, generateId });
  });

  it('should create video for valid input', async () => {
    const result = await useCase.execute({ googleDriveUrl: '...' });
    expect(result.id).toBeDefined();
    expect(videoRepository.save).toHaveBeenCalledTimes(1);
  });
});
```

---

## Integration テスト

**対象: infrastructure（全部）、application（必要に応じて）**

実際の外部サービス・DBに接続してテスト。

### 実行条件

| 対象 | 環境変数 | スキップ条件 |
|------|----------|--------------|
| 外部サービス Client | `INTEGRATION_TEST=true` | 未設定時スキップ |
| Repository (DB) | `DATABASE_URL` | 未設定時スキップ |

### 外部サービス Client

```typescript
// test/integration/contexts/shared/infrastructure/clients/google-drive.client.test.ts
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true';

describe.skipIf(!runIntegrationTests)('GoogleDriveClient Integration', () => {
  let client: GoogleDriveClient;

  beforeAll(() => {
    // 環境変数チェック
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is required');
    }
    client = GoogleDriveClient.fromEnv();
  });

  it('should upload and download file', async () => {
    // 実際の Google Drive に接続
  });
});
```

### Repository (DB)

```typescript
// test/integration/contexts/clip-video/infrastructure/repositories/video.repository.test.ts
const runIntegrationTests = !!process.env.DATABASE_URL;

describe.skipIf(!runIntegrationTests)('VideoRepository Integration', () => {
  let prisma: PrismaClient;
  let repository: VideoRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    repository = new VideoRepository(prisma);
  });

  beforeEach(async () => {
    // テストデータをクリーンアップ
    await prisma.video.deleteMany();
  });

  it('should save and find video', async () => {
    // 実際の DB に接続
  });
});
```

### Application 層 (統合)

複数の実 Client を組み合わせてテスト。

```typescript
// test/integration/contexts/clip-video/application/usecases/extract-clips.usecase.test.ts
const runIntegrationTests =
  process.env.INTEGRATION_TEST === 'true' &&
  isFFmpegAvailable() &&
  isOpenAIConfigured();

describe.skipIf(!runIntegrationTests)('ExtractClipsUseCase Integration', () => {
  // FFmpegClient, OpenAIClient など実際のクライアントを使用
});
```

---

## Fixtures

テスト用の静的データを `test/fixtures/` に配置する。

```
test/fixtures/
├── sample.mp4          # 動画処理テスト用
├── sample.wav          # 音声処理テスト用
└── output/             # テスト出力先（gitignore）
```

### 使用方法

```typescript
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_VIDEO_PATH = path.resolve(__dirname, '../../../fixtures/sample.mp4');
const OUTPUT_DIR = path.resolve(__dirname, '../../../fixtures/output');
```

### ルール

| ルール | 理由 |
|--------|------|
| 小さいファイルを使用 | CI の速度を維持 |
| output/ は gitignore | 生成物をリポジトリに含めない |
| 実データは使用しない | 著作権・プライバシー |

---

## 実行方法

### ローカル開発

```bash
# Unit テストのみ（常時実行可能）
pnpm --filter backend test:unit

# Integration テスト（DB接続のみ）
DATABASE_URL=postgresql://... pnpm --filter backend test:integration

# Integration テスト（外部サービス含む）
INTEGRATION_TEST=true \
DATABASE_URL=postgresql://... \
GOOGLE_APPLICATION_CREDENTIALS_JSON='...' \
OPENAI_API_KEY=sk-... \
pnpm --filter backend test:integration
```

### CI

```yaml
# Unit テスト - 常に実行
- run: pnpm --filter backend test:unit

# Integration テスト - secrets 設定時のみ
- run: pnpm --filter backend test:integration
  env:
    INTEGRATION_TEST: true
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## チェックリスト

### 新機能追加時

- [ ] Domain Model のテストを書いたか
- [ ] UseCase のテストをモックで書いたか
- [ ] 外部サービス連携がある場合、Client の統合テストを書いたか
- [ ] Repository を追加した場合、DB 統合テストを書いたか

### テスト実装時

- [ ] Unit テストは外部依存なしで実行できるか
- [ ] Integration テストは `skipIf` で適切にスキップされるか
- [ ] Integration テストは `beforeEach` でデータをクリーンアップしているか
- [ ] Integration テストは `afterAll` でリソースを解放しているか
