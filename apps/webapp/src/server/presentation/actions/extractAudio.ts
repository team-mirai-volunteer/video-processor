'use server';

import type { ExtractAudioResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function extractAudio(videoId: string): Promise<ExtractAudioResponse> {
  return getBackendClient().extractAudio(videoId);
}
