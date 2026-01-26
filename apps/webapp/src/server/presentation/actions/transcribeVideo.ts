'use server';

import type { TranscribeVideoResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function transcribeVideo(videoId: string): Promise<TranscribeVideoResponse> {
  return backendClient.transcribeVideo(videoId);
}
