import type { GetRefinedTranscriptionResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function loadRefinedTranscription(
  videoId: string
): Promise<GetRefinedTranscriptionResponse | null> {
  return backendClient.getRefinedTranscription(videoId);
}
