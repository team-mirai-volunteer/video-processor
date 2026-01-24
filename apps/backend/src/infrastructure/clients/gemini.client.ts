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

/**
 * Gemini AI client implementation
 * Note: This is a placeholder implementation.
 * In production, this would use the Gemini API via Vercel AI SDK or Google AI SDK.
 */
export class GeminiClient implements AiGateway {
  async analyzeVideo(params: AnalyzeVideoParams): Promise<ClipExtractionResponse> {
    // Build prompt (used in actual implementation)
    // const prompt = TIMESTAMP_EXTRACTION_PROMPT.replace(
    //   '{googleDriveUrl}',
    //   params.googleDriveUrl
    // )
    //   .replace('{videoTitle}', params.videoTitle ?? 'Unknown')
    //   .replace('{clipInstructions}', params.clipInstructions);

    // TODO: Implement actual Gemini API call
    // Example using @google/generative-ai:
    // const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    // const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    // const result = await model.generateContent([
    //   { fileData: { mimeType: 'video/mp4', fileUri: googleDriveUrl } },
    //   { text: prompt },
    // ]);
    // const response = result.response.text();
    // Parse JSON from response

    throw new Error(`Gemini API not configured. Cannot analyze video: ${params.googleDriveUrl}`);
  }
}
