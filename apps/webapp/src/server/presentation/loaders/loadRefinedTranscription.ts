import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetRefinedTranscriptionResponse } from '@video-processor/shared';

export async function loadRefinedTranscription(
  videoId: string
): Promise<GetRefinedTranscriptionResponse | null> {
  return getBackendClient().getRefinedTranscription(videoId, { revalidate: false });
}
