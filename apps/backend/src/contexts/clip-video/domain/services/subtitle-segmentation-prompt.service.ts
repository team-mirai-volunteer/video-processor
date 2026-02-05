import {
  type ClipSubtitleSegment,
  SUBTITLE_MAX_CHARS_PER_LINE,
  SUBTITLE_MAX_LINES,
} from '@clip-video/domain/models/clip-subtitle.js';
import type { TranscriptionSegment } from '@clip-video/domain/models/transcription.js';

/**
 * LLMからのレスポンス形式
 */
export interface SubtitleSegmentationResponse {
  segments: Array<{
    lines: string[];
    startTimeSeconds: number;
    endTimeSeconds: number;
  }>;
}

/**
 * 字幕分割のための入力データ
 */
export interface SubtitleSegmentationInput {
  clipStartSeconds: number;
  clipEndSeconds: number;
  transcriptionSegments: TranscriptionSegment[];
  refinedFullText: string;
}

/**
 * SubtitleSegmentationPromptService
 * LLMに字幕分割を依頼するためのプロンプト生成と解析を担当
 */
export class SubtitleSegmentationPromptService {
  /**
   * クリップ範囲のTranscriptionセグメントをフィルタリング
   */
  filterSegmentsForClip(
    segments: TranscriptionSegment[],
    clipStartSeconds: number,
    clipEndSeconds: number
  ): TranscriptionSegment[] {
    return segments.filter(
      (seg) =>
        seg.startTimeSeconds >= clipStartSeconds - 0.5 && seg.endTimeSeconds <= clipEndSeconds + 0.5
    );
  }

  /**
   * 字幕分割用のプロンプトを生成
   */
  buildPrompt(input: SubtitleSegmentationInput): string {
    const filteredSegments = this.filterSegmentsForClip(
      input.transcriptionSegments,
      input.clipStartSeconds,
      input.clipEndSeconds
    );

    const segmentsJson = JSON.stringify(
      filteredSegments.map((seg) => ({
        text: seg.text,
        startTimeSeconds: seg.startTimeSeconds,
        endTimeSeconds: seg.endTimeSeconds,
      })),
      null,
      2
    );

    return `あなたは動画字幕の編集者です。
以下の文字起こしデータを、動画の字幕として表示するのに適した単位に分割してください。

## 入力データ

### 1. 単語単位データ（タイムスタンプ用）
クリップ範囲: ${input.clipStartSeconds}秒 〜 ${input.clipEndSeconds}秒
\`\`\`json
${segmentsJson}
\`\`\`

### 2. 校正済みテキスト（文字参照用）
\`\`\`
${input.refinedFullText}
\`\`\`

## 出力形式
以下のJSON形式で出力してください。JSONのみを出力し、他のテキストは含めないでください。
**重要: タイムスタンプは入力データと同じ絶対時間（元動画の時間）で指定してください。**

例（クリップ範囲が120秒〜150秒の場合）:
\`\`\`json
{
  "segments": [
    {
      "lines": ["今日はとても"],
      "startTimeSeconds": 120.04,
      "endTimeSeconds": 122.5
    },
    {
      "lines": ["良い天気ですね", "皆さん"],
      "startTimeSeconds": 122.5,
      "endTimeSeconds": 125.2
    }
  ]
}
\`\`\`

## ルール
1. **1行は${SUBTITLE_MAX_CHARS_PER_LINE}文字以内にすること（厳守）**
2. **1セグメントは最大${SUBTITLE_MAX_LINES}行まで（厳守）**
3. **句読点（、。）は入れないこと** - 字幕なので句読点は不要
4. 文の切れ目、意味の区切りで分割する
5. テキストは「校正済みテキスト」を参考に決定する（漢字変換が正しい）
6. **タイムスタンプは入力の「単語単位データ」と同じ絶対時間で指定する**（相対時間ではない）
7. 読みやすさを優先し、1画面に表示する量を適切に調整する
8. セグメントは時系列順に並べる
9. 隣接するセグメントのタイムスタンプは連続させる（endTimeSecondsと次のstartTimeSecondsは同じか近い値）
10. 長い文は適切に2行に分割するか、複数のセグメントに分ける`;
  }

  /**
   * LLMのレスポンスをパースしてClipSubtitleSegment配列に変換
   * LLMは元動画の絶対時間で返すため、クリップ内相対時間に変換する
   *
   * @param response LLMからのレスポンス
   * @param clipStartSeconds クリップの開始時間（元動画の絶対時間）
   */
  parseResponse(response: string, clipStartSeconds: number): ClipSubtitleSegment[] {
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

      if (typeof seg.startTimeSeconds !== 'number') {
        throw new Error(`Invalid segment at index ${index}: missing startTimeSeconds`);
      }
      if (typeof seg.endTimeSeconds !== 'number') {
        throw new Error(`Invalid segment at index ${index}: missing endTimeSeconds`);
      }
      if (seg.startTimeSeconds >= seg.endTimeSeconds) {
        throw new Error(
          `Invalid segment at index ${index}: startTimeSeconds must be before endTimeSeconds`
        );
      }

      // 絶対時間からクリップ内相対時間に変換
      const relativeStart = Math.max(0, seg.startTimeSeconds - clipStartSeconds);
      const relativeEnd = Math.max(0, seg.endTimeSeconds - clipStartSeconds);

      return {
        index,
        lines: seg.lines.map((line) => line.trim()),
        startTimeSeconds: relativeStart,
        endTimeSeconds: relativeEnd,
      };
    });
  }
}
