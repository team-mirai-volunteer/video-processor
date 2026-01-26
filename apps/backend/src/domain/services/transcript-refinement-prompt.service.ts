import type { TranscriptionSegment } from '../models/transcription.js';

/**
 * Dictionary entry for proper noun correction
 */
export interface DictionaryEntry {
  correct: string;
  category: string;
  description: string;
  wrongPatterns: string[];
}

/**
 * Proper noun dictionary structure
 */
export interface ProperNounDictionary {
  version: string;
  description: string;
  entries: DictionaryEntry[];
}

/**
 * A chunk of segments with metadata for processing
 */
export interface SegmentChunk {
  segments: TranscriptionSegment[];
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Default number of segments per chunk
 * This value is chosen to stay well within LLM output token limits
 */
const DEFAULT_CHUNK_SIZE = 300;

/**
 * Number of segments to overlap between chunks for context continuity
 */
const CHUNK_OVERLAP = 10;

/**
 * Service for building prompts for transcript refinement
 */
export class TranscriptRefinementPromptService {
  /**
   * Split segments into chunks for processing
   * Each chunk has overlap with the previous chunk to maintain context
   */
  splitIntoChunks(
    segments: TranscriptionSegment[],
    chunkSize: number = DEFAULT_CHUNK_SIZE
  ): SegmentChunk[] {
    if (segments.length === 0) {
      return [];
    }

    if (segments.length <= chunkSize) {
      return [
        {
          segments,
          startIndex: 0,
          endIndex: segments.length - 1,
          chunkIndex: 0,
          totalChunks: 1,
        },
      ];
    }

    const chunks: SegmentChunk[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    // Calculate total chunks first
    const effectiveChunkSize = chunkSize - CHUNK_OVERLAP;
    const totalChunks = Math.ceil((segments.length - CHUNK_OVERLAP) / effectiveChunkSize);

    while (startIndex < segments.length) {
      const endIndex = Math.min(startIndex + chunkSize - 1, segments.length - 1);
      chunks.push({
        segments: segments.slice(startIndex, endIndex + 1),
        startIndex,
        endIndex,
        chunkIndex,
        totalChunks,
      });

      // Move to next chunk with overlap
      startIndex = endIndex + 1 - CHUNK_OVERLAP;
      if (startIndex >= segments.length) break;
      chunkIndex++;
    }

    // Update totalChunks for all chunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  }

  /**
   * Build a prompt for refining raw transcription segments
   */
  buildPrompt(segments: TranscriptionSegment[], dictionary: ProperNounDictionary): string {
    const dictionarySection = this.buildDictionarySection(dictionary);
    const inputSection = this.buildInputSection(segments);

    return `あなたは日本語の音声認識結果を校正するアシスタントです。

## 固有名詞辞書
以下の固有名詞は必ず正しい表記に修正してください:
${dictionarySection}

## タスク
1. 単語レベルのセグメントを日本語の自然な文単位にマージ
2. 固有名詞を辞書に基づいて修正
3. 政治の文脈を考慮して同音異義語を補正
4. 各文のタイムスタンプ（開始/終了）を保持
5. マージ元のセグメントindexを記録

## 重要な注意事項
- 句点（。）で文を区切ってください
- 読点（、）は文の途中で使用し、文の区切りには使用しないでください
- 長すぎる文は適切な位置で分割してください
- 話者の発言が終わる自然な区切りを尊重してください

## 入力フォーマット
[index] [startTime-endTime] text

## 入力データ
${inputSection}

## 出力フォーマット（JSON）
必ず以下の形式のJSONのみを出力してください。説明文や前置きは不要です。
{
  "sentences": [
    {
      "text": "文章テキスト。",
      "startTimeSeconds": 0.08,
      "endTimeSeconds": 0.80,
      "originalSegmentIndices": [0, 1, 2, 3]
    }
  ]
}`;
  }

  /**
   * Build dictionary section of the prompt
   */
  private buildDictionarySection(dictionary: ProperNounDictionary): string {
    return dictionary.entries
      .map((entry) => {
        const wrongPatterns = entry.wrongPatterns.join('、');
        return `- ${wrongPatterns} → ${entry.correct}（${entry.description}）`;
      })
      .join('\n');
  }

  /**
   * Build input section with formatted segments
   */
  private buildInputSection(segments: TranscriptionSegment[]): string {
    return segments
      .map((segment, index) => {
        const start = segment.startTimeSeconds.toFixed(2);
        const end = segment.endTimeSeconds.toFixed(2);
        return `[${index}] [${start}-${end}] ${segment.text}`;
      })
      .join('\n');
  }

  /**
   * Build a prompt for refining a chunk of segments
   * Uses absolute indices so results can be merged correctly
   */
  buildChunkPrompt(
    chunk: SegmentChunk,
    dictionary: ProperNounDictionary,
    previousContext?: string
  ): string {
    const dictionarySection = this.buildDictionarySection(dictionary);
    const inputSection = this.buildChunkInputSection(chunk);

    const contextSection = previousContext
      ? `\n## 前のチャンクの末尾（参考用、出力には含めないでください）\n${previousContext}\n`
      : '';

    const chunkInfo =
      chunk.totalChunks > 1
        ? `\n## チャンク情報\nこれは ${chunk.totalChunks} 個のチャンクのうち ${chunk.chunkIndex + 1} 番目です。セグメントindex ${chunk.startIndex} から ${chunk.endIndex} を処理してください。\n`
        : '';

    return `あなたは日本語の音声認識結果を校正するアシスタントです。

## 固有名詞辞書
以下の固有名詞は必ず正しい表記に修正してください:
${dictionarySection}
${contextSection}${chunkInfo}
## タスク
1. 単語レベルのセグメントを日本語の自然な文単位にマージ
2. 固有名詞を辞書に基づいて修正
3. 政治の文脈を考慮して同音異義語を補正
4. 各文のタイムスタンプ（開始/終了）を保持
5. マージ元のセグメントindexを記録（必ず元の絶対indexを使用）

## 重要な注意事項
- 句点（。）で文を区切ってください
- 読点（、）は文の途中で使用し、文の区切りには使用しないでください
- 長すぎる文は適切な位置で分割してください
- 話者の発言が終わる自然な区切りを尊重してください
- originalSegmentIndicesには入力データの[index]の値をそのまま使用してください
- すべてのセグメントを処理し、最後まで出力してください

## 入力フォーマット
[index] [startTime-endTime] text

## 入力データ
${inputSection}

## 出力フォーマット（JSON）
必ず以下の形式のJSONのみを出力してください。説明文や前置きは不要です。
{
  "sentences": [
    {
      "text": "文章テキスト。",
      "startTimeSeconds": 0.08,
      "endTimeSeconds": 0.80,
      "originalSegmentIndices": [0, 1, 2, 3]
    }
  ]
}`;
  }

  /**
   * Build input section for a chunk with absolute indices
   */
  private buildChunkInputSection(chunk: SegmentChunk): string {
    return chunk.segments
      .map((segment, localIndex) => {
        const absoluteIndex = chunk.startIndex + localIndex;
        const start = segment.startTimeSeconds.toFixed(2);
        const end = segment.endTimeSeconds.toFixed(2);
        return `[${absoluteIndex}] [${start}-${end}] ${segment.text}`;
      })
      .join('\n');
  }
}
