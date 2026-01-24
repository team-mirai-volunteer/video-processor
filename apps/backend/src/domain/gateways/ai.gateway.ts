import type { ClipExtractionResponse } from '@video-processor/shared';

export interface AnalyzeVideoParams {
  googleDriveUrl: string;
  videoTitle: string | null;
  clipInstructions: string;
}

export interface AiGateway {
  /**
   * Analyze video and extract clip timestamps
   */
  analyzeVideo(params: AnalyzeVideoParams): Promise<ClipExtractionResponse>;
}
