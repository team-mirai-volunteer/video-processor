'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { ExtractAudioResponse } from '@video-processor/shared';

export async function extractAudio(videoId: string): Promise<ExtractAudioResponse> {
  return getBackendClient().extractAudio(videoId);
}
