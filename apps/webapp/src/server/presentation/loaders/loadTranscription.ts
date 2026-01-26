import type { GetTranscriptionResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function loadTranscription(videoId: string): Promise<GetTranscriptionResponse> {
  return backendClient.getTranscription(videoId);
}
