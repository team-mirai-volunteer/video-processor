import {
  type ClipSubtitleSegment,
  SUBTITLE_MAX_CHARS_PER_LINE,
  SUBTITLE_MAX_LINES,
} from '@clip-video/domain/models/clip-subtitle.js';
import type { RefinedSentence } from '@clip-video/domain/models/refined-transcription.js';

/**
 * LLMからのレスポンス形式（軽量版: テキストのみ）
 */
export interface SubtitleSegmentationResponse {
  segments: Array<{
    lines: string[];
  }>;
}

/**
 * 字幕分割のための入力データ（軽量版）
 */
export interface SubtitleSegmentationInput {
  clipStartSeconds: number;
  clipEndSeconds: number;
  refinedSentences: RefinedSentence[];
}

/**
 * 時間をmm:ss.ms形式にフォーマット
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

/**
 * SubtitleSegmentationPromptService
 * LLMに字幕分割を依頼するためのプロンプト生成と解析を担当
 * 軽量版: JSONではなくテキストベースのプロンプトを使用し、タイムスタンプは後から文字数按分で計算
 */
export class SubtitleSegmentationPromptService {
  /**
   * クリップ範囲のRefinedSentenceをフィルタリング
   */
  filterSentencesForClip(
    sentences: RefinedSentence[],
    clipStartSeconds: number,
    clipEndSeconds: number
  ): RefinedSentence[] {
    return sentences.filter(
      (s) => s.startTimeSeconds < clipEndSeconds && s.endTimeSeconds > clipStartSeconds
    );
  }

  /**
   * 字幕分割用のプロンプトを生成（軽量版）
   */
  buildPrompt(input: SubtitleSegmentationInput): string {
    const filteredSentences = this.filterSentencesForClip(
      input.refinedSentences,
      input.clipStartSeconds,
      input.clipEndSeconds
    );

    // テキストベースの軽量フォーマット
    const sentencesText = filteredSentences
      .map((s) => `[${formatTime(s.startTimeSeconds)}-${formatTime(s.endTimeSeconds)}] ${s.text}`)
      .join('\n');

    return `あなたは動画字幕の編集者です。
以下の文章を、動画の字幕として表示するのに適した単位に分割してください。

## 入力データ
${sentencesText}

## 出力形式
以下のJSON形式で出力してください。JSONのみを出力し、他のテキストは含めないでください。

\`\`\`json
{
  "segments": [
    { "lines": ["今日はとても"] },
    { "lines": ["良い天気ですね", "皆さん"] }
  ]
}
\`\`\`

## ルール
1. **1行は${SUBTITLE_MAX_CHARS_PER_LINE}文字以内にすること（厳守）**
2. **1セグメントは最大${SUBTITLE_MAX_LINES}行まで（厳守）**
3. **句読点（、。！？）は入れないこと** - 字幕なので句読点は不要
4. 文の切れ目、意味の区切りで分割する
5. 読みやすさを優先し、1画面に表示する量を適切に調整する
6. セグメントは時系列順に並べる
7. 長い文は適切に2行に分割するか、複数のセグメントに分ける
8. 入力テキストの内容を省略せず、すべて含めること`;
  }

  /**
   * LLMのレスポンスをパース（テキストのみ、タイムスタンプなし）
   */
  parseResponse(response: string): Array<{ lines: string[] }> {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response: No valid JSON found');
    }

