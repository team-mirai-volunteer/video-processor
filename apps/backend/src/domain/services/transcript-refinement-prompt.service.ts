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
 * Note: segments are not stored here to avoid memory duplication
 */
export interface SegmentChunk {
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Default number of segments per chunk
 * This value is chosen to stay well within LLM output token limits
 */
const DEFAULT_CHUNK_SIZE = 500;

/**
 * Number of segments to overlap between chunks for context continuity
 */
export const CHUNK_OVERLAP = 100;

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
        startIndex,
        endIndex,
        chunkIndex,
        totalChunks,
      });

      // If this chunk reached the end, we're done
      if (endIndex >= segments.length - 1) break;

      // Move to next chunk with overlap
      startIndex = endIndex + 1 - CHUNK_OVERLAP;
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
    segments: TranscriptionSegment[],
    dictionary: ProperNounDictionary,
    previousContext?: string
  ): string {
    const dictionarySection = this.buildDictionarySection(dictionary);
    const inputSection = this.buildChunkInputSection(chunk, segments);

    const contextSection = previousContext
      ? `\n## 前のチャンクの末尾（参考用、出力には含めないでください）\n${previousContext}\n`
      : '';

    const chunkInfo =
      chunk.totalChunks > 1
        ? `\n## チャンク情報\nこれは ${chunk.totalChunks} 個のチャンクのうち ${chunk.chunkIndex + 1} 番目です。セグメントindex ${chunk.startIndex} から ${chunk.endIndex} を処理してください。\n`
        : '';

    return `音声認識結果を校正し、単語を文にまとめてください。

## 固有名詞辞書（必ず修正）
${dictionarySection}
${contextSection}${chunkInfo}
## ルール
- 句点（。）で文を区切る
- 固有名詞を辞書に基づいて修正
- 政治の文脈で同音異義語を補正
- すべてのセグメントを処理する

## 入力（[index] text）
${inputSection}

## 出力（JSONのみ、説明不要）
1文ごとにオブジェクトを作成。句点（。）で区切る。
{"sentences":[{"text":"本日はお集まりいただきありがとうございます。","start":0,"end":8},{"text":"チームみらいの安野たかひろです。","start":9,"end":15},{"text":"今日は活動報告をさせていただきます。","start":16,"end":24}]}`;
  }

  /**
   * Build input section for a chunk with absolute indices
   */
  private buildChunkInputSection(chunk: SegmentChunk, segments: TranscriptionSegment[]): string {
    const chunkSegments = segments.slice(chunk.startIndex, chunk.endIndex + 1);
    return chunkSegments
      .map((segment, localIndex) => {
        const absoluteIndex = chunk.startIndex + localIndex;
        return `[${absoluteIndex}] ${segment.text}`;
      })
      .join('\n');
  }
}
