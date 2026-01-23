import type { AIClipExtractionResponse } from '@video-processor/shared';
import type { AIGateway, AnalyzeVideoParams } from '../../domain/gateways/ai.gateway.js';

/**
 * Gemini client configuration
 */
export interface GeminiClientConfig {
  apiKey?: string;
  model?: string;
}

/**
 * Timestamp extraction prompt template
 */
const TIMESTAMP_EXTRACTION_PROMPT = `
あなたは動画編集アシスタントです。
以下のGoogle Drive動画を分析し、ユーザーの指示に基づいて切り抜くべき箇所を特定してください。

## 動画情報
- URL: {googleDriveUrl}
- タイトル: {videoTitle}

## ユーザーの切り抜き指示
{clipInstructions}

## 出力形式
以下のJSON形式で、切り抜くべき箇所を出力してください。
各クリップは20秒〜60秒程度になるようにしてください。

\`\`\`json
{
  "clips": [
    {
      "title": "クリップの簡潔なタイトル",
      "startTime": "HH:MM:SS",
      "endTime": "HH:MM:SS",
      "transcript": "このクリップ内での発言内容（文字起こし）",
      "reason": "この箇所を選んだ理由"
    }
  ]
}
\`\`\`

## 注意事項
- 各クリップは20秒〜60秒の範囲に収めてください
- 発言の途中で切れないよう、自然な区切りを選んでください
- transcriptは可能な限り正確に書き起こしてください
`;

/**
 * Gemini AI client implementation
 * Implements the AIGateway interface using Vercel AI SDK
 *
 * Note: This is a stub implementation. Replace with actual Gemini API calls.
 */
export class GeminiClient implements AIGateway {
  constructor(_config: GeminiClientConfig = {}) {
    // Configuration will be used when implementing actual Gemini API calls
    // Default model: gemini-1.5-pro
  }

  async analyzeVideo(params: AnalyzeVideoParams): Promise<AIClipExtractionResponse> {
    // TODO: Implement actual Gemini API call using Vercel AI SDK
    // import { generateText } from 'ai';
    // import { google } from '@ai-sdk/google';
    //
    // const prompt = TIMESTAMP_EXTRACTION_PROMPT
    //   .replace('{googleDriveUrl}', params.googleDriveUrl)
    //   .replace('{videoTitle}', params.videoTitle || 'Unknown')
    //   .replace('{clipInstructions}', params.clipInstructions);
    //
    // const { text } = await generateText({
    //   model: google(this.config.model),
    //   prompt,
    // });
    //
    // const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    // if (jsonMatch) {
    //   return JSON.parse(jsonMatch[1]);
    // }

    console.log(`[GeminiClient] Analyzing video: ${params.googleDriveUrl}`);
    console.log(`[GeminiClient] Instructions: ${params.clipInstructions}`);
    console.log(`[GeminiClient] Using prompt template:`, TIMESTAMP_EXTRACTION_PROMPT.substring(0, 100) + '...');

    // Stub implementation - return sample data
    return {
      clips: [
        {
          title: '自己紹介',
          startTime: '00:00:10',
          endTime: '00:00:55',
          transcript: 'こんにちは、本日はご視聴いただきありがとうございます。',
          reason: '冒頭の挨拶と自己紹介部分',
        },
        {
          title: 'メインコンテンツ',
          startTime: '00:05:30',
          endTime: '00:06:15',
          transcript: 'これが本日お伝えしたい内容のポイントになります。',
          reason: 'ユーザーが指定した重要なポイント部分',
        },
      ],
    };
  }
}
