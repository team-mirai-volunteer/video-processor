import type { ClipSubtitleSegment } from '@clip-video/domain/models/clip-subtitle.js';
import type { TranscriptionSegment } from '@clip-video/domain/models/transcription.js';

/**
 * LLMからのレスポンス形式
 */
export interface SubtitleSegmentationResponse {
  segments: Array<{
    text: string;
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
\`\`\`json
{
  "segments": [
    {
      "text": "字幕テキスト1",
      "startTimeSeconds": 0.04,
      "endTimeSeconds": 1.5
    },
    {
      "text": "字幕テキスト2",
      "startTimeSeconds": 1.5,
      "endTimeSeconds": 3.2
    }
  ]
}
\`\`\`

## ルール
1. 1セグメントは15〜25文字程度を目安にする
2. 文の切れ目、句読点、意味の区切りで分割する
3. テキストは「校正済みテキスト」を参考に決定する（漢字変換が正しい）
4. タイムスタンプは「単語単位データ」から計算する（精度が高い）
5. 読みやすさを優先し、1画面に表示する量を適切に調整する
6. セグメントは時系列順に並べる
7. 隣接するセグメントのタイムスタンプは連続させる（endTimeSecondsと次のstartTimeSecondsは同じか近い値）`;
  }

  /**
   * LLMのレスポンスをパースしてClipSubtitleSegment配列に変換
   */
  parseResponse(response: string): ClipSubtitleSegment[] {
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
      if (typeof seg.text !== 'string' || seg.text.trim() === '') {
        throw new Error(`Invalid segment at index ${index}: missing or empty text`);
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

      return {
        index,
        text: seg.text.trim(),
        startTimeSeconds: seg.startTimeSeconds,
        endTimeSeconds: seg.endTimeSeconds,
      };
    });
  }
}
