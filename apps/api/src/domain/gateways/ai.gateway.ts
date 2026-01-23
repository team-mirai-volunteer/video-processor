import type { AIClipExtractionResponse } from '@video-processor/shared';

/**
 * AI analysis request parameters
 */
export interface AnalyzeVideoParams {
  googleDriveUrl: string;
  videoTitle?: string;
  clipInstructions: string;
}

/**
 * AI gateway interface
 * Defines the contract for AI-based video analysis
 */
export interface AIGateway {
  /**
   * Analyze a video and extract clip timestamps based on instructions
   */
  analyzeVideo(params: AnalyzeVideoParams): Promise<AIClipExtractionResponse>;
}