    let parsed: SubtitleSegmentationResponse;
    try {
      parsed = JSON.parse(jsonMatch[0]) as SubtitleSegmentationResponse;
    } catch (e) {
      throw new Error(
        `Failed to parse AI response as JSON: ${e instanceof Error ? e.message : 'Unknown error'}`
      );
    }

    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      throw new Error('Invalid response format: missing segments array');
    }

    return parsed.segments.map((seg, index) => {
      // lines のバリデーション
      if (!Array.isArray(seg.lines) || seg.lines.length === 0) {
        throw new Error(`Invalid segment at index ${index}: missing or empty lines`);
      }
      if (seg.lines.length > SUBTITLE_MAX_LINES) {
        throw new Error(
          `Invalid segment at index ${index}: too many lines (max ${SUBTITLE_MAX_LINES}, got ${seg.lines.length})`
        );
      }
      for (const [lineIndex, line] of seg.lines.entries()) {
        if (typeof line !== 'string') {
          throw new Error(`Invalid segment at index ${index}, line ${lineIndex}: not a string`);
        }
        if (line.length > SUBTITLE_MAX_CHARS_PER_LINE) {
          throw new Error(
            `Invalid segment at index ${index}, line ${lineIndex + 1}: too long (max ${SUBTITLE_MAX_CHARS_PER_LINE} chars, got ${line.length})`
          );
        }
      }

      return {
        lines: seg.lines.map((line) => line.trim()),
      };
    });
  }

  /**
   * 分割されたテキストにタイムスタンプを文字数按分で割り当て
   * @param parsedSegments LLMが分割したセグメント（テキストのみ）
   * @param sentences 元のRefinedSentence配列（フィルタリング済み）
   * @param clipStartSeconds クリップの開始時間（相対時間計算用）
   */
  assignTimestamps(
    parsedSegments: Array<{ lines: string[] }>,
    sentences: RefinedSentence[],
    clipStartSeconds: number
  ): ClipSubtitleSegment[] {
    if (sentences.length === 0) {
      throw new Error('No sentences provided for timestamp assignment');
    }

    // 正規化関数（句読点・空白除去）
    const normalize = (text: string) => text.replace(/[、。！？\s]/g, '');

    // 各sentenceの文字位置範囲を計算
    const sentenceRanges: Array<{
      sentence: RefinedSentence;
      charStart: number;
      charEnd: number;
    }> = [];
    let charPos = 0;
    for (const sentence of sentences) {
      const normalizedText = normalize(sentence.text);
      sentenceRanges.push({
        sentence,
        charStart: charPos,
        charEnd: charPos + normalizedText.length,
      });
      charPos += normalizedText.length;
    }

    // 各セグメントにタイムスタンプを割り当て
    const results: ClipSubtitleSegment[] = [];
    let currentCharPos = 0;

    for (const [i, seg] of parsedSegments.entries()) {
      const segmentText = normalize(seg.lines.join(''));
      const segmentCharStart = currentCharPos;
      const segmentCharEnd = currentCharPos + segmentText.length;

      // このセグメントがカバーするsentenceを見つけてタイムスタンプを按分計算
      const startTime = this.charPosToTime(segmentCharStart, sentenceRanges, clipStartSeconds);
      const endTime = this.charPosToTime(segmentCharEnd, sentenceRanges, clipStartSeconds);

      results.push({
        index: i,
        lines: seg.lines,
        startTimeSeconds: Math.max(0, startTime),
        endTimeSeconds: Math.max(0, endTime),
      });

      currentCharPos = segmentCharEnd;
    }

    return results;
  }

  /**
   * 文字位置から時間を計算（文字数按分）
   */
  private charPosToTime(
    charPos: number,
    sentenceRanges: Array<{
      sentence: RefinedSentence;
      charStart: number;
      charEnd: number;
    }>,
    clipStartSeconds: number
  ): number {
    // 該当するsentenceを見つける
    for (const range of sentenceRanges) {
      if (charPos >= range.charStart && charPos <= range.charEnd) {
        const { sentence, charStart, charEnd } = range;
        const sentenceLength = charEnd - charStart;

        if (sentenceLength === 0) {
          return sentence.startTimeSeconds - clipStartSeconds;
        }

        // sentence内での位置を按分
        const ratio = (charPos - charStart) / sentenceLength;
        const duration = sentence.endTimeSeconds - sentence.startTimeSeconds;
        const absoluteTime = sentence.startTimeSeconds + duration * ratio;

        return absoluteTime - clipStartSeconds;
      }
    }

    // 見つからない場合は最後のsentenceの終了時間
    const lastRange = sentenceRanges[sentenceRanges.length - 1];
    if (!lastRange) {
      return 0;
    }
    return lastRange.sentence.endTimeSeconds - clipStartSeconds;
  }
}
