# 画像アップロードをGCSへ移行する実装計画

## 背景・問題

現在、背景画像の生成時に以下のエラーが発生している:

```
Failed to upload file scene_617a1b7d-7a3d-41e2-914e-11cd5166303e_background.png:
Service Accounts do not have storage quota.
Leverage shared drives (https://developers.google.com/workspace/drive/api/guides/about-shareddrives),
or use OAuth delegation (http://support.google.com/a/answer/7281227) instead.
```

**原因**: サービスアカウントはGoogle Driveのストレージクォータを持たないため、ファイルをアップロードできない。

**解決策**: 画像保存をGoogle DriveからGoogle Cloud Storage (GCS)に移行する。音声や字幕の保存は既にGCSを使用しているため、同様のパターンで実装する。

## 現在のアーキテクチャ

### ストレージ使用状況

| アセット種別 | 現在のストレージ | エラー状態 |
|-------------|-----------------|-----------|
| 背景画像 (background_image) | Google Drive | ❌ エラー発生 |
| 音声 (voice) | GCS | ✅ 正常 |
| 字幕画像 (subtitle_image) | GCS | ✅ 正常 |
| 合成動画 (composed video) | GCS | ✅ 正常 |

### 関連ファイル

**現在の画像アップロード処理:**
- `apps/backend/src/contexts/shorts-gen/application/usecases/generate-images.usecase.ts`
  - `ImageStorageGateway` インターフェース (L52-62)
  - `uploadFile()` でGoogle Driveへアップロード (L225-230)
- `apps/backend/src/contexts/shorts-gen/presentation/routes/image.routes.ts`
  - `createImageStorageGateway()` でGoogleDriveClientをラップ (L36-49)

**参考にすべきGCS実装（字幕）:**
- `apps/backend/src/contexts/shorts-gen/domain/gateways/asset-storage.gateway.ts`
  - `AssetStorageGateway` インターフェース
- `apps/backend/src/contexts/shorts-gen/presentation/routes/subtitle.routes.ts`
  - `createAssetStorageGateway()` でTempStorageGateway（GCS）をラップ (L62-87)
  - `toSignedUrl()` でGCS URIをSigned URLに変換 (L49-56)

**インフラ:**
- `apps/backend/src/contexts/shared/domain/gateways/temp-storage.gateway.ts`
  - `TempStorageGateway` インターフェース
- `apps/backend/src/contexts/shared/infrastructure/clients/gcs.client.ts`
  - `GcsClient` 実装

## 実装計画

### Phase 1: image.routes.ts の修正

#### 1.1 インポートの追加

```typescript
// 追加
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';

// 削除
import { GoogleDriveClient } from '@shared/infrastructure/clients/google-drive.client.js';
```

#### 1.2 TempStorageGateway の初期化（subtitle.routes.ts からコピー）

```typescript
// Initialize gateways based on environment
function createTempStorageGateway(): TempStorageGateway {
  if (process.env.TEMP_STORAGE_TYPE === 'local') {
    return new LocalTempStorageClient();
  }
  return new GcsClient();
}

// Singleton storage gateway for URL signing
let storageGateway: TempStorageGateway | null = null;

function getStorageGateway(): TempStorageGateway {
  if (!storageGateway) {
    storageGateway = createTempStorageGateway();
  }
  return storageGateway;
}

/**
 * Convert GCS URI to signed URL for browser access
 */
async function toSignedUrl(gcsUri: string | null | undefined): Promise<string | null> {
  if (!gcsUri) return null;
  // Only convert gs:// or local:// URIs
  if (!gcsUri.startsWith('gs://') && !gcsUri.startsWith('local://')) {
    return gcsUri;
  }
  return getStorageGateway().getSignedUrl(gcsUri);
}
```

#### 1.3 createImageStorageGateway の修正

**変更前:**
```typescript
function createImageStorageGateway(): ImageStorageGateway {
  const driveClient = GoogleDriveClient.fromEnv();

  return {
    async uploadFile(params) {
      return driveClient.uploadFile({
        name: params.name,
        mimeType: params.mimeType,
        content: params.content,
        parentFolderId: params.parentFolderId,
      });
    },
  };
}
```

**変更後:**
```typescript
function createImageStorageGateway(): ImageStorageGateway {
  const tempStorage = getStorageGateway();

  return {
    async uploadFile(params) {
      // パスを生成: shorts-gen/images/{filename}
      const storagePath = `shorts-gen/images/${params.name}`;

      const result = await tempStorage.upload({
        videoId: storagePath,
        content: params.content,
      });

      return {
        id: storagePath,
        webViewLink: result.gcsUri, // GCS URIを返す（後でSigned URLに変換）
      };
    },
  };
}
```

