# ProcessVideoUseCase Speech-to-Text統合設計

## 目的

**開発者**が**Speech-to-Text Chirpモデルの統合をローカルで試せる**ようになるため。

前提として、`SpeechToTextClient`と`extractAudio`の実装は完了している。

---

## スコープ

本設計では以下を対象とする：

1. `ProcessVideoUseCase`の改修
   - 音声抽出 → 文字起こし → Geminiの流れに変更
2. `AiGateway`インターフェースの拡張
   - 文字起こし結果を受け取る新しいメソッドを追加
3. `GeminiClient`の改修
   - 文字起こしテキストベースでクリップ選定するメソッドを実装

---

## 現状のフロー

```
動画URL → Gemini（動画分析 + 文字起こし + クリップ選定）
```

## 改修後のフロー

```
動画ダウンロード → FFmpeg音声抽出 → Speech-to-Text (Chirp)
                                          ↓
                                    タイムスタンプ付き文字起こし
                                          ↓
                            Gemini（テキストベースでクリップ選定）
```

---

## 1. AiGateway拡張

### 1.1 ファイル

```
apps/backend/src/domain/gateways/ai.gateway.ts
```

### 1.2 追加インターフェース

```typescript
// 既存のAnalyzeVideoParamsに加えて追加

export interface AnalyzeTranscriptParams {
  /** タイムスタンプ付き文字起こし結果 */
  transcription: TranscriptionResult;
  /** 動画タイトル */
  videoTitle: string | null;
  /** クリップ抽出の指示 */
  clipInstructions: string;
}

export interface AiGateway {
  // 既存（後方互換のため残す）
  analyzeVideo(params: AnalyzeVideoParams): Promise<ClipExtractionResponse>;

  // 新規追加
  analyzeTranscript(params: AnalyzeTranscriptParams): Promise<ClipExtractionResponse>;
}
```

### 1.3 設計判断

| 項目 | 決定 | 理由 |
|------|------|------|
| 既存メソッドの扱い | 残す | 後方互換性を維持。将来的に削除可能 |
| 入力形式 | TranscriptionResult全体 | セグメント情報をGeminiに渡してタイムスタンプ精度を向上させるため |

---

## 2. GeminiClient改修

### 2.1 ファイル

```
apps/backend/src/infrastructure/clients/gemini.client.ts
```

### 2.2 新規プロンプト

```
あなたは動画編集アシスタントです。
以下の文字起こしデータを分析し、ユーザーの指示に基づいて切り抜くべき箇所を特定してください。

## 動画情報
- タイトル: {videoTitle}
- 総時間: {durationSeconds}秒

## 文字起こし（タイムスタンプ付き）
{transcriptionWithTimestamps}

## ユーザーの切り抜き指示
{clipInstructions}

## 出力形式
以下のJSON形式で、切り抜くべき箇所を出力してください。
各クリップは20秒〜60秒程度になるようにしてください。
startTime/endTimeは文字起こしのタイムスタンプを参照して正確に指定してください。

```json
{
  "clips": [
    {
      "title": "クリップの簡潔なタイトル",
      "startTime": "HH:MM:SS",
      "endTime": "HH:MM:SS",
      "transcript": "このクリップ内での発言内容",
      "reason": "この箇所を選んだ理由"
    }
  ]
}
```

## 注意事項
- 各クリップは20秒〜60秒の範囲に収めてください
- 発言の途中で切れないよう、タイムスタンプを参照して自然な区切りを選んでください
- transcriptは文字起こしデータからそのまま抜粋してください
```

### 2.3 文字起こしデータのフォーマット

セグメントをテキスト形式に変換してプロンプトに含める：

```
[00:00.08 - 00:00.80] どうもこんにちは
[00:00.92 - 00:03.12] チーム未来党首の安野貴博です
[00:03.36 - 00:05.32] 本日は年始ということで
...
```

### 2.4 実装方針

1. `analyzeTranscript`メソッドを新規実装
2. Gemini API呼び出しはテキストのみ（動画ファイルは渡さない）
3. 出力パースは既存の`analyzeVideo`と同じ形式

---

## 3. ProcessVideoUseCase改修

### 3.1 ファイル

```
apps/backend/src/application/usecases/process-video.usecase.ts
```

### 3.2 依存関係の追加

```typescript
export interface ProcessVideoUseCaseDeps {
  // 既存
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
  processingJobRepository: ProcessingJobRepositoryGateway;
  storageGateway: StorageGateway;
  aiGateway: AiGateway;
  videoProcessingService: VideoProcessingService;
  generateId: () => string;

  // 新規追加
  transcriptionGateway: TranscriptionGateway;
}
```

### 3.3 処理フローの変更

現在の`execute`メソッド内の処理順序を以下のように変更：

```
1. ProcessingJob取得
2. Video取得
3. ステータス更新 → analyzing
4. Google Driveメタデータ取得
5. 動画ダウンロード                    ← 順番変更（先にダウンロード）
6. 音声抽出（extractAudio）             ← 新規追加
7. 文字起こし（transcriptionGateway）   ← 新規追加
8. AI分析（analyzeTranscript）          ← 変更（動画URLではなく文字起こしを渡す）
9. クリップ作成
10. ステータス更新 → extracting
11. クリップ抽出・アップロード
12. メタデータファイル作成
13. ステータス更新 → completed
```

### 3.4 変更箇所の詳細

#### 動画ダウンロードの移動

```typescript
// 現在: line 117 (extractingステータス後)
// 変更後: analyzingステータス後、AI分析前に移動
const videoBuffer = await this.storageGateway.downloadFile(video.googleDriveFileId);
```

#### 音声抽出の追加

```typescript
// 動画ダウンロード後に追加
const audioBuffer = await this.videoProcessingService.extractAudio(videoBuffer, 'wav');
```

#### 文字起こしの追加

```typescript
// 音声抽出後に追加
const transcription = await this.transcriptionGateway.transcribe({
  audioBuffer,
  mimeType: 'audio/wav',
  sampleRateHertz: 16000,
});
```

#### AI分析の変更

```typescript
// 変更前
const aiResponse = await this.aiGateway.analyzeVideo({
  googleDriveUrl: video.googleDriveUrl,
  videoTitle: metadata.name,
  clipInstructions: job.clipInstructions,
});

// 変更後
const aiResponse = await this.aiGateway.analyzeTranscript({
  transcription,
  videoTitle: metadata.name,
  clipInstructions: job.clipInstructions,
});
```

---

## 4. 実装ファイル一覧

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `apps/backend/src/domain/gateways/ai.gateway.ts` | 修正 | `analyzeTranscript`メソッド追加 |
| `apps/backend/src/infrastructure/clients/gemini.client.ts` | 修正 | `analyzeTranscript`実装 |
| `apps/backend/src/application/usecases/process-video.usecase.ts` | 修正 | Speech-to-Text統合 |

---

## 5. 環境変数

既存の`SpeechToTextClient`用環境変数が必要：

| 変数名 | 説明 |
|--------|------|
| `GOOGLE_CLOUD_PROJECT` | GCPプロジェクトID |
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントキーのパス |

---

## 6. テスト方針

本設計のテストはusecaseレベルでは行わず、以下で確認：

1. `GeminiClient.analyzeTranscript`の単体テスト（モック使用）
2. 実際の動作確認はE2Eで実施
