'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { TranscribeAudioResponse } from '@video-processor/shared';

export async function transcribeAudio(videoId: string): Promise<TranscribeAudioResponse> {
  return getBackendClient().transcribeAudio(videoId);
}
