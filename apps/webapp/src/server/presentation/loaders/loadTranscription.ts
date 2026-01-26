import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetTranscriptionResponse } from '@video-processor/shared';

export async function loadTranscription(videoId: string): Promise<GetTranscriptionResponse> {
  return getBackendClient().getTranscription(videoId, { revalidate: false });
}
