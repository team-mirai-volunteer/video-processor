'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { TranscribeVideoResponse } from '@video-processor/shared';

export async function transcribeVideo(videoId: string): Promise<TranscribeVideoResponse> {
  return getBackendClient().transcribeVideo(videoId);
}
