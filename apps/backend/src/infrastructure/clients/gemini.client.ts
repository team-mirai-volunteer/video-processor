import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ClipExtractionResponse } from '@video-processor/shared';
import type { AiGateway, AnalyzeVideoParams } from '../../domain/gateways/ai.gateway.js';

/**
 * Prompt template for timestamp extraction
 * Exported for use in actual implementation
 */
export const TIMESTAMP_EXTRACTION_PROMPT = `
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

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;
}

/**
 * Gemini AI client implementation
 * Uses Google Generative AI SDK to analyze videos and extract clip timestamps
 */
export class GeminiClient implements AiGateway {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(config: GeminiClientConfig) {
    if (!config.apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model ?? 'gemini-1.5-flash';
  }

  /**
   * Create a GeminiClient from environment variables
   * @throws Error if GOOGLE_GENERATIVE_AI_API_KEY is not set
   */
  static fromEnv(): GeminiClient {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
    }
    return new GeminiClient({
      apiKey,
      model: process.env.GEMINI_MODEL,
    });
  }

  async analyzeVideo(params: AnalyzeVideoParams): Promise<ClipExtractionResponse> {
    const prompt = this.buildPrompt(params);
    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return this.parseResponse(text);
  }

  /**
   * Build the prompt from parameters
   */
  private buildPrompt(params: AnalyzeVideoParams): string {
    return TIMESTAMP_EXTRACTION_PROMPT.replace('{googleDriveUrl}', params.googleDriveUrl)
      .replace('{videoTitle}', params.videoTitle ?? 'Unknown')
      .replace('{clipInstructions}', params.clipInstructions);
  }

  /**
   * Parse the Gemini response to extract ClipExtractionResponse
   */
  private parseResponse(text: string): ClipExtractionResponse {
    // Extract JSON from markdown code block if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = jsonMatch?.[1]?.trim() ?? text.trim();

    try {
      const parsed = JSON.parse(jsonString);

      // Validate the response structure
      if (!parsed.clips || !Array.isArray(parsed.clips)) {
        throw new Error('Invalid response: missing clips array');
      }

      // Validate each clip
      for (const clip of parsed.clips) {
        if (
          typeof clip.title !== 'string' ||
          typeof clip.startTime !== 'string' ||
          typeof clip.endTime !== 'string' ||
          typeof clip.transcript !== 'string' ||
          typeof clip.reason !== 'string'
        ) {
          throw new Error('Invalid response: clip missing required fields');
        }

        // Validate time format (HH:MM:SS)
        const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
        if (!timeRegex.test(clip.startTime) || !timeRegex.test(clip.endTime)) {
          throw new Error(
            `Invalid time format: startTime=${clip.startTime}, endTime=${clip.endTime}`
          );
        }
      }

      return parsed as ClipExtractionResponse;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse Gemini response as JSON: ${text.substring(0, 200)}`);
      }
      throw error;
    }
  }
}