### Phase 2: generate-images.usecase.ts の確認

UseCaseレベルでは、`ImageStorageGateway` インターフェースを使用しているため、変更は不要。`webViewLink` としてGCS URIが返されるが、これはそのまま `ShortsSceneAsset.fileUrl` に保存される。

### Phase 3: GET エンドポイントの修正

`GET /api/shorts-gen/scripts/:scriptId/images` で画像URLを返す際に、GCS URIをSigned URLに変換する必要がある。

**変更箇所:** `image.routes.ts` の GET エンドポイント (L282-345)

```typescript
router.get('/scripts/:scriptId/images', async (req, res, next) => {
  try {
    // ... existing code ...

    // Group by scene - Signed URLに変換
    const assetsByScene = new Map<string, { assetId: string; fileUrl: string }>();
    for (const asset of imageAssets) {
      const signedUrl = await toSignedUrl(asset.fileUrl);
      assetsByScene.set(asset.sceneId, {
        assetId: asset.id,
        fileUrl: signedUrl ?? asset.fileUrl, // fallback to original URL
      });
    }

    // ... rest of the code ...
  } catch (error) {
    next(error);
  }
});
```

### Phase 4: POSTエンドポイントのレスポンス修正

画像生成完了時のレスポンスでもSigned URLを返す必要がある。

**変更箇所:** `image.routes.ts` の POST エンドポイント

```typescript
router.post('/scripts/:scriptId/images', async (req, res, next) => {
  try {
    // ... existing code ...
    const result = await useCase.executeForScript(input);

    // Convert GCS URIs to signed URLs for browser access
    const resultsWithSignedUrls = await Promise.all(
      result.results.map(async (r) => ({
        ...r,
        fileUrl: (await toSignedUrl(r.fileUrl)) ?? r.fileUrl,
      }))
    );

    res.status(200).json({
      ...result,
      results: resultsWithSignedUrls,
    });
  } catch (error) {
    // ... error handling ...
  }
});
```

同様に `/scenes/:sceneId/images` エンドポイントも修正。

## 変更が必要なファイル一覧

1. **`apps/backend/src/contexts/shorts-gen/presentation/routes/image.routes.ts`**
   - インポートの変更
   - `createTempStorageGateway()` 追加
   - `getStorageGateway()` 追加
   - `toSignedUrl()` 追加
   - `createImageStorageGateway()` 修正
   - GET/POST エンドポイントでSigned URL変換を追加

## 変更不要なファイル

- `generate-images.usecase.ts` - インターフェースを使用しているため変更不要
- `asset-storage.gateway.ts` - 既存のまま使用可能
- `gcs.client.ts` - 既存のまま使用可能
- `temp-storage.gateway.ts` - 既存のまま使用可能

## テスト計画

### ユニットテスト

1. `createImageStorageGateway()` がGCSにアップロードすることを確認
2. `toSignedUrl()` がGCS URIをSigned URLに変換することを確認

### 統合テスト

1. 画像生成エンドポイントが正常にGCSにアップロードすること
2. 画像取得エンドポイントがSigned URLを返すこと
3. フロントエンドからSigned URLで画像が表示できること

### 手動テスト

```bash
# 画像生成
curl -X POST http://localhost:3001/api/shorts-gen/scripts/{scriptId}/images

# 画像一覧取得
curl http://localhost:3001/api/shorts-gen/scripts/{scriptId}/images
```

## 環境変数

必要な環境変数（既存のGCS設定と同じ）:

```
GOOGLE_CLOUD_PROJECT=your-project-id
VIDEO_TEMP_BUCKET=your-bucket-name (optional, defaults to {project}-video-processor-temp)
GOOGLE_APPLICATION_CREDENTIALS_JSON={"client_email":"...","private_key":"..."}
# または
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
```

ローカル開発用:
```
TEMP_STORAGE_TYPE=local
```

## マイグレーション注意点

1. **既存データ**: 既存のGoogle DriveのURLを持つアセットは、そのまま動作する（`toSignedUrl()` は `gs://` や `local://` 以外のURLはそのまま返す）

2. **並行運用**: 移行後も既存のGoogle Drive URLは引き続きアクセス可能（Google Drive側で削除しない限り）

3. **ストレージコスト**: GCSの料金が発生するが、一時ストレージとして設定済みの有効期限（デフォルト7日）で自動削除される

## 関連ドキュメント

- [バックエンドアーキテクチャガイド](./backend-architecture-guide.md)
- [ショート動画生成機能仕様](./shorts-gen-feature-spec.md)
