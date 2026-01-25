# Refined Transcript 機能設計書

## 概要

現在のraw transcriptを保持しつつ、LLMで品質を向上させたrefined transcriptを別途作成・保存する機能。

### 解決する課題
1. **誤字脱字** - 「党首→投手」のような音声認識誤り
2. **表記の誤り** - 「安野高広 → 安野たかひろ」のような固有名詞
3. **細かすぎる編集単位** - 単語レベルのセグメントを日本語の一文単位にマージ

### 機能要件
- 固有名詞辞書をプロンプトに含めて校正
- 政治の文脈をふまえ同音異義語を補正
- 日本語の一文単位にマージ（タイムスタンプは保持）

---

## アーキテクチャ設計

### データモデル

```
┌─────────────────────┐      ┌─────────────────────────┐
│   Transcription     │      │   RefinedTranscription  │
│   (raw / 既存)      │ 1:1  │   (refined / 新規)      │
├─────────────────────┤◄────►├─────────────────────────┤
│ id                  │      │ id                      │
│ videoId (unique)    │      │ transcriptionId (unique)│
│ fullText            │      │ fullText (校正済み)     │
│ segments[] (単語)   │      │ sentences[] (文単位)    │
│ languageCode        │      │ dictionaryVersion       │
│ durationSeconds     │      │ createdAt               │
└─────────────────────┘      │ updatedAt               │
                             └─────────────────────────┘
```

### 新規データ構造

```typescript
// RefinedTranscription Entity
interface RefinedTranscription {
  id: string;
  transcriptionId: string;  // FK to raw transcription
  fullText: string;          // 全文（校正・マージ済み）
  sentences: RefinedSentence[];
  dictionaryVersion: string; // 使用した辞書バージョン
  createdAt: Date;
  updatedAt: Date;
}

// 文単位のセグメント
interface RefinedSentence {
  text: string;              // 校正済みテキスト
  startTimeSeconds: number;  // 文の開始時刻（元のセグメントから）
  endTimeSeconds: number;    // 文の終了時刻
  originalSegmentIndices: number[];  // マージ元のセグメントindex
}
```

---

## バックエンド設計

### ディレクトリ構成（追加ファイル）

```
apps/backend/src/
├── domain/
│   ├── models/
│   │   └── refined-transcription.ts          # 新規 Entity
│   ├── gateways/
│   │   └── refined-transcription-repository.gateway.ts  # 新規 Gateway Interface
│   └── services/
│       └── transcript-refinement-prompt.service.ts      # 新規 Prompt Service
├── application/
│   └── usecases/
│       └── refine-transcript.usecase.ts      # 新規 UseCase
├── infrastructure/
│   ├── repositories/
│   │   └── refined-transcription.repository.ts  # 新規 Repository
│   └── data/
│       └── proper-noun-dictionary.json       # 固有名詞辞書
└── presentation/
    └── routes/
        └── videos.ts                         # 既存に追加
```

### Prisma Schema追加

```prisma
model RefinedTranscription {
  id                String   @id @default(uuid())
  transcriptionId   String   @unique @map("transcription_id")
  fullText          String   @map("full_text")
  sentences         Json     // RefinedSentence[]
  dictionaryVersion String   @map("dictionary_version")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  transcription Transcription @relation(fields: [transcriptionId], references: [id], onDelete: Cascade)

  @@map("refined_transcriptions")
}
```

### Domain Layer

#### `domain/models/refined-transcription.ts`
```typescript
export interface RefinedSentence {
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  originalSegmentIndices: number[];
}

export interface RefinedTranscriptionProps {
  id?: string;
  transcriptionId: string;
  fullText: string;
  sentences: RefinedSentence[];
  dictionaryVersion: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RefinedTranscription {
  // Factory, validation, getters...
}
```

#### `domain/services/transcript-refinement-prompt.service.ts`

プロンプト設計:
```
あなたは日本語の音声認識結果を校正するアシスタントです。

## 固有名詞辞書
以下の固有名詞は必ず正しい表記に修正してください:
- 安野高広/あんの高広 → 安野たかひろ（チームみらい党首）
- 投手 → 党首（政治の文脈で）
- チーム未来 → チームみらい
...

## タスク
1. 単語レベルのセグメントを日本語の自然な文単位にマージ
2. 固有名詞を辞書に基づいて修正
3. 政治の文脈を考慮して同音異義語を補正
4. 各文のタイムスタンプ（開始/終了）を保持

## 入力フォーマット
[index] [startTime-endTime] text
例: [0] [0.08-0.20] どう

## 出力フォーマット（JSON）
{
  "sentences": [
    {
      "text": "どうも、こんにちは。",
      "startTimeSeconds": 0.08,
      "endTimeSeconds": 0.80,
      "originalSegmentIndices": [0, 1, 2, 3]
    }
  ]
}
```

### Application Layer

#### `application/usecases/refine-transcript.usecase.ts`

```typescript
export class RefineTranscriptUseCase {
  constructor(
    private transcriptionRepository: TranscriptionRepositoryGateway,
    private refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway,
    private aiGateway: AiGateway,
    private videoRepository: VideoRepositoryGateway
  ) {}

  async execute(videoId: string): Promise<Result<RefinedTranscription>> {
    // 1. Get raw transcription
    // 2. Load proper noun dictionary
    // 3. Build prompt
    // 4. Call LLM
    // 5. Parse response
    // 6. Create RefinedTranscription entity
    // 7. Save to repository
    // 8. Return result
  }
}
```

