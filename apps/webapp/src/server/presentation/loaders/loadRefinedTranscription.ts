import type { GetRefinedTranscriptionResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function loadRefinedTranscription(
  videoId: string
): Promise<GetRefinedTranscriptionResponse | null> {
  return getBackendClient().getRefinedTranscription(videoId, { revalidate: false });
}
