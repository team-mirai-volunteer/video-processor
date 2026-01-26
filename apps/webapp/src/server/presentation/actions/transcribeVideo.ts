'use server';

import type { TranscribeVideoResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function transcribeVideo(videoId: string): Promise<TranscribeVideoResponse> {
  return getBackendClient().transcribeVideo(videoId);
}
