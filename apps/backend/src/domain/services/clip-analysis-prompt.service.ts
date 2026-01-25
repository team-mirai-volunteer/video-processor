import type { ClipExtractionResponse } from '@video-processor/shared';
import type { TranscriptionResult } from '../gateways/transcription.gateway.js';

export interface ClipAnalysisPromptParams {
  transcription: TranscriptionResult;
  videoTitle: string | null;
  clipInstructions: string;
}

/**
 * Service for building AI prompts and parsing responses for clip analysis
 */
export class ClipAnalysisPromptService {
  /**
   * Build a prompt for AI to analyze transcription and select clips
   */
  buildPrompt(params: ClipAnalysisPromptParams): string {
    const { transcription, videoTitle, clipInstructions } = params;

    const transcriptionText = this.formatTranscriptionForPrompt(transcription);

    return `あなたは動画編集アシスタントです。
以下の文字起こしデータを分析し、ユーザーの指示に基づいて切り抜くべき箇所を特定してください。

## 動画情報
- タイトル: ${videoTitle ?? '不明'}
- 総時間: ${transcription.durationSeconds}秒

## 文字起こし（タイムスタンプ付き）
${transcriptionText}

## ユーザーの切り抜き指示
${clipInstructions}

## 出力形式
以下のJSON形式で、切り抜くべき箇所を出力してください。
各クリップは20秒〜60秒程度になるようにしてください。
startTime/endTimeは文字起こしのタイムスタンプを参照して正確に指定してください。

\`\`\`json
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
\`\`\`

## 注意事項
- 各クリップは20秒〜60秒の範囲に収めてください
- 発言の途中で切れないよう、タイムスタンプを参照して自然な区切りを選んでください
- transcriptは文字起こしデータからそのまま抜粋してください
- 必ずJSON形式で出力してください`;
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
        if (!clip.title || !clip.startTime || !clip.endTime) {
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
   * Format transcription segments for prompt
   */
  private formatTranscriptionForPrompt(transcription: TranscriptionResult): string {
    return transcription.segments
      .map((segment) => {
        const startTime = this.formatTimeForDisplay(segment.startTimeSeconds);
        const endTime = this.formatTimeForDisplay(segment.endTimeSeconds);
        return `[${startTime} - ${endTime}] ${segment.text}`;
      })
      .join('\n');
  }

  /**
   * Format seconds to MM:SS.ss display format
   */
  private formatTimeForDisplay(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  }
}
