# クリップ抽出にRefinedTranscription使用 設計書

## 目的

**ユーザーが**、より正確な固有名詞表記・自然な文単位の文字起こしを元にした高品質なクリップ抽出結果**を得られるようにするため**。

現状はrawの文字起こし（単語レベル、誤認識含む）をAIに渡しているが、校正済みのrefined transcriptionを渡すことで、AIがより正確に文脈を理解し、適切な切り抜き箇所を特定できる。

---

## 現状分析

### 現在の処理フロー

```
ExtractClipsUseCase
  ↓
TranscriptionRepositoryGateway.findByVideoId(videoId)
  ↓
Transcription（raw）を取得
  ↓
ClipAnalysisPromptService.buildPrompt()
  ↓
AIに渡して切り抜き箇所を特定
```

### 現在のプロンプトに渡されるデータ

[clip-analysis-prompt.service.ts:17-57](apps/backend/src/domain/services/clip-analysis-prompt.service.ts#L17-L57)

```typescript
interface ClipAnalysisPromptParams {
  transcription: TranscriptionResult;  // ← raw
  videoTitle: string | null;
  clipInstructions: string;
}
```

TranscriptionResult（raw）:
- `fullText`: 単語を結合しただけの全文
- `segments`: 単語レベルのセグメント（0.1秒単位など細かい）
- `languageCode`: 言語コード
- `durationSeconds`: 総時間

### 問題点

1. **誤認識が含まれる**: 「党首→投手」のような音声認識誤りがそのまま渡される
2. **セグメントが細かすぎる**: 単語レベルのため、AIが文脈を把握しづらい
3. **タイムスタンプの精度**: 細かすぎるセグメントのせいで、自然な区切りでの切り抜きが難しい

---

## 設計

### 変更方針

1. `ClipAnalysisPromptService`をrefinedに対応させる
2. `ExtractClipsUseCase`でrefined transcriptionを取得・使用する
3. refined transcriptionが存在しない場合はエラーを返す
4. フロントエンドで「切り抜き作成」ボタンの表示条件を変更する

### 新しい処理フロー

```
ExtractClipsUseCase
  ↓
TranscriptionRepositoryGateway.findByVideoId(videoId)
  ↓
Transcription を取得（rawのdurationSecondsを使うため）
  ↓
RefinedTranscriptionRepositoryGateway.findByTranscriptionId(transcription.id)
  ↓
RefinedTranscription が存在しなければエラー（REFINED_TRANSCRIPTION_NOT_FOUND）
  ↓
ClipAnalysisPromptService.buildPrompt() にrefinedデータを渡す
  ↓
AIに渡して切り抜き箇所を特定
```

---

## バックエンド設計

### 1. ClipAnalysisPromptParams の変更

**ファイル**: [apps/backend/src/domain/services/clip-analysis-prompt.service.ts](apps/backend/src/domain/services/clip-analysis-prompt.service.ts)

```typescript
// 変更前
export interface ClipAnalysisPromptParams {
  transcription: TranscriptionResult;
  videoTitle: string | null;
  clipInstructions: string;
}

// 変更後
export interface ClipAnalysisPromptParams {
  refinedTranscription: {
    fullText: string;
    sentences: RefinedSentence[];
    durationSeconds: number;  // rawから取得
  };
  videoTitle: string | null;
  clipInstructions: string;
}
```

### 2. buildPrompt の変更

プロンプト内のセグメント形式を文単位に変更:

```
## 文字起こし（タイムスタンプ付き、単位: 秒）
[0.08秒 - 3.12秒] どうも、こんにちは。チームみらい党首の安野たかひろです。
[3.36秒 - 12.68秒] 本日は年始ということで、チームみらいが2026年に成し遂げること...
```

### 3. ExtractClipsUseCaseDeps の拡張

**ファイル**: [apps/backend/src/application/usecases/extract-clips.usecase.ts](apps/backend/src/application/usecases/extract-clips.usecase.ts)

```typescript
export interface ExtractClipsUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;  // 追加
  // ... 他は既存のまま
}
```

### 4. エラーコードの追加

**ファイル**: [apps/backend/src/application/errors/clip.errors.ts](apps/backend/src/application/errors/clip.errors.ts)

```typescript
export const CLIP_ERROR_CODES = {
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  TRANSCRIPTION_NOT_FOUND: 'TRANSCRIPTION_NOT_FOUND',
  REFINED_TRANSCRIPTION_NOT_FOUND: 'REFINED_TRANSCRIPTION_NOT_FOUND',  // 追加
  AI_ANALYSIS_FAILED: 'AI_ANALYSIS_FAILED',
  VIDEO_FETCH_FAILED: 'VIDEO_FETCH_FAILED',
  CLIP_EXTRACTION_FAILED: 'CLIP_EXTRACTION_FAILED',
  CLIP_UPLOAD_FAILED: 'CLIP_UPLOAD_FAILED',
} as const;
```

### 5. ExtractClipsUseCase.execute の変更

```typescript
async execute(input: ExtractClipsInput): Promise<ExtractClipsResponse> {
  // ... 既存のvideo取得処理

  // 2. Get transcription (for durationSeconds)
  const transcription = await this.transcriptionRepository.findByVideoId(videoId);
  if (!transcription) {
    const error = createClipError(
      CLIP_ERROR_CODES.TRANSCRIPTION_NOT_FOUND,
      `Transcription not found for video ${videoId}. Please run transcription first.`
    );
    throw new ValidationError(error.message);
  }

  // 3. Get refined transcription (必須)
  const refinedTranscription = await this.refinedTranscriptionRepository.findByTranscriptionId(transcription.id);
  if (!refinedTranscription) {
    const error = createClipError(
      CLIP_ERROR_CODES.REFINED_TRANSCRIPTION_NOT_FOUND,
      `Refined transcription not found for video ${videoId}. Please run transcript refinement first.`
    );
    throw new ValidationError(error.message);
  }

  // ... 以降の処理

  // 4. AI analysis (clip point suggestion)
  const prompt = this.clipAnalysisPromptService.buildPrompt({
    refinedTranscription: {
      fullText: refinedTranscription.fullText,
      sentences: refinedTranscription.sentences,
      durationSeconds: transcription.durationSeconds,
    },
    videoTitle: video.title ?? metadata.name,
    clipInstructions,
  });
  // ...
}
```

### 6. Presentation Layer (routes/videos.ts) の変更

`POST /api/videos/:videoId/extract-clips` のルートで、usecaseのDIにrefinedTranscriptionRepositoryを追加。

---

## フロントエンド設計

### UI制御の変更

**ファイル**: [apps/webapp/src/app/videos/[id]/page.tsx](apps/webapp/src/app/videos/%5Bid%5D/page.tsx)

現在の「切り抜き作成」カードの表示条件:

```tsx
// 変更前（314行目付近）
{(video.status === 'transcribed' || video.status === 'completed') && (
  <Card>
    {/* 切り抜き作成フォーム */}
  </Card>
)}
```

変更後:

```tsx
{/* 切り抜き作成カードの表示条件: transcribed/completed かつ refinedTranscriptionが存在 */}
{(video.status === 'transcribed' || video.status === 'completed') && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Scissors className="h-5 w-5" />
        切り抜き作成
      </CardTitle>
      <CardDescription>
        文字起こしを元に、切り抜きたい箇所を指示してください。
      </CardDescription>
    </CardHeader>
    <CardContent>
      {refinedTranscription ? (
        // 既存の切り抜き指示フォーム
        <div className="space-y-4">...</div>
      ) : (
        // refinedがない場合のメッセージ
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            切り抜き作成には文字起こしの校正が必要です。
          </p>
          <p className="text-sm text-muted-foreground">
            文字起こしカードの「Refined」タブから校正を実行してください。
          </p>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

### UXの考慮

- ボタン自体を非表示にするのではなく、カードは表示して「校正が必要」というメッセージを表示
- ユーザーが何をすべきか明確にガイドする
- 校正後に再描画で切り抜きフォームが表示される

---

## 影響範囲

### バックエンド

| ファイル | 変更内容 |
|----------|----------|
| `domain/services/clip-analysis-prompt.service.ts` | params型変更、プロンプト変更 |
| `application/usecases/extract-clips.usecase.ts` | deps追加、refined取得ロジック追加 |
| `application/errors/clip.errors.ts` | エラーコード追加 |
| `presentation/routes/videos.ts` | usecase DI変更 |

### フロントエンド

| ファイル | 変更内容 |
|----------|----------|
| `app/videos/[id]/page.tsx` | 切り抜き作成カードの表示条件変更 |

### テスト

| ファイル | 変更内容 |
|----------|----------|
| `test/unit/domain/services/clip-analysis-prompt.service.test.ts` | 新規作成または修正 |
| `test/unit/application/usecases/extract-clips.usecase.test.ts` | refined関連のテスト追加 |
| `test/e2e/video-detail.spec.ts` | UI表示条件のテスト追加 |

---

## 実装タスク

### バックエンド

1. `clip.errors.ts` に `REFINED_TRANSCRIPTION_NOT_FOUND` エラーコード追加
2. `clip-analysis-prompt.service.ts` の params型とbuildPrompt実装を変更
3. `extract-clips.usecase.ts` にrefinedTranscriptionRepository依存を追加し、取得・検証ロジックを追加
4. `routes/videos.ts` のDI設定を更新
5. ユニットテスト更新

### フロントエンド

1. `page.tsx` の切り抜き作成カードの表示ロジックを変更
2. E2Eテスト更新（任意）

---

## データ構造の対応関係

```
Transcription (raw)              RefinedTranscription
├── segments[] (単語単位)    →   ├── sentences[] (文単位)
│   ├── text                     │   ├── text (校正済み)
│   ├── startTimeSeconds         │   ├── startTimeSeconds
│   ├── endTimeSeconds           │   ├── endTimeSeconds
│   └── confidence               │   └── originalSegmentIndices
├── fullText                 →   ├── fullText (校正済み)
└── durationSeconds          →   └── (rawから引き継ぎ)
```

AIプロンプトでは、文単位（sentences）でタイムスタンプ付きテキストを渡すことで:
- 自然な文の区切りでの切り抜きが可能に
- 固有名詞が正確に表記された状態でAIが理解
- より良い切り抜き箇所の選定が期待できる
