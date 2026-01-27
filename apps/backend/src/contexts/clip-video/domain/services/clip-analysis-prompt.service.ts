import type { ClipExtractionResponse } from '@video-processor/shared';
import type { RefinedSentence } from '../models/refined-transcription.js';

export interface ClipAnalysisPromptParams {
  refinedTranscription: {
    fullText: string;
    sentences: RefinedSentence[];
    durationSeconds: number;
  };
  videoTitle: string | null;
  clipInstructions: string;
  /** true=複数クリップを許可, false=単一クリップのみ (デフォルト: false) */
  multipleClips?: boolean;
}

/**
 * Service for building AI prompts and parsing responses for clip analysis
 */
export class ClipAnalysisPromptService {
  /**
   * Build a prompt for AI to analyze transcription and select clips
   */
  buildPrompt(params: ClipAnalysisPromptParams): string {
    const { refinedTranscription, videoTitle, clipInstructions, multipleClips = false } = params;

    const transcriptionText = this.formatTranscriptionForPrompt(refinedTranscription.sentences);

    // 単一/複数クリップに応じた注意事項を生成
    const clipCountInstruction = multipleClips
      ? '- ユーザーの指示に基づいて、必要に応じて複数のクリップを抽出してください'
      : '- 必ず1つのクリップのみを抽出してください。ユーザーの指示全体をもれなく含むような範囲を1つのクリップとして抽出してください';

    return `あなたは動画編集アシスタントです。
以下の文字起こしデータを分析し、ユーザーの指示に基づいて切り抜くべき箇所を特定してください。

## 動画情報
- タイトル: ${videoTitle ?? '不明'}
- 総時間: ${refinedTranscription.durationSeconds}秒

## 文字起こし（タイムスタンプ付き、単位: 秒）
${transcriptionText}

## ユーザーの切り抜き指示
${clipInstructions}

## 出力形式
以下のJSON形式で、切り抜くべき箇所を出力してください。
startTimeSeconds/endTimeSecondsは上記の文字起こしのタイムスタンプ（秒）を参照して正確に指定してください。

\`\`\`json
{
  "clips": [
    {
      "title": "クリップの簡潔なタイトル",
      "startTimeSeconds": 0.08,
      "endTimeSeconds": 3.12,
      "transcript": "このクリップ内での発言内容",
      "reason": "この箇所を選んだ理由"
    }
  ]
}
\`\`\`

## 注意事項
- 動画の総時間は${refinedTranscription.durationSeconds}秒です。startTimeSeconds/endTimeSecondsは必ずこの範囲内（0〜${refinedTranscription.durationSeconds}）で指定してください
- 発言の途中で切れないよう、タイムスタンプを参照して自然な区切りを選んでください
- transcriptは文字起こしデータからそのまま抜粋してください
- 必ずJSON形式で出力してください
${clipCountInstruction}`;
  }

  /**
   * Parse AI response to extract clip data
   */
  parseResponse(response: string): ClipExtractionResponse {
    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1]?.trim() : response.trim();

    if (!jsonString) {
      throw new Error('Failed to extract JSON from AI response');
    }

    try {
      const parsed = JSON.parse(jsonString) as ClipExtractionResponse;

      // Validate structure
      if (!parsed.clips || !Array.isArray(parsed.clips)) {
        throw new Error('Invalid response structure: missing clips array');
      }

      // Validate each clip
      for (const clip of parsed.clips) {
        if (
          !clip.title ||
          typeof clip.startTimeSeconds !== 'number' ||
          typeof clip.endTimeSeconds !== 'number'
        ) {
          throw new Error('Invalid clip data: missing required fields');
        }
      }

      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Format refined sentences for prompt
   */
  private formatTranscriptionForPrompt(sentences: RefinedSentence[]): string {
    return sentences
      .map((sentence) => {
        return `[${sentence.startTimeSeconds}秒 - ${sentence.endTimeSeconds}秒] ${sentence.text}`;
      })
      .join('\n');
  }
}
