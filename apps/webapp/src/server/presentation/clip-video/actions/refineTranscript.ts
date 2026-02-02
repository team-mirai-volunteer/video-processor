'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { RefineTranscriptResponse } from '@video-processor/shared';

export async function refineTranscript(videoId: string): Promise<RefineTranscriptResponse> {
  return getBackendClient().refineTranscript(videoId);
}
