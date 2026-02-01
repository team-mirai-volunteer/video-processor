# ExtractClipsユースケースのGCS活用とストリーム処理最適化

## 目的

**開発者が**クリップ抽出処理においてGoogle Driveからの都度ダウンロードではなく、GCSにキャッシュ済みの動画を活用し、FFmpegのストリーム処理によりメモリ効率の良い切り出し処理を実現できるようにするため。

## 現状分析

### 現在のフロー（extract-clips.usecase.ts）

```
1. AI分析でクリップポイント抽出
2. getVideoBuffer() で動画取得
   - 現状: GCSの利用はコメントアウト状態（TODO）
   - 実際: 毎回Google Driveからダウンロード
   - ダウンロード後GCSに保存を試みる（ベストエフォート）
3. 各クリップについてループ:
   - videoProcessingGateway.extractClip(videoBuffer, start, end)
   - 抽出したクリップをGoogle Driveにアップロード
```

### 問題点

1. **GCSキャッシュの未活用**: `video.gcsUri`フィールドは存在するが、使われていない
2. **メモリ効率の悪さ**: 全動画をBufferとして保持し、各クリップ抽出も全てBuffer経由
3. **CreateTranscriptUseCaseとの不整合**: 文字起こし処理では既にGCS優先、ストリーム処理を活用している

### 既存インフラの確認

| コンポーネント | ストリーム対応 | 備考 |
|--------------|--------------|------|
| TempStorageGateway | ✅ | `downloadAsStream()`、`uploadFromStream()` 対応済み |
| StorageGateway | ✅ | `downloadFileAsStream()` 対応済み |
| VideoProcessingGateway | ❌ | Buffer入出力のみ |
| Videoモデル | ✅ | `gcsUri`, `gcsExpiresAt`, `withGcsInfo()` 対応済み |

## 設計

### Phase 1: GCSキャッシュの活用

#### 変更概要

`getVideoBuffer()`を修正し、GCSキャッシュを優先的に利用する。

#### ロジック

```
1. video.gcsUri が存在し、有効期限内か確認
2. GCSに存在確認 → 存在すればGCSからダウンロード
3. 存在しなければGoogle Driveからダウンロードし、GCSにキャッシュ
4. Videoレコードを更新（gcsUri, gcsExpiresAt）
```

#### 注意点

- 既存の`CacheVideoUseCase`はストリームでGoogle Drive → GCSの転送を行うが、今回は`getVideoBuffer()`内で直接Bufferを返す必要があるため、別処理とする
- または、`CacheVideoUseCase`を呼び出してからGCSからダウンロードする方法も検討可能

### Phase 2: FFmpegストリーム処理（拡張オプション）

#### 技術調査結果

fluent-ffmpegは以下のストリーム処理をサポート:
- **入力**: パイプ経由のストリーム入力（`.input(stream)`）
- **出力**: パイプ経由のストリーム出力（`.pipe()`）
- **ファイルパス**: 直接ファイルパスを指定した処理

#### 推奨アプローチ: ファイルベース処理

完全なストリーム処理（GCS → FFmpeg → GCS）はシーク操作の制約があるため、以下のハイブリッドアプローチを推奨:

```
1. GCSからローカル一時ファイルにダウンロード（ストリーム）
2. FFmpegでファイルからファイルへの切り出し
3. 切り出し結果をGoogle Driveにアップロード（ストリーム）
4. 一時ファイルをクリーンアップ
```

#### VideoProcessingGatewayの拡張

新規メソッドを追加:

```typescript
interface VideoProcessingGateway {
  // 既存
  extractClip(videoBuffer: Buffer, start: number, end: number): Promise<Buffer>;

  // 新規追加
  extractClipFromFile(
    inputPath: string,
    outputPath: string,
    startTimeSeconds: number,
    endTimeSeconds: number
  ): Promise<void>;
}
```

### 最終的なフロー設計

```
1. AI分析でクリップポイント抽出

2. 動画の準備
   - video.gcsUri が有効期限内か確認
   - GCSに存在確認
   - 存在しなければ:
     - Google Driveからストリームダウンロード → GCSにアップロード
     - Videoレコード更新
   - GCSからローカル一時ファイルにストリームダウンロード

3. 各クリップについて:
   - videoProcessingGateway.extractClipFromFile(input, output, start, end)
   - 出力ファイルをGoogle Driveにアップロード

4. ローカル一時ファイルのクリーンアップ
```

## 影響範囲

### 変更が必要なファイル

| ファイル | 変更内容 |
|---------|---------|
| `domain/gateways/video-processing.gateway.ts` | `extractClipFromFile`メソッド追加 |
| `infrastructure/clients/ffmpeg.client.ts` | `extractClipFromFile`実装 |
| `application/usecases/extract-clips.usecase.ts` | GCS優先ロジック、ファイルベース処理への変更 |

### 後方互換性

- 既存の`extractClip(Buffer)`メソッドは維持（他の用途で使用される可能性）
- 新規メソッド追加のみでインターフェース破壊なし

## テスト計画

| テスト種別 | 対象 | 内容 |
|-----------|------|------|
| Unit | ExtractClipsUseCase | GCS優先ロジック、フォールバックのモックテスト |
| Integration | FFmpegClient | `extractClipFromFile`の実ファイル処理テスト |
| Integration | 全体フロー | GCSキャッシュ有/無での動作確認 |

## エラーハンドリング

### 新規エラーコード

```typescript
export const CLIP_ERROR_CODES = {
  // 既存
  TRANSCRIPTION_NOT_FOUND: 'TRANSCRIPTION_NOT_FOUND',
  REFINED_TRANSCRIPTION_NOT_FOUND: 'REFINED_TRANSCRIPTION_NOT_FOUND',

  // 新規追加
  GCS_DOWNLOAD_FAILED: 'GCS_DOWNLOAD_FAILED',
  TEMP_FILE_CREATION_FAILED: 'TEMP_FILE_CREATION_FAILED',
  FFMPEG_EXTRACTION_FAILED: 'FFMPEG_EXTRACTION_FAILED',
} as const;
```

### エラー発生時の挙動

| エラー | 重要度 | 挙動 |
|-------|-------|------|
| GCSダウンロード失敗 | error | Google Driveフォールバック |
| 一時ファイル作成失敗 | error | 処理中断、エラー返却 |
| FFmpeg切り出し失敗 | error | 該当クリップをfailed状態に |
