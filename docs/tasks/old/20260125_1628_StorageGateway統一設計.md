# StorageGateway統一設計

## 目的

**開発者が**ローカル開発時にGCSバケットを用意しなくても動画処理機能をテスト・デバッグできるようにするため。

現状、`StorageGateway`（Google Drive用）と`TempStorageGateway`（GCS用）が別々のインターフェースとして存在し、ローカル実装は`StorageGateway`のみに存在する。この不統一により：
- ローカル開発時にGCSキャッシュが使えない（Warning発生）
- テストで2つの異なるスタブ/モックが必要
- 依存性注入の設定が複雑

## 現状分析

### 現在のゲートウェイ構成

| ゲートウェイ | 用途 | 実装 | ローカル実装 |
|---|---|---|---|
| `StorageGateway` | Google Drive（永続保存） | `GoogleDriveClient` | `LocalStorageClient` ✅ |
| `TempStorageGateway` | GCS（一時キャッシュ） | `GcsClient` | なし ❌ |

### 各ゲートウェイのメソッド比較

**StorageGateway:**
```typescript
interface StorageGateway {
  getFileMetadata(fileId: string): Promise<FileMetadata>;
  downloadFile(fileId: string): Promise<Buffer>;
  uploadFile(params: UploadFileParams): Promise<FileMetadata>;
  createFolder(name: string, parentId?: string): Promise<FileMetadata>;
  findOrCreateFolder(name: string, parentId?: string): Promise<FileMetadata>;
}
```

**TempStorageGateway:**
```typescript
interface TempStorageGateway {
  upload(params: TempStorageUploadParams): Promise<TempStorageUploadResult>;
  download(gcsUri: string): Promise<Buffer>;
  exists(gcsUri: string): Promise<boolean>;
}
```

### UseCaseでの使用状況

| UseCase | StorageGateway | TempStorageGateway |
|---|---|---|
| `CreateTranscriptUseCase` | メタデータ取得、ダウンロード | キャッシュ保存/取得/存在確認 |
| `ExtractClipsUseCase` | メタデータ取得、ダウンロード、アップロード、フォルダ操作 | キャッシュ保存/存在確認 |

### テストでの使用状況

- **統合テスト**: `LocalStorageClient` + `StubTempStorageGateway`（2つの実装が必要）
- **ユニットテスト**: 両方を `vi.fn()` でモック化

## 設計方針

**方針: 2つのゲートウェイを維持しつつ、`TempStorageGateway`のローカル実装を追加する**

### 理由

1. **責務の明確さ**: 2つのゲートウェイは異なる責務を持つ
   - `StorageGateway`: 永続ストレージ（入力元・出力先）
   - `TempStorageGateway`: 一時キャッシュ（処理効率化）

2. **APIの違いが意図的**:
   - `StorageGateway`: フォルダ操作、メタデータ管理が必要
   - `TempStorageGateway`: シンプルなキー・バリュー操作で十分

3. **変更影響の最小化**: 既存のUseCase、テストへの影響を最小限に抑える

## 詳細設計

### 1. `LocalTempStorageClient`の新規作成

**ファイル**: `apps/backend/src/infrastructure/clients/local-temp-storage.client.ts`

**インターフェース実装**:
```
TempStorageGateway
  ├── upload(params) → { gcsUri, expiresAt }
  ├── download(gcsUri) → Buffer
  └── exists(gcsUri) → boolean
```

**動作仕様**:
- ローカルファイルシステムに保存（`/tmp/video-processor-cache/` または設定可能なディレクトリ）
- URIフォーマット: `local://{baseDir}/videos/{videoId}/original.mp4`
- `expiresAt`は現在時刻 + 7日（設定可能）
- `exists()`は実際のファイル存在確認

**テスト用メソッド**:
- `clear()`: キャッシュディレクトリ内の全ファイル削除

### 2. 環境変数による切り替え

**ファイル**: `apps/backend/src/presentation/routes/videos.ts`

**新規環境変数**:
```
TEMP_STORAGE_TYPE=local|gcs  # デフォルト: gcs
LOCAL_TEMP_STORAGE_DIR=/tmp/video-processor-cache  # localの場合のみ使用
```

**切り替えロジック**:
```
if TEMP_STORAGE_TYPE === 'local'
  → LocalTempStorageClient を使用
else
  → GcsClient を使用（デフォルト）
```

### 3. テストの簡素化

**統合テストの変更**:

変更前:
```typescript
storageGateway: localStorageClient,
tempStorageGateway: new StubTempStorageGateway(),
```

変更後:
```typescript
storageGateway: localStorageClient,
tempStorageGateway: localTempStorageClient,
```

**削除対象**:
- `StubTempStorageGateway` クラス（`LocalTempStorageClient`で代替）

### 4. ファイル構成

```
apps/backend/src/
├── domain/gateways/
│   ├── storage.gateway.ts          # 変更なし
│   └── temp-storage.gateway.ts     # 変更なし
├── infrastructure/clients/
│   ├── google-drive.client.ts      # 変更なし
│   ├── gcs.client.ts               # 変更なし
│   ├── local-storage.client.ts     # 変更なし
│   └── local-temp-storage.client.ts # 新規作成
└── presentation/routes/
    └── videos.ts                   # 環境変数による切り替え追加
```

## 影響範囲

### 変更が必要なファイル

| ファイル | 変更内容 |
|---|---|
| `local-temp-storage.client.ts` | 新規作成 |
| `videos.ts` | TempStorageGateway の初期化ロジック変更 |
| `create-transcript.usecase.test.ts` | StubTempStorageGateway → LocalTempStorageClient |
| `extract-clips.usecase.test.ts` | StubTempStorageGateway → LocalTempStorageClient |

### 変更不要なファイル

- `StorageGateway`インターフェース
- `TempStorageGateway`インターフェース
- `CreateTranscriptUseCase`
- `ExtractClipsUseCase`
- `LocalStorageClient`
- `GoogleDriveClient`
- `GcsClient`
- ユニットテスト（モック使用のため）

## 環境ごとの設定

**本番/ステージング環境**（デフォルト）:
```
# 設定不要（デフォルトでGCS）
```

**ローカル開発**:
```
TEMP_STORAGE_TYPE=local
```

ローカル開発時は `.env` に `TEMP_STORAGE_TYPE=local` を設定する。
