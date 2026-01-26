'use server';

import type { TranscribeAudioResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function transcribeAudio(videoId: string): Promise<TranscribeAudioResponse> {
  return getBackendClient().transcribeAudio(videoId);
}
