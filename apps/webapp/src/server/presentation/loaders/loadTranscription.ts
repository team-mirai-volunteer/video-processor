import type { GetTranscriptionResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function loadTranscription(videoId: string): Promise<GetTranscriptionResponse> {
  return getBackendClient().getTranscription(videoId);
}