### API設計

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/videos/:videoId/refine-transcript` | Refined transcript作成開始 |
| GET | `/api/videos/:videoId/transcription/refined` | Refined transcript取得 |

**Response型 (shared/types/api.ts に追加)**
```typescript
export interface RefinedSentence {
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  originalSegmentIndices: number[];
}

export interface GetRefinedTranscriptionResponse {
  id: string;
  transcriptionId: string;
  fullText: string;
  sentences: RefinedSentence[];
  dictionaryVersion: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## フロントエンド設計

### 追加コンポーネント

```
apps/webapp/src/
├── app/videos/[id]/
│   └── page.tsx              # 既存を修正
├── components/
│   ├── TranscriptViewer.tsx           # 新規: タブ切り替えコンポーネント
│   ├── RawTranscriptView.tsx          # 新規: 生データ表示
│   ├── RefinedTranscriptView.tsx      # 新規: 校正済み表示
│   └── TranscriptSegmentTimeline.tsx  # 新規: タイムライン表示（オプション）
└── lib/
    └── api-client.ts         # API追加
```

### UIデザイン

```
┌──────────────────────────────────────────────────────────┐
│  Video: 2026年プラン発表                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Transcript                                              │
│  ┌─────────────────┬────────────────────┐               │
│  │  Raw (生データ) │  Refined (校正済み) │ ← Tab        │
│  └─────────────────┴────────────────────┘               │
│                                                          │
│  [Refineボタン]  ← 未作成時のみ表示                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [00:00.08 - 00:03.12]                              │ │
│  │ どうも、こんにちは。チームみらい党首の安野たかひろです。│ │
│  │                                                    │ │
│  │ [00:03.36 - 00:12.68]                              │ │
│  │ 本日は年始ということで、チームみらいが2026年に       │ │
│  │ 成し遂げること、題して2026年プランを発表したいと     │ │
│  │ 思います。                                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### コンポーネント設計

#### `TranscriptViewer.tsx`
```tsx
interface TranscriptViewerProps {
  videoId: string;
  rawTranscription: GetTranscriptionResponse | null;
  refinedTranscription: GetRefinedTranscriptionResponse | null;
  onRefine: () => void;
  isRefining: boolean;
}
// タブ切り替え + 表示制御
```

#### `RawTranscriptView.tsx`
```tsx
interface RawTranscriptViewProps {
  transcription: GetTranscriptionResponse;
  showSegments?: boolean;  // セグメント詳細表示のトグル
}
// 単語レベルのセグメントを表示
// confidence score表示オプション
```

#### `RefinedTranscriptView.tsx`
```tsx
interface RefinedTranscriptViewProps {
  refinedTranscription: GetRefinedTranscriptionResponse;
}
// 文単位でタイムスタンプ付き表示
```

### API Client追加

```typescript
// apps/webapp/src/lib/api-client.ts

export async function refineTranscript(videoId: string): Promise<void> {
  await fetch(`${API_BASE}/videos/${videoId}/refine-transcript`, {
    method: 'POST',
  });
}

export async function getRefinedTranscription(
  videoId: string
): Promise<GetRefinedTranscriptionResponse | null> {
  const res = await fetch(`${API_BASE}/videos/${videoId}/transcription/refined`);
  if (res.status === 404) return null;
  return res.json();
}
```

---

## 実装タスク分割

### バックエンド実装（Session A）

| # | タスク | ファイル |
|---|--------|----------|
| 1 | Prisma schema更新 + migration | `schema.prisma` |
| 2 | RefinedTranscription Entity作成 | `domain/models/refined-transcription.ts` |
| 3 | RefinedTranscriptionRepositoryGateway Interface作成 | `domain/gateways/refined-transcription-repository.gateway.ts` |
| 4 | TranscriptRefinementPromptService作成 | `domain/services/transcript-refinement-prompt.service.ts` |
| 5 | 固有名詞辞書データ作成 | `infrastructure/data/proper-noun-dictionary.json` |
| 6 | RefinedTranscriptionRepository実装 | `infrastructure/repositories/refined-transcription.repository.ts` |
| 7 | RefineTranscriptUseCase実装 | `application/usecases/refine-transcript.usecase.ts` |
| 8 | API Route追加 | `presentation/routes/videos.ts` |
| 9 | shared types追加 | `apps/shared/types/api.ts` |
| 10 | Unit Test作成 | `*.test.ts` |

### フロントエンド実装（Session B）

| # | タスク | ファイル |
|---|--------|----------|
| 1 | API Client関数追加 | `lib/api-client.ts` |
| 2 | RawTranscriptViewコンポーネント | `components/RawTranscriptView.tsx` |
| 3 | RefinedTranscriptViewコンポーネント | `components/RefinedTranscriptView.tsx` |
| 4 | TranscriptViewerコンポーネント（タブ） | `components/TranscriptViewer.tsx` |
| 5 | Video詳細ページ統合 | `app/videos/[id]/page.tsx` |
| 6 | ローディング/エラー状態対応 | 各コンポーネント |

---

## 依存関係

```
Backend完了必須:
├── Prisma schema + migration
├── shared types (API response型)
└── API endpoints実装

Frontend並列実行可能:
├── コンポーネント作成（モック使用）
└── API呼び出し実装
```

**並列開発のポイント:**
- Backend: shared typesを先に定義してpush
- Frontend: shared typesをimportしてコンポーネント開発
- 統合テストは両方完了後

---

## 今後の拡張案（スコープ外）

1. **辞書管理UI** - 固有名詞辞書をUIから編集
2. **手動修正機能** - Refined結果を手動で微調整
3. **バッチ処理** - 複数動画を一括refine
4. **品質スコア** - 校正前後の比較表示
5. **再refine** - 辞書更新後に再度refine
